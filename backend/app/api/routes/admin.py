"""
管理员路由
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel, Field
from app.services.admin_service import admin_service
from app.services.cache_service import cache_service
from app.services.notification_service import notification_service
from app.api.deps import get_current_admin_user
from app.core.response import success

router = APIRouter(prefix="/admin", tags=["管理员"])


# ==================== 请求模型 ====================

class CreateCommunityRequest(BaseModel):
    """创建社区请求"""
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    iconUrl: str = ""
    coverUrl: str = ""
    category: str = "GENERAL"
    isOfficial: bool = False
    sortOrder: int = 0


class UpdateCommunityRequest(BaseModel):
    """更新社区请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    iconUrl: Optional[str] = None
    coverUrl: Optional[str] = None
    category: Optional[str] = None
    isOfficial: Optional[bool] = None
    isActive: Optional[bool] = None
    sortOrder: Optional[int] = None


class BatchDeletePostsRequest(BaseModel):
    """批量删除帖子请求"""
    postIds: List[int]


class BroadcastNotificationRequest(BaseModel):
    """广播通知请求"""
    title: str = Field(..., min_length=1, max_length=100, description="通知标题")
    message: str = Field(..., min_length=1, max_length=500, description="通知内容")
    actionData: Optional[Dict[str, Any]] = Field(None, description="可选的操作数据")


# ==================== 帖子审核 ====================

