"""
PRD 模块四 · 出价 (Offer) 服务。

要点：
  - 出价 24h TTL，过期由 cron 清理
  - 卖家可接受 / 拒绝 / 还价（还价生成新的 pending offer，parent_offer_id 指向上一条）
  - 买家可撤回
  - 接受 offer 时调用 OrderService.create_order_from_listing(override_price_cents=...)
"""
from __future__ import annotations

from typing import Optional, List, Tuple
from datetime import datetime, timedelta

from app.db.supabase import get_supabase_admin, execute_with_retry
from app.schemas.orders import Offer, OfferStatus
from app.services.order_service import order_service


OFFER_TTL_HOURS = 24


class OfferService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

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
        return self._format(res.data[0])

    def _get_or_raise(self, offer_id: int) -> dict:
        res = self.db.table("offers").select("*").eq("id", offer_id).limit(1).execute()
        if not res.data:
            raise ValueError("出价不存在")
        return res.data[0]

    def withdraw(self, offer_id: int, buyer_user_id: int) -> Offer:
        offer = self._get_or_raise(offer_id)
        if offer["buyer_user_id"] != buyer_user_id:
            raise PermissionError("只有买家可撤回出价")
        if offer["status"] != "pending":
            raise ValueError("当前出价不可撤回")
        self.db.table("offers").update(
            {"status": "withdrawn", "resolved_at": datetime.utcnow().isoformat()}
        ).eq("id", offer_id).execute()
        return self._format({**offer, "status": "withdrawn"})

    def reject(self, offer_id: int, seller_user_id: Optional[int]) -> Offer:
        offer = self._get_or_raise(offer_id)
        self._assert_seller(offer, seller_user_id)
        if offer["status"] != "pending":
            raise ValueError("当前出价不可拒绝")
        self.db.table("offers").update(
            {"status": "rejected", "resolved_at": datetime.utcnow().isoformat()}
        ).eq("id", offer_id).execute()
        return self._format({**offer, "status": "rejected"})

    def counter(
        self,
        offer_id: int,
        seller_user_id: Optional[int],
        *,
        price_cents: int,
        message: Optional[str] = None,
    ) -> Offer:
        offer = self._get_or_raise(offer_id)
        self._assert_seller(offer, seller_user_id)
        if offer["status"] != "pending":
            raise ValueError("当前出价不可还价")
        now = datetime.utcnow().isoformat()
        self.db.table("offers").update(
            {"status": "countered", "resolved_at": now}
        ).eq("id", offer_id).execute()
        # 还价生成新一条 pending offer，但买卖双方对调（卖家是 actor）
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
        return self._format(res.data[0])

    def accept(self, offer_id: int, seller_user_id: Optional[int]):
        """卖家接受 offer：标记 accepted + 创建订单（买家需补完支付）。"""
        offer = self._get_or_raise(offer_id)
        self._assert_seller(offer, seller_user_id)
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
        return order, hold, self._format({**offer, "status": "accepted"})

    def _assert_seller(self, offer: dict, actor_user_id: Optional[int]) -> None:
        if actor_user_id is None:
            raise PermissionError("未登录")
        seller_user_id = offer.get("seller_user_id")
        if seller_user_id is not None and seller_user_id == actor_user_id:
            return
        merchant_id = offer.get("seller_merchant_id")
        if merchant_id:
            from app.services.store_merchant_service import store_merchant_service
            merchant = store_merchant_service.get_merchant_by_id(merchant_id)
            if merchant and getattr(merchant, "userId", None) == actor_user_id:
                return
        raise PermissionError("仅卖家可操作此出价")

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
            q = q.eq("seller_user_id", user_id)
        if status:
            q = q.eq("status", status)
        q = q.order("created_at", desc=True)
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = execute_with_retry(lambda: q.execute(), label="offers.list")
        return [self._format(r) for r in (res.data or [])], (res.count or 0)

    def expire_overdue(self) -> int:
        now = datetime.utcnow().isoformat()
        res = (
            self.db.table("offers")
            .select("id")
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
        return len(ids)


offer_service = OfferService()
