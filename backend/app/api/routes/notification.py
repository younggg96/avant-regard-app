"""
通知路由
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from app.schemas.notification import RegisterPushTokenRequest
from app.services.notification_service import notification_service
from app.api.deps import get_current_user_id
from app.core.response import success

router = APIRouter(prefix="/notifications", tags=["通知"])


@router.get("")
async def get_notifications(
    unreadOnly: bool = Query(False, description="是否只获取未读通知"),
    category: Optional[str] = Query(
        None,
        description=(
            "交易分类过滤：logistics/after_sales/wishlist 单类，"
            "trading 全部交易类，system 仅非交易系统/互动类"
        ),
    ),
    current_user_id: int = Depends(get_current_user_id),
):
    """获取用户通知列表"""
    result = notification_service.get_notifications(
        current_user_id, unreadOnly, category
    )
    return success([n.model_dump() for n in result])


@router.get("/unread-count")
async def get_unread_count(
    current_user_id: int = Depends(get_current_user_id),
):
    """获取未读通知数量"""
    count = notification_service.get_unread_count(current_user_id)
    return success({"count": count})


@router.get("/category-counts")
async def get_category_counts(
    current_user_id: int = Depends(get_current_user_id),
):
    """获取各交易分类的未读数量（供互动页「交易」tab 角标）"""
    counts = notification_service.get_category_counts(current_user_id)
    return success(counts)


@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """标记通知为已读"""
    ok = notification_service.mark_as_read(notification_id, current_user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="通知不存在")
    return success(message="标记成功")


@router.post("/read-all")
async def mark_all_as_read(
    current_user_id: int = Depends(get_current_user_id),
):
    """标记所有通知为已读"""
    notification_service.mark_all_as_read(current_user_id)
    return success(message="标记成功")


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user_id: int = Depends(get_current_user_id),
):
    """删除通知"""
    ok = notification_service.delete_notification(notification_id, current_user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="通知不存在")
    return success(message="删除成功")


@router.delete("/clear-all")
async def clear_all_notifications(
    current_user_id: int = Depends(get_current_user_id),
):
    """清空所有通知"""
    notification_service.clear_all_notifications(current_user_id)
    return success(message="清空成功")


# ======================= Push Token 管理 =======================


@router.post("/push-token")
async def register_push_token(
    request: RegisterPushTokenRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """注册推送 Token"""
    ok = notification_service.register_push_token(
        current_user_id, request.pushToken, request.platform
    )
    if not ok:
        raise HTTPException(status_code=500, detail="注册失败")
    return success(message="注册成功")


@router.delete("/push-token")
async def remove_push_token(
    current_user_id: int = Depends(get_current_user_id),
):
    """移除推送 Token"""
    notification_service.remove_push_token(current_user_id)
    return success(message="移除成功")
