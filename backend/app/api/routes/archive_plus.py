"""
PRD 模块 6 & 8 · My Archive / Plus 订阅 路由。
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.core.response import success
from app.api.deps import get_current_user
from app.services.archive_service import archive_service
from app.services.plus_service import plus_service
from app.services.store_product_service import store_product_service
from app.schemas.archive_plus import (
    PlusSubscribeRequest,
    PlusPlan,
    ArchiveItemManualCreate,
    ArchiveHoldingCreate,
)
from app.schemas.store_product import StoreProductCreate, SellerKind, ProductStatus, PhotoAngles


archive_router = APIRouter(prefix="/archive", tags=["交易系统 / My Archive"])
plus_router = APIRouter(prefix="/plus", tags=["交易系统 / Plus 订阅"])


# ==========================================================================
# Archive
# ==========================================================================


@archive_router.get("/items")
def list_archive(
    page: int = 1, pageSize: int = 30, user_id: int = Depends(get_current_user)
):
    items, total = archive_service.list_for_user(
        user_id, page=page, page_size=pageSize
    )
    return success({"items": [i.dict() for i in items], "total": total})


@archive_router.get("/analytics")
def archive_analytics(user_id: int = Depends(get_current_user)):
    """PRD 模块 8 数据画像面板。Plus 用户独占。"""
    if not plus_service.is_user_plus(user_id):
        raise HTTPException(status_code=403, detail="数据画像面板需要 Plus 订阅")
    return success(archive_service.analytics(user_id).dict())


@archive_router.get("/analytics-preview")
def archive_analytics_preview(user_id: int = Depends(get_current_user)):
    """非 Plus 用户的预览，仅返回 totalItems / brandBreakdown 关键字段。"""
    a = archive_service.analytics(user_id)
    return success(
        {
            "totalItems": a.totalItems,
            "brandBreakdown": dict(list(a.brandBreakdown.items())[:5]),
            "locked": not plus_service.is_user_plus(user_id),
        }
    )


# ----- PDF p.21 · 独立上传 -----
@archive_router.post("/items")
def create_archive_item(
    body: ArchiveItemManualCreate, user_id: int = Depends(get_current_user)
):
    item = archive_service.manual_create(user_id, body)
    return success(item.dict())


# ----- 将已购入订单转入 MY ARCHIVE -----
@archive_router.get("/from-order/{order_id}")
def archive_from_order_status(
    order_id: int, user_id: int = Depends(get_current_user)
):
    """查询某订单是否已转入当前用户的藏品，供前端决定入口按钮文案。"""
    item = archive_service.get_by_order(order_id, user_id)
    return success({"item": item.dict() if item else None})


@archive_router.post("/from-order/{order_id}")
def archive_transfer_from_order(
    order_id: int, user_id: int = Depends(get_current_user)
):
    """把买家已购入 / 卖家已售出的商品转入 MY ARCHIVE（幂等）。"""
    try:
        item = archive_service.transfer_from_order(order_id, user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(item.dict())


# ----- PDF p.22 · 持有记录 -----
@archive_router.get("/items/{archive_id}/holdings")
def list_holdings(archive_id: int, user_id: int = Depends(get_current_user)):
    items = archive_service.list_holdings(archive_id, user_id)
    return success([i.dict() for i in items])


@archive_router.post("/items/{archive_id}/holdings")
def create_holding(
    archive_id: int,
    body: ArchiveHoldingCreate,
    user_id: int = Depends(get_current_user),
):
    try:
        res = archive_service.add_holding(archive_id, user_id, body)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return success(res.dict())


@archive_router.post("/items/{archive_id}/resell")
def resell_archive(
    archive_id: int,
    body: dict | None = None,
    user_id: int = Depends(get_current_user),
):
    """一键转卖：用 archive 数据 prefill 一条新的 draft listing。

    Body 可选 priceCents / condition / description / acceptOffer 等覆盖项；
    其余字段由 archive snapshot 提供。
    """
    item = archive_service.get(archive_id)
    if not item or item.userId != user_id:
        raise HTTPException(status_code=404, detail="未找到该藏品")

    body = body or {}
    create_payload = StoreProductCreate(
        title=item.title or "转卖单品",
        brand=item.brandName,
        size=item.size,
        color=item.color,
        condition=item.condition,
        conditionNote=body.get("conditionNote"),
        originalShowId=item.originalShowId,
        originalAcquiredAt=item.acquiredAt,
        acceptOffer=body.get("acceptOffer", True),
        priceCents=body.get("priceCents", item.acquiredPriceCents or 0),
        currency=item.currency,
        sellerKind=SellerKind.INDIVIDUAL,
        status=ProductStatus.DRAFT,
        images=item.photos,
        photoAngles=PhotoAngles(**body["photoAngles"])
        if isinstance(body.get("photoAngles"), dict)
        else None,
        description=body.get("description"),
    )
    new_listing = store_product_service.create_individual_listing(
        user_id, create_payload
    )
    archive_service.mark_relisted(archive_id, new_listing.id)
    return success(new_listing.dict())


# ==========================================================================
# Plus
# ==========================================================================


@plus_router.get("/status")
def plus_status(user_id: int = Depends(get_current_user)):
    return success(plus_service.status_for(user_id).dict())


@plus_router.post("/subscribe")
def plus_subscribe(body: PlusSubscribeRequest, user_id: int = Depends(get_current_user)):
    try:
        sub = plus_service.subscribe(user_id, body.plan)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(sub.dict())


@plus_router.post("/subscriptions/{sub_id}/confirm-mock")
def plus_confirm_mock(sub_id: int, user_id: int = Depends(get_current_user)):
    """开发用：直接置 active。生产环境(`DEBUG=False`)一律 404,
    真实付款由 stripe webhook → plus_service.confirm_by_intent 推动。"""
    from app.core.config import settings
    if not settings.DEBUG:
        raise HTTPException(status_code=404, detail="not_found")
    try:
        sub = plus_service.confirm(sub_id, user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(sub.dict())


@plus_router.post("/subscriptions/{sub_id}/cancel")
def plus_cancel(sub_id: int, user_id: int = Depends(get_current_user)):
    try:
        sub = plus_service.cancel(sub_id, user_id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(sub.dict())


@plus_router.get("/subscriptions")
def plus_list(user_id: int = Depends(get_current_user)):
    return success([s.dict() for s in plus_service.list_for_user(user_id)])
