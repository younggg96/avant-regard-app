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
    # 封面图（image_urls[0]）原始像素尺寸；前端瀑布流直接按比例渲染，
    # 避免 Image.getSize 在滚动中触发 MasonryFlashList 重排。老帖为 None
    # 时前端回退 3/4。
    coverWidth: Optional[int] = None
    coverHeight: Optional[int] = None
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
    # 买手店帖子专用字段（migration 055）
    # storeId NOT NULL 表示该帖子是该买手店发布的「店铺帖子」, 在 PostCard
    # 上要显示「店铺」角标, 并且点击角标跳到 StoreDetail。 storeName 是
    # 服务端 join buyer_stores 后回填, 给前端避免再多发一次查店铺接口。
    storeId: Optional[str] = None
    storeName: Optional[str] = None
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
    # 封面原始像素尺寸（见 Post.coverWidth 注释）
    coverWidth: Optional[int] = Field(None, ge=1)
    coverHeight: Optional[int] = Field(None, ge=1)
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
    # 买手店帖子专用字段（migration 055）
    # 商家在 MerchantManageScreen 的 Posts tab 内发帖时, 由前端把当前
    # store_id 透传过来; 后端会校验 user 是该 store 的 APPROVED 商家。
    storeId: Optional[str] = None
    # AI 发帖助手 (V3 #25):
    # 由 ai_post_service.generate() 返回 metadata 后,前端预览页确认发布时
    # 原样回传。generatedByAi=True 时 generationMetadata.log_id 必填,
    # 后端会校验并双向回填 ai_post_service_logs.post_id。
    generatedByAi: bool = False
    generationMetadata: Optional[dict] = None

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
    # 封面原始像素尺寸（见 Post.coverWidth 注释）
    coverWidth: Optional[int] = Field(None, ge=1)
    coverHeight: Optional[int] = Field(None, ge=1)
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
    # 买手店帖子专用字段（migration 055）
    storeId: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: Optional[float]) -> Optional[float]:
        return _validate_half_star_rating(v)