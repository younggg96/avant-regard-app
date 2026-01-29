"""
社区路由
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from app.schemas.community import CreateCommunityRequest, UpdateCommunityRequest
from app.services.community_service import community_service
from app.api.deps import get_current_user_id, get_current_user_optional
from app.core.response import success

router = APIRouter(prefix="/communities", tags=["社区"])


@router.get("")
async def get_communities(
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    """获取社区列表（热门、关注、全部）"""
    result = community_service.get_community_list(current_user_id)
    return success({
        "popular": [c.model_dump() for c in result.popular],
        "following": [c.model_dump() for c in result.following],
        "all": [c.model_dump() for c in result.all],
    })


@router.get("/popular")
async def get_popular_communities(
    limit: int = Query(5, description="返回数量限制"),
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    """获取热门社区"""
    result = community_service.get_popular_communities(limit, current_user_id)
    return success([c.model_dump() for c in result])


@router.get("/following")
async def get_following_communities(
    current_user_id: int = Depends(get_current_user_id),
):
    """获取我关注的社区"""
    result = community_service.get_following_communities(current_user_id, current_user_id)
    return success([c.model_dump() for c in result])


@router.get("/search")
async def search_communities(
    keyword: str = Query(..., description="搜索关键词"),
    limit: int = Query(20, description="返回数量限制"),
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    """搜索社区"""
    result = community_service.search_communities(keyword, limit, current_user_id)
    return success([c.model_dump() for c in result])


@router.get("/{community_id}")
async def get_community_by_id(
    community_id: int,
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    """获取单个社区详情"""
    result = community_service.get_community_by_id(community_id, current_user_id)
    if not result:
        raise HTTPException(status_code=404, detail="社区不存在")
    return success(result.model_dump())


@router.get("/slug/{slug}")
async def get_community_by_slug(
    slug: str,
    current_user_id: Optional[int] = Depends(get_current_user_optional),
):
    """通过 slug 获取社区"""
    result = community_service.get_community_by_slug(slug, current_user_id)
    if not result:
        raise HTTPException(status_code=404, detail="社区不存在")
    return success(result.model_dump())


@router.get("/{community_id}/stats")
async def get_community_stats(
    community_id: int,
):
    """获取社区统计信息"""
    result = community_service.get_community_stats(community_id)
    if not result:
        raise HTTPException(status_code=404, detail="社区不存在")
    return success(result.model_dump())


# ==================== 关注操作 ====================


@router.post("/{community_id}/follow")
async def follow_community(
    community_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """关注社区"""
    ok = community_service.follow_community(community_id, current_user_id)
    if not ok:
        raise HTTPException(status_code=400, detail="关注失败（可能已关注）")
    return success(message="关注成功")


@router.delete("/{community_id}/follow")
async def unfollow_community(
    community_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """取消关注社区"""
    ok = community_service.unfollow_community(community_id, current_user_id)
    if not ok:
        raise HTTPException(status_code=400, detail="取消关注失败")
    return success(message="取消关注成功")


# ==================== 管理员操作 ====================


@router.post("")
async def create_community(
    request: CreateCommunityRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """创建社区（管理员）"""
    # TODO: 验证管理员权限
    result = community_service.create_community(
        name=request.name,
        slug=request.slug,
        description=request.description,
        icon_url=request.iconUrl,
        cover_url=request.coverUrl,
        category=request.category.value,
        is_official=request.isOfficial,
        sort_order=request.sortOrder,
    )
    if not result:
        raise HTTPException(status_code=500, detail="创建社区失败")
    return success(result.model_dump())


@router.put("/{community_id}")
async def update_community(
    community_id: int,
    request: UpdateCommunityRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """更新社区（管理员）"""
    # TODO: 验证管理员权限
    result = community_service.update_community(
        community_id=community_id,
        name=request.name,
        description=request.description,
        icon_url=request.iconUrl,
        cover_url=request.coverUrl,
        category=request.category.value if request.category else None,
        is_official=request.isOfficial,
        is_active=request.isActive,
        sort_order=request.sortOrder,
    )
    if not result:
        raise HTTPException(status_code=404, detail="社区不存在")
    return success(result.model_dump())


@router.delete("/{community_id}")
async def delete_community(
    community_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """删除社区（管理员）"""
    # TODO: 验证管理员权限
    ok = community_service.delete_community(community_id)
    if not ok:
        raise HTTPException(status_code=404, detail="社区不存在")
    return success(message="删除成功")
