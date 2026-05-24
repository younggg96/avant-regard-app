"""
PRD 模块四 · 订单 / 出价 / 库存锁 路由。

  - POST   /orders/buy-now                立即购买（创建 hold + order + payment_intent）
  - POST   /orders/{id}/pay-mock          dev 用：直接将订单标记为 paid（mock 通道）
  - POST   /orders/{id}/ship              卖家发货
  - GET    /orders/{id}/shipment          查询物流凭证（买卖双方都可读）
  - GET    /orders/{id}/tracking-events   查询物流轨迹时间轴
  - POST   /admin/orders/{id}/tracking-events  Admin / Mock 手动注入轨迹事件
  - POST   /orders/{id}/sign              买家主动确认签收 → delivered
  - POST   /orders/{id}/deliver           物流签收（外部回调 / admin）
  - POST   /orders/{id}/confirm           买家确认收货 → completed (扣 1% 抽佣 + 卖家钱包 pending 锁 3 天 + 卖家结算通知)
  - POST   /orders/{id}/inspection        提交验货 Checklist
  - GET    /orders/me                     我作为买家
  - GET    /orders/me/sales               我作为卖家
  - GET    /orders/{id}                   订单详情
  - POST   /offers                        买家出价
  - POST   /offers/{id}/accept            卖家接受
  - POST   /offers/{id}/reject            卖家拒绝
  - POST   /offers/{id}/counter           卖家还价
  - POST   /offers/{id}/withdraw          买家撤回
  - GET    /offers/me                     我作为买家的出价
  - GET    /offers/me/incoming            我作为卖家收到的出价
  - POST   /admin/scheduler/run           手动触发一次 cron（清 holds / offers / overdue ship / auto-confirm / settle）
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.response import success
from app.api.deps import get_current_user, get_current_admin_user
from app.services.order_service import order_service
from app.services.offer_service import offer_service
from app.services.store_product_service import store_product_service
from app.services.store_merchant_service import store_merchant_service
from app.schemas.orders import (
    BuyNowRequest,
    OfferCreate,
    OfferCounter,
    PaymentStartRequest,
    ShipmentCreate,
    InspectionSubmit,
    OrderStatus,
)
from app.schemas.tracking import TrackingEventCreate
from app.services.logistics import tracking_service


orders_router = APIRouter(prefix="/orders", tags=["交易系统 / 订单"])
offers_router = APIRouter(prefix="/offers", tags=["交易系统 / 出价"])
admin_orders_router = APIRouter(prefix="/admin/orders", tags=["交易系统 / 后台订单"])


# --------------- Orders ---------------


@orders_router.post("/buy-now")
async def buy_now(body: BuyNowRequest, user_id: int = Depends(get_current_user)):
    try:
        order, hold = order_service.create_order_from_listing(
            product_id=body.productId,
            buyer_user_id=user_id,
            shipping_address=body.shippingAddress,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success({"order": order.dict(), "hold": hold.dict()})


@orders_router.post("/{order_id}/pay-mock")
async def pay_mock(order_id: int, user_id: int = Depends(get_current_user)):
    """开发用：mock provider 直接置为 paid。
    上线后此入口应改成真实 webhook，由支付通道回调。"""
    order = order_service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.buyerUserId != user_id:
        raise HTTPException(status_code=403, detail="无权操作")
    try:
        updated = order_service.transition_status(
            order_id, OrderStatus.PAID, actor_user_id=user_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(updated.dict())


# --------------- Payment (Stripe / Alipay / WeChat) ---------------


_PROVIDER_DISPLAY = {
    "alipay": {"name": "支付宝", "iconKey": "alipay"},
    "wechat": {"name": "微信支付", "iconKey": "wechat"},
    "stripe": {"name": "Stripe", "iconKey": "stripe"},
    "mock":   {"name": "Mock (dev)", "iconKey": "mock"},
}


@orders_router.get("/{order_id}/payment-options")
async def list_payment_options(
    order_id: int, user_id: int = Depends(get_current_user)
):
    """返回当前订单可用的支付方式，PaymentScreen 展示用。"""
    order = order_service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.buyerUserId != user_id:
        raise HTTPException(status_code=403, detail="无权操作")
    options = order_service.list_payment_options(order)
    return success({
        "items": [
            {
                "provider": p,
                "name": _PROVIDER_DISPLAY.get(p, {}).get("name", p),
                "iconKey": _PROVIDER_DISPLAY.get(p, {}).get("iconKey", p),
            }
            for p in options
        ],
        "currency": order.currency,
        "amountCents": order.paidPriceCents,
    })


@orders_router.post("/{order_id}/pay")
async def start_payment(
    order_id: int,
    body: PaymentStartRequest,
    user_id: int = Depends(get_current_user),
):
    """选择 provider，生成 / 重新生成 payment intent。前端再用返回的
    paymentMetadata 拉起对应通道 SDK。"""
    try:
        order = order_service.start_payment(
            order_id=order_id, user_id=user_id, provider_name=body.provider
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(order.dict())


@orders_router.post("/{order_id}/pay/confirm")
async def confirm_payment(order_id: int, user_id: int = Depends(get_current_user)):
    """前端 SDK 收到 success 回执后调用：触发后端走 provider.confirm，
    成功则将订单推到 paid。生产环境也应让 webhook 调同样的 service 方法。"""
    try:
        order = order_service.confirm_payment(order_id=order_id, user_id=user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(order.dict())


@orders_router.post("/{order_id}/ship")
async def ship_order(
    order_id: int, body: ShipmentCreate, user_id: int = Depends(get_current_user)
):
    order = order_service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    _assert_seller_perm(order, user_id)
    order_service.add_shipment(
        order_id,
        carrier=body.carrier,
        tracking_no=body.trackingNo,
        images=body.images,
    )
    try:
        updated = order_service.transition_status(
            order_id, OrderStatus.SHIPPED, actor_user_id=user_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(updated.dict())


@orders_router.get("/{order_id}/shipment")
async def get_order_shipment(
    order_id: int, user_id: int = Depends(get_current_user)
):
    """查询订单的物流凭证（买卖双方都可读）。无凭证时返回 null。"""
    order = order_service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.buyerUserId != user_id and order.sellerUserId != user_id:
        if order.sellerMerchantId:
            merchant = store_merchant_service.get_merchant_by_id(order.sellerMerchantId)
            if not merchant or getattr(merchant, "userId", None) != user_id:
                raise HTTPException(status_code=403, detail="无权查看")
        else:
            raise HTTPException(status_code=403, detail="无权查看")
    shipment = order_service.get_shipment(order_id)
    return success(shipment.dict() if shipment else None)


@orders_router.get("/{order_id}/tracking-events")
async def list_tracking_events(
    order_id: int, user_id: int = Depends(get_current_user)
):
    """订单详情时间轴拉数据。仅买卖双方可读。"""
    order = order_service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.buyerUserId != user_id and order.sellerUserId != user_id:
        if order.sellerMerchantId:
            merchant = store_merchant_service.get_merchant_by_id(order.sellerMerchantId)
            if not merchant or getattr(merchant, "userId", None) != user_id:
                raise HTTPException(status_code=403, detail="无权查看")
        else:
            raise HTTPException(status_code=403, detail="无权查看")
    feed = tracking_service.list_events(order_id)
    return success(feed.dict())


@orders_router.post("/{order_id}/sign")
async def buyer_sign(order_id: int, user_id: int = Depends(get_current_user)):
    """买家主动确认签收 (shipped → delivered)。

    上线对接快递回调后此入口仍保留作为兜底，
    比如代收 / 自提等快递扫不到「派送签收」事件的场景。
    """
    try:
        updated = order_service.buyer_sign_for(order_id, user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(updated.dict())


@orders_router.post("/{order_id}/deliver")
async def mark_delivered(order_id: int, _admin=Depends(get_current_admin_user)):
    """物流签收。MVP 阶段由 admin 标记；上线后接快递回调。"""
    try:
        updated = order_service.transition_status(
            order_id, OrderStatus.DELIVERED, actor_user_id=0, is_admin=True
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(updated.dict())


@orders_router.post("/{order_id}/confirm")
async def buyer_confirm(order_id: int, user_id: int = Depends(get_current_user)):
    """买家确认收货 → completed。

    与单纯的状态机推进相比，本接口额外返回结算明细
    （成交金额 / 1% 手续费 / 卖家实收 / 解冻时间），方便前端跳「确认收货成功」页。
    """
    try:
        updated, pending = order_service.buyer_confirm_receipt(order_id, user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(
        {
            "order": updated.dict(),
            "settlement": {
                "orderId": updated.id,
                "orderNo": updated.orderNo,
                "grossAmountCents": updated.paidPriceCents,
                "commissionCents": updated.commissionCents,
                "commissionRateBps": updated.commissionRateBps,
                "sellerPayoutCents": updated.sellerPayoutCents,
                "currency": updated.currency,
                "releaseAt": (pending or {}).get("release_at"),
                "completedAt": updated.completedAt,
            },
        }
    )


@orders_router.post("/{order_id}/inspection")
async def submit_inspection(
    order_id: int, body: InspectionSubmit, user_id: int = Depends(get_current_user)
):
    order = order_service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.buyerUserId != user_id:
        raise HTTPException(status_code=403, detail="仅买家可提交验货")
    order_service.db.table("order_inspections").insert(
        {
            "order_id": order_id,
            "checked_items": body.checkedItems,
            "photos": body.photos,
            "note": body.note,
            "submitted_by": user_id,
        }
    ).execute()
    return success({"ok": True})


def _enrich_orders_with_product(orders) -> list:
    """给一批订单挂上 product 摘要, 返回可直接 jsonable 的字典列表。

    Profile「交易」tab 与设置页 MyOrders/MySales 都要在卡片上同时展示
    商品封面 / 品牌 / 标题, 不能只看订单本身。改成在路由层批量预取一次,
    避免客户端按需补拉时遇到 N 张卡 = N 次请求的回流。
    """
    if not orders:
        return []
    pid_map = order_service._build_product_brief_map([o.productId for o in orders])
    out = []
    for o in orders:
        d = o.dict()
        d["product"] = pid_map.get(o.productId)
        out.append(d)
    return out


@orders_router.get("/me")
async def list_my_orders(
    status: Optional[str] = None,
    page: int = 1,
    pageSize: int = 20,
    user_id: int = Depends(get_current_user),
):
    orders, total = order_service.list_orders(
        buyer_user_id=user_id, status=status, page=page, page_size=pageSize
    )
    return success({
        "items": _enrich_orders_with_product(orders),
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@orders_router.get("/me/summary")
async def my_orders_summary(user_id: int = Depends(get_current_user)):
    """买家「我的购物」首页顶部状态卡片用。

    返回当前用户作为买家在每个 ``OrderStatus`` 下的订单数量，
    前端用聚合后的 pending_payment / paid / shipped / delivered 等
    驱动 4 张状态卡片的角标，点击跳到 MyOrders 对应 tab。
    """
    counts = order_service.status_summary(buyer_user_id=user_id)
    total = sum(counts.values())
    return success({"counts": counts, "total": total})


@orders_router.get("/me/sales/summary")
async def my_sales_summary(user_id: int = Depends(get_current_user)):
    """卖家中心首页顶部状态卡片用。

    把「个人卖家身份 + 关联买手店身份」两边的订单数量合并返回，
    避免前端拉两次再相加，与 /me/sales 列表口径保持一致。
    """
    user_counts = order_service.status_summary(seller_user_id=user_id)
    merchant = store_merchant_service.get_merchant_by_user(user_id)
    merch_counts = (
        order_service.status_summary(seller_merchant_id=merchant.id)
        if merchant
        else {}
    )
    counts = {k: user_counts.get(k, 0) + merch_counts.get(k, 0) for k in user_counts}
    total = sum(counts.values())
    return success({"counts": counts, "total": total})


@orders_router.get("/me/sales")
async def list_my_sales(
    status: Optional[str] = None,
    page: int = 1,
    pageSize: int = 20,
    user_id: int = Depends(get_current_user),
):
    user_orders, user_total = order_service.list_orders(
        seller_user_id=user_id, status=status, page=page, page_size=pageSize
    )
    merchant = store_merchant_service.get_merchant_by_user(user_id)
    merch_orders, merch_total = (
        order_service.list_orders(
            seller_merchant_id=merchant.id, status=status, page=page, page_size=pageSize
        )
        if merchant
        else ([], 0)
    )
    items = (
        _enrich_orders_with_product(user_orders)
        + _enrich_orders_with_product(merch_orders)
    )
    items.sort(key=lambda x: x.get("createdAt") or "", reverse=True)
    return success(
        {
            "items": items,
            "total": user_total + merch_total,
            "page": page,
            "pageSize": pageSize,
        }
    )


@orders_router.get("/{order_id}")
async def get_order_detail(order_id: int, user_id: int = Depends(get_current_user)):
    order = order_service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.buyerUserId != user_id and order.sellerUserId != user_id:
        if order.sellerMerchantId:
            merchant = store_merchant_service.get_merchant_by_id(order.sellerMerchantId)
            if not merchant or getattr(merchant, "userId", None) != user_id:
                raise HTTPException(status_code=403, detail="无权查看")
        else:
            raise HTTPException(status_code=403, detail="无权查看")
    return success(order.dict())


# --------------- Offers ---------------


@offers_router.post("")
async def create_offer(body: OfferCreate, user_id: int = Depends(get_current_user)):
    try:
        offer = offer_service.create(
            product_id=body.productId,
            buyer_user_id=user_id,
            price_cents=body.priceCents,
            message=body.message,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(offer.dict())


@offers_router.post("/{offer_id}/accept")
async def accept_offer(offer_id: int, user_id: int = Depends(get_current_user)):
    try:
        order, hold, offer = offer_service.accept(offer_id, user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success({"order": order.dict(), "hold": hold.dict(), "offer": offer.dict()})


@offers_router.post("/{offer_id}/reject")
async def reject_offer(offer_id: int, user_id: int = Depends(get_current_user)):
    try:
        offer = offer_service.reject(offer_id, user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(offer.dict())


@offers_router.post("/{offer_id}/counter")
async def counter_offer(
    offer_id: int, body: OfferCounter, user_id: int = Depends(get_current_user)
):
    try:
        offer = offer_service.counter(
            offer_id,
            user_id,
            price_cents=body.priceCents,
            message=body.message,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(offer.dict())


@offers_router.post("/{offer_id}/withdraw")
async def withdraw_offer(offer_id: int, user_id: int = Depends(get_current_user)):
    try:
        offer = offer_service.withdraw(offer_id, user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(offer.dict())


@offers_router.get("/me")
async def list_my_offers(
    status: Optional[str] = None,
    page: int = 1,
    pageSize: int = 20,
    user_id: int = Depends(get_current_user),
):
    items, total = offer_service.list_for_user_enriched(
        user_id, role="buyer", status=status, page=page, page_size=pageSize
    )
    return success({"items": items, "total": total})


@offers_router.get("/me/incoming")
async def list_incoming_offers(
    status: Optional[str] = None,
    page: int = 1,
    pageSize: int = 20,
    user_id: int = Depends(get_current_user),
):
    items, total = offer_service.list_for_user_enriched(
        user_id, role="seller", status=status, page=page, page_size=pageSize
    )
    return success({"items": items, "total": total})


# --------------- Admin / 调度器 ---------------


@admin_orders_router.post("/scheduler/run")
async def run_scheduler(_admin=Depends(get_current_admin_user)):
    """单次执行所有 cron 任务。生产环境应改成由 APScheduler / Cloud Cron 触发。"""
    from app.services.wallet_service import wallet_service
    return success(
        {
            "holdsExpired": order_service.expire_holds_due(),
            "offersExpired": offer_service.expire_overdue(),
            "ordersRefunded": order_service.expire_overdue_shipments(),
            "ordersAutoConfirmed": order_service.auto_confirm_delivered(),
            "pendingPayoutsReleased": wallet_service.release_due_pending(),
            "ordersSettled": order_service.settle_completed(),
            "trackingPulled": tracking_service.pull_pending_shipments(),
        }
    )


class AdminRefundRequest(BaseModel):
    reason: Optional[str] = Field(
        None,
        max_length=200,
        description="退款原因 / 客服备注，会写入 orders.cancel_reason 与 settlement_ledger.metadata",
    )


@admin_orders_router.post("/{order_id}/refund")
async def admin_refund_order(
    order_id: int,
    body: AdminRefundRequest,
    admin_user_id: int = Depends(get_current_admin_user),
):
    """客服 IM 售后 v1：唯一动作 = 退款。

    入口：客服在聊天里点 order_status 卡片上的「退款」按钮。
    成功后：
      - 订单状态置为 REFUNDED（允许从 paid / shipped / delivered / completed 进入）
      - 若已 credit 到卖家钱包 pending_payouts，则反向冲账，保持账本守恒
      - 自动把刷新后的 order_status 卡片推送给买卖双方
    """
    order = order_service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    try:
        updated = order_service.transition_status(
            order_id,
            OrderStatus.REFUNDED,
            actor_user_id=admin_user_id,
            is_admin=True,
            reason=body.reason or "客服仲裁退款",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(updated.dict())


@admin_orders_router.post("/{order_id}/tracking-events")
async def admin_inject_tracking_event(
    order_id: int,
    payload: TrackingEventCreate,
    _admin=Depends(get_current_admin_user),
):
    """Admin / Mock provider 手动注入轨迹事件。

    用于：
      1. dev 联调阶段验证时间轴 UI + 推送
      2. 真物流方失联时的人工兜底
    """
    try:
        ev = tracking_service.admin_inject_event(order_id=order_id, payload=payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not ev:
        # 重复事件被去重；不当成错误
        return success({"deduped": True})
    return success(ev.dict())


def _assert_seller_perm(order, user_id: int) -> None:
    if order.sellerUserId == user_id:
        return
    if order.sellerMerchantId:
        merchant = store_merchant_service.get_merchant_by_id(order.sellerMerchantId)
        if merchant and getattr(merchant, "userId", None) == user_id:
            return
    raise HTTPException(status_code=403, detail="仅卖家可操作")
