"""
PRD 模块四 · 出价 (Offer) 服务。

要点：
  - 出价 24h TTL，过期由 cron 清理
  - 双向议价：买家可对卖家的 counter 继续 accept/reject/counter
  - 接受 offer 时调用 OrderService.create_order_from_listing(override_price_cents=...)
  - 创建 / 接受 / 拒绝 / 还价 / 撤回 时自动开聊天会话并推送 offer 富媒体卡片
  - List 接口附带商品 / 对手方摘要，前端无需 N+1
"""
from __future__ import annotations

import json
from typing import Optional, List, Tuple
from datetime import datetime, timedelta

from app.db.supabase import get_supabase_admin, execute_with_retry
from app.schemas.orders import Offer, OfferStatus
from app.services.order_service import order_service


OFFER_TTL_HOURS = 24


def _extract_avatar(user_row: dict) -> Optional[str]:
    """从 `users` join `user_info(avatar_url)` 的结果里掏出 avatar.

    PostgREST 嵌套关系既可能返回 dict (一对一) 也可能返回 list[dict] (一对多 / 多结果),
    follow_service / buyer_store_community_service 里也都得这样兼容，
    在这里集中处理一次。
    """
    info = user_row.get("user_info") if user_row else None
    if isinstance(info, list):
        info = info[0] if info else None
    if isinstance(info, dict):
        url = info.get("avatar_url")
        return url or None
    return None


