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
