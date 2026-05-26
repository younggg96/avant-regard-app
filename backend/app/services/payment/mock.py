"""
Mock 支付通道：开发 / 内测使用。

行为：
  - create_intent 总是返回 pending 的 intent_id
  - confirm 默认成功
  - refund 默认成功
  - verify_webhook 接受任何 JSON body,期望形如:
      { "type": "payment.succeeded"|"payment.failed"|"refund.succeeded",
        "intent_id": "...",
        "amount_cents": 0, "currency": "CNY" }
    便于 dev / 自动化测试直接 POST 调通联路。
"""
import json
import uuid
from typing import Optional, Dict, Any, Mapping

from .base import (
    PaymentProvider,
    PaymentIntent,
    PaymentResult,
    WebhookEvent,
    WEBHOOK_EVENT_PAYMENT_SUCCEEDED,
    WEBHOOK_EVENT_PAYMENT_FAILED,
    WEBHOOK_EVENT_REFUND_SUCCEEDED,
)


_ALLOWED_MOCK_EVENTS = {
    WEBHOOK_EVENT_PAYMENT_SUCCEEDED,
    WEBHOOK_EVENT_PAYMENT_FAILED,
    WEBHOOK_EVENT_REFUND_SUCCEEDED,
}


class MockPaymentProvider:
    name = "mock"

    def create_intent(
        self,
        *,
        order_id: int,
        amount_cents: int,
        currency: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> PaymentIntent:
        intent_id = f"mock_{order_id}_{uuid.uuid4().hex[:8]}"
        return PaymentIntent(
            provider=self.name,
            intent_id=intent_id,
            client_secret=intent_id,  # 直接当 secret 用，方便前端打通
            amount_cents=amount_cents,
            currency=currency,
            status="pending",
            metadata=metadata or {},
        )

    def confirm(self, intent_id: str) -> PaymentResult:
        return PaymentResult(
            provider=self.name,
            intent_id=intent_id,
            status="succeeded",
        )

    def refund(
        self,
        intent_id: str,
        *,
        amount_cents: Optional[int] = None,
        reason: Optional[str] = None,
    ) -> PaymentResult:
        return PaymentResult(
            provider=self.name,
            intent_id=intent_id,
            status="succeeded",
            raw={"refundAmountCents": amount_cents, "reason": reason},
        )

    def verify_webhook(
        self,
        *,
        headers: Mapping[str, str],
        body: bytes,
    ) -> Optional[WebhookEvent]:
        try:
            payload = json.loads(body or b"{}")
        except Exception:
            return None
        evt = payload.get("type")
        if evt not in _ALLOWED_MOCK_EVENTS:
            return None
        return WebhookEvent(
            provider=self.name,
            event_type=evt,
            intent_id=payload.get("intent_id"),
            amount_cents=int(payload.get("amount_cents") or 0),
            currency=str(payload.get("currency") or "CNY"),
            raw=payload,
        )
