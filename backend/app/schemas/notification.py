"""
通知 Schema
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from enum import Enum


class NotificationType(str, Enum):
    LIKE = "LIKE"
    COMMENT = "COMMENT"
    FOLLOW = "FOLLOW"
    MENTION = "MENTION"
    SYSTEM = "SYSTEM"
    COLLECTION = "COLLECTION"


class NotificationActionData(BaseModel):
    """通知关联数据"""
    userId: Optional[int] = None
    postId: Optional[int] = None
    collectionId: Optional[int] = None
    commentId: Optional[int] = None
    actorName: Optional[str] = None
    actorAvatar: Optional[str] = None
    postImage: Optional[str] = None
    # 自定义跳转
    navigateTo: Optional[str] = None  # 应用内页面名称
    navigateParams: Optional[Dict[str, Any]] = None  # 跳转参数
    externalUrl: Optional[str] = None  # 外部链接


class Notification(BaseModel):
    """通知响应模型"""
    id: int
    userId: int
    type: str
    title: str
    message: str
    isRead: bool
    actionData: NotificationActionData
    createdAt: str
    # 互动页「交易」tab 的二级分类：logistics(物流) / after_sales(售后) /
    # wishlist(心动)。非交易类通知为 None，仍归入「系统通知 / 互动」。
    category: Optional[str] = None


class CreateNotificationRequest(BaseModel):
    """创建通知请求"""
    userId: int
    type: NotificationType
    title: str
    message: str
    actionData: Optional[Dict[str, Any]] = None


class RegisterPushTokenRequest(BaseModel):
    """注册推送 Token 请求"""
    pushToken: str
    platform: str  # "ios" or "android"


class UnreadCountResponse(BaseModel):
    """未读数量响应"""
    count: int


class BroadcastNotificationRequest(BaseModel):
    """广播通知请求（发送给所有用户）"""
    title: str
    message: str
    actionData: Optional[Dict[str, Any]] = None


class BroadcastNotificationResponse(BaseModel):
    """广播通知响应"""
    successCount: int
    failCount: int
    totalUsers: int
