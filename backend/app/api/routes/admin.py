"""
管理员路由
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from app.services.admin_service import admin_service
from app.api.deps import get_current_admin_user
from app.core.response import success

router = APIRouter(prefix="/admin", tags=["管理员"])


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
