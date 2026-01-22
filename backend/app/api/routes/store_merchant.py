"""
商家入驻系统 API 路由
包含：商家认证、公告、活动、折扣、Banner 接口
"""

from fastapi import APIRouter, Query, HTTPException, Depends
from typing import Optional

from app.core.response import success
from app.services.store_merchant_service import store_merchant_service
from app.schemas.store_merchant import (
    StoreMerchantCreate,
    StoreMerchantUpdate,
    StoreMerchantReview,
    StoreAnnouncementCreate,
    StoreAnnouncementUpdate,
    StoreBannerCreate,
    StoreBannerUpdate,
    StoreActivityCreate,
    StoreActivityUpdate,
    StoreDiscountCreate,
    StoreDiscountUpdate,
    ActivityRegistrationCreate,
)
from app.api.deps import get_current_admin_user, get_current_user

router = APIRouter(prefix="/store-merchants", tags=["商家入驻"])


# ==================== 商家认证接口 ====================


@router.post("/apply")
async def apply_merchant(
    data: StoreMerchantCreate,
    current_user_id: int = Depends(get_current_user),
):
    """申请成为商家"""
    try:
        merchant = store_merchant_service.apply_merchant(current_user_id, data)
        return success(merchant.model_dump(), message="申请提交成功，等待审核")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my")
