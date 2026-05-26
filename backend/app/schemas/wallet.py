"""
卖家钱包 + 实名认证 + 放款账户相关 Schemas。

业务规则：
  - 买家确认收货 → 平台抽 1% → 进卖家钱包 pending_cents（锁 3 天）→ 自动释放到 available_cents
  - 卖家必须完成「实名认证 + 默认放款账户」才能发起提款
  - 提款采用「人工 / 第三方通道」打款，状态机 pending → processing → paid/rejected
"""
from __future__ import annotations

from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field, field_validator


# ============================ Wallet ============================


class SellerBalance(BaseModel):
    """卖家钱包余额。"""
    ownerKind: str = "user"            # user | merchant
    ownerUserId: Optional[int] = None
    ownerMerchantId: Optional[int] = None
    availableCents: int = 0            # 可立即提现
    pendingCents: int = 0              # 已确认收货但仍在 3 天锁定期
    totalPayoutCents: int = 0          # 累计入账（含已提）
    totalWithdrawnCents: int = 0
    currency: str = "CNY"
    lastReleaseAt: Optional[str] = None
    updatedAt: Optional[str] = None


class PendingPayoutItem(BaseModel):
    """单笔尚未解冻的款项（钱包 pending 列表用）。"""
    id: int
    orderId: int
    orderNo: Optional[str] = None
    amountCents: int                   # 实收（已扣 1%）
    grossAmountCents: int              # 买家实付
    commissionCents: int               # 平台手续费
    currency: str = "CNY"
    releaseAt: str                     # 解冻时间
    status: str = "locked"
    createdAt: Optional[str] = None


class LedgerEntry(BaseModel):
    """资金流水。"""
    id: int
    orderId: Optional[int] = None
    direction: str                     # credit | debit
    amountCents: int
    currency: str = "CNY"
    reason: str
    note: Optional[str] = None
    createdAt: Optional[str] = None


class WalletSummary(BaseModel):
    """钱包首屏（余额 + 最近释放 + 待解冻）。"""
    balance: SellerBalance
    upcomingReleaseCents: int = 0      # 未来 24h 内会释放的金额
    pendingCount: int = 0              # pending_payouts 数量
    kycStatus: str = "none"            # 实名认证状态
    hasDefaultPayoutAccount: bool = False


# ============================ Withdrawals ============================


class WithdrawCreateRequest(BaseModel):
    """发起提款。"""
    amountCents: int = Field(..., gt=0)
    payoutAccountId: Optional[int] = Field(
        None, description="为空则使用 is_default 的账户"
    )
    note: Optional[str] = Field(None, max_length=200)


class Withdrawal(BaseModel):
    id: int
    userId: int
    payoutAccountId: Optional[int] = None
    amountCents: int
    currency: str = "CNY"
    status: str = "pending"            # pending | processing | paid | rejected
    note: Optional[str] = None
    rejectReason: Optional[str] = None
    processedAt: Optional[str] = None
    createdAt: Optional[str] = None
    # 关联快照（避免账户删了流水也找不到）
    payoutAccountSummary: Optional[str] = None


class WithdrawalAdminUpdate(BaseModel):
    """管理员处理：mark paid / rejected。"""
    status: str = Field(..., pattern="^(processing|paid|rejected)$")
    rejectReason: Optional[str] = Field(None, max_length=300)


# ============================ KYC ============================


class KYCStatus(str, Enum):
    NONE = "none"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class KYCSubmitRequest(BaseModel):
    realName: str = Field(..., min_length=1, max_length=80)
    idCardNo: str = Field(..., min_length=6, max_length=64)
    idCardFrontUrl: Optional[str] = None
    idCardBackUrl: Optional[str] = None
    holderPhotoUrl: Optional[str] = None
    contactPhone: Optional[str] = Field(None, max_length=32)

    @field_validator("idCardNo")
    @classmethod
    def _strip_id(cls, v: str) -> str:
        return v.strip().upper()


class KYCRecord(BaseModel):
    id: Optional[int] = None
    userId: int
    realName: Optional[str] = None     # 服务端按 mask 输出（如 张*伟）
    idCardMasked: Optional[str] = None
    idCardFrontUrl: Optional[str] = None
    idCardBackUrl: Optional[str] = None
    holderPhotoUrl: Optional[str] = None
    contactPhone: Optional[str] = None
    status: str = "none"
    rejectReason: Optional[str] = None
    submittedAt: Optional[str] = None
    reviewedAt: Optional[str] = None


class KYCAdminDecision(BaseModel):
    decision: str = Field(..., pattern="^(approved|rejected)$")
    rejectReason: Optional[str] = Field(None, max_length=300)


# ============================ Payout Account ============================


class PayoutAccountType(str, Enum):
    BANK = "bank"
    ALIPAY = "alipay"
    WECHAT = "wechat"
    # Stripe Connect Express, account_no 字段存 acct_*。
    # KYC 由 Stripe 托管, 国际放款必备。
    STRIPE_CONNECT = "stripe_connect"


class PayoutAccountCreate(BaseModel):
    accountType: PayoutAccountType
    holderName: str = Field(..., min_length=1, max_length=80)
    accountNo: str = Field(..., min_length=4, max_length=64)
    bankName: Optional[str] = Field(None, max_length=80)
    branchName: Optional[str] = Field(None, max_length=120)
    isDefault: bool = True


class VerifyIdentityRequest(BaseModel):
    """实名二要素校验请求(姓名 + 身份证号)。"""
    realName: str = Field(..., min_length=1, max_length=80)
    idCardNo: str = Field(..., min_length=15, max_length=18)


class VerifyBankCardRequest(BaseModel):
    """银行卡四要素校验请求(绑定 payout_account 前调)。"""
    holderName: str = Field(..., min_length=1, max_length=80)
    idCardNo: str = Field(..., min_length=15, max_length=18)
    bankNo: str = Field(..., min_length=12, max_length=24)
    phone: str = Field(..., min_length=8, max_length=24)


class PayoutAccount(BaseModel):
    id: int
    userId: int
    accountType: str
    holderName: str
    accountNoMasked: str               # 服务端 mask（如 6217 **** **** 4583）
    accountNoLast4: Optional[str] = None
    bankName: Optional[str] = None
    branchName: Optional[str] = None
    isDefault: bool = False
    createdAt: Optional[str] = None


# ============================ Confirm Receipt ============================


class ConfirmReceiptResult(BaseModel):
    """买家确认收货后返回的结算明细，前端「确认成功」页直接渲染。"""
    orderId: int
    orderNo: str
    grossAmountCents: int              # 买家实付
    commissionCents: int               # 平台手续费
    commissionRateBps: int             # 100 = 1%
    sellerPayoutCents: int             # 卖家实收
    currency: str = "CNY"
    releaseAt: Optional[str] = None    # 卖家可提现时间（completed + 3d）
    completedAt: Optional[str] = None
