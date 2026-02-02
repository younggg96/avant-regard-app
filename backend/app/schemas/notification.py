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