async def get_my_merchants(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user),
):
    """获取我的商家列表"""
    merchants, total = store_merchant_service.get_user_merchants(
        current_user_id, page, pageSize
    )
    return success({
        "merchants": [m.model_dump() for m in merchants],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.get("/by-store/{store_id}")
async def get_merchant_by_store(store_id: str):
    """通过店铺ID获取商家信息"""
    merchant = store_merchant_service.get_merchant_by_store(store_id)
    if merchant:
        return success(merchant.model_dump())
    return success(None)


@router.put("/{merchant_id}")
async def update_merchant(
    merchant_id: int,
    data: StoreMerchantUpdate,
    current_user_id: int = Depends(get_current_user),
):
    """更新商家信息"""
    try:
        merchant = store_merchant_service.update_merchant(
            merchant_id, current_user_id, data
        )
        return success(merchant.model_dump(), message="更新成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/pending")
async def get_pending_merchants(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取待审核的商家列表（管理员）"""
    merchants, total = store_merchant_service.get_pending_merchants(page, pageSize)
    return success({
        "merchants": [m.model_dump() for m in merchants],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.put("/{merchant_id}/review")
async def review_merchant(
    merchant_id: int,
    data: StoreMerchantReview,
    current_user_id: int = Depends(get_current_admin_user),
):
    """审核商家申请（管理员）"""
    try:
        merchant = store_merchant_service.review_merchant(
            merchant_id, current_user_id, data
        )
        return success(merchant.model_dump(), message="审核完成")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== 公告接口 ====================


@router.post("/{merchant_id}/announcements")
async def create_announcement(
    merchant_id: int,
    data: StoreAnnouncementCreate,
    current_user_id: int = Depends(get_current_user),
):
    """创建公告"""
    # 验证商家权限
    merchant = store_merchant_service.get_merchant_by_id(merchant_id)
    if not merchant or merchant.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权限操作")
    if merchant.status != "APPROVED":
        raise HTTPException(status_code=403, detail="商家认证未通过")
    if not merchant.canPostAnnouncement:
        raise HTTPException(status_code=403, detail="无发布公告权限")

    try:
        announcement = store_merchant_service.create_announcement(
            merchant_id, merchant.storeId, data
        )
        return success(announcement.model_dump(), message="发布成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/announcements/{announcement_id}")
async def update_announcement(
    announcement_id: int,
    data: StoreAnnouncementUpdate,
    current_user_id: int = Depends(get_current_user),
):
    """更新公告"""
    # 获取商家信息
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    if not merchant:
        raise HTTPException(status_code=403, detail="您不是商家")

    try:
        announcement = store_merchant_service.update_announcement(
            announcement_id, merchant.id, data
        )
        return success(announcement.model_dump(), message="更新成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: int,
    current_user_id: int = Depends(get_current_user),
):
    """删除公告"""
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    if not merchant:
        raise HTTPException(status_code=403, detail="您不是商家")

    if store_merchant_service.delete_announcement(announcement_id, merchant.id):
        return success(None, message="删除成功")
    raise HTTPException(status_code=404, detail="公告不存在或无权限删除")


@router.get("/{merchant_id}/announcements")
async def get_merchant_announcements(
    merchant_id: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user),
):
    """获取商家的公告列表"""
    # 验证是否是该商家
    merchant = store_merchant_service.get_merchant_by_id(merchant_id)
    if not merchant or merchant.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权限查看")

    announcements, total = store_merchant_service.get_merchant_announcements(
        merchant_id, page, pageSize
    )
    return success({
        "announcements": [a.model_dump() for a in announcements],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


# ==================== Banner 接口 ====================


@router.post("/{merchant_id}/banners")
async def create_banner(
    merchant_id: int,
    data: StoreBannerCreate,
    current_user_id: int = Depends(get_current_user),
):
    """创建 Banner"""
    merchant = store_merchant_service.get_merchant_by_id(merchant_id)
    if not merchant or merchant.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权限操作")
    if merchant.status != "APPROVED":
        raise HTTPException(status_code=403, detail="商家认证未通过")
    if not merchant.canPostBanner:
        raise HTTPException(status_code=403, detail="无发布 Banner 权限")

    try:
        banner = store_merchant_service.create_banner(
            merchant_id, merchant.storeId, data
        )
        return success(banner.model_dump(), message="发布成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/banners/{banner_id}")
async def update_banner(
    banner_id: int,
    data: StoreBannerUpdate,
    current_user_id: int = Depends(get_current_user),
):
    """更新 Banner"""
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    if not merchant:
        raise HTTPException(status_code=403, detail="您不是商家")

    try:
        banner = store_merchant_service.update_banner(banner_id, merchant.id, data)
        return success(banner.model_dump(), message="更新成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/banners/{banner_id}")
async def delete_banner(
    banner_id: int,
    current_user_id: int = Depends(get_current_user),
):
    """删除 Banner"""
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    if not merchant:
        raise HTTPException(status_code=403, detail="您不是商家")

    if store_merchant_service.delete_banner(banner_id, merchant.id):
        return success(None, message="删除成功")
    raise HTTPException(status_code=404, detail="Banner 不存在或无权限删除")


@router.get("/{merchant_id}/banners")
async def get_merchant_banners(
    merchant_id: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user),
):
    """获取商家的 Banner 列表"""
    merchant = store_merchant_service.get_merchant_by_id(merchant_id)
    if not merchant or merchant.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权限查看")

    banners, total = store_merchant_service.get_merchant_banners(
        merchant_id, page, pageSize
    )
    return success({
        "banners": [b.model_dump() for b in banners],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.post("/banners/{banner_id}/click")
async def record_banner_click(banner_id: int):
    """记录 Banner 点击"""
    store_merchant_service.increment_banner_click(banner_id)
    return success(None)


# ==================== 活动接口 ====================


@router.post("/{merchant_id}/activities")
async def create_activity(
    merchant_id: int,
    data: StoreActivityCreate,
    current_user_id: int = Depends(get_current_user),
):
    """创建活动"""
    merchant = store_merchant_service.get_merchant_by_id(merchant_id)
    if not merchant or merchant.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权限操作")
    if merchant.status != "APPROVED":
        raise HTTPException(status_code=403, detail="商家认证未通过")
    if not merchant.canPostActivity:
        raise HTTPException(status_code=403, detail="无发布活动权限")

    try:
        activity = store_merchant_service.create_activity(
            merchant_id, merchant.storeId, data
        )
        return success(activity.model_dump(), message="发布成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/activities/{activity_id}")
async def update_activity(
    activity_id: int,
    data: StoreActivityUpdate,
    current_user_id: int = Depends(get_current_user),
):
    """更新活动"""
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    if not merchant:
        raise HTTPException(status_code=403, detail="您不是商家")

    try:
        activity = store_merchant_service.update_activity(
            activity_id, merchant.id, data
        )
        return success(activity.model_dump(), message="更新成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/activities/{activity_id}")
async def delete_activity(
    activity_id: int,
    current_user_id: int = Depends(get_current_user),
):
    """删除活动"""
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    if not merchant:
        raise HTTPException(status_code=403, detail="您不是商家")

    if store_merchant_service.delete_activity(activity_id, merchant.id):
        return success(None, message="删除成功")
    raise HTTPException(status_code=404, detail="活动不存在或无权限删除")


@router.get("/{merchant_id}/activities")
async def get_merchant_activities(
    merchant_id: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user),
):
    """获取商家的活动列表"""
    merchant = store_merchant_service.get_merchant_by_id(merchant_id)
    if not merchant or merchant.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权限查看")

    activities, total = store_merchant_service.get_merchant_activities(
        merchant_id, page, pageSize
    )
    return success({
        "activities": [a.model_dump() for a in activities],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.get("/activities/{activity_id}")
async def get_activity_detail(activity_id: int):
    """获取活动详情"""
    activity = store_merchant_service.get_activity_by_id(activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="活动不存在")
    return success(activity.model_dump())


@router.post("/activities/{activity_id}/register")
async def register_activity(
    activity_id: int,
    data: ActivityRegistrationCreate,
    current_user_id: int = Depends(get_current_user),
):
    """报名活动"""
    try:
        registration = store_merchant_service.register_activity(
            activity_id, current_user_id, data
        )
        return success(registration.model_dump(), message="报名成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/activities/{activity_id}/register")
async def cancel_activity_registration(
    activity_id: int,
    current_user_id: int = Depends(get_current_user),
):
    """取消报名"""
    if store_merchant_service.cancel_registration(activity_id, current_user_id):
        return success(None, message="取消报名成功")
    raise HTTPException(status_code=404, detail="未找到报名记录")


@router.get("/activities/{activity_id}/registrations")
async def get_activity_registrations(
    activity_id: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user),
):
    """获取活动报名列表（商家）"""
    # 验证是否是活动的商家
    activity = store_merchant_service.get_activity_by_id(activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="活动不存在")

    merchant = store_merchant_service.get_merchant_by_id(activity.merchantId)
    if not merchant or merchant.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权限查看")

    registrations, total = store_merchant_service.get_activity_registrations(
        activity_id, page, pageSize
    )
    return success({
        "registrations": [r.model_dump() for r in registrations],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.get("/activities/{activity_id}/check-registration")
async def check_activity_registration(
    activity_id: int,
    current_user_id: int = Depends(get_current_user),
):
    """检查是否已报名"""
    is_registered = store_merchant_service.check_user_registration(
        activity_id, current_user_id
    )
    return success({"isRegistered": is_registered})


# ==================== 折扣接口 ====================


@router.post("/{merchant_id}/discounts")
async def create_discount(
    merchant_id: int,
    data: StoreDiscountCreate,
    current_user_id: int = Depends(get_current_user),
):
    """创建折扣"""
    merchant = store_merchant_service.get_merchant_by_id(merchant_id)
    if not merchant or merchant.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权限操作")
    if merchant.status != "APPROVED":
        raise HTTPException(status_code=403, detail="商家认证未通过")
    if not merchant.canPostDiscount:
        raise HTTPException(status_code=403, detail="无发布折扣权限")

    try:
        discount = store_merchant_service.create_discount(
            merchant_id, merchant.storeId, data
        )
        return success(discount.model_dump(), message="发布成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/discounts/{discount_id}")
async def update_discount(
    discount_id: int,
    data: StoreDiscountUpdate,
    current_user_id: int = Depends(get_current_user),
):
    """更新折扣"""
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    if not merchant:
        raise HTTPException(status_code=403, detail="您不是商家")

    try:
        discount = store_merchant_service.update_discount(
            discount_id, merchant.id, data
        )
        return success(discount.model_dump(), message="更新成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/discounts/{discount_id}")
async def delete_discount(
    discount_id: int,
    current_user_id: int = Depends(get_current_user),
):
    """删除折扣"""
    merchant = store_merchant_service.get_merchant_by_user(current_user_id)
    if not merchant:
        raise HTTPException(status_code=403, detail="您不是商家")

    if store_merchant_service.delete_discount(discount_id, merchant.id):
        return success(None, message="删除成功")
    raise HTTPException(status_code=404, detail="折扣不存在或无权限删除")


@router.get("/{merchant_id}/discounts")
async def get_merchant_discounts(
    merchant_id: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user),
):
    """获取商家的折扣列表"""
    merchant = store_merchant_service.get_merchant_by_id(merchant_id)
    if not merchant or merchant.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权限查看")

    discounts, total = store_merchant_service.get_merchant_discounts(
        merchant_id, page, pageSize
    )
    return success({
        "discounts": [d.model_dump() for d in discounts],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


# ==================== 店铺商家内容接口（公开） ====================


@router.get("/store/{store_id}/content")
async def get_store_merchant_content(store_id: str):
    """获取店铺的所有商家发布内容（公开接口）"""
    content = store_merchant_service.get_store_merchant_content(store_id)
    return success(content.model_dump())


@router.get("/store/{store_id}/banners")
async def get_store_banners(store_id: str):
    """获取店铺的 Banner 列表（公开接口）"""
    banners = store_merchant_service.get_store_banners(store_id)
    return success({
        "banners": [b.model_dump() for b in banners],
        "total": len(banners),
    })


@router.get("/store/{store_id}/announcements")
async def get_store_announcements(store_id: str):
    """获取店铺的公告列表（公开接口）"""
    announcements = store_merchant_service.get_store_announcements(store_id)
    return success({
        "announcements": [a.model_dump() for a in announcements],
        "total": len(announcements),
    })


@router.get("/store/{store_id}/activities")
async def get_store_activities(
    store_id: str,
    includeEnded: bool = Query(False, description="是否包含已结束的活动"),
):
    """获取店铺的活动列表（公开接口）"""
    activities = store_merchant_service.get_store_activities(
        store_id, include_ended=includeEnded
    )
    return success({
        "activities": [a.model_dump() for a in activities],
        "total": len(activities),
    })


@router.get("/store/{store_id}/discounts")
async def get_store_discounts(
    store_id: str,
    includeEnded: bool = Query(False, description="是否包含已结束的折扣"),
):
    """获取店铺的折扣列表（公开接口）"""
    discounts = store_merchant_service.get_store_discounts(
        store_id, include_ended=includeEnded
    )
    return success({
        "discounts": [d.model_dump() for d in discounts],
        "total": len(discounts),
    })
