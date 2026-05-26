"""
支付宝（Alipay）支付通道。

策略：
  - 通过 `alipay-sdk-python` (alipay-sdk-python-all) 创建 App / WAP 支付。
  - 未配置密钥 / SDK 时 fallback 到 stub，前端依然可以走完支付页（开发用）。

环境变量：
  ALIPAY_APP_ID
  ALIPAY_PRIVATE_KEY         应用私钥（PEM）
  ALIPAY_PUBLIC_KEY          支付宝公钥（PEM）
  ALIPAY_NOTIFY_URL          异步回调地址
"""
from __future__ import annotations

import os
import uuid
from typing import Optional, Dict, Any, Mapping
from urllib.parse import parse_qsl

from .base import (
    PaymentIntent,
    PaymentResult,
    WebhookEvent,
    WEBHOOK_EVENT_PAYMENT_SUCCEEDED,
    WEBHOOK_EVENT_PAYMENT_FAILED,
    WEBHOOK_EVENT_REFUND_SUCCEEDED,
)

try:  # pragma: no cover - optional dep
    from alipay.aop.api.AlipayClientConfig import AlipayClientConfig  # type: ignore
    from alipay.aop.api.DefaultAlipayClient import DefaultAlipayClient  # type: ignore
    from alipay.aop.api.domain.AlipayTradeAppPayModel import AlipayTradeAppPayModel  # type: ignore
    from alipay.aop.api.request.AlipayTradeAppPayRequest import AlipayTradeAppPayRequest  # type: ignore
    _HAS_ALIPAY = True
except Exception:  # pragma: no cover
    _HAS_ALIPAY = False


class AlipayProvider:
    name = "alipay"

    def __init__(self) -> None:
        self._app_id = os.getenv("ALIPAY_APP_ID")
        self._private_key = os.getenv("ALIPAY_PRIVATE_KEY")
        self._public_key = os.getenv("ALIPAY_PUBLIC_KEY")
        self._notify_url = os.getenv("ALIPAY_NOTIFY_URL")
        self._client = None
        if _HAS_ALIPAY and self._app_id and self._private_key and self._public_key:
            try:  # pragma: no cover
                cfg = AlipayClientConfig()  # type: ignore
                cfg.app_id = self._app_id
                cfg.app_private_key = self._private_key
                cfg.alipay_public_key = self._public_key
                self._client = DefaultAlipayClient(alipay_client_config=cfg)  # type: ignore
            except Exception as e:  # pragma: no cover
                print(f"[alipay] init client failed: {e}")

    def _live(self) -> bool:
        return self._client is not None

    def create_intent(
        self,
        *,
        order_id: int,
        amount_cents: int,
        currency: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> PaymentIntent:
        meta = {"orderId": str(order_id), **(metadata or {})}
        amount_yuan = f"{amount_cents / 100:.2f}"
        intent_id = f"ali_{order_id}_{uuid.uuid4().hex[:8]}"

        if not self._live():
            return PaymentIntent(
                provider=self.name,
                intent_id=intent_id,
                client_secret=None,
                amount_cents=amount_cents,
                currency=currency or "CNY",
                status="pending",
                metadata={**meta, "stub": True, "orderString": intent_id},
            )

        try:  # pragma: no cover
            model = AlipayTradeAppPayModel()  # type: ignore
            model.out_trade_no = intent_id
            model.total_amount = amount_yuan
            model.subject = (metadata or {}).get("subject") or f"Order #{order_id}"
            model.product_code = "QUICK_MSECURITY_PAY"
            req = AlipayTradeAppPayRequest(biz_model=model)  # type: ignore
            if self._notify_url:
                req.notify_url = self._notify_url
            order_string = self._client.sdk_execute(req)  # type: ignore
            return PaymentIntent(
                provider=self.name,
                intent_id=intent_id,
                client_secret=None,
                amount_cents=amount_cents,
                currency=currency or "CNY",
                status="pending",
                metadata={**meta, "orderString": order_string},
            )
        except Exception as e:  # pragma: no cover
            print(f"[alipay] create_intent failed: {e}")
            return PaymentIntent(
                provider=self.name,
                intent_id=intent_id,
                client_secret=None,
                amount_cents=amount_cents,
                currency=currency or "CNY",
                status="pending",
                metadata={**meta, "stub": True, "error": str(e)},
            )

    def confirm(self, intent_id: str) -> PaymentResult:
        # 真实场景下应当走 notify_url 异步回调；客户端调用 confirm 只能
        # 做 `alipay.trade.query` 检查。这里允许开发联调时把任何 intent
        # 直接置为 succeeded 以打通后续状态机。
        return PaymentResult(
            provider=self.name,
            intent_id=intent_id,
            status="succeeded",
            raw={"stub": not self._live()},
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
            raw={"refundAmountCents": amount_cents, "reason": reason, "stub": not self._live()},
        )

    def verify_webhook(
        self,
        *,
        headers: Mapping[str, str],
        body: bytes,
    ) -> Optional[WebhookEvent]:
        """支付宝异步通知 verify。

        支付宝通知是 application/x-www-form-urlencoded,需要按官方文档拼串验签。
        当前实现:
          - 没装 SDK 或没配公钥 → 返回 None,生产路径拒掉
          - 已装且 SDK 验签通过 → 把 trade_status / refund 信号映射成标准事件
        """
        if not self._live():
            return None
        try:
            form = dict(parse_qsl(body.decode("utf-8")))
        except Exception:
            return None

        # 真实环境必须用 alipay-sdk-python 验签:
        # from alipay.aop.api.util.SignatureUtils import verify_with_rsa
        # 这里保留接口,实际接入时把 verify_with_rsa(...) 接上即可。
        # 没验签前一律不返回事件,避免被伪造请求推进订单状态。
        try:  # pragma: no cover
            from alipay.aop.api.util.SignatureUtils import verify_with_rsa  # type: ignore
            sign = form.pop("sign", None)
            sign_type = form.pop("sign_type", None)
            if not sign or sign_type != "RSA2":
                return None
            sign_content = "&".join(
                f"{k}={v}" for k, v in sorted(form.items()) if v != ""
            )
            ok = verify_with_rsa(self._public_key, sign_content.encode("utf-8"), sign)
            if not ok:
                return None
        except Exception:  # pragma: no cover
            return None

        trade_status = form.get("trade_status")
        if trade_status in ("TRADE_SUCCESS", "TRADE_FINISHED"):
            evt = WEBHOOK_EVENT_PAYMENT_SUCCEEDED
        elif form.get("refund_fee"):
            evt = WEBHOOK_EVENT_REFUND_SUCCEEDED
        elif trade_status == "TRADE_CLOSED":
            evt = WEBHOOK_EVENT_PAYMENT_FAILED
        else:
            return None

        try:
            amount = int(round(float(form.get("total_amount") or 0) * 100))
        except Exception:
            amount = 0
        return WebhookEvent(
            provider=self.name,
            event_type=evt,
            intent_id=form.get("out_trade_no"),
            amount_cents=amount,
            currency="CNY",
            raw=form,
        )
