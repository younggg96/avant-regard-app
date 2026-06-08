"""
PRD 模块 5 · 售后 / 鉴定 / 双盲互评 schemas。
"""
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field


# ----------------- Disputes -----------------


class DisputeReason(str, Enum):
    # 旧通用原因（保留向后兼容 / 后台仲裁仍可用）
    NOT_AS_DESCRIBED = "not_as_described"
    DAMAGED = "damaged"
    NOT_RECEIVED = "not_received"
    FAKE = "fake"
    OTHER = "other"
    # 买家端售后请求原因（与前端 AftersalesIssue + 订单详情「选择售后类型」一致）
    NO_LOGISTICS_UPDATE = "no_logistics_update"
    DELIVERED_NOT_RECEIVED = "delivered_not_received"
    QUALITY_ISSUE = "quality_issue"
    LISTING_DELISTED = "listing_delisted"


class DisputeStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED_REFUND = "resolved_refund"
    RESOLVED_RELEASE = "resolved_release"
    WITHDRAWN = "withdrawn"


class SellerResponseAction(str, Enum):
    """卖家对买家售后请求的响应动作。

    - agree_refund: 卖家同意退款 → 订单直接进入 refunded，无需客服介入。
    - reject:       卖家拒绝并申诉 → 记录卖家说明 + 凭证，转交客服仲裁。
    """
    AGREE_REFUND = "agree_refund"
    REJECT = "reject"


class DisputeCreate(BaseModel):
    orderId: int
    reason: DisputeReason
    description: Optional[str] = Field(None, max_length=2000)
    evidencePhotos: List[str] = Field(default_factory=list)


class DisputeResolve(BaseModel):
    decision: DisputeStatus  # resolved_refund / resolved_release
    note: Optional[str] = None


class DisputeSellerRespond(BaseModel):
    action: SellerResponseAction
    message: Optional[str] = Field(None, max_length=2000)
    evidencePhotos: List[str] = Field(default_factory=list)


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
    # 卖家响应（买家/卖家分流后新增）
    sellerResponse: Optional[str] = None
    sellerResponseAction: Optional[str] = None
    sellerResponseAt: Optional[str] = None
    sellerEvidencePhotos: List[str] = Field(default_factory=list)
    # 列表展示用的订单 / 商品上下文（仅卖家售后列表 / 详情接口填充）
    orderNo: Optional[str] = None
    productId: Optional[int] = None
    productTitle: Optional[str] = None
    productImage: Optional[str] = None
    paidPriceCents: Optional[int] = None
    currency: Optional[str] = None
    buyerUserId: Optional[int] = None
    sellerUserId: Optional[int] = None


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
    # 仅 stripe 支付时返回 client_secret, 前端拉 PaymentSheet 用。
    clientSecret: Optional[str] = None
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
    # 评价人信息（卖家历史评价页展示买家头像 + 脱敏用户名）
    reviewerUsername: Optional[str] = None
    reviewerAvatarUrl: Optional[str] = None


class OrderReviewStatus(BaseModel):
    orderId: int
    canReview: bool
    myReviewSubmitted: bool
    buyerReviewSubmitted: bool
    sellerReviewSubmitted: bool
    bothVisible: bool


class TradeReviewStatusBatchRequest(BaseModel):
    orderIds: List[int] = Field(..., max_length=50)
