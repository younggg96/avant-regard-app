"""
PRD 模块 5 · 售后 / 鉴定 / 双盲互评 schemas。
"""
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field


# ----------------- Disputes -----------------


class DisputeReason(str, Enum):
    NOT_AS_DESCRIBED = "not_as_described"
    DAMAGED = "damaged"
    NOT_RECEIVED = "not_received"
    FAKE = "fake"
    OTHER = "other"


class DisputeStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED_REFUND = "resolved_refund"
    RESOLVED_RELEASE = "resolved_release"
    WITHDRAWN = "withdrawn"


class DisputeCreate(BaseModel):
    orderId: int
    reason: DisputeReason
    description: Optional[str] = Field(None, max_length=2000)
    evidencePhotos: List[str] = Field(default_factory=list)


class DisputeResolve(BaseModel):
    decision: DisputeStatus  # resolved_refund / resolved_release
    note: Optional[str] = None


class Dispute(BaseModel):
    id: int
    orderId: int
    openerUserId: int
    openerRole: str
    reason: str
    description: Optional[str] = None
    evidencePhotos: List[str] = Field(default_factory=list)
    status: str
    csHandlerUserId: Optional[int] = None
    csDecision: Optional[str] = None
    resolvedAt: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


# ----------------- Authentication SKU -----------------


class AuthenticationPackage(BaseModel):
    id: int
    code: str
    name: str
    priceCents: int
    currency: str = "CNY"
    slaHours: int
    description: Optional[str] = None


class AuthenticationOrderCreate(BaseModel):
    packageCode: str  # 'standard' / 'pro' / 'expert'
    productId: Optional[int] = None
    brandName: Optional[str] = None
    itemPhotos: List[str] = Field(default_factory=list, min_length=1)
    note: Optional[str] = Field(None, max_length=1000)


class AuthenticationDecision(BaseModel):
    result: str = Field(..., pattern="^(authentic|fake|inconclusive)$")
    expertReport: str = Field(..., min_length=1)
    certificateUrl: Optional[str] = None


class AuthenticationOrder(BaseModel):
    id: int
    orderNo: str
    userId: int
    packageId: int
    packageCode: Optional[str] = None
    productId: Optional[int] = None
    brandName: Optional[str] = None
    itemPhotos: List[str] = Field(default_factory=list)
    note: Optional[str] = None
    priceCents: int
    currency: str
    status: str
    result: str
    expertUserId: Optional[int] = None
    expertReport: Optional[str] = None
    certificateUrl: Optional[str] = None
    paymentProvider: Optional[str] = None
    paymentIntentId: Optional[str] = None
    paidAt: Optional[str] = None
    completedAt: Optional[str] = None
    createdAt: Optional[str] = None


# ----------------- Trade reviews -----------------


class TradeReviewCreate(BaseModel):
    orderId: int
    rating: int = Field(..., ge=1, le=5)
    payload: Optional[Dict[str, Any]] = None  # {asDescribed:5, communication:5, packaging:4, shipping:5, tags:[...]}
    comment: Optional[str] = Field(None, max_length=1000)
    photos: Optional[list[str]] = Field(default=None, max_length=3)


class TradeReview(BaseModel):
    id: int
    orderId: int
    reviewerUserId: int
    reviewerRole: str
    targetUserId: int
    rating: int
    payload: Optional[Dict[str, Any]] = None
    comment: Optional[str] = None
    photos: Optional[list[str]] = None
    visible: bool
    submittedAt: Optional[str] = None
    autoClosedAt: Optional[str] = None
