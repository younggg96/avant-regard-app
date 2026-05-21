"""
Mock 支付通道：开发 / 内测使用。

行为：
  - create_intent 总是返回 pending 的 intent_id
  - confirm 默认成功
  - refund 默认成功
"""
import uuid
from typing import Optional, Dict, Any

from .base import PaymentProvider, PaymentIntent, PaymentResult


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
