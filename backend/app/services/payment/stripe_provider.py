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
from typing import Optional, Dict, Any, Mapping

from .base import (
    PaymentIntent,
    PaymentResult,
    WebhookEvent,
    WEBHOOK_EVENT_PAYMENT_SUCCEEDED,
    WEBHOOK_EVENT_PAYMENT_FAILED,
    WEBHOOK_EVENT_REFUND_SUCCEEDED,
)


# Stripe 事件名 → 我们的标准事件名
_STRIPE_EVENT_MAP = {
    "payment_intent.succeeded": WEBHOOK_EVENT_PAYMENT_SUCCEEDED,
    "payment_intent.payment_failed": WEBHOOK_EVENT_PAYMENT_FAILED,
    "charge.refunded": WEBHOOK_EVENT_REFUND_SUCCEEDED,
}

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
        self._webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
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

    def verify_webhook(
        self,
        *,
        headers: Mapping[str, str],
        body: bytes,
    ) -> Optional[WebhookEvent]:
        # 没装 SDK 或没配 webhook secret → 直接拒绝(生产路径必须验签)。
        # 本地 dev 可以用 PAYMENT_PROVIDER=mock 的 webhook 路径联调,
        # 不要让真实 stripe 路由在未验签状态下推进订单。
        if not (_HAS_STRIPE and self._webhook_secret):
            return None

        sig = headers.get("stripe-signature") or headers.get("Stripe-Signature")
        if not sig:
            return None
        try:  # pragma: no cover
            event = stripe.Webhook.construct_event(  # type: ignore
                body, sig, self._webhook_secret
            )
        except Exception as e:  # pragma: no cover
            print(f"[stripe] webhook verify failed: {e}")
            return None

        evt_type_raw = getattr(event, "type", None) or event.get("type")  # type: ignore
        evt_type = _STRIPE_EVENT_MAP.get(evt_type_raw)
        if not evt_type:
            return None

        data = (
            event.get("data", {}).get("object", {})  # type: ignore
            if isinstance(event, dict)
            else event.data.object  # type: ignore
        )
        # PaymentIntent / Charge 都有 id + amount + currency,但字段位置不同
        intent_id = data.get("payment_intent") or data.get("id")
        amount = int(data.get("amount") or data.get("amount_received") or 0)
        currency = (data.get("currency") or "usd").upper()
        return WebhookEvent(
            provider=self.name,
            event_type=evt_type,
            intent_id=intent_id,
            amount_cents=amount,
            currency=currency,
            raw={"id": event.get("id") if isinstance(event, dict) else event.id},
        )
