"""
帖子路由
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from app.schemas.post import CreatePostRequest, UpdatePostRequest, PostStatus
from app.services.post_service import post_service
from app.api.deps import get_current_user_id, get_current_user_optional
from app.core.response import success

router = APIRouter(prefix="/posts", tags=["帖子"])


@router.get("/search")
async def search_posts(
    keyword: str = Query(..., description="搜索关键词"),
    limit: int = Query(50, description="返回数量限制"),
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    """搜索帖子（支持标题、内容、作者名搜索）"""
    results = post_service.search_posts(
        keyword=keyword, limit=limit, current_user_id=current_user_id
    )
    return success([r.model_dump() for r in results])


@router.get("")
async def get_posts(
    limit: int = Query(50, ge=1, le=200, description="返回数量限制"),
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    """获取帖子列表"""
    result = post_service.get_posts(current_user_id, limit=limit)
    return success([p.model_dump() for p in result])


@router.get("/{post_id}")
async def get_post_by_id(
    post_id: int, current_user_id: Optional[int] = Depends(get_current_user_optional)
):
    """获取单个帖子详情"""
    result = post_service.get_post_by_id(post_id, current_user_id)
    if not result:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return success(result.model_dump())


@router.post("")
async def create_post(
    request: CreatePostRequest, current_user_id: int = Depends(get_current_user_id)
):
    """创建帖子"""
    if request.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权为其他用户创建帖子")

    result = post_service.create_post(
        user_id=request.userId,
        post_type=request.postType.value,
        post_status=request.postStatus.value,
        title=request.title,
        content_text=request.contentText,
        image_urls=request.imageUrls,
        product_name=request.productName,
        brand_name=request.brandName,
        rating=request.rating,
        show_ids=request.showIds,
        community_id=request.communityId,
    )
    if not result:
        raise HTTPException(status_code=500, detail="创建帖子失败")
    return success(result.model_dump())


@router.put("/{post_id}")
async def update_post(
    post_id: int,
    request: UpdatePostRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """更新帖子"""
    if request.userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权修改其他用户的帖子")

    result = post_service.update_post(
        post_id=post_id,
        user_id=request.userId,
        post_type=request.postType.value,
        status=request.status.value,
        title=request.title,
        content_text=request.contentText,
        image_urls=request.imageUrls,
        product_name=request.productName,
        brand_name=request.brandName,
        rating=request.rating,
        show_ids=request.showIds,
        community_id=request.communityId,
    )
    if not result:
        raise HTTPException(status_code=404, detail="帖子不存在或无权修改")
    return success(result.model_dump())


@router.delete("/{post_id}")
async def delete_post(
    post_id: int,
    userId: int = Query(...),
    current_user_id: int = Depends(get_current_user_id),
):
    """删除帖子"""
    if userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权删除其他用户的帖子")

    ok = post_service.delete_post(post_id, userId)
    if not ok:
        raise HTTPException(status_code=404, detail="帖子不存在或无权删除")
    return success(message="删除成功")


# ==================== 点赞 ====================


@router.post("/{post_id}/like")
async def like_post(
    post_id: int,
    userId: int = Query(...),
    current_user_id: int = Depends(get_current_user_id),
):
    """点赞帖子"""
    if userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权为其他用户点赞")

    ok = post_service.like_post(post_id, userId)
    if not ok:
        raise HTTPException(status_code=400, detail="点赞失败（可能已点赞）")
    return success(message="点赞成功")


@router.delete("/{post_id}/like")
async def unlike_post(
    post_id: int,
    userId: int = Query(...),
    current_user_id: int = Depends(get_current_user_id),
):
    """取消点赞"""
    if userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权取消其他用户的点赞")

    ok = post_service.unlike_post(post_id, userId)
    if not ok:
        raise HTTPException(status_code=400, detail="取消点赞失败")
    return success(message="取消点赞成功")


# ==================== 收藏 ====================


@router.post("/{post_id}/favorite")
async def favorite_post(
    post_id: int,
    userId: int = Query(...),
    current_user_id: int = Depends(get_current_user_id),
):
    """收藏帖子"""
    if userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权为其他用户收藏")

    ok = post_service.favorite_post(post_id, userId)
    if not ok:
        raise HTTPException(status_code=400, detail="收藏失败（可能已收藏）")
    return success(message="收藏成功")


@router.delete("/{post_id}/favorite")
async def unfavorite_post(
    post_id: int,
    userId: int = Query(...),
    current_user_id: int = Depends(get_current_user_id),
):
    """取消收藏"""
    if userId != current_user_id:
        raise HTTPException(status_code=403, detail="无权取消其他用户的收藏")

    ok = post_service.unfavorite_post(post_id, userId)
    if not ok:
        raise HTTPException(status_code=400, detail="取消收藏失败")
    return success(message="取消收藏成功")


# ==================== 用户帖子 ====================


@router.get("/user/{user_id}")
async def get_posts_by_user_id(
    user_id: int,
    status: Optional[str] = Query(None),
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    """获取用户的帖子列表"""
    result = post_service.get_posts_by_user_id(user_id, status, current_user_id)
    return success([p.model_dump() for p in result])


@router.get("/user/{user_id}/liked")
async def get_liked_posts_by_user_id(
    user_id: int, current_user_id: Optional[int] = Depends(get_current_user_optional)
):
    """获取用户点赞的帖子列表"""
    result = post_service.get_liked_posts_by_user_id(user_id, current_user_id)
    return success([p.model_dump() for p in result])


@router.get("/user/{user_id}/favorites")
async def get_favorite_posts_by_user_id(
    user_id: int, current_user_id: Optional[int] = Depends(get_current_user_optional)
):
    """获取用户收藏的帖子列表"""
    result = post_service.get_favorite_posts_by_user_id(user_id, current_user_id)
    return success([p.model_dump() for p in result])


# ==================== 秀场关联帖子 ====================


@router.get("/show/{show_id}")
async def get_posts_by_show_id(
    show_id: int, current_user_id: Optional[int] = Depends(get_current_user_optional)
):
    """获取某个秀场关联的帖子"""
    result = post_service.get_posts_by_show_id(show_id, current_user_id)
    return success([p.model_dump() for p in result])


# ==================== 社区帖子 ====================


@router.get("/community/{community_id}")
async def get_posts_by_community_id(
    community_id: int, current_user_id: Optional[int] = Depends(get_current_user_optional)
):
    """获取某个社区的帖子"""
    result = post_service.get_posts_by_community_id(community_id, current_user_id)
    return success([p.model_dump() for p in result])


@router.get("/forum/all")
async def get_forum_posts(
    limit: int = Query(50, ge=1, le=200, description="返回数量限制"),
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    """获取所有论坛帖子"""
    result = post_service.get_forum_posts(current_user_id, limit=limit)
    return success([p.model_dump() for p in result])
