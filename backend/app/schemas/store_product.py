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

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import date


# ==================== 枚举类型 ====================


class ProductStatus(str, Enum):
    """单品交易态。

    Phase 1 起改为小写字符串，对齐 PRD 状态机 draft → reviewing → active → frozen → sold。
    `rejected` / `offline` 是辅助态：审核拒绝 / 卖家主动下架。
    """
    DRAFT = "draft"
    REVIEWING = "reviewing"
    ACTIVE = "active"
    FROZEN = "frozen"
    SOLD = "sold"
    REJECTED = "rejected"
    OFFLINE = "offline"


# PRD 5 档成色：全新未拆 / 99新 / 95新 / 8成新 / 有瑕疵
class ProductCondition(str, Enum):
    BNWT = "BNWT"        # Brand New With Tag 全新未拆
    NEW_99 = "NEW_99"    # 99新（轻试）
    NEW_95 = "NEW_95"    # 95新
    USED_8 = "USED_8"    # 8 成新
    FLAW = "FLAW"        # 有瑕疵


# 卖家身份多态键。merchant 复用 store_merchants；individual 复用 seller_profiles。
class SellerKind(str, Enum):
    MERCHANT = "merchant"
    INDIVIDUAL = "individual"


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


class PhotoAngles(BaseModel):
    """PRD 1.3 规范化 7 视角图 + 最多 7 张额外图。

    7 个强制槽 (提交审核前必填)：
      - `front / back`                      —— 单品正反面
      - `wash_label` / `wash_label_back`    —— 洗标正反面（防止只拍一面看不全）
      - `brand_label` / `brand_label_back`  —— 领标 / 品牌标正反面
      - `flaw`                              —— 细节 / 瑕疵；无瑕疵也需提供一张兜底证明

    历史草稿只填了原来的 5 张：会被前端 UI 提示「补两张标签背面」，后端拒绝
    提交直到补齐；不强制 DB 迁移老数据。
    """
    front: Optional[str] = Field(None, description="正面")
    back: Optional[str] = Field(None, description="背面")
    wash_label: Optional[str] = Field(None, description="洗标正面")
    wash_label_back: Optional[str] = Field(None, description="洗标背面（成分/水洗反面）")
    brand_label: Optional[str] = Field(None, description="领标 / 品牌标正面")
    brand_label_back: Optional[str] = Field(None, description="领标 / 品牌标背面")
    flaw: Optional[str] = Field(None, description="瑕疵细节图；无瑕疵也需提供一张兜底证明")
    extras: List[str] = Field(default_factory=list, max_length=7)

    REQUIRED_SLOTS: tuple = (
        "front",
        "back",
        "wash_label",
        "wash_label_back",
        "brand_label",
        "brand_label_back",
        "flaw",
    )

    def required_complete(self) -> bool:
        return all(getattr(self, k) for k in self.REQUIRED_SLOTS)


class StoreProductCreate(BaseModel):
    """创建商品 / 单品。

    Phase 1 之后这是「单品 listing」的统一入口：
      - 买手店发布：sellerKind='merchant' + merchantId（由路由解析）
      - 个人发布   ：sellerKind='individual'，seller_user_id = 当前登录用户
    默认 status='draft'，提交审核走单独接口 transition。
    """
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
    status: ProductStatus = Field(default=ProductStatus.DRAFT)
    # PRD 单品新字段
    sellerKind: SellerKind = Field(default=SellerKind.MERCHANT)
    size: Optional[str] = Field(None, max_length=32)
    color: Optional[str] = Field(None, max_length=32)
    condition: Optional[ProductCondition] = None
    conditionNote: Optional[str] = Field(None, description="无瑕疵也需填写说明（PRD 1.3）")
    originalShowId: Optional[str] = Field(None, description="关联秀场（可选）")
    originalAcquiredAt: Optional[date] = None
    acceptOffer: bool = Field(default=True)
    photoAngles: Optional[PhotoAngles] = None
    # PRD 单品 Phase 2 新字段
    styleName: Optional[str] = Field(None, max_length=200, description="款式 / Runway 系列名")
    accessoriesNote: Optional[str] = Field(None, description="配件说明")
    shipFromCountry: Optional[str] = Field(None, max_length=80, description="发货国家")
    shipFromState: Optional[str] = Field(None, max_length=80, description="发货省 / 州")
    shipFromCity: Optional[str] = Field(None, max_length=80, description="发货城市")
    shippingFeeMode: str = Field(
        default="cod",
        pattern="^(cod|free)$",
        description="运费方式：cod 到付 / free 包邮",
    )

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
    """更新商品 / 单品分步保存；未传字段不改动。

    显式传 `discountPriceCents=None` 表示取消折扣。状态字段只允许从此处 patch
    到「卖家可自行触发」的状态：draft / offline；其他状态切换必须走 transition 接口。
    """
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
    # PRD 单品字段（分步保存）
    size: Optional[str] = Field(None, max_length=32)
    color: Optional[str] = Field(None, max_length=32)
    condition: Optional[ProductCondition] = None
    conditionNote: Optional[str] = None
    originalShowId: Optional[str] = None
    originalAcquiredAt: Optional[date] = None
    acceptOffer: Optional[bool] = None
    photoAngles: Optional[PhotoAngles] = None
    # PRD 单品 Phase 2 新字段
    styleName: Optional[str] = Field(None, max_length=200)
    accessoriesNote: Optional[str] = None
    shipFromCountry: Optional[str] = Field(None, max_length=80)
    shipFromState: Optional[str] = Field(None, max_length=80)
    shipFromCity: Optional[str] = Field(None, max_length=80)
    shippingFeeMode: Optional[str] = Field(None, pattern="^(cod|free)$")


