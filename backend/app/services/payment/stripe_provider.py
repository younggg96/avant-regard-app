"""
Stripe 支付通道。

环境变量：
  STRIPE_API_KEY     必填，Secret key
  STRIPE_WEBHOOK_SECRET  可选，处理 webhook 时校验签名用

策略：
  - 没装 `stripe` SDK 时 fallback 到内部 stub（依然返回结构化 intent），
    这样开发机 / CI 不强制依赖 Stripe 账号。
  - intent.client_secret 由前端 Stripe SDK 使用拉起 PaymentSheet。
"""
from __future__ import annotations

import os
import uuid
from typing import Optional, Dict, Any

from .base import PaymentIntent, PaymentResult

try:  # pragma: no cover - optional dep
    import stripe  # type: ignore
    _HAS_STRIPE = True
except Exception:  # pragma: no cover
    stripe = None  # type: ignore
    _HAS_STRIPE = False


def _to_stripe_currency(currency: str) -> str:
    # Stripe 用小写
    return (currency or "USD").lower()


class StripeProvider:
    name = "stripe"

    def __init__(self) -> None:
        self._api_key = os.getenv("STRIPE_API_KEY")
        if _HAS_STRIPE and self._api_key:
            stripe.api_key = self._api_key  # type: ignore

    def _live(self) -> bool:
        return _HAS_STRIPE and bool(self._api_key)

    def create_intent(
        self,
        *,
        order_id: int,
        amount_cents: int,
        currency: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> PaymentIntent:
        meta = {"orderId": str(order_id), **(metadata or {})}
        if not self._live():
            stub = f"stripe_stub_{order_id}_{uuid.uuid4().hex[:8]}"
            return PaymentIntent(
                provider=self.name,
                intent_id=stub,
                client_secret=stub,
                amount_cents=amount_cents,
                currency=_to_stripe_currency(currency),
                status="pending",
                metadata={**meta, "stub": True},
            )
        try:  # pragma: no cover - live path
            intent = stripe.PaymentIntent.create(  # type: ignore
                amount=amount_cents,
                currency=_to_stripe_currency(currency),
                metadata={k: str(v) for k, v in meta.items()},
                automatic_payment_methods={"enabled": True},
            )
            return PaymentIntent(
                provider=self.name,
                intent_id=intent.id,
                client_secret=intent.client_secret,
                amount_cents=amount_cents,
                currency=_to_stripe_currency(currency),
                status=intent.status,
                metadata=meta,
            )
        except Exception as e:  # pragma: no cover
            print(f"[stripe] create_intent failed, fallback to stub: {e}")
            stub = f"stripe_err_{order_id}_{uuid.uuid4().hex[:8]}"
            return PaymentIntent(
                provider=self.name,
                intent_id=stub,
                client_secret=stub,
                amount_cents=amount_cents,
                currency=_to_stripe_currency(currency),
                status="pending",
                metadata={**meta, "stub": True, "error": str(e)},
            )

    def confirm(self, intent_id: str) -> PaymentResult:
        if not self._live():
            return PaymentResult(
                provider=self.name,
                intent_id=intent_id,
                status="succeeded",
                raw={"stub": True},
            )
        try:  # pragma: no cover - live path
            intent = stripe.PaymentIntent.retrieve(intent_id)  # type: ignore
            status = "succeeded" if intent.status == "succeeded" else (
                "failed" if intent.status in ("canceled", "requires_payment_method") else "pending"
            )
            return PaymentResult(
                provider=self.name,
                intent_id=intent_id,
                status=status,
                amount_cents=intent.amount or 0,
                currency=(intent.currency or "usd").upper(),
                raw=intent.to_dict() if hasattr(intent, "to_dict") else {},
            )
        except Exception as e:  # pragma: no cover
            print(f"[stripe] confirm failed: {e}")
            return PaymentResult(
                provider=self.name, intent_id=intent_id, status="failed", raw={"error": str(e)}
            )

    def refund(
        self,
        intent_id: str,
        *,
        amount_cents: Optional[int] = None,
        reason: Optional[str] = None,
    ) -> PaymentResult:
        if not self._live():
            return PaymentResult(
                provider=self.name,
                intent_id=intent_id,
                status="succeeded",
                raw={"stub": True, "amount_cents": amount_cents, "reason": reason},
            )
        try:  # pragma: no cover
            refund = stripe.Refund.create(  # type: ignore
                payment_intent=intent_id,
                amount=amount_cents,
                reason="requested_by_customer",
            )
            return PaymentResult(
                provider=self.name,
                intent_id=intent_id,
                status="succeeded" if refund.status == "succeeded" else "pending",
                raw={"refundId": refund.id, "status": refund.status},
            )
        except Exception as e:  # pragma: no cover
            return PaymentResult(
                provider=self.name, intent_id=intent_id, status="failed", raw={"error": str(e)}
            )
