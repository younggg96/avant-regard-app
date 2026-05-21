"""
支付通道协议层。各实现仅需满足 PaymentProvider 协议。
"""
from __future__ import annotations

from typing import Protocol, Optional, Dict, Any
from dataclasses import dataclass, field


@dataclass
class PaymentIntent:
    """创建支付意图后的返回。

    `client_secret` 在 Stripe 等通道下用于前端 SDK 拉起收银台；
    支付宝 / 微信场景下放在 `metadata` 里返回 prepay_id / qr_url。
    """
    provider: str
    intent_id: str
    client_secret: Optional[str] = None
    amount_cents: int = 0
    currency: str = "CNY"
    status: str = "pending"  # pending / succeeded / failed / canceled
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PaymentResult:
    """支付确认 / 回调结果。"""
    provider: str
    intent_id: str
    status: str  # succeeded / failed / canceled
    amount_cents: int = 0
    currency: str = "CNY"
    raw: Dict[str, Any] = field(default_factory=dict)


class PaymentProvider(Protocol):
    name: str

    def create_intent(
        self,
        *,
        order_id: int,
        amount_cents: int,
        currency: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> PaymentIntent: ...

    def confirm(self, intent_id: str) -> PaymentResult: ...

    def refund(
        self,
        intent_id: str,
        *,
        amount_cents: Optional[int] = None,
        reason: Optional[str] = None,
    ) -> PaymentResult: ...
