"""
商家商品系统 & 店铺主页可配置项相关的数据模型。

覆盖 4 个资源：
  - StoreProfileConfig  : 买手店 Tab 首屏 StoreProfileCard 的可配置数据源
  - StoreEntryCard      : CategoryCards 的可配置数据源（多张、可排序、换背景图）
  - StoreProductCategory: 商家自定义的商品分类（上衣/裤子/男/女 等）
  - StoreProduct        : 商品（价格、折扣、新品标记、图片、品牌）

价格约定：
  API 层统一接收/返回整数 `priceCents`（分）。展示侧再用 `priceCents / 100` 渲染
  成两位小数，避免浮点精度问题传染到后端存储。
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from enum import Enum


# ==================== 枚举类型 ====================


class ProductStatus(str, Enum):
    """商品状态"""
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    HIDDEN = "HIDDEN"
    SOLD_OUT = "SOLD_OUT"


class EntryCardType(str, Enum):
    """入口卡片类型。

    - CLASSIFICATION: 分类；点击后进入分类商品列表
    - DISCOUNT      : 折扣；点击后进入折扣商品列表
    - EVENT         : 活动；点击后进入活动列表
    - NEW_ARRIVAL   : 新品；点击后进入 is_new=TRUE 的商品列表
    """
    CLASSIFICATION = "CLASSIFICATION"
    DISCOUNT = "DISCOUNT"
    EVENT = "EVENT"
    NEW_ARRIVAL = "NEW_ARRIVAL"


class EntryCardStatus(str, Enum):
    """入口卡片发布状态"""
    PUBLISHED = "PUBLISHED"
    HIDDEN = "HIDDEN"


# ==================== StoreProfileConfig ====================


class StoreProfileConfigUpsert(BaseModel):
    """Upsert 店铺主页卡片配置。"""
    logoImage: Optional[str] = Field(None, description="圆形 logo 图 URL")
    coverImage: Optional[str] = Field(None, description="右侧封面图 URL")
    shortDescription: Optional[str] = Field(None, description="短介绍（卡片顶部）")
    longDescription: Optional[str] = Field(None, description="长介绍（卡片底部）")
    tags: Optional[List[str]] = Field(
        None, description="标签 chips；前端最多渲染 6 个"
    )

    @field_validator("tags")
    @classmethod
    def _limit_tags(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return value
        # 留一点冗余给后端数据，不要太死板；超过 20 再拒绝。
        if len(value) > 20:
            raise ValueError("tags 数量超过上限（20）")
        return [t.strip() for t in value if t and t.strip()]


class StoreProfileConfig(BaseModel):
    """店铺主页卡片配置"""
    storeId: str
    merchantId: Optional[int] = None
    logoImage: Optional[str] = None
    coverImage: Optional[str] = None
    shortDescription: Optional[str] = None
    longDescription: Optional[str] = None
    tags: List[str] = []
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


# ==================== StoreEntryCard ====================


class StoreEntryCardCreate(BaseModel):
    """新建入口卡片"""
    cardType: EntryCardType
    label: str = Field(..., min_length=1, max_length=50)
    labelEn: Optional[str] = Field(None, max_length=50)
    imageUrl: str = Field(..., description="背景图 URL")
    targetCategoryId: Optional[int] = Field(
        None,
        description="仅 cardType=CLASSIFICATION 且希望定向到某个分类时设置；为 null 代表"
        "'全部单品'。其他 card_type 应保持为 null。",
    )
    sortOrder: int = Field(default=0)
    status: EntryCardStatus = Field(default=EntryCardStatus.PUBLISHED)


class StoreEntryCardUpdate(BaseModel):
    """更新入口卡片（所有字段可选，未传不改动）"""
    cardType: Optional[EntryCardType] = None
    label: Optional[str] = Field(None, max_length=50)
    labelEn: Optional[str] = Field(None, max_length=50)
    imageUrl: Optional[str] = None
    targetCategoryId: Optional[int] = None
    sortOrder: Optional[int] = None
    status: Optional[EntryCardStatus] = None


class StoreEntryCard(BaseModel):
    """入口卡片"""
    id: int
    storeId: str
    merchantId: Optional[int] = None
    cardType: str
    label: str
    labelEn: Optional[str] = None
    imageUrl: str
    targetCategoryId: Optional[int] = None
    sortOrder: int = 0
    status: str = "PUBLISHED"
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


# ==================== StoreProductCategory ====================


class StoreProductCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    coverImage: Optional[str] = None
    sortOrder: int = Field(default=0)


class StoreProductCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    coverImage: Optional[str] = None
    sortOrder: Optional[int] = None


class StoreProductCategory(BaseModel):
    id: int
    storeId: str
    merchantId: Optional[int] = None
    name: str
    coverImage: Optional[str] = None
    sortOrder: int = 0
    productCount: Optional[int] = None  # 可选：列表接口会顺手回填
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


# ==================== StoreProduct ====================


class StoreProductCreate(BaseModel):
    """创建商品"""
    categoryId: Optional[int] = Field(None, description="商品分类 ID")
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    brand: Optional[str] = Field(None, max_length=200)
    images: List[str] = Field(default_factory=list, description="商品图片 URL 列表")
    priceCents: int = Field(..., ge=0, description="原价（单位：分）")
    currency: str = Field(default="CNY", max_length=10)
    discountPriceCents: Optional[int] = Field(
        None, ge=0, description="折扣价（单位：分）；为 null 代表无折扣"
    )
    isNew: bool = Field(default=False, description="是否为新品")
    tags: List[str] = Field(default_factory=list)
    status: ProductStatus = Field(default=ProductStatus.PUBLISHED)

    @field_validator("discountPriceCents")
    @classmethod
    def _check_discount(cls, value: Optional[int], info) -> Optional[int]:
        if value is None:
            return value
        price = info.data.get("priceCents")
        if price is not None and value > price:
            raise ValueError("折扣价不能高于原价")
        return value


class StoreProductUpdate(BaseModel):
    """更新商品；未传字段不改动。显式传 `discountPriceCents=None` 表示取消折扣。"""
    categoryId: Optional[int] = None
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    brand: Optional[str] = Field(None, max_length=200)
    images: Optional[List[str]] = None
    priceCents: Optional[int] = Field(None, ge=0)
    currency: Optional[str] = None
    discountPriceCents: Optional[int] = Field(None, ge=0)
    isNew: Optional[bool] = None
    tags: Optional[List[str]] = None
    status: Optional[ProductStatus] = None


class StoreProduct(BaseModel):
    """商品"""
    id: int
    storeId: str
    merchantId: Optional[int] = None
    categoryId: Optional[int] = None
    categoryName: Optional[str] = None  # 服务端 join 回填
    title: str
    description: Optional[str] = None
    brand: Optional[str] = None
    images: List[str] = []
    priceCents: int
    currency: str = "CNY"
    discountPriceCents: Optional[int] = None
    hasDiscount: bool = False
    isNew: bool = False
    tags: List[str] = []
    likeCount: int = 0
    commentCount: int = 0
    viewCount: int = 0
    wantCount: int = 0
    favoriteCount: int = 0
    status: str = "PUBLISHED"
    # 当前登录用户是否已点喜欢 / 已收藏 / 已加愿望单；需要 userId 时才回填
    likedByMe: Optional[bool] = None
    favoritedByMe: Optional[bool] = None
    wantedByMe: Optional[bool] = None
    publishedAt: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


# ==================== 商品评论 ====================


class ProductCommentCreate(BaseModel):
    """发表商品评论"""
    content: str = Field(..., min_length=1)
    parentId: Optional[int] = Field(None, description="父评论 ID；回复他人时传入")
    replyToUserId: Optional[int] = Field(None, description="被回复的用户 ID")


class ProductComment(BaseModel):
    """商品评论"""
    id: int
    productId: int
    userId: Optional[int] = None
    username: Optional[str] = None
    userAvatar: Optional[str] = None
    parentId: Optional[int] = None
    replyToUserId: Optional[int] = None
    replyToUsername: Optional[str] = None
    content: str
    likeCount: int = 0
    replyCount: int = 0
    likedByMe: Optional[bool] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class ProductCommentList(BaseModel):
    """评论分页结果"""
    comments: List[ProductComment] = []
    total: int = 0


# ==================== 分页 & 过滤 ====================


class StoreProductListResult(BaseModel):
    """商品列表分页结果"""
    products: List[StoreProduct] = []
    total: int
    page: int
    pageSize: int
