"""
PRD 模块四 · 订单引擎核心服务。

涵盖：
  - stock_holds：30 分钟库存锁（创建 / 释放 / 消费 / 过期回收）
  - orders：状态机（pending_payment → paid → shipped → delivered → completed → settled）
  - 价格快照与抽佣计算（Plus 6% / 普通 8%）

支付通道通过 payment.factory.get_payment_provider() 获取，订单不直接依赖具体 SDK。
"""
from __future__ import annotations

import secrets
from typing import Optional, Tuple, List, Dict, Any
from datetime import datetime, timedelta

from app.db.supabase import get_supabase_admin, execute_with_retry
from app.schemas.orders import Order, Offer, StockHold, OrderStatus
from app.services.payment import get_payment_provider


_ORDER_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.PENDING_PAYMENT: {
        OrderStatus.PAID,
        OrderStatus.REFUNDED_AUTO,  # hold 过期自动取消
    },
    OrderStatus.PAID: {
        OrderStatus.SHIPPED,
        OrderStatus.REFUNDED_AUTO,  # 72h 超期未发货 → 自动退款
    },
    OrderStatus.SHIPPED: {
        OrderStatus.DELIVERED,
        OrderStatus.REFUNDED,
        OrderStatus.DISPUTED,
    },
    OrderStatus.DELIVERED: {
        OrderStatus.COMPLETED,
        OrderStatus.DISPUTED,
        OrderStatus.REFUNDED,
    },
    OrderStatus.COMPLETED: {
        OrderStatus.SETTLED,
        OrderStatus.DISPUTED,
    },
    OrderStatus.SETTLED: set(),
    OrderStatus.REFUNDED_AUTO: set(),
    OrderStatus.REFUNDED: set(),
    OrderStatus.DISPUTED: {OrderStatus.RESOLVED},
    OrderStatus.RESOLVED: {OrderStatus.SETTLED, OrderStatus.REFUNDED},
}


def is_valid_order_transition(src: str, target: str) -> bool:
    try:
        s = OrderStatus(src)
        t = OrderStatus(target)
    except ValueError:
        return False
    return t in _ORDER_TRANSITIONS.get(s, set())


HOLD_TTL_MINUTES = 30
SHIP_DEADLINE_HOURS = 72
AUTO_CONFIRM_DAYS = 7
SETTLEMENT_DAYS = 7
DEFAULT_COMMISSION_BPS = 800   # 8%
PLUS_COMMISSION_BPS = 600      # 6%


