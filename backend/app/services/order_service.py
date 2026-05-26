"""
PRD 模块四 · 订单引擎核心服务。

涵盖：
  - stock_holds：30 分钟库存锁（创建 / 释放 / 消费 / 过期回收）
    过期回收时会同步取消同一 (product, buyer) 下仍处于 pending_payment 的订单，
    避免「库存释放了但订单留下来污染待付款列表」的孤儿状态。
  - orders：状态机（pending_payment → paid → shipped → delivered → completed → settled）
  - 价格快照与抽佣计算（统一 1% 平台手续费，DEFAULT_COMMISSION_BPS=100）
    历史上分过 Plus 6% / 普通 8%，migration 063 起统一为 1%；
    `_commission_for_user` 保留作为未来差异化抽佣的 hook 点。

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
            # 同时下发 push：让买卖双方都能在 App 关闭时被提醒（与微信 / 闲鱼一致）。
            # title 走「卖家发货 / 买家付款」等业务化文案；点击跳订单详情。
            push_title = self._status_push_title(order.status, sender_user_id == order.buyerUserId)
            chat.send_message(
                conversation_id=conv_id,
                sender_id=sender_user_id,
                content=json.dumps(payload, ensure_ascii=False),
                message_type="order_status",
                send_push=True,
                push_title=push_title,
                push_navigate_to="OrderDetail",
                push_navigate_params={"orderId": order.id},
            )
        except Exception as e:
            print(f"[orders] send order_status card failed: {e}")

    @staticmethod
    def _status_push_title(status: str, sender_is_buyer: bool) -> str:
        """给 push 通知的 title 选一段更贴合「订单状态变化」的中文文案。

        sender_is_buyer 表示触发动作的是买家（接收方就是卖家）。
        """
        if status == OrderStatus.PAID.value:
            return "买家已付款"
        if status == OrderStatus.SHIPPED.value:
            return "卖家已发货"
        if status == OrderStatus.DELIVERED.value:
            return "包裹已签收"
        if status == OrderStatus.COMPLETED.value:
            return "交易已完成"
        if status in (OrderStatus.REFUNDED.value, OrderStatus.REFUNDED_AUTO.value):
            return "订单已退款"
        if status == OrderStatus.SETTLED.value:
            return "款项已结算"
        if status == OrderStatus.PENDING_PAYMENT.value:
            return "有新订单待付款"
        return "订单状态更新"

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
        """订单状态变化时给相关方发卡片 + push（与微信 / 闲鱼一致的双向触达）。

        - PENDING_PAYMENT（下单待支付）→ 发给卖家
        - PAID（买家支付完成）         → 发给卖家
        - SHIPPED（卖家发货）           → 发给买家
        - DELIVERED（签收）             → 同时发给买家 + 卖家（双方都需要知道已签收）
        - COMPLETED（确认收货 / 自动确认）→ 双方都需要知道交易完成
        - REFUNDED / REFUNDED_AUTO     → 双方都需要知晓终态
        - SETTLED（T+3 结算到账）       → 双方知晓款项已结算
        """
        buyer_id = order.buyerUserId
        seller_id = self._resolve_seller_user_id(order_row)
        if not seller_id:
            return

        # 这几类状态对买卖双方都关键，双方都得到一份卡片 + push：
        if order.status in {
            OrderStatus.DELIVERED.value,
            OrderStatus.COMPLETED.value,
            OrderStatus.REFUNDED.value,
            OrderStatus.REFUNDED_AUTO.value,
            OrderStatus.SETTLED.value,
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
        """Cron：把过期未消费的 hold 标记为 released 并把商品状态恢复 active。返回处理数量。

        同时把对应的 `pending_payment` 订单转 `refunded_auto`,避免买家钱包/订单
        列表里留下永远停在「待付款」的孤儿订单。买家会收到一条系统通知。
        """
        now = datetime.utcnow().isoformat()
        res = (
            self.db.table("stock_holds")
            .select("id, product_id, buyer_user_id")
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

        # 同步把对应的待付款订单转 refunded_auto。
        # 由于 stock_holds 上没有 order_id 外键(MVP 阶段保留隐式关联),
        # 这里按 (product_id, buyer_user_id) 反查;一个 hold 最多一个 pending_payment 订单。
        cancelled_orders: list[int] = []
        for r in rows:
            try:
                pending = (
                    self.db.table("orders")
                    .select("id")
                    .eq("product_id", r["product_id"])
                    .eq("buyer_user_id", r["buyer_user_id"])
                    .eq("status", "pending_payment")
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if not pending.data:
                    continue
                order_id = pending.data[0]["id"]
                try:
                    self.transition_status(
                        order_id,
                        OrderStatus.REFUNDED_AUTO,
                        is_admin=True,
                        reason="支付超时自动取消",
                    )
                    cancelled_orders.append(order_id)
                except Exception as e:  # noqa: BLE001
                    print(f"[orders] cancel pending order {order_id} failed: {e}")
            except Exception as e:  # noqa: BLE001
                print(f"[orders] lookup pending order for hold {r['id']} failed: {e}")

        # 给买家发 push（系统事件，没 chat 卡片可借力，直接走 in-app notification）
        try:
            from app.services.notification_service import notification_service
            from app.schemas.notification import NotificationType
            for r in rows:
                buyer_id = r.get("buyer_user_id")
                if not buyer_id:
                    continue
                product = self._product_brief(r.get("product_id")) or {}
                title = product.get("title") or product.get("brand") or f"商品 #{r.get('product_id')}"
                notification_service.create_notification(
                    user_id=buyer_id,
                    notification_type=NotificationType.SYSTEM,
                    title="订单已超时取消",
                    message=f"商品「{title}」未在规定时间内完成付款，已自动释放库存",
                    action_data={
                        "navigateTo": "StoreProductDetail",
                        "navigateParams": {"productId": r.get("product_id")},
                    },
                    send_push=True,
                )
        except Exception as e:  # noqa: BLE001
            print(f"[orders] notify hold expired failed: {e}")
        if cancelled_orders:
            print(
                f"[orders] hold expiry cancelled {len(cancelled_orders)} pending orders: "
                f"{cancelled_orders}",
                flush=True,
            )
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

        # 退款(人工或自动)处理:
        #   1) 调真实通道 refund(),让买家的钱真的回到原支付渠道(stub provider 默认成功);
        #   2) 若订单已结算到 pending_payouts,则反向冲账,保证账本守恒;
        # 注意:provider.refund() 失败不会阻塞状态机迁移——订单仍标 refunded,
        # 失败的退款由后续 retry job / 客服处理,避免因通道抖动卡住整个状态切换。
        if target in (OrderStatus.REFUNDED, OrderStatus.REFUNDED_AUTO):
            try:
                self._issue_provider_refund(
                    {**order, **update},
                    reason=reason or "order_refund",
                )
            except Exception as e:
                print(f"[orders] provider refund failed: {e}")
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

            # Dispute resolved_release 路径下,订单从 DISPUTED → RESOLVED → SETTLED
            # 跳过了 COMPLETED,credit_pending_for_order 不会被自动触发,
            # 卖家钱包 pending_cents 就少计了。这里做一次幂等补偿:
            # - 如果该订单尚未生成 pending_payouts,立刻补一条(release_at = 现在,
            #   下一轮 wallet release cron 会把它划到 available_cents);
            # - 如果已有 pending_payouts(说明走过 COMPLETED),什么都不做。
            try:
                from app.services.wallet_service import wallet_service
                existing = (
                    self.db.table("pending_payouts")
                    .select("id")
                    .eq("order_id", order_id)
                    .limit(1)
                    .execute()
                )
                if not existing.data:
                    wallet_service.credit_pending_for_order(
                        order_id, release_immediately=True
                    )
            except Exception as e:
                print(f"[orders] settle backfill pending failed: {e}")

        # 关键状态变更自动推送 order_status 富媒体卡片 + 同步触发 push
        if target in {
            OrderStatus.PAID,
            OrderStatus.SHIPPED,
            OrderStatus.DELIVERED,
            OrderStatus.COMPLETED,
            OrderStatus.REFUNDED,
            OrderStatus.REFUNDED_AUTO,
            OrderStatus.SETTLED,
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

    def _build_product_brief_map(self, product_ids: List[int]) -> Dict[int, dict]:
        """批量预取一批 product_id 的卡片摘要 (id / title / brand / cover / 标价)。

        ProfileScreen 的「交易」tab 一次会展示多张订单卡片, 每张卡片要的
        都只是「品牌 + 标题 + 封面图 + 标价」这套展示性字段。把它做成
        批量预取, 避免对每个订单各打一次 ``store_products`` 查询造成的
        N+1 抖动。返回 dict 的 key 是 product_id, 命中 0 个不会抛错。
        """
        if not product_ids:
            return {}
        unique = list({pid for pid in product_ids if pid})
        if not unique:
            return {}
        res = (
            self.db.table("store_products")
            .select("id, title, brand, price_cents, currency, images")
            .in_("id", unique)
            .execute()
        )
        out: Dict[int, dict] = {}
        for row in res.data or []:
            images = row.get("images") or []
            out[row["id"]] = {
                "productId": row["id"],
                "title": row.get("title"),
                "brand": row.get("brand"),
                "priceCents": row.get("price_cents"),
                "currency": row.get("currency", "CNY"),
                "coverImage": images[0] if images else None,
            }
        return out

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
    # Payment refund / webhook handling
    # ------------------------------------------------------------------

    @staticmethod
    def _is_synthetic_intent(intent_id: Optional[str]) -> bool:
        """stub / mock intent_id 不需要也不能调用真实退款 API。"""
        if not intent_id:
            return True
        return any(
            intent_id.startswith(p)
            for p in ("mock_", "stripe_stub_", "stripe_err_", "ali_", "wx_")
        )

    def _issue_provider_refund(
        self, order_row: Dict[str, Any], *, reason: str
    ) -> None:
        """调真实支付通道退款。

        - 没有 payment_intent_id 或是 mock/stub intent → 直接跳过(没真实扣款);
        - 通道返回非 succeeded → 打日志并写一条 settlement_ledger 标记(metadata.pending=true),
          交给后续 retry job / 人工处理;
        - 通道 succeeded → 在 orders.payment_metadata.refund 里记录,方便对账。
        """
        intent_id = order_row.get("payment_intent_id")
        if self._is_synthetic_intent(intent_id):
            return
        provider_name = order_row.get("payment_provider") or "mock"
        provider = get_payment_provider_by_name(provider_name)
        result = provider.refund(
            intent_id,
            amount_cents=order_row.get("paid_price_cents") or 0,
            reason=reason,
        )

        # 把退款结果落到 payment_metadata 与 settlement_ledger 上,方便对账与排查。
        metadata = order_row.get("payment_metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {}
        metadata.setdefault("refunds", []).append(
            {
                "provider": provider_name,
                "intentId": intent_id,
                "status": result.status,
                "reason": reason,
                "rawSummary": {k: v for k, v in (result.raw or {}).items() if k != "_raw"},
            }
        )
        try:
            self.db.table("orders").update(
                {"payment_metadata": metadata}
            ).eq("id", order_row["id"]).execute()
        except Exception as e:
            print(f"[orders] write refund metadata failed: {e}")

        if result.status != "succeeded":
            print(
                f"[orders] provider {provider_name} refund returned {result.status} "
                f"for order {order_row['id']}, will need manual retry",
                flush=True,
            )

    def handle_payment_event(self, event: Any) -> None:
        """支付 webhook 入口。把通道事件映射到订单状态机。

        幂等约束:
          - PAID 已存在 → succeeded 事件直接 no-op
          - REFUNDED 已存在 → refund.succeeded 直接 no-op
          - 找不到订单 → 跳过(可能是 webhook 在数据库恢复前到达,或 intent_id 不属于本系统)
        """
        from app.services.payment.base import (
            WebhookEvent,
            WEBHOOK_EVENT_PAYMENT_SUCCEEDED,
            WEBHOOK_EVENT_PAYMENT_FAILED,
            WEBHOOK_EVENT_REFUND_SUCCEEDED,
        )

        if not isinstance(event, WebhookEvent):
            return
        intent_id = event.intent_id
        if not intent_id:
            return
        res = (
            self.db.table("orders")
            .select("*")
            .eq("payment_intent_id", intent_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            print(f"[webhook] no order found for intent {intent_id}", flush=True)
            return
        order_row = res.data[0]
        order_id = order_row["id"]

        if event.event_type == WEBHOOK_EVENT_PAYMENT_SUCCEEDED:
            if order_row["status"] in (
                "paid",
                "shipped",
                "delivered",
                "completed",
                "settled",
            ):
                return  # already advanced
            if order_row["status"] != "pending_payment":
                print(
                    f"[webhook] order {order_id} in {order_row['status']}, "
                    f"cannot advance to paid"
                )
                return
            self.transition_status(
                order_id,
                OrderStatus.PAID,
                actor_user_id=order_row["buyer_user_id"],
                is_admin=True,
            )
        elif event.event_type == WEBHOOK_EVENT_PAYMENT_FAILED:
            # 失败也只是个提示,前端会让用户重试 / 切换支付方式。
            # 不主动 refunded_auto:用户可能只是临时银行拒绝。
            print(
                f"[webhook] payment failed for order {order_id}, "
                f"raw={event.raw}",
                flush=True,
            )
        elif event.event_type == WEBHOOK_EVENT_REFUND_SUCCEEDED:
            # 退款回执:仅做对账记录,状态机迁移由发起方(_issue_provider_refund 上游)负责。
            metadata = order_row.get("payment_metadata") or {}
            if not isinstance(metadata, dict):
                metadata = {}
            metadata.setdefault("refundWebhooks", []).append(
                {"intentId": intent_id, "amountCents": event.amount_cents}
            )
            try:
                self.db.table("orders").update(
                    {"payment_metadata": metadata}
                ).eq("id", order_id).execute()
            except Exception as e:
                print(f"[orders] write refund webhook metadata failed: {e}")

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
        """delivered + 7d → completed。

        PRD 「包裹长期不动 / 已签收但买家说没收到」边缘场景:
          - 若 `auto_confirm_paused_at` 不为空,跳过本订单(由 stuck 检测暂停);
          - 若 `tracking_stuck_since` 也仍存在,说明仍在 stuck 状态,不推进。
        """
        now = datetime.utcnow().isoformat()
        res = (
            self.db.table("orders")
            .select("id, auto_confirm_paused_at, tracking_stuck_since")
            .eq("status", "delivered")
            .lt("auto_confirm_due_at", now)
            .execute()
        )
        rows = res.data or []
        count = 0
        for r in rows:
            if r.get("auto_confirm_paused_at") or r.get("tracking_stuck_since"):
                continue
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

    # ------------------------------------------------------------------
    # 提醒序列(Batch 5)
    # ------------------------------------------------------------------

    def send_confirm_receipt_reminders(self) -> int:
        """delivered 状态下:
          - 第 3 天: push + 站内信 「请确认收货」
          - 第 5 天: 短信 「即将自动确认收货」(需要 contact_phone)
        幂等:写入 confirm_reminder_3d_sent_at / 5d 后不再发。
        """
        now = datetime.utcnow()
        res = (
            self.db.table("orders")
            .select(
                "id, order_no, buyer_user_id, product_id, delivered_at, "
                "auto_confirm_due_at, "
                "confirm_reminder_3d_sent_at, confirm_reminder_5d_sent_at, "
                "auto_confirm_paused_at, tracking_stuck_since"
            )
            .eq("status", "delivered")
            .execute()
        )
        rows = res.data or []
        sent = 0
        for r in rows:
            # stuck 状态下不要催买家(物流自己没动,催了买家也没法操作)
            if r.get("auto_confirm_paused_at") or r.get("tracking_stuck_since"):
                continue
            delivered_at = r.get("delivered_at")
            if not delivered_at:
                continue
            try:
                d_at = datetime.fromisoformat(delivered_at.replace("Z", "+00:00"))
            except Exception:
                continue
            age_days = (now - d_at.replace(tzinfo=None)).days

            if age_days >= 3 and not r.get("confirm_reminder_3d_sent_at"):
                self._send_confirm_reminder_3d(r)
                self.db.table("orders").update(
                    {"confirm_reminder_3d_sent_at": now.isoformat()}
                ).eq("id", r["id"]).execute()
                sent += 1
            if age_days >= 5 and not r.get("confirm_reminder_5d_sent_at"):
                self._send_confirm_reminder_5d(r)
                self.db.table("orders").update(
                    {"confirm_reminder_5d_sent_at": now.isoformat()}
                ).eq("id", r["id"]).execute()
                sent += 1
        return sent

    def send_shipping_reminders(self) -> int:
        """paid 状态接近 shipping_due_at 时催卖家发货。
          - 48h 提醒:距离 due 还剩 ≤ 48h
          - 24h 提醒:距离 due 还剩 ≤ 24h
        幂等同上。
        """
        now = datetime.utcnow()
        res = (
            self.db.table("orders")
            .select(
                "id, order_no, seller_user_id, seller_merchant_id, product_id, "
                "shipping_due_at, "
                "shipping_reminder_48h_sent_at, shipping_reminder_24h_sent_at"
            )
            .eq("status", "paid")
            .execute()
        )
        rows = res.data or []
        sent = 0
        for r in rows:
            due = r.get("shipping_due_at")
            if not due:
                continue
            try:
                due_at = datetime.fromisoformat(due.replace("Z", "+00:00")).replace(
                    tzinfo=None
                )
            except Exception:
                continue
            remaining_hours = (due_at - now).total_seconds() / 3600

            if (
                remaining_hours <= 48
                and remaining_hours > 24
                and not r.get("shipping_reminder_48h_sent_at")
            ):
                self._send_shipping_reminder(r, hours_left=48)
                self.db.table("orders").update(
                    {"shipping_reminder_48h_sent_at": now.isoformat()}
                ).eq("id", r["id"]).execute()
                sent += 1
            elif (
                remaining_hours <= 24
                and remaining_hours > 0
                and not r.get("shipping_reminder_24h_sent_at")
            ):
                self._send_shipping_reminder(r, hours_left=24)
                self.db.table("orders").update(
                    {"shipping_reminder_24h_sent_at": now.isoformat()}
                ).eq("id", r["id"]).execute()
                sent += 1
        return sent

    def detect_stuck_packages(self, *, idle_days: int = 5) -> int:
        """shipped 状态下,如果 tracking_events 连续 idle_days 天没新轨迹,
        标记 tracking_stuck_since 并把 auto_confirm_paused_at 置上,
        同时 push 双方提醒。下次有新 tracking_event 时再清零。
        """
        now = datetime.utcnow()
        cutoff = (now - timedelta(days=idle_days)).isoformat()
        res = (
            self.db.table("orders")
            .select(
                "id, order_no, buyer_user_id, seller_user_id, shipped_at, "
                "tracking_stuck_since"
            )
            .eq("status", "shipped")
            .lt("shipped_at", cutoff)
            .execute()
        )
        rows = res.data or []
        marked = 0
        for r in rows:
            if r.get("tracking_stuck_since"):
                continue
            # 检查最新一条 tracking_event 时间
            try:
                latest = (
                    self.db.table("tracking_events")
                    .select("occurred_at")
                    .eq("order_id", r["id"])
                    .order("occurred_at", desc=True)
                    .limit(1)
                    .execute()
                )
                last_time = (
                    latest.data[0]["occurred_at"] if latest.data else r.get("shipped_at")
                )
                if not last_time:
                    continue
                last_dt = datetime.fromisoformat(
                    last_time.replace("Z", "+00:00")
                ).replace(tzinfo=None)
                if (now - last_dt).days < idle_days:
                    continue
            except Exception:
                continue
            self.db.table("orders").update(
                {
                    "tracking_stuck_since": now.isoformat(),
                    "auto_confirm_paused_at": now.isoformat(),
                }
            ).eq("id", r["id"]).execute()
            self._notify_stuck_package(r)
            marked += 1
        return marked

    # ---------- 提醒发送辅助 ----------

    def _send_confirm_reminder_3d(self, order_row: Dict[str, Any]) -> None:
        try:
            from app.services.notification_service import notification_service
            from app.schemas.notification import NotificationType
            product = self._product_brief(order_row["product_id"]) or {}
            title = product.get("title") or product.get("brand") or f"订单 #{order_row['order_no']}"
            notification_service.create_notification(
                user_id=order_row["buyer_user_id"],
                notification_type=NotificationType.SYSTEM,
                title="请确认收货",
                message=f"您购买的「{title}」已签收 3 天,请尽快确认无误后释放款项给卖家",
                action_data={
                    "navigateTo": "OrderDetail",
                    "navigateParams": {"orderId": order_row["id"]},
                },
                send_push=True,
            )
        except Exception as e:
            print(f"[orders] send 3d reminder failed: {e}")

    def _send_confirm_reminder_5d(self, order_row: Dict[str, Any]) -> None:
        # 站内信兜底 + 短信
        try:
            from app.services.notification_service import notification_service
            from app.schemas.notification import NotificationType
            product = self._product_brief(order_row["product_id"]) or {}
            title = product.get("title") or product.get("brand") or f"订单 #{order_row['order_no']}"
            notification_service.create_notification(
                user_id=order_row["buyer_user_id"],
                notification_type=NotificationType.SYSTEM,
                title="即将自动确认收货",
                message=f"「{title}」还有 2 天将自动确认。如有问题请尽快联系客服",
                action_data={
                    "navigateTo": "OrderDetail",
                    "navigateParams": {"orderId": order_row["id"]},
                },
                send_push=True,
            )
        except Exception as e:
            print(f"[orders] send 5d in-app reminder failed: {e}")

        # 取买家手机号发短信(可选)
        try:
            phone = self._buyer_phone(order_row["buyer_user_id"])
            if phone:
                from app.services.sms import get_sms_provider
                product = self._product_brief(order_row["product_id"]) or {}
                title = (
                    product.get("title") or product.get("brand") or order_row["order_no"]
                )
                get_sms_provider().send_template_sms(
                    phone=phone,
                    template_code="SMS_TPL_CONFIRM_RECEIPT_5D",
                    params={"product": title[:20], "days": "2"},
                )
        except Exception as e:
            print(f"[orders] send 5d sms failed: {e}")

    def _send_shipping_reminder(
        self, order_row: Dict[str, Any], *, hours_left: int
    ) -> None:
        seller_id = order_row.get("seller_user_id")
        if not seller_id:
            return
        try:
            from app.services.notification_service import notification_service
            from app.schemas.notification import NotificationType
            notification_service.create_notification(
                user_id=seller_id,
                notification_type=NotificationType.SYSTEM,
                title="请尽快发货",
                message=(
                    f"订单 #{order_row['order_no']} 还有 {hours_left} 小时,"
                    f"逾期未发货将自动退款给买家"
                ),
                action_data={
                    "navigateTo": "OrderDetail",
                    "navigateParams": {"orderId": order_row["id"]},
                },
                send_push=True,
            )
        except Exception as e:
            print(f"[orders] send shipping reminder failed: {e}")

        # 24h 临门一脚还要发短信
        if hours_left == 24:
            try:
                phone = self._seller_phone(seller_id)
                if phone:
                    from app.services.sms import get_sms_provider
                    get_sms_provider().send_template_sms(
                        phone=phone,
                        template_code="SMS_TPL_SHIPPING_24H",
                        params={"orderNo": order_row["order_no"][:20]},
                    )
            except Exception as e:
                print(f"[orders] send 24h shipping sms failed: {e}")

    def _notify_stuck_package(self, order_row: Dict[str, Any]) -> None:
        try:
            from app.services.notification_service import notification_service
            from app.schemas.notification import NotificationType
            for user_id in (
                order_row.get("buyer_user_id"),
                order_row.get("seller_user_id"),
            ):
                if not user_id:
                    continue
                notification_service.create_notification(
                    user_id=user_id,
                    notification_type=NotificationType.SYSTEM,
                    title="包裹物流停止更新",
                    message=(
                        f"订单 #{order_row['order_no']} 的包裹连续多日无物流更新,"
                        f"已暂停自动确认倒计时。请双方核实,如有异常请联系客服"
                    ),
                    action_data={
                        "navigateTo": "OrderDetail",
                        "navigateParams": {"orderId": order_row["id"]},
                    },
                    send_push=True,
                )
        except Exception as e:
            print(f"[orders] notify stuck failed: {e}")

    def _buyer_phone(self, user_id: int) -> Optional[str]:
        try:
            res = (
                self.db.table("users")
                .select("phone")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            return (res.data[0] or {}).get("phone") if res.data else None
        except Exception:
            return None

    def _seller_phone(self, user_id: int) -> Optional[str]:
        # 优先取 seller_kyc.contact_phone,fallback users.phone
        try:
            kyc = (
                self.db.table("seller_kyc")
                .select("contact_phone")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if kyc.data and kyc.data[0].get("contact_phone"):
                return kyc.data[0]["contact_phone"]
        except Exception:
            pass
        return self._buyer_phone(user_id)

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
