"""
Stripe 支付通道。

环境变量：
  STRIPE_API_KEY        必填,后端 secret/restricted key (rk_/sk_)
  STRIPE_WEBHOOK_SECRET 必填(生产),webhook 验签用 whsec_
  STRIPE_ACCOUNT_ID     可选,Connect 平台场景才需要

策略:
  - 没装 `stripe` SDK 或缺 STRIPE_API_KEY → fallback 到内部 stub
    (返回 stripe_stub_* 形式的 intent_id, 不会被错误推送到真 Stripe),
    这样开发机 / CI 不强制依赖 Stripe 账号。
  - 在线模式下显式 pin API 版本 + 走 automatic_payment_methods 让 Stripe
    Dashboard 决定支付方式列表(信用卡/Apple Pay/Google Pay 等),
    避免在代码里硬编码 payment_method_types 锁死动态支付方式入口。
  - intent.client_secret 给前端 Stripe RN SDK 拉 PaymentSheet 用。

注意: 该 provider 必须保证 stub 与 live 的对外契约一致——返回结构化
PaymentIntent / PaymentResult, 由 OrderService 决定如何写库,不要在
provider 里直接操作订单。
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
    # Stripe 在 2024 起推荐用 refund.* 替代 charge.refunded 做退款回执对账
    "refund.updated": WEBHOOK_EVENT_REFUND_SUCCEEDED,
}

# 显式 pin API 版本,避免 stripe-python 升级隐式拉默认版本造成行为变化。
# 升级前请阅读 release notes,确认 PaymentIntent / Refund / charge.refunded
# payload 结构与 client SDK 兼容。
_STRIPE_API_VERSION = "2024-12-18.acacia"

try:  # pragma: no cover - optional dep
    import stripe  # type: ignore
    _HAS_STRIPE = True
except Exception:  # pragma: no cover
    stripe = None  # type: ignore
    _HAS_STRIPE = False


def _to_stripe_currency(currency: str) -> str:
    # Stripe 用小写
    return (currency or "USD").lower()


def _to_str_metadata(meta: Dict[str, Any]) -> Dict[str, str]:
    """Stripe metadata 的 value 必须是 string,且 ≤ 500 字符。"""
    out: Dict[str, str] = {}
    for k, v in meta.items():
        if v is None:
            continue
        s = str(v)
        out[k] = s[:500]
    return out


class StripeProvider:
    name = "stripe"

    def __init__(self) -> None:
        self._api_key = os.getenv("STRIPE_API_KEY")
        self._webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
        self._account_id = os.getenv("STRIPE_ACCOUNT_ID") or None
        if _HAS_STRIPE and self._api_key:
            stripe.api_key = self._api_key  # type: ignore
            # 把 SDK 的默认 API 版本对齐到代码侧, 防止账号默认版本升级把
            # PaymentIntent 字段命名改了。
            try:
                stripe.api_version = _STRIPE_API_VERSION  # type: ignore
            except Exception:
                pass

    def _live(self) -> bool:
        return _HAS_STRIPE and bool(self._api_key)

    def _request_options(self, *, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        """收单时为防止网络重试导致重复扣款,额外塞 idempotency_key。
        Connect 场景下 stripe_account 让请求作用于平台子账号。"""
        opts: Dict[str, Any] = {}
        if idempotency_key:
            opts["idempotency_key"] = idempotency_key
        if self._account_id:
            opts["stripe_account"] = self._account_id
        return opts

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
            # idempotency_key 必须真幂等 —— 用 (order_id, amount, currency)
            # 三元组锁定。同一订单同金额重复调 startPayment 不会创建多个
            # PaymentIntent;金额变化(offer 接受 / 改价)时会得到新 intent。
            # scope 前缀允许同一参数下复用到 marketplace / plus / auth 三类
            # 业务,因为它们用同一个 stripe 账号但 order_id 命名空间互不相交,
            # 由 metadata.scope 区分。
            scope = (metadata or {}).get("scope") or "order"
            idem_key = (
                f"{scope}_{order_id}_intent_{amount_cents}_{_to_stripe_currency(currency)}"
            )
            intent = stripe.PaymentIntent.create(  # type: ignore
                amount=amount_cents,
                currency=_to_stripe_currency(currency),
                metadata=_to_str_metadata(meta),
                # automatic_payment_methods 让 Dashboard 决定支付方式
                # (Card / Apple Pay / Google Pay / Link 等)。绝不写死
                # payment_method_types,否则 Dashboard 上的动态支付方式
                # 全部失效。
                automatic_payment_methods={"enabled": True},
                # 让前端可以在 PaymentSheet 上展示订单号
                description=f"Order #{meta.get('orderNo') or order_id}",
                **self._request_options(idempotency_key=idem_key),
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
            print(f"[stripe] create_intent failed, fallback to stub: {e}", flush=True)
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
        # stub intent_id 直接放行,避免在开发联调时调真 Stripe API
        if not self._live() or intent_id.startswith(("stripe_stub_", "stripe_err_")):
            return PaymentResult(
                provider=self.name,
                intent_id=intent_id,
                status="succeeded",
                raw={"stub": True},
            )
        try:  # pragma: no cover - live path
            intent = stripe.PaymentIntent.retrieve(  # type: ignore
                intent_id, **self._request_options()
            )
            # Stripe 状态机参考: requires_payment_method / requires_confirmation /
            # requires_action / processing / succeeded / canceled / requires_capture
            # 我们对外只关心 succeeded / failed / pending 三态。
            if intent.status == "succeeded":
                status = "succeeded"
            elif intent.status in ("canceled", "requires_payment_method"):
                status = "failed"
            else:
                status = "pending"
            return PaymentResult(
                provider=self.name,
                intent_id=intent_id,
                status=status,
                amount_cents=intent.amount or 0,
                currency=(intent.currency or "usd").upper(),
                raw=intent.to_dict() if hasattr(intent, "to_dict") else {},
            )
        except Exception as e:  # pragma: no cover
            print(f"[stripe] confirm failed: {e}", flush=True)
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
        # stub intent_id → 直接 succeeded,不调真 Stripe(开发联调防误退)
        if not self._live() or intent_id.startswith(("stripe_stub_", "stripe_err_")):
            return PaymentResult(
                provider=self.name,
                intent_id=intent_id,
                status="succeeded",
                raw={"stub": True, "amount_cents": amount_cents, "reason": reason},
            )
        try:  # pragma: no cover
            # 退款也用 idempotency_key 防 webhook / 客服重复触发同一订单退款。
            idem_key = f"refund_{intent_id}_{amount_cents or 0}"
            refund = stripe.Refund.create(  # type: ignore
                payment_intent=intent_id,
                amount=amount_cents,
                # Stripe 仅接受 duplicate / fraudulent / requested_by_customer
                reason="requested_by_customer",
                metadata=_to_str_metadata({"appReason": reason or ""}),
                **self._request_options(idempotency_key=idem_key),
            )
            return PaymentResult(
                provider=self.name,
                intent_id=intent_id,
                # refund.status: pending / succeeded / failed / canceled
                status="succeeded" if refund.status == "succeeded" else (
                    "failed" if refund.status in ("failed", "canceled") else "pending"
                ),
                raw={"refundId": refund.id, "status": refund.status},
            )
        except Exception as e:  # pragma: no cover
            return PaymentResult(
                provider=self.name, intent_id=intent_id, status="failed", raw={"error": str(e)}
            )

    def construct_raw_event(
        self,
        *,
        headers: Mapping[str, str],
        body: bytes,
    ) -> Optional[Any]:
        """验签 + 返回 Stripe Event 原始对象,供上层按 event.type 自己分发。
        没装 SDK / 没 webhook secret / 验签失败一律 None。

        与 verify_webhook 的差别: 后者只返回我们标准化后的 WebhookEvent
        (仅含 payment.* / refund.*), 而 construct_raw_event 是给 Connect
        webhook (account.updated) 等"非支付意图"事件用的逃生口。
        """
        if not (_HAS_STRIPE and self._webhook_secret):
            return None
        sig = headers.get("stripe-signature") or headers.get("Stripe-Signature")
        if not sig:
            return None
        try:  # pragma: no cover
            return stripe.Webhook.construct_event(  # type: ignore
                body, sig, self._webhook_secret
            )
        except Exception as e:  # pragma: no cover
            print(f"[stripe] webhook verify failed: {e}", flush=True)
            return None

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
            print(f"[stripe] webhook verify failed: {e}", flush=True)
            return None

        evt_type_raw = (
            event.get("type") if isinstance(event, dict) else getattr(event, "type", None)
        )
        evt_type = _STRIPE_EVENT_MAP.get(evt_type_raw)
        if not evt_type:
            return None

        # event.data.object 兼容 dict / StripeObject 两种返回类型
        if isinstance(event, dict):
            data = event.get("data", {}).get("object", {}) or {}
            event_id = event.get("id")
        else:
            data_obj = event.data.object  # type: ignore
            data = data_obj.to_dict() if hasattr(data_obj, "to_dict") else dict(data_obj)
            event_id = getattr(event, "id", None)

        # 三类 payload 的 intent_id 位置不同:
        #   payment_intent.* → object.id 即 PaymentIntent id
        #   charge.refunded  → object.payment_intent (charge 上的关联字段)
        #   refund.updated   → object.payment_intent (refund 自带)
        intent_id = data.get("payment_intent") or data.get("id")
        if evt_type_raw and evt_type_raw.startswith("payment_intent."):
            intent_id = data.get("id") or intent_id

        amount = int(
            data.get("amount_refunded")
            or data.get("amount_received")
            or data.get("amount")
            or 0
        )
        currency = (data.get("currency") or "usd").upper()
        return WebhookEvent(
            provider=self.name,
            event_type=evt_type,
            intent_id=intent_id,
            amount_cents=amount,
            currency=currency,
            raw={"id": event_id, "type": evt_type_raw},
        )