@router.get("/posts/pending")
async def get_pending_posts(
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取待审核帖子列表"""
    result = admin_service.get_pending_posts()
    return success([p.model_dump() for p in result])


@router.post("/posts/{post_id}/approve")
async def approve_post(
    post_id: int,
    remark: str = Query(None),
    current_user_id: int = Depends(get_current_admin_user)
):
    """审核通过帖子"""
    ok = admin_service.approve_post(post_id, remark)
    if not ok:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return success(message="审核通过")


@router.post("/posts/{post_id}/reject")
async def reject_post(
    post_id: int,
    remark: str = Query(None),
    current_user_id: int = Depends(get_current_admin_user)
):
    """审核拒绝帖子"""
    ok = admin_service.reject_post(post_id, remark)
    if not ok:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return success(message="审核拒绝")


@router.delete("/posts/{post_id}")
async def admin_delete_post(
    post_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """管理员删除帖子"""
    ok = admin_service.admin_delete_post(post_id)
    if not ok:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return success(message="帖子删除成功")


# ==================== 评论管理 ====================

@router.get("/comments")
async def get_all_comments(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取所有评论（分页）"""
    result = admin_service.get_all_comments(page, pageSize)
    return success(result)


@router.get("/comments/post/{post_id}")
async def get_comments_by_post(
    post_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取指定帖子的所有评论"""
    result = admin_service.get_comments_by_post(post_id)
    return success(result)


@router.get("/comments/user/{user_id}")
async def get_comments_by_user(
    user_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取指定用户的所有评论"""
    result = admin_service.get_comments_by_user(user_id)
    return success(result)


@router.delete("/comments/{comment_id}")
async def admin_delete_comment(
    comment_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """管理员删除评论"""
    ok = admin_service.admin_delete_comment(comment_id)
    if not ok:
        raise HTTPException(status_code=404, detail="评论不存在")
    return success(message="评论删除成功")


# ==================== 用户管理 ====================

# 用户管理路由放在 /api/auth/admin 路径下
admin_user_router = APIRouter(prefix="/auth/admin", tags=["管理员-用户管理"])


@admin_user_router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """删除用户及其所有关联数据"""
    ok = admin_service.delete_user(user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="用户不存在")
    return success(message="用户删除成功")


# ==================== 社区管理 ====================

@router.get("/communities")
async def get_all_communities(
    include_inactive: bool = Query(True, description="是否包含未激活的社区"),
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取所有社区（管理员）"""
    result = admin_service.get_all_communities(include_inactive)
    return success(result)


@router.get("/communities/{community_id}")
async def get_community_detail(
    community_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取社区详情（管理员）"""
    result = admin_service.get_community_by_id(community_id)
    if not result:
        raise HTTPException(status_code=404, detail="社区不存在")
    return success(result)


@router.post("/communities")
async def create_community(
    request: CreateCommunityRequest,
    current_user_id: int = Depends(get_current_admin_user)
):
    """创建社区（管理员）"""
    result = admin_service.create_community(
        name=request.name,
        slug=request.slug,
        description=request.description,
        icon_url=request.iconUrl,
        cover_url=request.coverUrl,
        category=request.category,
        is_official=request.isOfficial,
        sort_order=request.sortOrder,
    )
    if not result:
        raise HTTPException(status_code=500, detail="创建社区失败")
    
    # 清除社区缓存
    cache_service.invalidate_communities()
    
    return success(result)


@router.put("/communities/{community_id}")
async def update_community(
    community_id: int,
    request: UpdateCommunityRequest,
    current_user_id: int = Depends(get_current_admin_user)
):
    """更新社区（管理员）"""
    result = admin_service.update_community(
        community_id=community_id,
        name=request.name,
        description=request.description,
        icon_url=request.iconUrl,
        cover_url=request.coverUrl,
        category=request.category,
        is_official=request.isOfficial,
        is_active=request.isActive,
        sort_order=request.sortOrder,
    )
    if not result:
        raise HTTPException(status_code=404, detail="社区不存在")
    
    # 清除社区缓存
    cache_service.invalidate_communities()
    
    return success(result)


@router.delete("/communities/{community_id}")
async def delete_community(
    community_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """删除社区（管理员）"""
    ok = admin_service.delete_community(community_id)
    if not ok:
        raise HTTPException(status_code=404, detail="社区不存在")
    
    # 清除社区缓存
    cache_service.invalidate_communities()
    
    return success(message="社区删除成功")


# ==================== 社区帖子管理 ====================

@router.get("/communities/{community_id}/posts")
async def get_community_posts(
    community_id: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user_id: int = Depends(get_current_admin_user)
):
    """获取社区内的所有帖子（管理员）"""
    # 先检查社区是否存在
    community = admin_service.get_community_by_id(community_id)
    if not community:
        raise HTTPException(status_code=404, detail="社区不存在")
    
    result = admin_service.get_community_posts(community_id, page, pageSize)
    return success(result)


@router.delete("/communities/{community_id}/posts/{post_id}")
async def delete_community_post(
    community_id: int,
    post_id: int,
    current_user_id: int = Depends(get_current_admin_user)
):
    """删除社区内的指定帖子（管理员）"""
    ok = admin_service.delete_community_post(community_id, post_id)
    if not ok:
        raise HTTPException(status_code=404, detail="帖子不存在或不属于该社区")
    return success(message="帖子删除成功")


@router.post("/communities/{community_id}/posts/batch-delete")
async def batch_delete_community_posts(
    community_id: int,
    request: BatchDeletePostsRequest,
    current_user_id: int = Depends(get_current_admin_user)
):
    """批量删除社区内的帖子（管理员）"""
    # 先检查社区是否存在
    community = admin_service.get_community_by_id(community_id)
    if not community:
        raise HTTPException(status_code=404, detail="社区不存在")
    
    result = admin_service.batch_delete_community_posts(community_id, request.postIds)
    return success(result)


# ==================== 广播通知 ====================

@router.post("/notifications/broadcast")
async def broadcast_notification(
    request: BroadcastNotificationRequest,
    current_user_id: int = Depends(get_current_admin_user)
):
    """
    向所有用户发送广播通知（管理员）
    - 同时创建 App 内通知和发送 Push 推送
    """
    result = notification_service.broadcast_notification(
        title=request.title,
        message=request.message,
        action_data=request.actionData,
    )
    
    return success({
        "successCount": result["success_count"],
        "failCount": result["fail_count"],
        "totalUsers": result["total_users"],
    })
