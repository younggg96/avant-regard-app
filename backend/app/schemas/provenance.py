"""
PRD 模块三 · 履历 / 价格基准 / 收藏夹 schemas。
"""
from typing import Optional, List, Dict, Any
from datetime import date
from enum import Enum
from pydantic import BaseModel, Field


class ProvenanceEventType(str, Enum):
    ORIGIN_SHOW = "origin_show"
    MERCHANT_ACQUIRED = "merchant_acquired"
    COLLECTOR_OWNED = "collector_owned"
    ON_SALE_NOW = "on_sale_now"
    SOLD = "sold"
    RESALE = "resale"


class ActorKind(str, Enum):
    BRAND = "brand"
    MERCHANT = "merchant"
    USER = "user"
    SYSTEM = "system"


class ProvenanceEvent(BaseModel):
    id: int
    productId: int
    eventType: str
    actorKind: str
    actorUserId: Optional[int] = None
    actorMerchantId: Optional[int] = None
    actorBrandId: Optional[int] = None
    occurredAt: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    createdAt: Optional[str] = None


class ProvenanceEventCreate(BaseModel):
    eventType: ProvenanceEventType
    actorKind: ActorKind
    actorUserId: Optional[int] = None
    actorMerchantId: Optional[int] = None
    actorBrandId: Optional[int] = None
    occurredAt: Optional[date] = None
    description: Optional[str] = Field(None, max_length=500)
    metadata: Optional[Dict[str, Any]] = None


class PriceHistoryBucket(BaseModel):
    """聚合后的价格直方图分桶。"""
    bucketLabel: str            # e.g. "0-500", "500-1000", "1000-2000"
    count: int
    avgPriceCents: int


class PriceHistorySummary(BaseModel):
    brand: Optional[str] = None
    sampleSize: int
    minPriceCents: int
    maxPriceCents: int
    medianPriceCents: int
    p25PriceCents: int
    p75PriceCents: int
    buckets: List[PriceHistoryBucket] = []


class UserCollectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    description: Optional[str] = None
    visibility: str = Field(default="private", pattern="^(private|public)$")


class UserCollectionUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=64)
    description: Optional[str] = None
    visibility: Optional[str] = Field(None, pattern="^(private|public)$")
    coverProductId: Optional[int] = None
    sortOrder: Optional[int] = None


class UserCollection(BaseModel):
    id: int
    userId: int
    name: str
    description: Optional[str] = None
    visibility: str = "private"
    coverProductId: Optional[int] = None
    sortOrder: int = 0
    itemCount: Optional[int] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
