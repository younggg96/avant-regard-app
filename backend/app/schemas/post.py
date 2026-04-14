"""
帖子相关的数据模型
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Union
from enum import Enum
from datetime import datetime


class PostType(str, Enum):
    OUTFIT = "OUTFIT"
    DAILY_SHARE = "DAILY_SHARE"
    ITEM_REVIEW = "ITEM_REVIEW"
    ARTICLES = "ARTICLES"  # 文章类型，论坛帖子也使用此类型（通过 community_id 区分）


class PostStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    HIDDEN = "HIDDEN"


class AuditStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class PostGrade(str, Enum):
    A = "A"  # 300字+深度内容，奖励30元
    B = "B"  # 50字+单品介绍，奖励15元
    C = "C"  # 日常分享，奖励5元
    D = "D"  # 无关联，最低优先级
    F = "F"  # 违规自动驳回


GRADE_REWARD_MAP = {
    PostGrade.A: 30,
    PostGrade.B: 15,
    PostGrade.C: 5,
    PostGrade.D: 0,
    PostGrade.F: 0,
}


class Post(BaseModel):
    """帖子响应"""

    id: int
    userId: int
    username: str
    avatarUrl: Optional[str] = None  # 作者头像 URL
    postType: PostType
    status: PostStatus
    auditStatus: Optional[AuditStatus] = None
    title: str
    contentText: str = ""
    imageUrls: List[str] = []
    likeCount: int = 0
    favoriteCount: int = 0
    commentCount: int = 0
    wantCount: int = 0
    createdAt: str
    updatedAt: str
    # 单品评价专用字段
    productName: Optional[str] = None
    brandName: Optional[str] = None
    rating: Optional[float] = None
    # 关联秀场 ID 列表（支持关联多个秀场，ID 可能是整数或字符串）
    showIds: List[Union[int, str]] = []
    # 关联品牌 ID 列表（支持关联多个品牌）
    brandIds: List[int] = []
    # 单品信息（可选）
    itemBrand: Optional[str] = None
    itemBrandId: Optional[int] = None
    itemCategory: Optional[str] = None
    itemSizes: List[str] = []
    itemColors: List[str] = []
    # 论坛帖子专用字段
    communityId: Optional[int] = None
    communityName: Optional[str] = None
    communitySlug: Optional[str] = None
    # 内容评级
    grade: Optional[str] = None
    gradeReward: Optional[int] = None
    # 当前用户交互状态
    likedByMe: Optional[bool] = None
    favoritedByMe: Optional[bool] = None
    wantedByMe: Optional[bool] = None


def _validate_half_star_rating(v: Optional[float]) -> Optional[float]:
    """Validate that rating is in 0.5 increments between 0.5 and 5."""
    if v is None:
        return v
    if v < 0.5 or v > 5:
        raise ValueError("Rating must be between 0.5 and 5")
    if (v * 2) % 1 != 0:
        raise ValueError("Rating must be in 0.5 increments (e.g. 0.5, 1, 1.5, ..., 5)")
    return v


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
    rating: Optional[float] = Field(None, ge=0.5, le=5)
    # 关联秀场 ID 列表（支持关联多个秀场，ID 可能是整数或字符串）
    showIds: List[Union[int, str]] = []
    # 关联品牌 ID 列表（支持关联多个品牌）
    brandIds: List[int] = []
    # 单品信息（可选）
    itemBrand: Optional[str] = None
    itemBrandId: Optional[int] = None
    itemCategory: Optional[str] = None
    itemSizes: List[str] = []
    itemColors: List[str] = []
    # 论坛帖子专用字段
    communityId: Optional[int] = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: Optional[float]) -> Optional[float]:
        return _validate_half_star_rating(v)


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
    rating: Optional[float] = Field(None, ge=0.5, le=5)
    # 关联秀场 ID 列表（支持关联多个秀场，ID 可能是整数或字符串）
    showIds: List[Union[int, str]] = []
    # 关联品牌 ID 列表（支持关联多个品牌）
    brandIds: List[int] = []
    # 单品信息（可选）
    itemBrand: Optional[str] = None
    itemBrandId: Optional[int] = None
    itemCategory: Optional[str] = None
    itemSizes: List[str] = []
    itemColors: List[str] = []
    # 论坛帖子专用字段
    communityId: Optional[int] = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: Optional[float]) -> Optional[float]:
        return _validate_half_star_rating(v)