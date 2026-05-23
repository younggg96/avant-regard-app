"""
PRD 模块四 · 订单 / 出价 / 库存锁 路由。

  - POST   /orders/buy-now                立即购买（创建 hold + order + payment_intent）
  - POST   /orders/{id}/pay-mock          dev 用：直接将订单标记为 paid（mock 通道）
  - POST   /orders/{id}/ship              卖家发货
  - POST   /orders/{id}/deliver           物流签收（外部回调）
  - POST   /orders/{id}/confirm           买家确认收货 → completed
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
    ShipmentCreate,
    InspectionSubmit,
    OrderStatus,
)


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
    order = order_service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.buyerUserId != user_id:
        raise HTTPException(status_code=403, detail="仅买家可确认")
    try:
        updated = order_service.transition_status(
            order_id, OrderStatus.COMPLETED, actor_user_id=user_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(updated.dict())


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
    return success({"items": [o.dict() for o in orders], "total": total, "page": page, "pageSize": pageSize})


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
    items = [o.dict() for o in user_orders] + [o.dict() for o in merch_orders]
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
    return success(
        {
            "holdsExpired": order_service.expire_holds_due(),
            "offersExpired": offer_service.expire_overdue(),
            "ordersRefunded": order_service.expire_overdue_shipments(),
            "ordersAutoConfirmed": order_service.auto_confirm_delivered(),
            "ordersSettled": order_service.settle_completed(),
        }
    )


def _assert_seller_perm(order, user_id: int) -> None:
    if order.sellerUserId == user_id:
        return
    if order.sellerMerchantId:
        merchant = store_merchant_service.get_merchant_by_id(order.sellerMerchantId)
        if merchant and getattr(merchant, "userId", None) == user_id:
            return
    raise HTTPException(status_code=403, detail="仅卖家可操作")
