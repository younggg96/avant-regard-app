"""
支付通道协议层。各实现仅需满足 PaymentProvider 协议。
"""
from __future__ import annotations

from typing import Protocol, Optional, Dict, Any, Mapping
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


# 标准化 webhook 事件类型,跨 provider 复用同一处理逻辑(orders 状态机)。
WEBHOOK_EVENT_PAYMENT_SUCCEEDED = "payment.succeeded"
WEBHOOK_EVENT_PAYMENT_FAILED = "payment.failed"
WEBHOOK_EVENT_REFUND_SUCCEEDED = "refund.succeeded"


@dataclass
class WebhookEvent:
    """Provider webhook 解析后的标准化事件。

    业务层只关心:
      - `event_type`:WEBHOOK_EVENT_* 之一
      - `intent_id`:对应订单 payment_intent_id,用于查询订单
      - `amount_cents` / `currency`:对账用
      - `raw`:原始 payload,留作审计 / 排查
    """
    provider: str
    event_type: str
    intent_id: Optional[str]
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

    def verify_webhook(
        self,
        *,
        headers: Mapping[str, str],
        body: bytes,
    ) -> Optional[WebhookEvent]:
        """验签并解析 webhook payload。

        - 验签失败 → 返回 None (路由层应该 400 拒掉)
        - 解析到的事件类型在 WEBHOOK_EVENT_* 之外 → 也返回 None (路由层 200 ignore)
        - 成功 → 返回 WebhookEvent,业务层据此推进订单状态机
        """
        ...
