"""
PRD 模块 5 · 售后 / 鉴定 / 双盲互评 路由聚合。
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.response import success
from app.api.deps import get_current_user, get_current_admin_user
from app.services.dispute_service import dispute_service
from app.services.authentication_service import authentication_service
from app.services.trade_review_service import trade_review_service
from app.schemas.disputes import (
    DisputeCreate,
    DisputeResolve,
    DisputeSellerRespond,
    AuthenticationOrderCreate,
    AuthenticationDecision,
    TradeReviewCreate,
    TradeReviewStatusBatchRequest,
)


disputes_router = APIRouter(prefix="/disputes", tags=["交易系统 / 售后争议"])
authentication_router = APIRouter(prefix="/authentication", tags=["交易系统 / 鉴定"])
reviews_router = APIRouter(prefix="/trade-reviews", tags=["交易系统 / 双盲互评"])

admin_disputes_router = APIRouter(prefix="/admin/disputes", tags=["交易系统 / 后台仲裁"])
admin_auth_router = APIRouter(prefix="/admin/authentication", tags=["交易系统 / 后台鉴定"])


# ==========================================================================
# Disputes
# ==========================================================================


@disputes_router.post("")
def open_dispute(body: DisputeCreate, user_id: int = Depends(get_current_user)):
    try:
        d = dispute_service.open_dispute(
            order_id=body.orderId,
            opener_user_id=user_id,
            reason=body.reason.value,
            description=body.description,
            evidence_photos=body.evidencePhotos,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(d.dict())


@disputes_router.post("/{dispute_id}/withdraw")
def withdraw_dispute(dispute_id: int, user_id: int = Depends(get_current_user)):
    try:
        d = dispute_service.withdraw(dispute_id, user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(d.dict())


@disputes_router.get("/orders/{order_id}")
def list_dispute_for_order(order_id: int, _user=Depends(get_current_user)):
    return success([d.dict() for d in dispute_service.list_for_order(order_id)])


@disputes_router.get("/seller")
def list_seller_disputes(
    status: Optional[str] = None,
    page: int = 1,
    pageSize: int = 20,
    user_id: int = Depends(get_current_user),
):
    """卖家端：拉取自己名下所有订单上买家提交的售后请求列表。"""
    items, total = dispute_service.list_for_seller(
        user_id, status=status, page=page, page_size=pageSize
    )
    return success({"items": [d.dict() for d in items], "total": total})


@disputes_router.post("/{dispute_id}/seller-respond")
def seller_respond_dispute(
    dispute_id: int,
    body: DisputeSellerRespond,
    user_id: int = Depends(get_current_user),
):
    """卖家端：对买家售后请求做出响应（同意退款 / 拒绝并申诉）。"""
    try:
        d = dispute_service.seller_respond(
            dispute_id,
            user_id,
            action=body.action.value,
            message=body.message,
            evidence_photos=body.evidencePhotos,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(d.dict())


@admin_disputes_router.get("/queue")
def admin_dispute_queue(
    page: int = 1, pageSize: int = 30, _admin=Depends(get_current_admin_user)
):
    items, total = dispute_service.list_pending(page=page, page_size=pageSize)
    return success({"items": [d.dict() for d in items], "total": total})


@admin_disputes_router.post("/{dispute_id}/take")
def admin_take_dispute(dispute_id: int, admin_id: int = Depends(get_current_admin_user)):
    try:
        d = dispute_service.take(dispute_id, admin_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(d.dict())


@admin_disputes_router.post("/{dispute_id}/resolve")
def admin_resolve_dispute(
    dispute_id: int, body: DisputeResolve, admin_id: int = Depends(get_current_admin_user)
):
    try:
        d = dispute_service.resolve(
            dispute_id,
            admin_id,
            decision=body.decision.value if hasattr(body.decision, "value") else body.decision,
            note=body.note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(d.dict())


# ==========================================================================
# Authentication
# ==========================================================================


@authentication_router.get("/packages")
def list_packages():
    pkgs = authentication_service.list_packages()
    return success([p.dict() for p in pkgs])


@authentication_router.post("/orders")
def create_auth_order(
    body: AuthenticationOrderCreate, user_id: int = Depends(get_current_user)
):
    try:
        o = authentication_service.create_order(
            user_id=user_id,
            package_code=body.packageCode,
            product_id=body.productId,
            brand_name=body.brandName,
            item_photos=body.itemPhotos,
            note=body.note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(o.dict())


@authentication_router.post("/orders/{order_id}/pay-mock")
def pay_auth_order_mock(order_id: int, user_id: int = Depends(get_current_user)):
    """开发联调用,生产环境一律 404。真实付款由 stripe webhook → 
    authentication_service.confirm_by_intent 推动。"""
    from app.core.config import settings
    if not settings.DEBUG:
        raise HTTPException(status_code=404, detail="not_found")
    try:
        o = authentication_service.pay_mock(order_id, user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(o.dict())


@authentication_router.get("/orders/me")
def list_my_auth_orders(
    page: int = 1, pageSize: int = 20, user_id: int = Depends(get_current_user)
):
    items, total = authentication_service.list_for_user(
        user_id, page=page, page_size=pageSize
    )
    return success({"items": [o.dict() for o in items], "total": total})


@admin_auth_router.get("/orders")
def admin_list_auth_orders(
    status: Optional[str] = None,
    page: int = 1,
    pageSize: int = 30,
    _admin=Depends(get_current_admin_user),
):
    items, total = authentication_service.list_for_admin(
        status=status, page=page, page_size=pageSize
    )
    return success({"items": [o.dict() for o in items], "total": total})


@admin_auth_router.post("/orders/{order_id}/decision")
def admin_submit_auth_decision(
    order_id: int, body: AuthenticationDecision, admin_id: int = Depends(get_current_admin_user)
):
    try:
        o = authentication_service.submit_decision(
            order_id,
            expert_user_id=admin_id,
            result=body.result,
            expert_report=body.expertReport,
            certificate_url=body.certificateUrl,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(o.dict())


# ==========================================================================
# Trade reviews (双盲)
# ==========================================================================


@reviews_router.post("")
def submit_review(body: TradeReviewCreate, user_id: int = Depends(get_current_user)):
    try:
        r = trade_review_service.submit(
            order_id=body.orderId,
            reviewer_user_id=user_id,
            rating=body.rating,
            payload=body.payload,
            comment=body.comment,
            photos=body.photos,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(r.dict())


@reviews_router.get("/users/{user_id}")
def list_user_reviews(
    user_id: int, page: int = 1, pageSize: int = 20
):
    # 卖家历史评价页：只返回真实买家对该卖家（target=user_id）的评价
    items, total = trade_review_service.list_for_user(
        user_id,
        only_visible=True,
        reviewer_role="buyer",
        page=page,
        page_size=pageSize,
    )
    return success({"items": [r.dict() for r in items], "total": total})


@reviews_router.get("/orders/{order_id}/status")
def get_order_review_status(order_id: int, user_id: int = Depends(get_current_user)):
    try:
        status = trade_review_service.get_order_review_status(order_id, viewer_user_id=user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(status.dict())


@reviews_router.post("/status/batch")
def batch_order_review_status(
    body: TradeReviewStatusBatchRequest, user_id: int = Depends(get_current_user)
):
    items = trade_review_service.batch_order_review_status(
        body.orderIds, viewer_user_id=user_id
    )
    return success([s.dict() for s in items])


@reviews_router.get("/orders/{order_id}")
def list_order_reviews(order_id: int, user_id: int = Depends(get_current_user)):
    try:
        items = trade_review_service.list_for_order(order_id, viewer_user_id=user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success([r.dict() for r in items])