# ==================== 状态机 transition ====================


class ProductTransition(BaseModel):
    """状态机迁移请求。

    target 必须是合法目标态；reason 仅在 reject/offline 时建议填写。
    """
    target: ProductStatus
    reason: Optional[str] = Field(None, max_length=500)


class ProductReviewDecision(BaseModel):
    """管理员审核决策。"""
    decision: str = Field(..., pattern="^(approved|rejected)$")
    reason: Optional[str] = Field(None, max_length=500)


# ==================== 批量操作 ====================


class BatchListingAction(BaseModel):
    """批量下架 / 删除（PRD 1.6 卖家管理后台）。"""
    productIds: List[int] = Field(..., min_length=1, max_length=100)


class StoreProduct(BaseModel):
    """商品 / 单品"""
    id: int
    storeId: Optional[str] = None              # 个人卖家时为 null
    merchantId: Optional[int] = None
    sellerKind: str = "merchant"
    sellerUserId: Optional[int] = None
    # 列表卡片展示用：卖家头像 + 名称（marketplace 列表批量补充，详情走 rich-detail）
    sellerName: Optional[str] = None
    sellerAvatarUrl: Optional[str] = None
    categoryId: Optional[int] = None
    categoryName: Optional[str] = None
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
    status: str = "draft"
    # PRD 单品扩展
    size: Optional[str] = None
    color: Optional[str] = None
    condition: Optional[str] = None
    conditionNote: Optional[str] = None
    originalShowId: Optional[str] = None
    originalAcquiredAt: Optional[str] = None
    acceptOffer: bool = True
    photoAngles: Optional[Dict[str, Any]] = None
    frozenUntil: Optional[str] = None
    currentBuyerId: Optional[int] = None
    soldAt: Optional[str] = None
    rejectedReason: Optional[str] = None
    likedByMe: Optional[bool] = None
    favoritedByMe: Optional[bool] = None
    wantedByMe: Optional[bool] = None
    publishedAt: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    # PRD 单品 Phase 2 新字段
    styleName: Optional[str] = None
    accessoriesNote: Optional[str] = None
    shipFromCountry: Optional[str] = None
    shipFromState: Optional[str] = None
    shipFromCity: Optional[str] = None
    shippingFeeMode: str = "cod"
    commissionRateBps: int = 100  # 1%
    # 「大家都在看」管理员策展 + 信息完整度评分（migration 065）
    isCurated: bool = False
    curatedSortOrder: Optional[int] = None
    completenessScore: int = 0


class BrandPriceRange(BaseModel):
    """PRD 1.4 智能定价 —— 品牌 + 成色历史价格区间。"""
    brand: str
    condition: Optional[str] = None
    sampleSize: int = 0
    lowCents: int = 0
    medianCents: int = 0
    highCents: int = 0
    minCents: int = 0
    maxCents: int = 0
    source: str = "history"  # history | fallback


class SupportContactInfo(BaseModel):
    """找不到品牌 / 秀场时引导联系小客服的配置。"""
    weekdayHours: str
    weekendHours: str
    timezone: str
    wechatId: Optional[str] = None
    email: Optional[str] = None
    notice: Optional[str] = None


class MarketplaceSearchSuggestion(BaseModel):
    """交易大厅搜索下拉建议项。"""
    label: str = Field(..., description="展示文案，如 Rick Owens / Rick Owens DRKSHDW / Rick Owens FW07")
    type: str = Field(..., description="brand | product | show | keyword")
    query: str = Field(..., description="选中后用于 Marketplace 搜索的关键词")
    brand: Optional[str] = None
    brandId: Optional[int] = None
    showId: Optional[str] = None
    productId: Optional[int] = None
    imageUrl: Optional[str] = None
    listingCount: Optional[int] = None


# ==================== Seller Profile ====================


class SellerProfile(BaseModel):
    """C2C 个人卖家档案（与 users 1:1）。

    PRD 3.2 卖家信用浮层数据源。Phase 1 只读基础字段；信用分 / 响应速度 在
    P4 / P5 才会通过订单与 IM 自动写入。
    """
    userId: int
    displayName: Optional[str] = None
    bio: Optional[str] = None
    idVerified: bool = False
    idVerifiedAt: Optional[str] = None
    creditScore: int = 100
    responseAvgMinutes: Optional[int] = None
    totalSales: int = 0
    totalGmvCents: int = 0
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class SellerProfileUpsert(BaseModel):
    """卖家自助维护档案（昵称 / 简介）。"""
    displayName: Optional[str] = Field(None, max_length=64)
    bio: Optional[str] = Field(None, max_length=500)


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
