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

import json

from app.db.supabase import get_supabase_admin, execute_with_retry
from app.schemas.orders import Order, Offer, StockHold, OrderStatus, Shipment
from app.services.payment import (
    get_payment_provider,
    get_payment_provider_by_name,
    resolve_provider,
    list_provider_options,
)


_ORDER_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.PENDING_PAYMENT: {
        OrderStatus.PAID,
        OrderStatus.REFUNDED_AUTO,  # hold 过期自动取消
    },
    OrderStatus.PAID: {
        OrderStatus.SHIPPED,
        OrderStatus.REFUNDED_AUTO,  # 72h 超期未发货 → 自动退款
        # 客服在用户付款后但卖家尚未发货时手动介入退款（IM 售后入口）。
        OrderStatus.REFUNDED,
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
        # 即使买家已确认收货也可在锁定期内由客服仲裁退款，钱包 pending 会被反向冲账。
        OrderStatus.REFUNDED,
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
# 「确认收货 + 3 天提现锁定」业务规则：
#   - completed 即刻 credit 到卖家钱包的 pending_cents
#   - 3 天后由 WalletService.release_due_pending() 释放到 available_cents
SETTLEMENT_DAYS = 3
DEFAULT_COMMISSION_BPS = 100   # 1% 统一手续费
PLUS_COMMISSION_BPS = 100      # Plus 不再额外打折，保持一致


class OrderService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()
        self._chat = None  # 懒加载，避免循环依赖

    # ------------------------------------------------------------------
    # IM 卡片 (order_status) 推送
    # ------------------------------------------------------------------

    def _get_chat(self):
        if self._chat is None:
            from app.services.chat_service import ChatService
            self._chat = ChatService()
        return self._chat

    def _product_brief(self, product_id: int) -> dict:
        try:
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
        except Exception:
            return {}

    def _latest_shipment_row(self, order_id: int) -> Optional[Dict[str, Any]]:
        """取订单最新一条物流凭证（卡片 payload + 详情查询都会用到）。"""
        try:
            res = (
                self.db.table("order_shipments")
                .select("*")
                .eq("order_id", order_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            return res.data[0] if res.data else None
        except Exception:
            return None

    def _send_order_status_card(
        self,
        order: Order,
        *,
        sender_user_id: int,
        recipient_user_id: int,
        note: Optional[str] = None,
    ) -> None:
        """开会话 + 推送一张 order_status 富媒体卡片。失败静默。"""
        if not recipient_user_id or sender_user_id == recipient_user_id:
            return
        try:
            chat = self._get_chat()
            conv_id = chat.create_conversation(sender_user_id, recipient_user_id)
            payload: Dict[str, Any] = {
                "orderId": order.id,
                "orderNo": order.orderNo,
                "status": order.status,
                "paidPriceCents": order.paidPriceCents,
                "currency": order.currency,
                "product": self._product_brief(order.productId) or None,
            }
            if order.shippingDueAt:
                payload["shippingDueAt"] = order.shippingDueAt
            if order.autoConfirmDueAt:
                payload["autoConfirmDueAt"] = order.autoConfirmDueAt
            # shipped / delivered 状态：把物流单号塞进卡片，
            # 聊天里点开即可看到承运商 + 单号，无需跳订单详情。
            if order.status in {"shipped", "delivered", "completed", "settled"}:
                ship_row = self._latest_shipment_row(order.id)
                if ship_row:
                    payload["shipment"] = {
                        "carrier": ship_row.get("carrier"),
                        "trackingNo": ship_row.get("tracking_no"),
                        "signedAt": ship_row.get("signed_at"),
                    }
            if note:
                payload["note"] = note
            chat.send_message(
                conversation_id=conv_id,
                sender_id=sender_user_id,
                content=json.dumps(payload, ensure_ascii=False),
                message_type="order_status",
            )
        except Exception as e:
            print(f"[orders] send order_status card failed: {e}")

    def _resolve_seller_user_id(self, order_row: dict) -> Optional[int]:
        """处理买手店卖家 → 取 merchant.user_id。"""
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

    def _notify_both_parties(
        self,
        order: Order,
        order_row: dict,
        *,
        actor_user_id: Optional[int] = None,
    ) -> None:
        """订单状态变化时给相关方发卡片。

        - PAID（买家支付完成）         → 发给卖家
        - SHIPPED（卖家发货）           → 发给买家
        - DELIVERED（签收）             → 同时发给买家 + 卖家（双方都需要知道已签收）
        - COMPLETED / REFUNDED 系列     → 发给对手方
        """
        buyer_id = order.buyerUserId
        seller_id = self._resolve_seller_user_id(order_row)
        if not seller_id:
            return

        # 这几类状态对买卖双方都关键，双方都得到一份卡片：
        #   - DELIVERED：签收（系统或买家触发，双方需要知道开始 7 天确认窗口）
        #   - REFUNDED / REFUNDED_AUTO：退款（客服仲裁或系统超时回收，双方需要知晓终态）
        if order.status in {
            OrderStatus.DELIVERED.value,
            OrderStatus.REFUNDED.value,
            OrderStatus.REFUNDED_AUTO.value,
        }:
            self._send_order_status_card(
                order, sender_user_id=buyer_id, recipient_user_id=seller_id
            )
            self._send_order_status_card(
                order, sender_user_id=seller_id, recipient_user_id=buyer_id
            )
            return

        if actor_user_id == seller_id:
            # 卖家发起（如发货） — 发给买家
            self._send_order_status_card(
                order, sender_user_id=seller_id, recipient_user_id=buyer_id
            )
        else:
            # 默认买家或系统发起 — 发给卖家
            self._send_order_status_card(
                order, sender_user_id=buyer_id, recipient_user_id=seller_id
            )

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
        """返回 commission bps。

        当前统一按 1%（100 bps）抽佣，不再按 Plus / 普通区分。
        如果未来产品要恢复差异化抽佣，重新接 plus_service.commission_rate_for(user_id)
        即可——这里把 hook 留着但默认返回 DEFAULT_COMMISSION_BPS。"""
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
        notify_chat: bool = True,
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
        order_obj = self._format_order(full.data[0] if full.data else order)

        if notify_chat:
            self._notify_both_parties(
                order_obj,
                full.data[0] if full.data else order,
                actor_user_id=buyer_user_id,
            )

        return order_obj, hold

    def list_payment_options(self, order: Order) -> List[str]:
        """根据订单币种返回可用 provider 列表（前端展示用）。"""
        # 默认按 currency 判定区域（CNY → 中国，其它 → US/Stripe）
        return list_provider_options(currency=order.currency)

    def start_payment(
        self,
        *,
        order_id: int,
        user_id: int,
        provider_name: Optional[str] = None,
    ) -> Order:
        """用户在 PaymentScreen 选了一个 provider 后调用：
          - 校验权限 / 订单仍处于 pending_payment
          - 用对应 provider 重新 create_intent，覆盖 orders.payment_*
          - 返回更新后的 Order（包含 client_secret、order_string、prepay_id 等）
        """
        res = (
            self.db.table("orders").select("*").eq("id", order_id).limit(1).execute()
        )
        if not res.data:
            raise ValueError("订单不存在")
        order_row = res.data[0]
        if order_row["buyer_user_id"] != user_id:
            raise PermissionError("仅买家可发起支付")
        if order_row["status"] != "pending_payment":
            raise ValueError("订单不在待支付状态")

        provider = resolve_provider(
            preferred=provider_name,
            currency=order_row.get("currency", "CNY"),
        )
        intent = provider.create_intent(
            order_id=order_row["id"],
            amount_cents=order_row["paid_price_cents"],
            currency=order_row.get("currency", "CNY"),
            metadata={
                "orderNo": order_row["order_no"],
                "productId": order_row["product_id"],
            },
        )

        meta_payload: Dict[str, Any] = {**(intent.metadata or {})}
        if intent.client_secret:
            meta_payload["clientSecret"] = intent.client_secret

        self.db.table("orders").update(
            {
                "payment_provider": intent.provider,
                "payment_intent_id": intent.intent_id,
                "payment_metadata": meta_payload,
            }
        ).eq("id", order_id).execute()

        full = self.db.table("orders").select("*").eq("id", order_id).limit(1).execute()
        return self._format_order(full.data[0] if full.data else order_row)

    def confirm_payment(self, *, order_id: int, user_id: int) -> Order:
        """支付完成后客户端 / webhook 调用：调用 provider.confirm，
        成功则推动状态机到 PAID（含商品 sold / hold 消费 / IM 卡片）。

        生产环境应当：
          - Stripe webhook：直接读取事件，调用本方法 (admin/系统身份)
          - 支付宝 / 微信 notify：同上
          - 前端 SDK 成功回执：可调用本方法做客户端确认，最终仍以 webhook 为准
        """
        res = (
            self.db.table("orders").select("*").eq("id", order_id).limit(1).execute()
        )
        if not res.data:
            raise ValueError("订单不存在")
        order_row = res.data[0]
        if order_row["buyer_user_id"] != user_id:
            raise PermissionError("仅买家可确认支付")
        if order_row["status"] == "paid":
            return self._format_order(order_row)
        if order_row["status"] != "pending_payment":
            raise ValueError("订单不在待支付状态")

        provider_name = order_row.get("payment_provider") or "mock"
        intent_id = order_row.get("payment_intent_id") or ""
        provider = get_payment_provider_by_name(provider_name)
        result = provider.confirm(intent_id)
        if result.status != "succeeded":
            raise ValueError(f"支付未成功：{result.status}")

        return self.transition_status(
            order_id, OrderStatus.PAID, actor_user_id=user_id
        )

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
            # 同步把最新一条 order_shipments.signed_at 写上，
            # 让后台报表 / 售后查证一致。
            self._mark_shipment_signed(order_id)
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

        # 退款（人工或自动）若订单已结算到 pending_payouts，则反向冲账，
        # 保证 sum(pending) 与 seller_balances.pending_cents 守恒。
        if target in (OrderStatus.REFUNDED, OrderStatus.REFUNDED_AUTO):
            try:
                from app.services.wallet_service import wallet_service
                wallet_service.reverse_pending_for_order(
                    order_id, reason=reason or "order_refund"
                )
            except Exception as e:
                print(f"[orders] reverse pending payout failed: {e}")

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
            # 1) 单品自动入库 MY ARCHIVE
            try:
                from app.services.archive_service import archive_service
                archive_service.snapshot_from_order(order_id)
            except Exception as e:
                print(f"[orders] archive snapshot failed: {e}")
            # 2) 抽 1% 后挂卖家钱包 pending（锁 3 天 → wallet cron 释放）
            pending_row = None
            try:
                from app.services.wallet_service import wallet_service
                pending_row = wallet_service.credit_pending_for_order(order_id)
            except Exception as e:
                print(f"[orders] credit pending failed: {e}")
            # 3) 发系统通知 + 推送（订单号 / 成交金额 / 手续费 / 实收）
            try:
                self._notify_settlement(updated, pending_row)
            except Exception as e:
                print(f"[orders] settlement notification failed: {e}")

        if target == OrderStatus.SETTLED:
            # 历史路径保留：把已 release 的 pending 余额冗余记一次 ledger，方便对账。
            try:
                self._credit_seller_legacy(updated)
            except Exception as e:
                print(f"[orders] settle legacy failed: {e}")

        # 关键状态变更自动推送 order_status 富媒体卡片
        if target in {
            OrderStatus.PAID,
            OrderStatus.SHIPPED,
            OrderStatus.DELIVERED,
            OrderStatus.COMPLETED,
            OrderStatus.REFUNDED,
            OrderStatus.REFUNDED_AUTO,
        }:
            try:
                self._notify_both_parties(updated, {**order, **update}, actor_user_id=actor_user_id)
            except Exception as e:
                print(f"[orders] notify chat after transition failed: {e}")

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

    def status_summary(
        self,
        *,
        buyer_user_id: Optional[int] = None,
        seller_user_id: Optional[int] = None,
        seller_merchant_id: Optional[int] = None,
    ) -> Dict[str, int]:
        """聚合当前用户在各订单状态下的数量。

        买家「我的购物」/ 卖家「卖家中心」首页用来渲染顶部状态卡片
        （pending_payment / paid / shipped / delivered 等）。

        实现选 status 列做客户端聚合而不是写多次 ``count="exact"`` 查询，
        因为单个用户的订单总量上限是 PRD 设计里的 几十 ~ 几百 量级，
        多次 count 查询的网络往返 + 数据库执行成本高于一次拉 status 列再
        在内存里 group by。
        """
        counts: Dict[str, int] = {s.value: 0 for s in OrderStatus}
        if (
            buyer_user_id is None
            and seller_user_id is None
            and seller_merchant_id is None
        ):
            return counts
        q = self.db.table("orders").select("status")
        if buyer_user_id is not None:
            q = q.eq("buyer_user_id", buyer_user_id)
        if seller_user_id is not None:
            q = q.eq("seller_user_id", seller_user_id)
        if seller_merchant_id is not None:
            q = q.eq("seller_merchant_id", seller_merchant_id)
        res = execute_with_retry(lambda: q.execute(), label="orders.status_summary")
        for row in res.data or []:
            status = (row or {}).get("status")
            if status in counts:
                counts[status] += 1
        return counts

    def add_shipment(
        self,
        order_id: int,
        *,
        carrier: str,
        tracking_no: str,
        images: List[str],
    ) -> None:
        res = self.db.table("order_shipments").insert(
            {
                "order_id": order_id,
                "carrier": carrier,
                "tracking_no": tracking_no,
                "images": images,
            }
        ).execute()
        # 把运单接入物流轨迹聚合层（subscribe webhook + 拉一次初始事件）。
        # 失败静默，不影响发货主流程。
        try:
            shipment_id = None
            if res.data:
                shipment_id = res.data[0].get("id")
            if shipment_id and carrier and tracking_no:
                from app.services.logistics import tracking_service

                tracking_service.on_shipment_created(
                    shipment_id=int(shipment_id),
                    order_id=order_id,
                    carrier=carrier,
                    tracking_no=tracking_no,
                )
        except Exception as e:
            print(f"[orders] tracking subscribe failed: {e}")

    def get_shipment(self, order_id: int) -> Optional[Shipment]:
        """订单详情 / 聊天卡片中的物流块都通过此方法读取。"""
        row = self._latest_shipment_row(order_id)
        if not row:
            return None
        return Shipment(
            id=row["id"],
            orderId=row["order_id"],
            carrier=row.get("carrier"),
            trackingNo=row.get("tracking_no"),
            images=row.get("images") or [],
            signedAt=row.get("signed_at"),
            createdAt=row.get("created_at"),
            latestStatusCode=row.get("latest_status_code"),
            latestDescription=row.get("latest_description"),
            latestLocation=row.get("latest_location"),
            latestEventAt=row.get("latest_event_at"),
            providerSource=row.get("provider_source"),
        )

    def _mark_shipment_signed(self, order_id: int) -> None:
        """物流签收时同步把 order_shipments.signed_at 写上，便于后台导出 / 售后查证。"""
        try:
            self.db.table("order_shipments").update(
                {"signed_at": datetime.utcnow().isoformat()}
            ).eq("order_id", order_id).is_("signed_at", "null").execute()
        except Exception as e:
            print(f"[orders] mark shipment signed failed: {e}")

    def buyer_confirm_receipt(self, order_id: int, buyer_user_id: int) -> Tuple[Order, Optional[Dict[str, Any]]]:
        """买家主动确认收货：delivered → completed。

        和 transition_status 比额外做的事：
          - 校验身份
          - 返回新创建的 pending_payout 行，前端「确认成功」页直接渲染
            「成交 / 手续费 / 实收 / 解冻时间」明细
        """
        res = (
            self.db.table("orders").select("*").eq("id", order_id).limit(1).execute()
        )
        if not res.data:
            raise ValueError("订单不存在")
        order_row = res.data[0]
        if order_row["buyer_user_id"] != buyer_user_id:
            raise PermissionError("仅买家可确认收货")
        if order_row["status"] not in {"delivered", "shipped"}:
            raise ValueError("当前订单状态无法确认收货")

        # 若仍在 shipped 直接跳到 completed（兜底兼容旧客户端）
        if order_row["status"] == "shipped":
            self.transition_status(
                order_id, OrderStatus.DELIVERED, actor_user_id=buyer_user_id
            )

        updated = self.transition_status(
            order_id, OrderStatus.COMPLETED, actor_user_id=buyer_user_id
        )
        # transition_status 已经写过 pending_payout，再读一次拿 release_at 返回
        pending = (
            self.db.table("pending_payouts")
            .select("*")
            .eq("order_id", order_id)
            .limit(1)
            .execute()
        )
        return updated, (pending.data[0] if pending.data else None)

    def buyer_sign_for(self, order_id: int, buyer_user_id: int) -> Order:
        """买家主动确认签收：shipped → delivered（自动卡片走 _notify_both_parties）。

        正式上线对接快递回调后，这条入口仍保留作为「卡车未扫到、但人已拿到」的兜底。
        """
        res = (
            self.db.table("orders").select("*").eq("id", order_id).limit(1).execute()
        )
        if not res.data:
            raise ValueError("订单不存在")
        order_row = res.data[0]
        if order_row["buyer_user_id"] != buyer_user_id:
            raise PermissionError("仅买家可确认签收")
        if order_row["status"] != "shipped":
            raise ValueError("订单不在已发货状态")
        return self.transition_status(
            order_id, OrderStatus.DELIVERED, actor_user_id=buyer_user_id
        )

    # ------------------------------------------------------------------
    # Settlement
    # ------------------------------------------------------------------

    def _notify_settlement(
        self, order: Order, pending_row: Optional[Dict[str, Any]]
    ) -> None:
        """买家确认收货后给卖家一条结算通知（含订单号 / 成交金额 / 手续费 / 实收 / 解冻时间）。"""
        seller_id = order.sellerUserId
        if not seller_id and order.sellerMerchantId:
            try:
                from app.services.store_merchant_service import store_merchant_service
                merchant = store_merchant_service.get_merchant_by_id(order.sellerMerchantId)
                if merchant:
                    seller_id = getattr(merchant, "userId", None)
            except Exception:
                seller_id = None
        if not seller_id:
            return

        currency_symbol = "¥" if order.currency == "CNY" else order.currency
        gross_yuan = (order.paidPriceCents or 0) / 100
        fee_yuan = (order.commissionCents or 0) / 100
        payout_yuan = (order.sellerPayoutCents or 0) / 100
        release_at = (pending_row or {}).get("release_at") if pending_row else None

        try:
            from app.services.notification_service import NotificationService
            from app.schemas.notification import NotificationType
            ns = NotificationService()
            ns.create_notification(
                user_id=seller_id,
                notification_type=NotificationType.SYSTEM,
                title="结算入账",
                message=(
                    f"订单 #{order.orderNo} 已完成，成交 {currency_symbol}{gross_yuan:.2f}，"
                    f"扣除 {currency_symbol}{fee_yuan:.2f} 手续费后实收 {currency_symbol}{payout_yuan:.2f}，"
                    f"将在 3 天后到账"
                ),
                action_data={
                    "navigateTo": "OrderDetail",
                    "navigateParams": {"orderId": order.id},
                    "orderNo": order.orderNo,
                    "grossCents": order.paidPriceCents,
                    "commissionCents": order.commissionCents,
                    "sellerPayoutCents": order.sellerPayoutCents,
                    "releaseAt": release_at,
                    "currency": order.currency,
                },
            )
        except Exception as e:
            print(f"[orders] notify seller settlement failed: {e}")

    def _credit_seller_legacy(self, order: Order) -> None:
        """对账标记：order → settled。

        实际资金流转（pending 锁 3d → available）由 WalletService 全权负责，
        这里只写一条 reason='order_settled' 流水，方便业务对账时按订单回溯。
        """
        try:
            self.db.table("settlement_ledger").insert(
                {
                    "order_id": order.id,
                    "owner_kind": "user" if order.sellerUserId else "merchant",
                    "owner_user_id": order.sellerUserId,
                    "owner_merchant_id": order.sellerMerchantId,
                    "direction": "credit",
                    "amount_cents": 0,            # 仅标记，不重复入账
                    "currency": order.currency,
                    "reason": "order_settled",
                    "metadata": {"orderNo": order.orderNo, "marker": True},
                }
            ).execute()
        except Exception as e:
            print(f"[orders] legacy settled marker failed: {e}")

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
        """completed + 3d → settled.

        和 WalletService.release_due_pending() 的 3 天解冻保持同步：
          - WalletService 负责真正释放 pending → available
          - 这里把订单状态翻成 settled，让卖家「我的销售」看见状态切换
        """
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
