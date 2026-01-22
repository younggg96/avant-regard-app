"""
买手店相关 API 路由
"""

from fastapi import APIRouter, Query, HTTPException, Depends
from typing import Optional, List

from app.core.response import success, error
from app.services.buyer_store_service import buyer_store_service
from app.services.buyer_store_community_service import buyer_store_community_service
from app.schemas.buyer_store import (
    BuyerStoreCreate,
    BuyerStoreUpdate,
    NearbyStoreParams,
    UserSubmittedStoreCreate,
    BuyerStoreCommentCreate,
    BuyerStoreRatingCreate,
    ReviewSubmissionRequest,
    COMMENT_SUGGESTIONS,
)
from app.api.deps import get_current_admin_user, get_current_user

router = APIRouter(prefix="/buyer-stores", tags=["买手店"])


@router.get("")
async def get_stores(
    country: Optional[str] = Query(None, description="国家筛选"),
    city: Optional[str] = Query(None, description="城市筛选"),
    brand: Optional[str] = Query(None, description="品牌筛选"),
    style: Optional[str] = Query(None, description="风格筛选"),
    openOnly: Optional[bool] = Query(None, description="仅显示营业中"),
    searchQuery: Optional[str] = Query(None, description="搜索关键词"),
    page: int = Query(1, ge=1, description="页码"),
    pageSize: int = Query(50, ge=1, le=200, description="每页数量"),
):
    """获取买手店列表"""
    stores, total = buyer_store_service.get_all_stores(
        country=country,
        city=city,
        brand=brand,
        style=style,
        open_only=openOnly,
        search_query=searchQuery,
        page=page,
        page_size=pageSize,
    )

    return success({
        "stores": [s.model_dump() for s in stores],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.get("/countries")
async def get_countries():
    """获取所有国家列表"""
    countries = buyer_store_service.get_all_countries()
    return success({"countries": countries})


@router.get("/cities")
async def get_cities(
    country: Optional[str] = Query(None, description="按国家筛选城市"),
):
    """获取所有城市列表"""
    cities = buyer_store_service.get_all_cities(country=country)
    return success({"cities": cities})


@router.get("/styles")
async def get_styles():
    """获取所有风格列表"""
    styles = buyer_store_service.get_all_styles()
    return success({"styles": styles})


@router.get("/search")
async def search_stores(
    keyword: str = Query(..., min_length=1, description="搜索关键词"),
    limit: int = Query(20, ge=1, le=100, description="返回数量"),
):
    """搜索买手店"""
    stores = buyer_store_service.search_stores(keyword=keyword, limit=limit)
    return success({
        "stores": [s.model_dump() for s in stores],
        "total": len(stores),
    })


@router.get("/by-brand/{brand}")
async def get_stores_by_brand(brand: str):
    """根据品牌获取买手店"""
    stores = buyer_store_service.get_stores_by_brand(brand)
    return success({
        "stores": [s.model_dump() for s in stores],
        "total": len(stores),
    })


@router.get("/brand-recommendations/{brand}")
async def get_brand_recommendations(brand: str):
    """获取品牌推荐（包含相关品牌）"""
    recommendation = buyer_store_service.get_brand_recommendations(brand)
    return success({
        "stores": [s.model_dump() for s in recommendation.stores],
        "relatedBrands": recommendation.relatedBrands,
    })


@router.post("/nearby")
async def get_nearby_stores(params: NearbyStoreParams):
    """获取附近的买手店"""
    stores = buyer_store_service.get_nearby_stores(
        latitude=params.latitude,
        longitude=params.longitude,
        radius=params.radius,
    )
    return success({
        "stores": [
            {**s["store"].model_dump(), "distance": s["distance"]}
            for s in stores
        ],
        "total": len(stores),
    })


# ==================== 用户提交买手店接口 ====================


@router.get("/comment-suggestions")
async def get_comment_suggestions():
    """获取评论提示建议"""
    return success({
        "suggestions": COMMENT_SUGGESTIONS
    })


@router.post("/submit")
async def submit_store(
    data: UserSubmittedStoreCreate,
    current_user_id: int = Depends(get_current_user),
):
    """用户提交买手店"""
    try:
        store = buyer_store_community_service.submit_store(current_user_id, data)
        return success(store.model_dump(), message="提交成功，等待审核")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/submissions/my")
async def get_my_submissions(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user),
):
    """获取我提交的买手店列表"""
    stores, total = buyer_store_community_service.get_user_submissions(
        current_user_id, page, pageSize
    )
    return success({
        "stores": [s.model_dump() for s in stores],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.get("/submissions/pending")
async def get_pending_submissions(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user),
):
    """获取待审核的买手店列表（管理员）"""
    stores, total = buyer_store_community_service.get_pending_submissions(page, pageSize)
    return success({
        "stores": [s.model_dump() for s in stores],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.put("/submissions/{submission_id}/review")
async def review_submission(
    submission_id: int,
    data: ReviewSubmissionRequest,
    current_user_id: int = Depends(get_current_admin_user),
):
    """审核用户提交的买手店（管理员）"""
    try:
        store = buyer_store_community_service.review_submission(
            submission_id, current_user_id, data
        )
        return success(store.model_dump(), message="审核完成")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== 买手店评论接口 ====================


@router.get("/{store_id}/comments")
async def get_store_comments(
    store_id: str,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    """获取买手店评论列表"""
    comments, total = buyer_store_community_service.get_store_comments(
        store_id, page, pageSize
    )
    return success({
        "comments": [c.model_dump() for c in comments],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


@router.post("/{store_id}/comments")
async def create_store_comment(
    store_id: str,
    data: BuyerStoreCommentCreate,
    current_user_id: int = Depends(get_current_user),
):
    """发表买手店评论"""
    # 验证用户ID匹配
    if data.userId != current_user_id:
        raise HTTPException(status_code=403, detail="用户ID不匹配")

    try:
        comment = buyer_store_community_service.create_comment(store_id, data)
        return success(comment.model_dump(), message="评论成功")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/comments/{comment_id}")
async def delete_store_comment(
    comment_id: int,
    userId: int = Query(...),
    current_user_id: int = Depends(get_current_user),
):
    """删除买手店评论"""
    if userId != current_user_id:
        raise HTTPException(status_code=403, detail="用户ID不匹配")

    try:
        buyer_store_community_service.delete_comment(comment_id, userId)
        return success(None, message="删除成功")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/comments/{comment_id}/like")
async def like_store_comment(
    comment_id: int,
    userId: int = Query(...),
    current_user_id: int = Depends(get_current_user),
):
    """点赞买手店评论"""
    if userId != current_user_id:
        raise HTTPException(status_code=403, detail="用户ID不匹配")

    buyer_store_community_service.like_comment(comment_id, userId)
    return success(None, message="点赞成功")


@router.delete("/comments/{comment_id}/like")
async def unlike_store_comment(
    comment_id: int,
    userId: int = Query(...),
    current_user_id: int = Depends(get_current_user),
):
    """取消点赞买手店评论"""
    if userId != current_user_id:
        raise HTTPException(status_code=403, detail="用户ID不匹配")

    buyer_store_community_service.unlike_comment(comment_id, userId)
    return success(None, message="取消点赞成功")


@router.get("/comments/{comment_id}/replies")
async def get_comment_replies(comment_id: int):
    """获取评论的所有回复"""
    replies = buyer_store_community_service.get_all_replies(comment_id)
    return success({
        "replies": [r.model_dump() for r in replies],
        "total": len(replies),
    })


# ==================== 买手店评分接口 ====================


@router.post("/{store_id}/rate")
async def rate_store(
    store_id: str,
    data: BuyerStoreRatingCreate,
    current_user_id: int = Depends(get_current_user),
):
    """给买手店评分"""
    if data.userId != current_user_id:
        raise HTTPException(status_code=403, detail="用户ID不匹配")

    try:
        rating = buyer_store_community_service.rate_store(store_id, data)
        return success(rating.model_dump(), message="评分成功")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{store_id}/rating")
async def get_store_rating_stats(store_id: str):
    """获取买手店评分统计"""
    stats = buyer_store_community_service.get_rating_stats(store_id)
    return success(stats.model_dump())


@router.get("/{store_id}/rating/user")
async def get_user_store_rating(
    store_id: str,
    userId: int = Query(...),
):
    """获取用户对买手店的评分"""
    rating = buyer_store_community_service.get_user_rating(store_id, userId)
    if rating:
        return success(rating.model_dump())
    return success(None)


# ==================== 买手店收藏接口 ====================


@router.post("/{store_id}/favorite")
async def favorite_store(
    store_id: str,
    userId: int = Query(...),
    current_user_id: int = Depends(get_current_user),
):
    """收藏买手店"""
    if userId != current_user_id:
        raise HTTPException(status_code=403, detail="用户ID不匹配")

    buyer_store_community_service.favorite_store(store_id, userId)
    return success(None, message="收藏成功")


@router.delete("/{store_id}/favorite")
async def unfavorite_store(
    store_id: str,
    userId: int = Query(...),
    current_user_id: int = Depends(get_current_user),
):
    """取消收藏买手店"""
    if userId != current_user_id:
        raise HTTPException(status_code=403, detail="用户ID不匹配")

    buyer_store_community_service.unfavorite_store(store_id, userId)
    return success(None, message="取消收藏成功")


@router.get("/{store_id}/favorite/check")
async def check_favorite_status(
    store_id: str,
    userId: int = Query(...),
):
    """检查是否已收藏买手店"""
    is_favorited = buyer_store_community_service.is_favorited(store_id, userId)
    return success({"isFavorited": is_favorited})


@router.get("/favorites/user")
async def get_user_favorites(
    userId: int = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_user),
):
    """获取用户收藏的买手店列表"""
    if userId != current_user_id:
        raise HTTPException(status_code=403, detail="用户ID不匹配")

    store_ids, total = buyer_store_community_service.get_user_favorites(
        userId, page, pageSize
    )
    return success({
        "storeIds": store_ids,
        "total": total,
        "page": page,
        "pageSize": pageSize,
    })


# ==================== 管理员接口 ====================


@router.post("")
async def create_store(
    store: BuyerStoreCreate,
    current_user_id: int = Depends(get_current_admin_user),
):
    """创建买手店（管理员）"""
    try:
        new_store = buyer_store_service.create_store(store)
        return success(new_store.model_dump(), message="创建成功")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch")
async def batch_create_stores(
    stores: List[BuyerStoreCreate],
    current_user_id: int = Depends(get_current_admin_user),
):
    """批量创建买手店（管理员）"""
    try:
        count = buyer_store_service.batch_create_stores(stores)
        return success({"count": count}, message=f"成功创建 {count} 个买手店")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== 动态路由 - 必须放在最后 ====================


@router.get("/{store_id}/detail")
async def get_store_detail(
    store_id: str,
    userId: Optional[int] = Query(None),
):
    """获取买手店详情（含社区数据）"""
    # 获取基础信息
    store = buyer_store_service.get_store_by_id(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="买手店不存在")

    store_data = store.model_dump()

    # 获取评分统计
    rating_stats = buyer_store_community_service.get_rating_stats(store_id)
    store_data["averageRating"] = rating_stats.averageRating
    store_data["ratingCount"] = rating_stats.ratingCount

    # 获取评论数
    store_data["commentCount"] = buyer_store_community_service.get_store_comment_count(store_id)

    # 获取收藏数
    store_data["favoriteCount"] = buyer_store_community_service.get_store_favorite_count(store_id)

    # 如果提供了用户ID，获取用户相关状态
    if userId:
        store_data["isFavorited"] = buyer_store_community_service.is_favorited(store_id, userId)
        user_rating = buyer_store_community_service.get_user_rating(store_id, userId)
        store_data["userRating"] = user_rating.rating if user_rating else None
    else:
        store_data["isFavorited"] = False
        store_data["userRating"] = None

    return success(store_data)


@router.get("/{store_id}")
async def get_store_by_id(store_id: str):
    """通过 ID 获取买手店详情"""
    store = buyer_store_service.get_store_by_id(store_id)

    if not store:
        return success(None, message="买手店不存在")

    return success(store.model_dump())


@router.put("/{store_id}")
async def update_store(
    store_id: str,
    store: BuyerStoreUpdate,
    current_user_id: int = Depends(get_current_admin_user),
):
    """更新买手店（管理员）"""
    updated_store = buyer_store_service.update_store(store_id, store)

    if not updated_store:
        raise HTTPException(status_code=404, detail="买手店不存在")

    return success(updated_store.model_dump(), message="更新成功")


@router.delete("/{store_id}")
async def delete_store(
    store_id: str,
    current_user_id: int = Depends(get_current_admin_user),
):
    """删除买手店（管理员）"""
    deleted = buyer_store_service.delete_store(store_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="买手店不存在")

    return success(None, message="删除成功")
