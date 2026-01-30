"""
帖子相关的数据模型
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Union
from enum import Enum
from datetime import datetime


class PostType(str, Enum):
    OUTFIT = "OUTFIT"
    DAILY_SHARE = "DAILY_SHARE"
    ITEM_REVIEW = "ITEM_REVIEW"
    ARTICLES = "ARTICLES"
    FORUM = "FORUM"  # 论坛帖子


class PostStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    HIDDEN = "HIDDEN"


class AuditStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Post(BaseModel):
    """帖子响应"""

    id: int
    userId: int
    username: str
    postType: PostType
    status: PostStatus
    auditStatus: Optional[AuditStatus] = None
    title: str
    contentText: str = ""
    imageUrls: List[str] = []
    likeCount: int = 0
    favoriteCount: int = 0
    commentCount: int = 0
    createdAt: str
    updatedAt: str
    # 单品评价专用字段
    productName: Optional[str] = None
    brandName: Optional[str] = None
    rating: Optional[int] = None
    # 关联秀场 ID 列表（支持关联多个秀场，ID 可能是整数或字符串）
    showIds: List[Union[int, str]] = []
    # 论坛帖子专用字段
    communityId: Optional[int] = None
    communityName: Optional[str] = None
    communitySlug: Optional[str] = None
    # 当前用户交互状态
    likedByMe: Optional[bool] = None
    favoritedByMe: Optional[bool] = None


class CreatePostRequest(BaseModel):
    """创建帖子请求"""

    userId: int
    postType: PostType
    postStatus: PostStatus = PostStatus.DRAFT
    title: str = Field(..., min_length=1, max_length=500)
    contentText: Optional[str] = ""
    imageUrls: List[str] = []
    # 单品评价专用字段
    productName: Optional[str] = None
    brandName: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    # 关联秀场 ID 列表（支持关联多个秀场，ID 可能是整数或字符串）
    showIds: List[Union[int, str]] = []
    # 论坛帖子专用字段
    communityId: Optional[int] = None


class UpdatePostRequest(BaseModel):
    """更新帖子请求"""

    userId: int
    postType: PostType
    status: PostStatus
    title: str = Field(..., min_length=1, max_length=500)
    contentText: str = ""
    imageUrls: List[str] = []
    # 单品评价专用字段
    productName: Optional[str] = None
    brandName: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    # 关联秀场 ID 列表（支持关联多个秀场，ID 可能是整数或字符串）
    showIds: List[Union[int, str]] = []
    # 论坛帖子专用字段
    communityId: Optional[int] = None