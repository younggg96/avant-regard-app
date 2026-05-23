"""
PRD 模块四 · 订单 / 出价 / 库存锁 schemas。
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class OrderStatus(str, Enum):
    PENDING_PAYMENT = "pending_payment"
    PAID = "paid"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    SETTLED = "settled"
    REFUNDED_AUTO = "refunded_auto"
    REFUNDED = "refunded"
    DISPUTED = "disputed"
    RESOLVED = "resolved"


class OfferStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    COUNTERED = "countered"
    EXPIRED = "expired"
    WITHDRAWN = "withdrawn"


# ----------------- Create / Update bodies -----------------


class BuyNowRequest(BaseModel):
    productId: int
    shippingAddress: Optional[Dict[str, Any]] = None


class PaymentStartRequest(BaseModel):
    provider: Optional[str] = Field(
        None,
        description="alipay / wechat / stripe / mock；空时按订单 currency 自动选首选",
    )


class PaymentOption(BaseModel):
    provider: str
    name: str
    iconKey: str  # 前端图标 key（i18n 兼容）


class OfferCreate(BaseModel):
    productId: int
    priceCents: int = Field(..., gt=0)
    message: Optional[str] = Field(None, max_length=500)


class OfferCounter(BaseModel):
    priceCents: int = Field(..., gt=0)
    message: Optional[str] = Field(None, max_length=500)


class ShipmentCreate(BaseModel):
    carrier: str = Field(..., min_length=1, max_length=64)
    trackingNo: str = Field(..., min_length=1, max_length=128)
    images: List[str] = Field(default_factory=list)


class InspectionSubmit(BaseModel):
    checkedItems: Dict[str, bool]
    photos: List[str] = Field(default_factory=list)
    note: Optional[str] = None


# ----------------- Response objects -----------------


class Order(BaseModel):
    id: int
    orderNo: str
    productId: int
    buyerUserId: int
    sellerUserId: Optional[int] = None
    sellerMerchantId: Optional[int] = None
    offerId: Optional[int] = None
    listingPriceCents: int
    paidPriceCents: int
    commissionRateBps: int
    commissionCents: int
    sellerPayoutCents: int
    currency: str = "CNY"
    shippingAddress: Optional[Dict[str, Any]] = None
    shippingDueAt: Optional[str] = None
    autoConfirmDueAt: Optional[str] = None
    settlementDueAt: Optional[str] = None
    status: str
    paidAt: Optional[str] = None
    shippedAt: Optional[str] = None
    deliveredAt: Optional[str] = None
    completedAt: Optional[str] = None
    settledAt: Optional[str] = None
    refundedAt: Optional[str] = None
    cancelReason: Optional[str] = None
    paymentProvider: Optional[str] = None
    paymentIntentId: Optional[str] = None
    paymentMetadata: Optional[Dict[str, Any]] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class Offer(BaseModel):
    id: int
    productId: int
    buyerUserId: int
    sellerUserId: Optional[int] = None
    sellerMerchantId: Optional[int] = None
    priceCents: int
    currency: str = "CNY"
    message: Optional[str] = None
    status: str
    parentOfferId: Optional[int] = None
    expiresAt: Optional[str] = None
    resolvedAt: Optional[str] = None
    createdAt: Optional[str] = None


class StockHold(BaseModel):
    id: int
    productId: int
    buyerUserId: int
    expiresAt: str
    releasedAt: Optional[str] = None
    consumedAt: Optional[str] = None
    createdAt: Optional[str] = None


class PaymentIntentResponse(BaseModel):
    provider: str
    intentId: str
    clientSecret: Optional[str] = None
    amountCents: int
    currency: str
    status: str
    metadata: Optional[Dict[str, Any]] = None
