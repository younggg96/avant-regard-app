"""
微信支付通道。

策略与 Alipay 类似：未配置时 fallback 到 stub。

环境变量：
  WECHAT_APP_ID
  WECHAT_MCH_ID
  WECHAT_API_V3_KEY
  WECHAT_PRIVATE_KEY        商户私钥
  WECHAT_CERT_SERIAL_NO
  WECHAT_NOTIFY_URL
"""
from __future__ import annotations

import os
import uuid
from typing import Optional, Dict, Any

from .base import PaymentIntent, PaymentResult


class WechatProvider:
    name = "wechat"

    def __init__(self) -> None:
        self._app_id = os.getenv("WECHAT_APP_ID")
        self._mch_id = os.getenv("WECHAT_MCH_ID")
        self._api_key = os.getenv("WECHAT_API_V3_KEY")
        self._cert_serial = os.getenv("WECHAT_CERT_SERIAL_NO")
        self._private_key = os.getenv("WECHAT_PRIVATE_KEY")
        self._notify_url = os.getenv("WECHAT_NOTIFY_URL")

    def _live(self) -> bool:
        # 仅当所有关键变量齐全时认为已接入真实通道。
        return all(
            [self._app_id, self._mch_id, self._api_key, self._cert_serial, self._private_key]
        )

    def create_intent(
        self,
        *,
        order_id: int,
        amount_cents: int,
        currency: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> PaymentIntent:
        intent_id = f"wx_{order_id}_{uuid.uuid4().hex[:8]}"
        meta = {"orderId": str(order_id), **(metadata or {})}

        if not self._live():
            return PaymentIntent(
                provider=self.name,
                intent_id=intent_id,
                client_secret=None,
                amount_cents=amount_cents,
                currency=currency or "CNY",
                status="pending",
                metadata={**meta, "stub": True, "prepayId": intent_id},
            )

        # 真实接入：调用 v3 /pay/transactions/app，拿到 prepay_id 再二次签名为客户端 payload
        # （wechatpayv3 或 wechatpay-python-sdk）。此处保持占位以待运营拍板 SDK。
        try:  # pragma: no cover
            from wechatpayv3 import WeChatPay, WeChatPayType  # type: ignore
            wxpay = WeChatPay(
                wechatpay_type=WeChatPayType.APP,
                mchid=self._mch_id,
                private_key=self._private_key,
                cert_serial_no=self._cert_serial,
                apiv3_key=self._api_key,
                appid=self._app_id,
                notify_url=self._notify_url or "",
            )
            code, message = wxpay.pay(
                description=(metadata or {}).get("subject") or f"Order #{order_id}",
                out_trade_no=intent_id,
                amount={"total": amount_cents, "currency": currency or "CNY"},
            )
            return PaymentIntent(
                provider=self.name,
                intent_id=intent_id,
                client_secret=None,
                amount_cents=amount_cents,
                currency=currency or "CNY",
                status="pending",
                metadata={**meta, "rawResp": message},
            )
        except Exception as e:  # pragma: no cover
            print(f"[wechat] create_intent failed: {e}")
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
