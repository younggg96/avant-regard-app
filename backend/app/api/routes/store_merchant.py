"""
商家入驻系统 API 路由
包含：商家认证、公告、活动、折扣、Banner 接口
"""

from fastapi import APIRouter, Query, HTTPException, Depends
from typing import Optional

from app.core.response import success
from app.services.store_merchant_service import store_merchant_service
from app.services.store_insights_service import store_insights_service
from app.schemas.store_merchant import (
    StoreMerchantCreate,
    StoreMerchantUpdate,
    StoreMerchantReview,
    StoreMerchantAdminUpdate,
    BuyerStoreUpdate,
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
def apply_merchant(
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
def get_my_merchants(
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
def get_merchant_by_store(store_id: str):
    """通过店铺ID获取商家信息"""
    merchant = store_merchant_service.get_merchant_by_store(store_id)
    if merchant:
        return success(merchant.model_dump())
    return success(None)


@router.put("/{merchant_id}")
def update_merchant(
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
def get_pending_merchants(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取待审核的商家列表（管理员）- 包含店铺和用户信息"""
    merchants, total = store_merchant_service.get_pending_merchants(page, pageSize)
    return success({
        "merchants": merchants,  # 已经是字典列表
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.put("/{merchant_id}/review")
def review_merchant(
    merchant_id: int,
    data: StoreMerchantReview,
    current_user_id: int = Depends(get_current_admin_user),
):
    """审核商家申请（管理员）"""
    try:
        merchant = store_merchant_service.review_merchant(
            merchant_id, current_user_id, data
        )

        if data.status.value == "APPROVED" and merchant.userId and merchant.storeId:
            try:
                from app.db.supabase import get_supabase
                db = get_supabase()
                store_result = (
                    db.table("buyer_stores")
                    .select("name")
                    .eq("id", merchant.storeId)
                    .execute()
                )
                store_name = (
                    store_result.data[0]["name"] if store_result.data else merchant.storeId
                )
                title_text = f"{store_name}买手店"
                existing = (
                    db.table("user_titles")
                    .select("id")
                    .eq("user_id", merchant.userId)
                    .eq("title", title_text)
                    .execute()
                )
                if not existing.data:
                    has_any = (
                        db.table("user_titles")
                        .select("id")
                        .eq("user_id", merchant.userId)
                        .limit(1)
                        .execute()
                    )
                    db.table("user_titles").insert({
                        "user_id": merchant.userId,
                        "title": title_text,
                        "is_primary": not has_any.data,
                        "granted_by": current_user_id,
                    }).execute()
            except Exception:
                pass

        return success(merchant.model_dump(), message="审核完成")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/all")
def get_all_merchants(
    status: Optional[str] = Query(None, description="商家状态筛选"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取所有商家列表（管理员）"""
    merchants, total = store_merchant_service.get_all_merchants(status, page, pageSize)
    return success({
        "merchants": merchants,
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.put("/{merchant_id}/admin-update")
def admin_update_merchant(
    merchant_id: int,
    data: StoreMerchantAdminUpdate,
    current_user_id: int = Depends(get_current_admin_user),
):
    """管理员更新商家信息（状态、权限等）"""
    try:
        merchant = store_merchant_service.admin_update_merchant(
            merchant_id, current_user_id, data
        )
        return success(merchant.model_dump(), message="更新成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== 公告接口 ====================


@router.post("/{merchant_id}/announcements")
def create_announcement(
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
def update_announcement(
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
def delete_announcement(
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
def get_merchant_announcements(
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
def create_banner(
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
def update_banner(
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
def delete_banner(
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
def get_merchant_banners(
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
def record_banner_click(banner_id: int):
    """记录 Banner 点击（fire-and-forget，失败不影响用户体验）"""
    try:
        store_merchant_service.increment_banner_click(banner_id)
    except Exception:
        pass
    return success(None)


# ==================== 活动接口 ====================


@router.post("/{merchant_id}/activities")
def create_activity(
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
def update_activity(
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
def delete_activity(
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
def get_merchant_activities(
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
def get_activity_detail(activity_id: int):
    """获取活动详情"""
    activity = store_merchant_service.get_activity_by_id(activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="活动不存在")
    return success(activity.model_dump())


@router.post("/activities/{activity_id}/register")
def register_activity(
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
def cancel_activity_registration(
    activity_id: int,
    current_user_id: int = Depends(get_current_user),
):
    """取消报名"""
    if store_merchant_service.cancel_registration(activity_id, current_user_id):
        return success(None, message="取消报名成功")
    raise HTTPException(status_code=404, detail="未找到报名记录")


@router.get("/activities/{activity_id}/registrations")
def get_activity_registrations(
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
def check_activity_registration(
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
def create_discount(
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
def update_discount(
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
def delete_discount(
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
def get_merchant_discounts(
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


# ==================== 看板 / Insights 接口（商家受保护） ====================
#
# 看板路由分三段:
#   1. /insights/overview        —— 顶部汇总卡 (累计/今日)
#   2. /insights/fans            —— 粉丝画像 Tab
#   3. /insights/promotion       —— 地推数据 (我想去/我去过 累计 + 今日 + 7d 趋势)
#   4. /insights/visit-comments  —— 「我去过」评论列表
#
# 全部需要 merchant 本人 (userId 校验), 防止越权窥探别家店铺数据.


def _ensure_merchant_owner(merchant_id: int, current_user_id: int):
    """共用权限校验: 拿到的 merchant 必须属于当前用户且认证通过."""
    merchant = store_merchant_service.get_merchant_by_id(merchant_id)
    if not merchant or merchant.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权限查看")
    if merchant.status != "APPROVED":
        raise HTTPException(status_code=403, detail="商家认证未通过")
    return merchant


@router.get("/{merchant_id}/insights/overview")
def get_merchant_insights_overview(
    merchant_id: int,
    current_user_id: int = Depends(get_current_user),
):
    """看板顶部汇总卡 (我想去 / 我去过 累计 + 今日, 评分均值)."""
    merchant = _ensure_merchant_owner(merchant_id, current_user_id)
    return success(store_insights_service.get_overview(merchant.storeId))


@router.get("/{merchant_id}/insights/fans")
def get_merchant_insights_fans(
    merchant_id: int,
    current_user_id: int = Depends(get_current_user),
):
    """粉丝画像: 城市分布 / 24h 活跃时段 / Top 偏好品牌."""
    merchant = _ensure_merchant_owner(merchant_id, current_user_id)
    return success(store_insights_service.get_fan_profile(merchant.storeId))


@router.get("/{merchant_id}/insights/promotion")
def get_merchant_insights_promotion(
    merchant_id: int,
    current_user_id: int = Depends(get_current_user),
):
    """地推数据看板 (累计 + 今日 + 7 天趋势)."""
    merchant = _ensure_merchant_owner(merchant_id, current_user_id)
    return success(store_insights_service.get_promotion_stats(merchant.storeId))


@router.get("/{merchant_id}/insights/visit-comments")
def get_merchant_visit_comments(
    merchant_id: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user),
):
    """「我去过」打卡评论列表 —— 复用 buyer_store_comments, 商家在原评论
    流里直接回复 (POST /api/buyer-stores/{storeId}/comments + parentId)."""
    merchant = _ensure_merchant_owner(merchant_id, current_user_id)
    comments, total = store_insights_service.get_visit_comments(
        merchant.storeId, page, pageSize
    )
    return success({
        "comments": [c.model_dump() for c in comments],
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "storeId": merchant.storeId,
    })


@router.get("/{merchant_id}/insights/brand-stats")
def get_merchant_brand_stats(
    merchant_id: int,
    window: int = Query(
        7,
        description="时间窗口 (天). 允许 7 / 30 / 0(=全部),其它值 400.",
    ),
    topN: int = Query(3, ge=1, le=20, description="排行 Top N"),
    current_user_id: int = Depends(get_current_user),
):
    """内容数据看板 V2: 品牌点击 & TOP 品牌.

    - 接口只查 store_brand_stats 缓存表; 缓存过期 (>1h) 时 lazy 重算.
    - 浏览数为累计列 (没有事件表), 所有 window 下都是累计总浏览.
    """
    merchant = _ensure_merchant_owner(merchant_id, current_user_id)
    try:
        return success(
            store_insights_service.get_brand_stats(merchant.storeId, window, topN)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{merchant_id}/insights/top-products")
def get_merchant_top_products(
    merchant_id: int,
    limit: int = Query(10, ge=1, le=50),
    current_user_id: int = Depends(get_current_user),
):
    """单品维度 Top (V3 #16 保留): 按「我想要」倒序."""
    merchant = _ensure_merchant_owner(merchant_id, current_user_id)
    items = store_insights_service.get_top_products_by_want(merchant.storeId, limit)
    return success({"items": items, "limit": limit})


# ==================== 店铺商家内容接口（公开） ====================


@router.get("/store/{store_id}/content")
def get_store_merchant_content(store_id: str):
    """获取店铺的所有商家发布内容（公开接口）"""
    content = store_merchant_service.get_store_merchant_content(store_id)
    return success(content.model_dump())


@router.get("/store/{store_id}/banners")
def get_store_banners(store_id: str):
    """获取店铺的 Banner 列表（公开接口）"""
    banners = store_merchant_service.get_store_banners(store_id)
    return success({
        "banners": [b.model_dump() for b in banners],
        "total": len(banners),
    })


@router.get("/store/{store_id}/announcements")
def get_store_announcements(store_id: str):
    """获取店铺的公告列表（公开接口）"""
    announcements = store_merchant_service.get_store_announcements(store_id)
    return success({
        "announcements": [a.model_dump() for a in announcements],
        "total": len(announcements),
    })


@router.get("/store/{store_id}/activities")
def get_store_activities(
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
def get_store_discounts(
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


# ==================== 店铺信息管理接口 ====================


@router.get("/buyer-store/{store_id}")
def get_buyer_store(store_id: str):
    """获取店铺详情"""
    store = store_merchant_service.get_buyer_store(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="店铺不存在")
    return success(store.model_dump())


@router.put("/buyer-store/{store_id}")
def update_buyer_store(
    store_id: str,
    data: BuyerStoreUpdate,
    current_user_id: int = Depends(get_current_user),
):
    """商家更新店铺信息"""
    try:
        store = store_merchant_service.update_buyer_store(
            store_id, current_user_id, data
        )
        return success(store.model_dump(), message="店铺信息已更新")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
