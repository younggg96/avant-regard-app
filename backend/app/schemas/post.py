"""
帖子相关的数据模型
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import datetime


class PostType(str, Enum):
    OUTFIT = "OUTFIT"
    DAILY_SHARE = "DAILY_SHARE"
    ITEM_REVIEW = "ITEM_REVIEW"
    ARTICLES = "ARTICLES"


class PostStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    HIDDEN = "HIDDEN"


class AuditStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ShowImageDetail(BaseModel):
    """关联的秀场造型详情"""
    id: int
    imageUrl: str
    sortOrder: Optional[int] = None
    showId: Optional[int] = None
    season: Optional[str] = None
    category: Optional[str] = None
    city: Optional[str] = None
    collectionTs: Optional[str] = None
    designerId: Optional[int] = None
    designerName: Optional[str] = None


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
    # 关联秀场图片
    showImageIds: Optional[List[int]] = None
    showImages: Optional[List[ShowImageDetail]] = None
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
    # 关联秀场图片 ID 数组
    showImageIds: Optional[List[int]] = None


class UpdatePostRequest(BaseModel):
    """更新帖子请求"""
    userId: int
    postType: PostType
    status: PostStatus
    title: str = Field(..., min_length=1, max_length=500)
    contentText: str = ""
    imageUrls: List[str] = []
