"""
管理员路由
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from app.services.admin_service import admin_service
from app.api.deps import get_current_admin_user
from app.core.response import success

router = APIRouter(prefix="/admin", tags=["管理员"])


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