class OfferService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()
        # 懒加载 chat_service，避免循环 import
        self._chat = None

    # ---------------------------------------------------------------- chat

    def _get_chat(self):
        if self._chat is None:
            from app.services.chat_service import ChatService
            self._chat = ChatService()
        return self._chat

    def _resolve_seller_user_id(self, offer: dict) -> Optional[int]:
        """优先用 seller_user_id；merchant 卖家时回退到 merchant.user_id。"""
        if offer.get("seller_user_id"):
            return offer["seller_user_id"]
        merchant_id = offer.get("seller_merchant_id")
        if merchant_id:
            try:
                from app.services.store_merchant_service import store_merchant_service
                merchant = store_merchant_service.get_merchant_by_id(merchant_id)
                if merchant:
                    return getattr(merchant, "userId", None)
            except Exception:
                return None
        return None

    def _get_product_brief(self, product_id: int) -> dict:
        res = (
            self.db.table("store_products")
            .select("id, title, brand, price_cents, images, currency")
            .eq("id", product_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return {}
        row = res.data[0]
        images = row.get("images") or []
        return {
            "productId": row["id"],
            "title": row.get("title"),
            "brand": row.get("brand"),
            "priceCents": row.get("price_cents"),
            "currency": row.get("currency", "CNY"),
            "coverImage": images[0] if images else None,
        }

    def _get_user_brief(self, user_id: Optional[int]) -> dict:
        if not user_id:
            return {}
        try:
            res = (
                self.db.table("users")
                .select("id, username, user_info(avatar_url)")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            if res.data:
                row = res.data[0]
                return {
                    "userId": row["id"],
                    "username": row.get("username"),
                    "avatarUrl": _extract_avatar(row),
                }
        except Exception:
            pass
        return {}

    def _send_offer_card(
        self,
        offer_row: dict,
        actor_user_id: int,
        counterpart_user_id: int,
    ) -> None:
        """开会话 + 发送 offer 富媒体卡片。失败静默，避免影响主流程。"""
        try:
            chat = self._get_chat()
            conv_id = chat.create_conversation(actor_user_id, counterpart_user_id)
            product = self._get_product_brief(offer_row["product_id"])
            payload = {
                "offerId": offer_row["id"],
                "productId": offer_row["product_id"],
                "priceCents": offer_row["price_cents"],
                "status": offer_row["status"],
                "expiresAt": offer_row.get("expires_at"),
                "parentOfferId": offer_row.get("parent_offer_id"),
                "product": product or None,
            }
            push_title = self._offer_push_title(offer_row.get("status") or "")
            chat.send_message(
                conversation_id=conv_id,
                sender_id=actor_user_id,
                content=json.dumps(payload, ensure_ascii=False),
                message_type="offer",
                send_push=True,
                push_title=push_title,
                push_navigate_to="StoreProductDetail",
                push_navigate_params={"productId": offer_row["product_id"]},
            )
        except Exception as e:
            print(f"[offer_service] send offer card failed: {e}")

    @staticmethod
    def _offer_push_title(status: str) -> str:
        """给出价类 push 选一段中文标题（让 banner 一眼可读）。"""
        if status == "pending":
            return "收到新出价"
        if status == "accepted":
            return "出价已接受"
        if status == "rejected":
            return "出价已拒绝"
        if status == "countered":
            return "对方还价了"
        if status == "withdrawn":
            return "出价已撤回"
        if status == "expired":
            return "出价已过期"
        return "出价更新"

    # --------------------------------------------------------- format / chain

    @staticmethod
    def _format(row: dict) -> Offer:
        return Offer(
            id=row["id"],
            productId=row["product_id"],
            buyerUserId=row["buyer_user_id"],
            sellerUserId=row.get("seller_user_id"),
            sellerMerchantId=row.get("seller_merchant_id"),
            priceCents=row["price_cents"],
            currency=row.get("currency", "CNY"),
            message=row.get("message"),
            status=row["status"],
            parentOfferId=row.get("parent_offer_id"),
            expiresAt=row.get("expires_at"),
            resolvedAt=row.get("resolved_at"),
            createdAt=row.get("created_at"),
        )

    def _chain_depth(self, offer: dict) -> int:
        """parent_offer_id 链长。0 = 买家原始出价；1 = 卖家 counter；2 = 买家 counter…"""
        depth = 0
        cur_parent = offer.get("parent_offer_id")
        while cur_parent and depth < 32:
            depth += 1
            res = (
                self.db.table("offers")
                .select("parent_offer_id")
                .eq("id", cur_parent)
                .limit(1)
                .execute()
            )
            if not res.data:
                break
            cur_parent = res.data[0].get("parent_offer_id")
        return depth

    def _initiator_role(self, offer: dict) -> str:
        """谁创建了这条 offer（buyer / seller）。链深度偶数 → buyer。"""
        return "buyer" if self._chain_depth(offer) % 2 == 0 else "seller"

    def _responder_role(self, offer: dict) -> str:
        """谁应该响应这条 pending offer。和 initiator 相反。"""
        return "seller" if self._initiator_role(offer) == "buyer" else "buyer"

    def _assert_responder(self, offer: dict, actor_user_id: Optional[int]) -> None:
        """actor 必须是当前 offer 的「响应方」。"""
        if actor_user_id is None:
            raise PermissionError("未登录")
        role = self._responder_role(offer)
        if role == "buyer":
            if offer["buyer_user_id"] != actor_user_id:
                raise PermissionError("仅买家可操作此出价")
        else:
            seller_uid = offer.get("seller_user_id")
            if seller_uid is not None and seller_uid == actor_user_id:
                return
            merchant_id = offer.get("seller_merchant_id")
            if merchant_id:
                from app.services.store_merchant_service import store_merchant_service
                merchant = store_merchant_service.get_merchant_by_id(merchant_id)
                if merchant and getattr(merchant, "userId", None) == actor_user_id:
                    return
            raise PermissionError("仅卖家可操作此出价")

    # ---------------------------------------------------------------- mutations

    def create(
        self,
        *,
        product_id: int,
        buyer_user_id: int,
        price_cents: int,
        message: Optional[str] = None,
    ) -> Offer:
        prod = (
            self.db.table("store_products")
            .select("id, status, accept_offer, seller_user_id, merchant_id")
            .eq("id", product_id)
            .limit(1)
            .execute()
        )
        if not prod.data:
            raise ValueError("商品不存在")
        row = prod.data[0]
        if row.get("status") != "active":
            raise ValueError("商品当前不可出价")
        if not row.get("accept_offer", True):
            raise ValueError("卖家未开放出价")
        if row.get("seller_user_id") == buyer_user_id:
            raise ValueError("不能对自己的商品出价")

        expires_at = (datetime.utcnow() + timedelta(hours=OFFER_TTL_HOURS)).isoformat()
        payload = {
            "product_id": product_id,
            "buyer_user_id": buyer_user_id,
            "seller_user_id": row.get("seller_user_id"),
            "seller_merchant_id": row.get("merchant_id"),
            "price_cents": price_cents,
            "message": message,
            "status": "pending",
            "expires_at": expires_at,
        }
        res = self.db.table("offers").insert(payload).execute()
        if not res.data:
            raise RuntimeError("创建出价失败")

        created = res.data[0]
        seller_uid = self._resolve_seller_user_id(created)
        if seller_uid and seller_uid != buyer_user_id:
            self._send_offer_card(created, buyer_user_id, seller_uid)

        return self._format(created)

    def _get_or_raise(self, offer_id: int) -> dict:
        res = self.db.table("offers").select("*").eq("id", offer_id).limit(1).execute()
        if not res.data:
            raise ValueError("出价不存在")
        return res.data[0]

    def withdraw(self, offer_id: int, actor_user_id: int) -> Offer:
        """initiator（最近一次出价的创建者）可以撤回。"""
        offer = self._get_or_raise(offer_id)
        if offer["status"] != "pending":
            raise ValueError("当前出价不可撤回")
        initiator = self._initiator_role(offer)
        if initiator == "buyer":
            if offer["buyer_user_id"] != actor_user_id:
                raise PermissionError("只有买家可撤回此出价")
        else:
            seller_uid = self._resolve_seller_user_id(offer)
            if seller_uid != actor_user_id:
                raise PermissionError("只有卖家可撤回此出价")
        self.db.table("offers").update(
            {"status": "withdrawn", "resolved_at": datetime.utcnow().isoformat()}
        ).eq("id", offer_id).execute()
        updated = {**offer, "status": "withdrawn"}

        # 通知对手方
        counterpart = self._resolve_seller_user_id(offer) if initiator == "buyer" else offer["buyer_user_id"]
        if counterpart:
            self._send_offer_card(updated, actor_user_id, counterpart)
        return self._format(updated)

    def reject(self, offer_id: int, actor_user_id: Optional[int]) -> Offer:
        offer = self._get_or_raise(offer_id)
        self._assert_responder(offer, actor_user_id)
        if offer["status"] != "pending":
            raise ValueError("当前出价不可拒绝")
        self.db.table("offers").update(
            {"status": "rejected", "resolved_at": datetime.utcnow().isoformat()}
        ).eq("id", offer_id).execute()
        updated = {**offer, "status": "rejected"}

        # 通知对手方（initiator）
        initiator = self._initiator_role(offer)
        counterpart = offer["buyer_user_id"] if initiator == "buyer" else self._resolve_seller_user_id(offer)
        if counterpart:
            self._send_offer_card(updated, actor_user_id, counterpart)
        return self._format(updated)

    def counter(
        self,
        offer_id: int,
        actor_user_id: Optional[int],
        *,
        price_cents: int,
        message: Optional[str] = None,
    ) -> Offer:
        offer = self._get_or_raise(offer_id)
        self._assert_responder(offer, actor_user_id)
        if offer["status"] != "pending":
            raise ValueError("当前出价不可还价")
        now = datetime.utcnow().isoformat()
        self.db.table("offers").update(
            {"status": "countered", "resolved_at": now}
        ).eq("id", offer_id).execute()

        new_payload = {
            "product_id": offer["product_id"],
            "buyer_user_id": offer["buyer_user_id"],
            "seller_user_id": offer.get("seller_user_id"),
            "seller_merchant_id": offer.get("seller_merchant_id"),
            "price_cents": price_cents,
            "message": message,
            "status": "pending",
            "parent_offer_id": offer["id"],
            "expires_at": (datetime.utcnow() + timedelta(hours=OFFER_TTL_HOURS)).isoformat(),
        }
        res = self.db.table("offers").insert(new_payload).execute()
        if not res.data:
            raise RuntimeError("还价生成失败")
        created = res.data[0]

        # 通知对手方
        initiator = self._initiator_role(offer)
        counterpart = offer["buyer_user_id"] if initiator == "buyer" else self._resolve_seller_user_id(offer)
        if counterpart:
            self._send_offer_card(created, actor_user_id, counterpart)
        return self._format(created)

    def accept(self, offer_id: int, actor_user_id: Optional[int]):
        """响应方接受 offer：标记 accepted + 创建订单（买家需补完支付）。"""
        offer = self._get_or_raise(offer_id)
        self._assert_responder(offer, actor_user_id)
        if offer["status"] != "pending":
            raise ValueError("当前出价不可接受")
        order, hold = order_service.create_order_from_listing(
            product_id=offer["product_id"],
            buyer_user_id=offer["buyer_user_id"],
            offer_id=offer["id"],
            override_price_cents=offer["price_cents"],
        )
        self.db.table("offers").update(
            {"status": "accepted", "resolved_at": datetime.utcnow().isoformat()}
        ).eq("id", offer_id).execute()
        updated = {**offer, "status": "accepted"}

        # 通知对手方 offer 已被接受。
        # 注意:订单本身的 pending_payment 卡片已经由
        # ``order_service.create_order_from_listing → _notify_both_parties`` 发出
        # (seller → buyer),这里不要再发一张 order_status 卡,避免双卡。
        initiator = self._initiator_role(offer)
        counterpart = offer["buyer_user_id"] if initiator == "buyer" else self._resolve_seller_user_id(offer)
        if counterpart:
            self._send_offer_card(updated, actor_user_id, counterpart)
        return order, hold, self._format(updated)

    # ------------------------------------------------------------ legacy alias

    def _assert_seller(self, offer: dict, actor_user_id: Optional[int]) -> None:
        """兼容旧调用方：保留旧 API（直接转 _assert_responder）。"""
        self._assert_responder(offer, actor_user_id)

    # ---------------------------------------------------------------- queries

    def list_for_user(
        self,
        user_id: int,
        *,
        role: str = "buyer",
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Offer], int]:
        q = self.db.table("offers").select("*", count="exact")
        if role == "buyer":
            q = q.eq("buyer_user_id", user_id)
        elif role == "seller":
            # 卖家身份既可能是 C2C (seller_user_id) 也可能是买手店 owner (seller_merchant_id).
            # 用 PostgREST 的 or= 表达式把这两种来源合并查询，
            # 避免买手店收到的出价漏在「待我处理」里。
            merchant_ids: List[int] = []
            try:
                from app.services.store_merchant_service import store_merchant_service
                merchant = store_merchant_service.get_merchant_by_user(user_id)
                if merchant and getattr(merchant, "id", None):
                    merchant_ids.append(int(merchant.id))
            except Exception:
                pass

            if merchant_ids:
                # PostgREST 不接受 IN 在 or 内的列表写法，单值时直接 eq，多值时拼 in.
                merchant_clause = (
                    f"seller_merchant_id.eq.{merchant_ids[0]}"
                    if len(merchant_ids) == 1
                    else f"seller_merchant_id.in.({','.join(str(m) for m in merchant_ids)})"
                )
                q = q.or_(f"seller_user_id.eq.{user_id},{merchant_clause}")
            else:
                q = q.eq("seller_user_id", user_id)
        if status:
            q = q.eq("status", status)
        q = q.order("created_at", desc=True)
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = execute_with_retry(lambda: q.execute(), label="offers.list")
        return [self._format(r) for r in (res.data or [])], (res.count or 0)

    def list_for_user_enriched(
        self,
        user_id: int,
        *,
        role: str = "buyer",
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[dict], int]:
        """带 product / counterparty / responder 摘要的列表，专给 MyOffers UI 用。"""
        items, total = self.list_for_user(
            user_id, role=role, status=status, page=page, page_size=page_size
        )

        # 批量预取 product / user
        product_ids = list({o.productId for o in items})
        prod_map: dict = {}
        if product_ids:
            res = (
                self.db.table("store_products")
                .select("id, title, brand, price_cents, images, currency")
                .in_("id", product_ids)
                .execute()
            )
            for row in res.data or []:
                images = row.get("images") or []
                prod_map[row["id"]] = {
                    "productId": row["id"],
                    "title": row.get("title"),
                    "brand": row.get("brand"),
                    "priceCents": row.get("price_cents"),
                    "currency": row.get("currency", "CNY"),
                    "coverImage": images[0] if images else None,
                }

        user_ids = set()
        for o in items:
            user_ids.add(o.buyerUserId)
            if o.sellerUserId:
                user_ids.add(o.sellerUserId)
        user_ids.discard(None)
        user_map: dict = {}
        if user_ids:
            res = (
                self.db.table("users")
                .select("id, username, user_info(avatar_url)")
                .in_("id", list(user_ids))
                .execute()
            )
            for row in res.data or []:
                user_map[row["id"]] = {
                    "userId": row["id"],
                    "username": row.get("username"),
                    "avatarUrl": _extract_avatar(row),
                }

        # 拿到所有 offer 的原始行，用来算 chain depth
        raw_map: dict = {}
        if items:
            ids = [o.id for o in items]
            res = (
                self.db.table("offers")
                .select("id, parent_offer_id, buyer_user_id, seller_user_id, seller_merchant_id")
                .in_("id", ids)
                .execute()
            )
            for row in res.data or []:
                raw_map[row["id"]] = row

        enriched: List[dict] = []
        for o in items:
            d = o.dict()
            d["product"] = prod_map.get(o.productId)
            d["buyer"] = user_map.get(o.buyerUserId)
            d["seller"] = user_map.get(o.sellerUserId) if o.sellerUserId else None

            raw = raw_map.get(o.id) or {}
            initiator = "buyer"
            try:
                if raw:
                    initiator = self._initiator_role(raw)
            except Exception:
                pass
            d["initiatorRole"] = initiator
            d["responderRole"] = "seller" if initiator == "buyer" else "buyer"

            # 当前用户能做哪些操作（前端用来显隐按钮）
            actions: List[str] = []
            if o.status == "pending":
                if d["responderRole"] == "buyer" and o.buyerUserId == user_id:
                    actions = ["accept", "reject", "counter"]
                elif d["responderRole"] == "seller":
                    # 用户是 seller 的两种情况：seller_user_id 或 merchant
                    seller_uid = raw.get("seller_user_id")
                    if seller_uid == user_id:
                        actions = ["accept", "reject", "counter"]
                    elif raw.get("seller_merchant_id"):
                        try:
                            from app.services.store_merchant_service import store_merchant_service
                            merchant = store_merchant_service.get_merchant_by_id(raw["seller_merchant_id"])
                            if merchant and getattr(merchant, "userId", None) == user_id:
                                actions = ["accept", "reject", "counter"]
                        except Exception:
                            pass
                # initiator 可撤回
                if d["initiatorRole"] == "buyer" and o.buyerUserId == user_id:
                    actions = list(set(actions + ["withdraw"]))
                elif d["initiatorRole"] == "seller":
                    seller_uid = raw.get("seller_user_id")
                    if seller_uid == user_id:
                        actions = list(set(actions + ["withdraw"]))
            d["allowedActions"] = actions
            enriched.append(d)

        return enriched, total

    def expire_overdue(self) -> int:
        """Cron：把过期 24h 未响应的 pending offer 标记为 expired，并给双方推送提醒。"""
        now = datetime.utcnow().isoformat()
        res = (
            self.db.table("offers")
            .select("id, product_id, buyer_user_id, seller_user_id, seller_merchant_id, price_cents")
            .eq("status", "pending")
            .lt("expires_at", now)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return 0
        ids = [r["id"] for r in rows]
        self.db.table("offers").update(
            {"status": "expired", "resolved_at": now}
        ).in_("id", ids).execute()

        # 通知双方：出价 24h 未响应已过期
        try:
            from app.services.notification_service import notification_service
            from app.schemas.notification import NotificationType
            for r in rows:
                buyer_id = r.get("buyer_user_id")
                seller_uid = r.get("seller_user_id")
                if not seller_uid and r.get("seller_merchant_id"):
                    try:
                        from app.services.store_merchant_service import store_merchant_service
                        merchant = store_merchant_service.get_merchant_by_id(r["seller_merchant_id"])
                        if merchant:
                            seller_uid = getattr(merchant, "userId", None)
                    except Exception:
                        seller_uid = None
                product = self._get_product_brief(r.get("product_id")) or {}
                product_title = product.get("title") or product.get("brand") or f"商品 #{r.get('product_id')}"
                action_data = {
                    "navigateTo": "StoreProductDetail",
                    "navigateParams": {"productId": r.get("product_id")},
                }
                for uid in {buyer_id, seller_uid}:
                    if not uid:
                        continue
                    notification_service.create_notification(
                        user_id=uid,
                        notification_type=NotificationType.SYSTEM,
                        title="出价已过期",
                        message=f"「{product_title}」的出价 24 小时内未响应，已自动过期",
                        action_data=action_data,
                        send_push=True,
                    )
        except Exception as e:  # noqa: BLE001
            print(f"[offer_service] notify offer expired failed: {e}")

        return len(ids)


offer_service = OfferService()
