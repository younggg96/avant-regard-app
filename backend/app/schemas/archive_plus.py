"""
PRD 模块 6 & 8 · My Archive / Plus schemas。
"""
from typing import Optional, List
from datetime import date
from enum import Enum
from pydantic import BaseModel, Field


# ---------------- My Archive ----------------


class ArchiveItem(BaseModel):
    id: int
    userId: int
    productId: Optional[int] = None
    orderId: Optional[int] = None
    title: Optional[str] = None
    brandName: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    condition: Optional[str] = None
    # shows.id 是 VARCHAR(100)（MongoDB ObjectId 字符串），不能用 int。
    originalShowId: Optional[str] = None
    acquiredPriceCents: Optional[int] = None
    currency: str = "CNY"
    photos: List[str] = Field(default_factory=list)
    acquiredAt: Optional[str] = None
    note: Optional[str] = None
    relistedProductId: Optional[int] = None
    relistedAt: Optional[str] = None
    # PDF p.21 + p.22 新增字段
    source: str = "order"          # 'order' / 'manual' / 'imported'
    storageLocation: Optional[str] = None
    isCurrentlyOwned: bool = True
    # 数字护照 5.2 / 5.3：品牌归一到 brands 表、发布年份、有效性检查结论。
    # brandId 为空而 brandName 有值 = 新品牌还在后台审核中。
    brandId: Optional[int] = None
    releaseYear: Optional[int] = None
    validityStatus: str = "passed"   # passed / warned / manual_review / rejected
    # photos 的子集：其中由 AI 生成（三视图）而非实拍的那些。
    # 展示单品照片的地方都应据此标注，尤其是 5.4 的公开验证页 ——
    # 把 AI 推测的侧背面当实物照展示会误导买家。
    aiPhotos: List[str] = Field(default_factory=list)
    # 090：public = 进「世界」feed、他人可打开详情页；private = 仅本人可见。
    visibility: str = "public"
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


# PDF p.21 · 独立上传 MY ARCHIVE 条目
class ArchiveItemManualCreate(BaseModel):
    title: str
    brandName: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    condition: Optional[str] = None
    acquiredPriceCents: Optional[int] = None
    currency: str = "CNY"
    photos: List[str] = Field(default_factory=list)
    acquiredAt: Optional[str] = None
    note: Optional[str] = None
    storageLocation: Optional[str] = None
    originalShowId: Optional[str] = None
    # 数字护照链路写入；老的独立上传入口不传这些，保持默认值即可。
    brandId: Optional[int] = None
    releaseYear: Optional[int] = None
    # 注意：validityStatus 故意不在这里 —— 它是「这张图过没过 5.3 有效性检查」
    # 的结论，只能由服务端根据实际检查结果写，客户端不能自证清白。
    # 见 archive_service.manual_create 的 validity_status 参数。


# PDF p.22 · MY ARCHIVE 持有记录
class ArchiveHoldingRecord(BaseModel):
    id: int
    archiveItemId: int
    userId: int
    heldFrom: Optional[str] = None
    heldTo: Optional[str] = None
    status: str
    note: Optional[str] = None
    counterpartUserId: Optional[int] = None
    counterpartName: Optional[str] = None
    relatedProductId: Optional[int] = None
    relatedOrderId: Optional[int] = None
    createdAt: Optional[str] = None


class ArchiveHoldingCreate(BaseModel):
    heldFrom: Optional[str] = None
    heldTo: Optional[str] = None
    status: str = Field("owned", pattern="^(owned|lent|transferred|resold|returned)$")
    note: Optional[str] = None
    counterpartUserId: Optional[int] = None
    counterpartName: Optional[str] = None
    relatedProductId: Optional[int] = None
    relatedOrderId: Optional[int] = None


class ArchiveAnalytics(BaseModel):
    totalItems: int
    totalAcquiredCents: int
    brandBreakdown: dict          # {brand_name: count}
    yearBreakdown: dict           # {year: count}
    avgPriceCents: int


# ---------------- My Archive · 世界（浏览他人档案） ----------------


class ArchiveAuthor(BaseModel):
    """世界档案 feed 中的作者简介（username + 头像）。"""
    id: int
    username: str = ""
    avatarUrl: Optional[str] = None


class WorldArchiveItem(ArchiveItem):
    """他人公开档案条目 = 基础 ArchiveItem + 作者简介。"""
    author: Optional[ArchiveAuthor] = None


class ArchiveVisibilityUpdate(BaseModel):
    """本人切换藏品可见性。只此一个字段 —— 其余字段的编辑走各自的入口，
    别让一个「改可见性」的接口顺手成为万能更新接口。"""
    visibility: str = Field(..., pattern="^(public|private)$")


# ---------------- Plus ----------------


class PlusPlan(str, Enum):
    MONTHLY = "monthly"
    ANNUAL = "annual"


class PlusSubscription(BaseModel):
    id: int
    userId: int
    plan: str
    periodStart: str
    periodEnd: str
    priceCents: int
    currency: str = "CNY"
    source: str
    paymentIntentId: Optional[str] = None
    # 仅 source=stripe 时返回 client_secret, 前端用 Stripe RN SDK 拉
    # PaymentSheet 完成支付。其它通道为 null。
    clientSecret: Optional[str] = None
    status: str
    autoRenew: bool = False
    createdAt: Optional[str] = None


class PlusSubscribeRequest(BaseModel):
    plan: PlusPlan


class PlusStatus(BaseModel):
    isActive: bool
    subscription: Optional[PlusSubscription] = None
    commissionRateBps: int  # 当前用户实际抽佣率
