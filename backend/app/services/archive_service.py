"""
PRD 模块 6 · My Archive 服务。

- 订单进入 completed 时自动 snapshot 一条 user_archive_items
- 用户「一键转卖」：用 archive 数据 prefill 新 listing，落地新 product_id 后回写 relisted_*。
"""
from __future__ import annotations

from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime

from app.db.supabase import get_supabase_admin, execute_with_retry
from app.schemas.archive_plus import (
    ArchiveItem,
    ArchiveAnalytics,
    ArchiveItemManualCreate,
    ArchiveHoldingRecord,
    ArchiveHoldingCreate,
)


class ArchiveService:
    # 可被「手动转入 MY ARCHIVE」的订单状态：买家已实际拿到/完成的单。
    TRANSFERABLE_ORDER_STATUSES = {
        "delivered",
        "completed",
        "settled",
        "resolved",
    }

    def __init__(self) -> None:
        self.db = get_supabase_admin()

    @staticmethod
    def _resolve_seller_user_id(order_row: dict) -> Optional[int]:
        """C2C 取 seller_user_id；买手店卖家回退 merchant.user_id。"""
        if order_row.get("seller_user_id"):
            return order_row["seller_user_id"]
        merchant_id = order_row.get("seller_merchant_id")
        if not merchant_id:
            return None
        try:
            from app.services.store_merchant_service import store_merchant_service

            merchant = store_merchant_service.get_merchant_by_id(merchant_id)
            if merchant:
                return getattr(merchant, "userId", None)
        except Exception:
            return None
        return None

    def _product_snapshot(self, product_id: int) -> dict:
        prod_res = (
            self.db.table("store_products")
            .select(
                "id, title, brand, size, color, condition, original_show_id, images"
            )
            .eq("id", product_id)
            .limit(1)
            .execute()
        )
        return prod_res.data[0] if prod_res.data else {}

    def _insert_archive_payload(self, payload: dict) -> Optional[ArchiveItem]:
        try:
            res = self.db.table("user_archive_items").insert(payload).execute()
        except Exception as insert_err:
            if payload.pop("original_show_id", None) is not None:
                res = self.db.table("user_archive_items").insert(payload).execute()
            else:
                raise insert_err
        if not res.data:
            return None
        return self._format(res.data[0])

    @staticmethod
    def _format(row: dict) -> ArchiveItem:
        return ArchiveItem(
            id=row["id"],
            userId=row["user_id"],
            productId=row.get("product_id"),
            orderId=row.get("order_id"),
            title=row.get("title"),
            brandName=row.get("brand_name"),
            size=row.get("size"),
            color=row.get("color"),
            condition=row.get("condition"),
            originalShowId=row.get("original_show_id"),
            acquiredPriceCents=row.get("acquired_price_cents"),
            currency=row.get("currency", "CNY"),
            photos=row.get("photos") or [],
            acquiredAt=row.get("acquired_at"),
            note=row.get("note"),
            relistedProductId=row.get("relisted_product_id"),
            relistedAt=row.get("relisted_at"),
            source=row.get("source", "order"),
            storageLocation=row.get("storage_location"),
            isCurrentlyOwned=row.get("is_currently_owned", True),
            brandId=row.get("brand_id"),
            releaseYear=row.get("release_year"),
            validityStatus=row.get("validity_status", "passed"),
            aiPhotos=row.get("ai_photos") or [],
            # 090 之前建的行没有这一列，读到 None 时按 public 兜底 ——
            # 那正是它们在加列之前的实际可见性，不要凭空收紧。
            visibility=row.get("visibility") or "public",
            showRealPhotos=(
                True
                if row.get("show_real_photos") is None
                else bool(row["show_real_photos"])
            ),
            createdAt=row.get("created_at"),
            updatedAt=row.get("updated_at"),
        )

    @staticmethod
    def _format_holding(row: dict) -> ArchiveHoldingRecord:
        return ArchiveHoldingRecord(
            id=row["id"],
            archiveItemId=row["archive_item_id"],
            userId=row["user_id"],
            heldFrom=row.get("held_from"),
            heldTo=row.get("held_to"),
            status=row.get("status", "owned"),
            note=row.get("note"),
            counterpartUserId=row.get("counterpart_user_id"),
            counterpartName=row.get("counterpart_name"),
            relatedProductId=row.get("related_product_id"),
            relatedOrderId=row.get("related_order_id"),
            createdAt=row.get("created_at"),
        )

    def snapshot_from_order(self, order_id: int) -> Optional[ArchiveItem]:
        """订单完成后调用，自动生成 archive 条目。"""
        try:
            order_res = (
                self.db.table("orders")
                .select("*")
                .eq("id", order_id)
                .limit(1)
                .execute()
            )
            if not order_res.data:
                return None
            order = order_res.data[0]

            # 幂等：同一订单已入库则直接返回既有条目，避免重复 snapshot
            # （自动入库与手动「转入藏品」可能先后触发同一订单）。
            existing = (
                self.db.table("user_archive_items")
                .select("*")
                .eq("order_id", order_id)
                .eq("user_id", order["buyer_user_id"])
                .limit(1)
                .execute()
            )
            if existing.data:
                return self._format(existing.data[0])

            prod_res = (
                self.db.table("store_products")
                .select(
                    "id, title, brand, size, color, condition, original_show_id, images"
                )
                .eq("id", order["product_id"])
                .limit(1)
                .execute()
            )
            prod = prod_res.data[0] if prod_res.data else {}

            payload = {
                "user_id": order["buyer_user_id"],
                "product_id": order["product_id"],
                "order_id": order_id,
                "title": prod.get("title"),
                "brand_name": prod.get("brand"),
                "size": prod.get("size"),
                "color": prod.get("color"),
                "condition": prod.get("condition"),
                "original_show_id": prod.get("original_show_id"),
                "acquired_price_cents": order["paid_price_cents"],
                "currency": order.get("currency", "CNY"),
                "photos": prod.get("images") or [],
                "acquired_at": (order.get("completed_at") or order.get("paid_at") or datetime.utcnow().isoformat())[:10],
                "source": "order",
            }
            try:
                res = self.db.table("user_archive_items").insert(payload).execute()
            except Exception as insert_err:
                # 秀场外键失效时降级：去掉 original_show_id 再试一次。
                if payload.pop("original_show_id", None) is not None:
                    res = self.db.table("user_archive_items").insert(payload).execute()
                else:
                    raise insert_err
            if not res.data:
                return None
            return self._format(res.data[0])
        except Exception as e:
            print(f"[archive] snapshot_from_order failed: {e}")
            return None

    def snapshot_sold_from_order(
        self, order_id: int, seller_user_id: int
    ) -> Optional[ArchiveItem]:
        """卖家售出后手动/自动写入 MY ARCHIVE（已售回忆，不再持有）。"""
        try:
            order_res = (
                self.db.table("orders")
                .select("*")
                .eq("id", order_id)
                .limit(1)
                .execute()
            )
            if not order_res.data:
                return None
            order = order_res.data[0]

            existing = (
                self.db.table("user_archive_items")
                .select("*")
                .eq("order_id", order_id)
                .eq("user_id", seller_user_id)
                .limit(1)
                .execute()
            )
            if existing.data:
                return self._format(existing.data[0])

            prod = self._product_snapshot(order["product_id"])
            sold_at = (
                order.get("completed_at")
                or order.get("paid_at")
                or datetime.utcnow().isoformat()
            )[:10]

            payload = {
                "user_id": seller_user_id,
                "product_id": order["product_id"],
                "order_id": order_id,
                "title": prod.get("title"),
                "brand_name": prod.get("brand"),
                "size": prod.get("size"),
                "color": prod.get("color"),
                "condition": prod.get("condition"),
                "original_show_id": prod.get("original_show_id"),
                "acquired_price_cents": order["paid_price_cents"],
                "currency": order.get("currency", "CNY"),
                "photos": prod.get("images") or [],
                "acquired_at": sold_at,
                "source": "order",
                "is_currently_owned": False,
            }
            item = self._insert_archive_payload(payload)
            if not item:
                return None

            try:
                self.add_holding(
                    item.id,
                    seller_user_id,
                    ArchiveHoldingCreate(
                        heldFrom=sold_at,
                        status="resold",
                        note="订单售出 · 入藏",
                        counterpartUserId=order.get("buyer_user_id"),
                        relatedOrderId=order_id,
                    ),
                )
            except Exception as e:
                print(f"[archive] seller sold holding failed: {e}")
            return item
        except Exception as e:
            print(f"[archive] snapshot_sold_from_order failed: {e}")
            return None

    def get_by_order(self, order_id: int, user_id: int) -> Optional[ArchiveItem]:
        """查询某订单是否已转入当前用户的 MY ARCHIVE。"""
        res = (
            self.db.table("user_archive_items")
            .select("*")
            .eq("order_id", order_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return self._format(res.data[0])

    def transfer_from_order(self, order_id: int, user_id: int) -> ArchiveItem:
        """手动把订单相关单品转入 MY ARCHIVE（买家购入 / 卖家售出）。

        - 仅订单买家或卖家本人可操作
        - 订单需处于已收货/完成等状态
        - 幂等：已入库则返回既有条目
        """
        order_res = (
            self.db.table("orders")
            .select(
                "id, buyer_user_id, seller_user_id, seller_merchant_id, status"
            )
            .eq("id", order_id)
            .limit(1)
            .execute()
        )
        if not order_res.data:
            raise ValueError("订单不存在")
        order = order_res.data[0]
        seller_id = self._resolve_seller_user_id(order)
        is_buyer = order.get("buyer_user_id") == user_id
        is_seller = seller_id == user_id
        if not is_buyer and not is_seller:
            raise PermissionError("只能将与本订单相关的商品转入藏品")
        if order.get("status") not in self.TRANSFERABLE_ORDER_STATUSES:
            raise ValueError("该订单尚未完成收货，暂时无法转入藏品")

        existing = self.get_by_order(order_id, user_id)
        if existing:
            return existing

        if is_buyer:
            item = self.snapshot_from_order(order_id)
        else:
            item = self.snapshot_sold_from_order(order_id, seller_id)
        if not item:
            raise ValueError("转入藏品失败，请稍后重试")
        return item

    def list_for_user(
        self,
        user_id: int,
        *,
        page: int = 1,
        page_size: int = 30,
    ) -> Tuple[List[ArchiveItem], int]:
        q = (
            self.db.table("user_archive_items")
            .select("*", count="exact")
            .eq("user_id", user_id)
            .order("acquired_at", desc=True)
        )
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = execute_with_retry(lambda: q.execute(), label="archive.list")
        return [self._format(r) for r in (res.data or [])], (res.count or 0)

    @staticmethod
    def _apply_photo_display(item: ArchiveItem, *, is_owner: bool) -> ArchiveItem:
        """按 show_real_photos 决定给外人看哪些图。

        必须在这里（服务端）把实拍 URL 摘掉，而不是让前端不渲染 —— 后者
        等于把地址照发出去再请客户端自觉别看。

        没有 AI 生成图时忽略该开关：否则这件藏品对外就是一张图都没有，
        比「实拍被看到」更糟。
        """
        if is_owner or item.showRealPhotos:
            return item
        ai = [u for u in item.photos if u in set(item.aiPhotos)]
        if not ai:
            return item
        return item.copy(update={"photos": ai})

    def _authors_brief(self, user_ids: List[int]) -> Dict[int, Dict[str, Any]]:
        """批量取作者 username + 头像，供「世界」档案 feed 附带作者信息。"""
        out: Dict[int, Dict[str, Any]] = {}
        ids = list({u for u in user_ids if u})
        if not ids:
            return out
        users = (
            self.db.table("users").select("id, username").in_("id", ids).execute().data
            or []
        )
        infos = (
            self.db.table("user_info")
            .select("user_id, avatar_url")
            .in_("user_id", ids)
            .execute()
            .data
            or []
        )
        avatar_map = {i["user_id"]: i.get("avatar_url") for i in infos}
        for u in users:
            out[u["id"]] = {
                "id": u["id"],
                "username": u.get("username") or "",
                "avatarUrl": avatar_map.get(u["id"]),
            }
        return out

    def list_world(
        self,
        viewer_user_id: int,
        *,
        page: int = 1,
        page_size: int = 30,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """公开档案 feed。

        只按 visibility='public' 过滤，不再排除本人。Archive tab 已经是唯一的
        浏览入口，「我的 / 世界」拆开之后，排除自己等于公开了也无处可看。
        viewer_user_id 留着是为了以后做「已看过 / 拉黑」之类的个性化，
        现在的查询用不到它。

        返回 dict 列表（基础 archive 字段 + `author` 作者简介），
        按创建时间倒序分页。
        """
        offset = (page - 1) * page_size
        q = (
            self.db.table("user_archive_items")
            .select("*", count="exact")
            .eq("visibility", "public")
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
        )
        res = execute_with_retry(lambda: q.execute(), label="archive.world")
        rows = res.data or []
        author_map = self._authors_brief([r.get("user_id") for r in rows])
        items: List[Dict[str, Any]] = []
        for r in rows:
            item = self._format(r)
            # feed 的封面取 photos[0]，所以剥离必须在这里也做一遍，
            # 否则藏在详情页后面的实拍会从列表缩略图漏出去。
            item = self._apply_photo_display(
                item, is_owner=item.userId == viewer_user_id
            )
            data = item.dict()
            data["author"] = author_map.get(r.get("user_id"))
            items.append(data)
        return items, (res.count or 0)

    def get_detail(
        self, archive_id: int, viewer_user_id: int
    ) -> Optional[Dict[str, Any]]:
        """详情页数据：条目 + 作者简介，按可见性决定给不给看。

        本人无论 public / private 都能看自己的；他人只能看 public 的。
        看不到时统一返回 None（路由转 404）而不是 403 —— 403 会告诉
        陌生人「这个 id 存在但你没权限」，等于确认了私密条目的存在。
        """
        item = self.get(archive_id)
        if not item:
            return None
        is_owner = item.userId == viewer_user_id
        if not is_owner and item.visibility != "public":
            return None
        data = self._apply_photo_display(item, is_owner=is_owner).dict()
        data["author"] = self._authors_brief([item.userId]).get(item.userId)
        data["isOwner"] = is_owner
        return data

    def set_visibility(
        self, archive_id: int, user_id: int, visibility: str
    ) -> ArchiveItem:
        """本人切换藏品可见性。"""
        item = self.get(archive_id)
        if not item:
            raise ValueError("未找到该藏品")
        if item.userId != user_id:
            raise PermissionError("只能修改自己的藏品")
        res = (
            self.db.table("user_archive_items")
            .update({"visibility": visibility})
            .eq("id", archive_id)
            .execute()
        )
        if not res.data:
            raise ValueError("未找到该藏品")
        return self._format(res.data[0])

    def set_photo_display(
        self, archive_id: int, user_id: int, show_real_photos: bool
    ) -> ArchiveItem:
        """本人切换「实拍是否给他人看」。

        找不到抛 LookupError（→404），业务规则不满足抛 ValueError（→400）：
        两者对客户端的含义不同，不该压成同一个状态码。
        """
        item = self.get(archive_id)
        if not item:
            raise LookupError("未找到该藏品")
        if item.userId != user_id:
            raise PermissionError("只能修改自己的藏品")
        # 没有 AI 图却要藏实拍 = 这件藏品对外一张图都没有。挡在这里，
        # 不要依赖前端不给点 —— 接口是公开的。
        if not show_real_photos and not item.aiPhotos:
            raise ValueError("这件藏品还没有 AI 三视图，隐藏实拍后将没有任何图片")
        res = (
            self.db.table("user_archive_items")
            .update({"show_real_photos": show_real_photos})
            .eq("id", archive_id)
            .execute()
        )
        if not res.data:
            raise LookupError("未找到该藏品")
        return self._format(res.data[0])

    def get(self, archive_id: int) -> Optional[ArchiveItem]:
        res = (
            self.db.table("user_archive_items")
            .select("*")
            .eq("id", archive_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return self._format(res.data[0])

    def mark_relisted(self, archive_id: int, new_product_id: int) -> None:
        self.db.table("user_archive_items").update(
            {
                "relisted_product_id": new_product_id,
                "relisted_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", archive_id).execute()

    # ------------------------------------------------------------------
    # PDF p.21 · 独立上传 MY ARCHIVE 条目（不依赖订单）
    # ------------------------------------------------------------------

    def _detect_ai_photos(self, photos: List[str]) -> List[str]:
        """
        从一组照片里挑出 AI 生成的那些。

        依据是 passport_three_views 里真实存在的生成记录，不是客户端自报 ——
        客户端谎称「AI 图是实拍」正是要防的方向，5.4 公开验证页要靠这个
        标记告诉买家哪张是 AI 推测的侧背面。

        查不到时返回空（全部按实拍处理）。这是保守的失败方向吗？不是，
        所以这里不吞异常：标漏了等于在公开页上把 AI 图当实物照展示。
        """
        if not photos:
            return []
        res = (
            self.db.table("passport_three_views")
            .select("image_url")
            .in_("image_url", photos)
            .eq("status", "success")
            .execute()
        )
        generated = {r["image_url"] for r in (res.data or []) if r.get("image_url")}
        # 保持与 photos 相同的顺序，方便前端按序比对。
        return [p for p in photos if p in generated]

    def manual_create(
        self,
        user_id: int,
        body: ArchiveItemManualCreate,
        *,
        validity_status: str = "manual_review",
    ) -> ArchiveItem:
        """
        独立上传一条档案。

        validity_status 只能由调用方（服务端）给，不从 body 里读 —— 它记录的是
        「这张图过没过 5.3 有效性检查」。默认 manual_review 是有意为之：走到这个
        方法而没有显式传值，就说明这条记录没经过 AI 闸门，只能先进人工队列。
        真正跑过闸门的护照链路（attribution_service.confirm）会显式传入结论。
        """
        payload = {
            "user_id": user_id,
            "title": body.title,
            "brand_name": body.brandName,
            "size": body.size,
            "color": body.color,
            "condition": body.condition,
            "original_show_id": body.originalShowId,
            "acquired_price_cents": body.acquiredPriceCents,
            "currency": body.currency,
            "photos": body.photos or [],
            "acquired_at": body.acquiredAt,
            "note": body.note,
            "storage_location": body.storageLocation,
            "source": "manual",
            "is_currently_owned": True,
            "brand_id": body.brandId,
            "release_year": body.releaseYear,
            "validity_status": validity_status,
            "ai_photos": self._detect_ai_photos(body.photos or []),
        }
        res = self.db.table("user_archive_items").insert(payload).execute()
        item = self._format(res.data[0])

        # 生成三视图时档案条目还不存在，到这里才能把两边挂上。
        # 后台的三视图管理页靠它跳转到对应档案。
        if item.aiPhotos:
            try:
                self.db.table("passport_three_views").update(
                    {"archive_item_id": item.id}
                ).in_("image_url", item.aiPhotos).execute()
            except Exception as e:
                print(f"[archive] link three-view records failed: {e}")

        # 自动开一段 owned 持有记录
        try:
            self.add_holding(
                item.id,
                user_id,
                ArchiveHoldingCreate(
                    heldFrom=body.acquiredAt,
                    status="owned",
                    note="独立上传 · 入藏",
                ),
            )
        except Exception as e:
            print(f"[archive] open initial holding failed: {e}")
        return item

    # ------------------------------------------------------------------
    # PDF p.22 · 持有记录
    # ------------------------------------------------------------------

    def list_holdings(
        self, archive_id: int, user_id: int
    ) -> List[ArchiveHoldingRecord]:
        # 仅本人可看
        item = self.get(archive_id)
        if not item or item.userId != user_id:
            return []
        res = (
            self.db.table("archive_holding_history")
            .select("*")
            .eq("archive_item_id", archive_id)
            .order("held_from", desc=True)
            .execute()
        )
        return [self._format_holding(r) for r in (res.data or [])]

    def add_holding(
        self,
        archive_id: int,
        user_id: int,
        body: ArchiveHoldingCreate,
    ) -> ArchiveHoldingRecord:
        item = self.get(archive_id)
        if not item:
            raise ValueError("Archive item not found")
        if item.userId != user_id:
            raise PermissionError("Cannot record holding for another user's item")

        payload = {
            "archive_item_id": archive_id,
            "user_id": user_id,
            "held_from": body.heldFrom,
            "held_to": body.heldTo,
            "status": body.status,
            "note": body.note,
            "counterpart_user_id": body.counterpartUserId,
            "counterpart_name": body.counterpartName,
            "related_product_id": body.relatedProductId,
            "related_order_id": body.relatedOrderId,
        }
        res = self.db.table("archive_holding_history").insert(payload).execute()

        # 若新记录是 transferred / resold / lent / returned 且 held_to 为空，
        # 标记 archive item 为「不再持有」直到下一条 owned 记录闭合。
        if body.status in {"transferred", "resold"} and not body.heldTo:
            self.db.table("user_archive_items").update(
                {"is_currently_owned": False}
            ).eq("id", archive_id).execute()
        elif body.status == "owned":
            self.db.table("user_archive_items").update(
                {"is_currently_owned": True}
            ).eq("id", archive_id).execute()

        return self._format_holding(res.data[0])

    def analytics(self, user_id: int) -> ArchiveAnalytics:
        res = (
            self.db.table("user_archive_items")
            .select("brand_name, acquired_price_cents, acquired_at")
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []
        total = len(rows)
        total_cents = sum((r.get("acquired_price_cents") or 0) for r in rows)
        brand_breakdown: Dict[str, int] = {}
        year_breakdown: Dict[str, int] = {}
        for r in rows:
            b = r.get("brand_name") or "未知"
            brand_breakdown[b] = brand_breakdown.get(b, 0) + 1
            y = (r.get("acquired_at") or "")[:4]
            if y:
                year_breakdown[y] = year_breakdown.get(y, 0) + 1
        return ArchiveAnalytics(
            totalItems=total,
            totalAcquiredCents=total_cents,
            brandBreakdown=brand_breakdown,
            yearBreakdown=year_breakdown,
            avgPriceCents=(total_cents // total) if total else 0,
        )


archive_service = ArchiveService()