class OrderService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

    # ------------------------------------------------------------------
    # Stock holds
    # ------------------------------------------------------------------

    @staticmethod
    def _format_hold(row: dict) -> StockHold:
        return StockHold(
            id=row["id"],
            productId=row["product_id"],
            buyerUserId=row["buyer_user_id"],
            expiresAt=row["expires_at"],
            releasedAt=row.get("released_at"),
            consumedAt=row.get("consumed_at"),
            createdAt=row.get("created_at"),
        )

    def acquire_hold(self, product_id: int, buyer_user_id: int) -> StockHold:
        """尝试给商品加 30 分钟锁；冲突时抛 ValueError。

        借助 stock_holds 的部分唯一索引（uq_stock_holds_active）保证同一商品同时只能有一个未消费/未释放的 hold。
        """
        # 先确保商品当前是 active 且不属于 buyer 自己
        prod = (
            self.db.table("store_products")
            .select("id, status, seller_user_id, merchant_id, accept_offer")
            .eq("id", product_id)
            .limit(1)
            .execute()
        )
        if not prod.data:
            raise ValueError("商品不存在")
        row = prod.data[0]
        if row.get("status") != "active":
            raise ValueError("商品当前不可购买")
        if row.get("seller_user_id") == buyer_user_id:
            raise ValueError("不能购买自己的商品")

        expires_at = (datetime.utcnow() + timedelta(minutes=HOLD_TTL_MINUTES)).isoformat()
        try:
            res = (
                self.db.table("stock_holds")
                .insert(
                    {
                        "product_id": product_id,
                        "buyer_user_id": buyer_user_id,
                        "expires_at": expires_at,
                    }
                )
                .execute()
            )
        except Exception:
            raise ValueError("商品已被其他买家锁定，请稍后再试")
        if not res.data:
            raise ValueError("锁定库存失败")

        # 同步把商品状态改成 frozen + 标 current_buyer
        self.db.table("store_products").update(
            {
                "status": "frozen",
                "frozen_until": expires_at,
                "current_buyer_id": buyer_user_id,
            }
        ).eq("id", product_id).execute()
        return self._format_hold(res.data[0])

    def release_hold(self, hold_id: int) -> None:
        """主动释放（用户取消 / cron 过期）。商品回到 active。"""
        hold_res = (
            self.db.table("stock_holds")
            .select("*")
            .eq("id", hold_id)
            .limit(1)
            .execute()
        )
        if not hold_res.data:
            return
        hold = hold_res.data[0]
        if hold.get("released_at") or hold.get("consumed_at"):
            return
        self.db.table("stock_holds").update(
            {"released_at": datetime.utcnow().isoformat()}
        ).eq("id", hold_id).execute()
        self.db.table("store_products").update(
            {"status": "active", "frozen_until": None, "current_buyer_id": None}
        ).eq("id", hold["product_id"]).execute()

    def consume_hold(self, hold_id: int) -> None:
        """支付成功时调用，标记 hold 为 consumed。"""
        self.db.table("stock_holds").update(
            {"consumed_at": datetime.utcnow().isoformat()}
        ).eq("id", hold_id).execute()

    def expire_holds_due(self) -> int:
        """Cron：把过期未消费的 hold 标记为 released 并把商品状态恢复 active。返回处理数量。"""
        now = datetime.utcnow().isoformat()
        res = (
            self.db.table("stock_holds")
            .select("id, product_id")
            .is_("released_at", "null")
            .is_("consumed_at", "null")
            .lt("expires_at", now)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return 0
        ids = [r["id"] for r in rows]
        product_ids = list({r["product_id"] for r in rows})
        self.db.table("stock_holds").update(
            {"released_at": now}
        ).in_("id", ids).execute()
        # 商品恢复 active（前提是当前还是 frozen）
        self.db.table("store_products").update(
            {"status": "active", "frozen_until": None, "current_buyer_id": None}
        ).in_("id", product_ids).eq("status", "frozen").execute()
        return len(ids)

    # ------------------------------------------------------------------
    # 价格 / 抽佣
    # ------------------------------------------------------------------

    @staticmethod
    def _commission_for_user(user_id: int) -> int:
        """返回 commission bps。Plus = 6%、普通 = 8%。"""
        try:
            from app.services.plus_service import plus_service
            return plus_service.commission_rate_for(user_id)
        except Exception:
            return DEFAULT_COMMISSION_BPS

    @staticmethod
    def _split_payment(price_cents: int, commission_bps: int) -> Tuple[int, int]:
        commission = price_cents * commission_bps // 10000
        payout = price_cents - commission
        return commission, payout

    # ------------------------------------------------------------------
    # Orders
    # ------------------------------------------------------------------

    @staticmethod
    def _format_order(row: dict) -> Order:
        return Order(
            id=row["id"],
            orderNo=row["order_no"],
            productId=row["product_id"],
            buyerUserId=row["buyer_user_id"],
            sellerUserId=row.get("seller_user_id"),
            sellerMerchantId=row.get("seller_merchant_id"),
            offerId=row.get("offer_id"),
            listingPriceCents=row["listing_price_cents"],
            paidPriceCents=row["paid_price_cents"],
            commissionRateBps=row["commission_rate_bps"],
            commissionCents=row["commission_cents"],
            sellerPayoutCents=row["seller_payout_cents"],
            currency=row.get("currency", "CNY"),
            shippingAddress=row.get("shipping_address_json"),
            shippingDueAt=row.get("shipping_due_at"),
            autoConfirmDueAt=row.get("auto_confirm_due_at"),
            settlementDueAt=row.get("settlement_due_at"),
            status=row["status"],
            paidAt=row.get("paid_at"),
            shippedAt=row.get("shipped_at"),
            deliveredAt=row.get("delivered_at"),
            completedAt=row.get("completed_at"),
            settledAt=row.get("settled_at"),
            refundedAt=row.get("refunded_at"),
            cancelReason=row.get("cancel_reason"),
            paymentProvider=row.get("payment_provider"),
            paymentIntentId=row.get("payment_intent_id"),
            paymentMetadata=row.get("payment_metadata"),
            createdAt=row.get("created_at"),
            updatedAt=row.get("updated_at"),
        )

    @staticmethod
    def _gen_order_no() -> str:
        return datetime.utcnow().strftime("%Y%m%d%H%M%S") + secrets.token_hex(4).upper()

    def create_order_from_listing(
        self,
        *,
        product_id: int,
        buyer_user_id: int,
        shipping_address: Optional[Dict[str, Any]] = None,
        offer_id: Optional[int] = None,
        override_price_cents: Optional[int] = None,
    ) -> Tuple[Order, StockHold]:
        """创建订单 + 库存锁 + 支付意图（pending_payment）。"""
        hold = self.acquire_hold(product_id, buyer_user_id)

        prod = (
            self.db.table("store_products")
            .select(
                "id, seller_user_id, merchant_id, seller_kind, price_cents, currency"
            )
            .eq("id", product_id)
            .limit(1)
            .execute()
        )
        if not prod.data:
            self.release_hold(hold.id)
            raise ValueError("商品不存在")
        row = prod.data[0]
        listing_price = row["price_cents"]
        paid_price = override_price_cents or listing_price

        commission_bps = self._commission_for_user(row.get("seller_user_id") or 0)
        commission, payout = self._split_payment(paid_price, commission_bps)

        order_no = self._gen_order_no()
        order_payload = {
            "order_no": order_no,
            "product_id": product_id,
            "buyer_user_id": buyer_user_id,
            "seller_user_id": row.get("seller_user_id"),
            "seller_merchant_id": row.get("merchant_id"),
            "offer_id": offer_id,
            "listing_price_cents": listing_price,
            "paid_price_cents": paid_price,
            "commission_rate_bps": commission_bps,
            "commission_cents": commission,
            "seller_payout_cents": payout,
            "currency": row.get("currency", "CNY"),
            "shipping_address_json": shipping_address,
            "status": "pending_payment",
        }
        res = self.db.table("orders").insert(order_payload).execute()
        if not res.data:
            self.release_hold(hold.id)
            raise RuntimeError("创建订单失败")
        order = res.data[0]

        # 同步创建支付意图（默认 mock provider）
        provider = get_payment_provider()
        intent = provider.create_intent(
            order_id=order["id"],
            amount_cents=paid_price,
            currency=order["currency"],
            metadata={"orderNo": order_no, "productId": product_id},
        )
        self.db.table("orders").update(
            {
                "payment_provider": intent.provider,
                "payment_intent_id": intent.intent_id,
                "payment_metadata": {
                    "clientSecret": intent.client_secret,
                    **intent.metadata,
                },
            }
        ).eq("id", order["id"]).execute()
        # 重新读取 row 以拿到 payment fields
        full = self.db.table("orders").select("*").eq("id", order["id"]).limit(1).execute()
        return self._format_order(full.data[0] if full.data else order), hold

    def transition_status(
        self,
        order_id: int,
        target: OrderStatus,
        *,
        actor_user_id: int,
        is_admin: bool = False,
        reason: Optional[str] = None,
    ) -> Order:
        """订单状态迁移（卖家发货 / 买家确认 / 客服仲裁 等）。"""
        res = (
            self.db.table("orders").select("*").eq("id", order_id).limit(1).execute()
        )
        if not res.data:
            raise ValueError("订单不存在")
        order = res.data[0]
        src = order["status"]
        if not is_valid_order_transition(src, target.value):
            raise ValueError(f"非法订单跳转：{src} → {target.value}")

        update: Dict[str, Any] = {"status": target.value}
        now = datetime.utcnow()

        if target == OrderStatus.PAID:
            update["paid_at"] = now.isoformat()
            update["shipping_due_at"] = (now + timedelta(hours=SHIP_DEADLINE_HOURS)).isoformat()
            # 商品锁定持续到发货
        elif target == OrderStatus.SHIPPED:
            update["shipped_at"] = now.isoformat()
        elif target == OrderStatus.DELIVERED:
            update["delivered_at"] = now.isoformat()
            update["auto_confirm_due_at"] = (now + timedelta(days=AUTO_CONFIRM_DAYS)).isoformat()
        elif target == OrderStatus.COMPLETED:
            update["completed_at"] = now.isoformat()
            update["settlement_due_at"] = (now + timedelta(days=SETTLEMENT_DAYS)).isoformat()
        elif target == OrderStatus.SETTLED:
            update["settled_at"] = now.isoformat()
        elif target in (OrderStatus.REFUNDED, OrderStatus.REFUNDED_AUTO):
            update["refunded_at"] = now.isoformat()
            update["cancel_reason"] = reason

        self.db.table("orders").update(update).eq("id", order_id).execute()
        full = self.db.table("orders").select("*").eq("id", order_id).limit(1).execute()
        updated = self._format_order(full.data[0] if full.data else {**order, **update})

        # Side effects
        if target == OrderStatus.PAID:
            # 把商品标记为 sold，consume hold，写履历 + 价格历史
            try:
                self.db.table("store_products").update(
                    {"status": "sold", "sold_at": now.isoformat()}
                ).eq("id", order["product_id"]).execute()
            except Exception as e:
                print(f"[orders] mark product sold failed: {e}")
            try:
                hold = (
                    self.db.table("stock_holds")
                    .select("id")
                    .eq("product_id", order["product_id"])
                    .eq("buyer_user_id", order["buyer_user_id"])
                    .is_("released_at", "null")
                    .is_("consumed_at", "null")
                    .limit(1)
                    .execute()
                )
                if hold.data:
                    self.consume_hold(hold.data[0]["id"])
            except Exception as e:
                print(f"[orders] consume hold failed: {e}")

            try:
                from app.services.provenance_service import provenance_service
                provenance_service.append_sold_event(
                    order["product_id"], order["buyer_user_id"], now
                )
                provenance_service.record_sale_price(
                    product_id=order["product_id"],
                    brand_name=None,
                    category_id=None,
                    size=None,
                    condition=None,
                    price_cents=order["paid_price_cents"],
                    currency=order.get("currency", "CNY"),
                    source="order",
                )
            except Exception as e:
                print(f"[orders] provenance updates failed: {e}")

        if target == OrderStatus.COMPLETED:
            try:
                from app.services.archive_service import archive_service
                archive_service.snapshot_from_order(order_id)
            except Exception as e:
                print(f"[orders] archive snapshot failed: {e}")

        if target == OrderStatus.SETTLED:
            try:
                self._credit_seller(updated)
            except Exception as e:
                print(f"[orders] settle failed: {e}")

        return updated

    def list_orders(
        self,
        *,
        buyer_user_id: Optional[int] = None,
        seller_user_id: Optional[int] = None,
        seller_merchant_id: Optional[int] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Order], int]:
        q = self.db.table("orders").select("*", count="exact")
        if buyer_user_id is not None:
            q = q.eq("buyer_user_id", buyer_user_id)
        if seller_user_id is not None:
            q = q.eq("seller_user_id", seller_user_id)
        if seller_merchant_id is not None:
            q = q.eq("seller_merchant_id", seller_merchant_id)
        if status:
            q = q.eq("status", status)
        q = q.order("created_at", desc=True)
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = execute_with_retry(lambda: q.execute(), label="orders.list")
        return [self._format_order(r) for r in (res.data or [])], (res.count or 0)

    def get_order(self, order_id: int) -> Optional[Order]:
        res = (
            self.db.table("orders").select("*").eq("id", order_id).limit(1).execute()
        )
        if not res.data:
            return None
        return self._format_order(res.data[0])

    def add_shipment(
        self,
        order_id: int,
        *,
        carrier: str,
        tracking_no: str,
        images: List[str],
    ) -> None:
        self.db.table("order_shipments").insert(
            {
                "order_id": order_id,
                "carrier": carrier,
                "tracking_no": tracking_no,
                "images": images,
            }
        ).execute()

    # ------------------------------------------------------------------
    # Settlement
    # ------------------------------------------------------------------

    def _credit_seller(self, order: Order) -> None:
        """T+7 把卖家应收金额转入 available_balance。"""
        owner_kind = "user" if order.sellerUserId else "merchant"
        owner_user_id = order.sellerUserId
        owner_merchant_id = order.sellerMerchantId
        # 1) ledger 流水
        self.db.table("settlement_ledger").insert(
            {
                "order_id": order.id,
                "owner_kind": owner_kind,
                "owner_user_id": owner_user_id,
                "owner_merchant_id": owner_merchant_id,
                "direction": "credit",
                "amount_cents": order.sellerPayoutCents,
                "currency": order.currency,
                "reason": "order_settled",
                "metadata": {"orderNo": order.orderNo},
            }
        ).execute()
        # 2) seller_balances upsert
        select_q = (
            self.db.table("seller_balances")
            .select("*")
            .eq("owner_kind", owner_kind)
        )
        if owner_user_id is not None:
            select_q = select_q.eq("owner_user_id", owner_user_id)
        else:
            select_q = select_q.eq("owner_merchant_id", owner_merchant_id)
        existing = select_q.limit(1).execute()
        if existing.data:
            cur = existing.data[0]
            new_available = (cur.get("available_cents") or 0) + order.sellerPayoutCents
            new_total = (cur.get("total_payout_cents") or 0) + order.sellerPayoutCents
            self.db.table("seller_balances").update(
                {
                    "available_cents": new_available,
                    "total_payout_cents": new_total,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", cur["id"]).execute()
        else:
            self.db.table("seller_balances").insert(
                {
                    "owner_kind": owner_kind,
                    "owner_user_id": owner_user_id,
                    "owner_merchant_id": owner_merchant_id,
                    "available_cents": order.sellerPayoutCents,
                    "total_payout_cents": order.sellerPayoutCents,
                    "currency": order.currency,
                }
            ).execute()

    # ------------------------------------------------------------------
    # Cron 入口
    # ------------------------------------------------------------------

    def expire_overdue_shipments(self) -> int:
        """paid 状态超过 72h 未发货 → refunded_auto。"""
        now = datetime.utcnow().isoformat()
        res = (
            self.db.table("orders")
            .select("id, status, shipping_due_at")
            .eq("status", "paid")
            .lt("shipping_due_at", now)
            .execute()
        )
        rows = res.data or []
        count = 0
        for r in rows:
            try:
                self.transition_status(
                    r["id"],
                    OrderStatus.REFUNDED_AUTO,
                    actor_user_id=0,
                    is_admin=True,
                    reason="超时未发货",
                )
                count += 1
            except Exception:
                pass
        return count

    def auto_confirm_delivered(self) -> int:
        """delivered + 7d → completed。"""
        now = datetime.utcnow().isoformat()
        res = (
            self.db.table("orders")
            .select("id")
            .eq("status", "delivered")
            .lt("auto_confirm_due_at", now)
            .execute()
        )
        rows = res.data or []
        count = 0
        for r in rows:
            try:
                self.transition_status(
                    r["id"],
                    OrderStatus.COMPLETED,
                    actor_user_id=0,
                    is_admin=True,
                )
                count += 1
            except Exception:
                pass
        return count

    def settle_completed(self) -> int:
        """completed + 7d → settled。"""
        now = datetime.utcnow().isoformat()
        res = (
            self.db.table("orders")
            .select("id")
            .eq("status", "completed")
            .lt("settlement_due_at", now)
            .execute()
        )
        rows = res.data or []
        count = 0
        for r in rows:
            try:
                self.transition_status(
                    r["id"],
                    OrderStatus.SETTLED,
                    actor_user_id=0,
                    is_admin=True,
                )
                count += 1
            except Exception:
                pass
        return count


order_service = OrderService()
