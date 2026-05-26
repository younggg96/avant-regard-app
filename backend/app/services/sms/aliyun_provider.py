"""
阿里云短信(SMS)provider · 通过 alibabacloud_sms20170525 SDK 发送模板短信。

环境变量:
  SMS_PROVIDER=aliyun
  ALIYUN_SMS_ACCESS_KEY_ID
  ALIYUN_SMS_ACCESS_KEY_SECRET
  ALIYUN_SMS_SIGN_NAME      短信签名,如「Avant Regard」

模板示例(在阿里云 SMS 控制台创建):
  SMS_TPL_CONFIRM_RECEIPT_3D  "您购买的【${product}】已签收,请尽快确认收货~"
  SMS_TPL_CONFIRM_RECEIPT_5D  "您购买的【${product}】尚未确认,${days}天后将自动确认"
  SMS_TPL_SHIPPING_24H        "您的订单${orderNo}还有24小时未发货,逾期将自动退款"
"""
from __future__ import annotations

import os
from typing import Dict

from .base import SmsResult


class AliyunSmsProvider:
    name = "aliyun"

    def __init__(self) -> None:
        self._ak = os.getenv("ALIYUN_SMS_ACCESS_KEY_ID")
        self._sk = os.getenv("ALIYUN_SMS_ACCESS_KEY_SECRET")
        self._sign = os.getenv("ALIYUN_SMS_SIGN_NAME")
        self._client = None
        if self._ak and self._sk:
            try:  # pragma: no cover
                from alibabacloud_dysmsapi20170525.client import Client  # type: ignore
                from alibabacloud_tea_openapi import models as open_api_models  # type: ignore

                cfg = open_api_models.Config(
                    access_key_id=self._ak,
                    access_key_secret=self._sk,
                    endpoint="dysmsapi.aliyuncs.com",
                )
                self._client = Client(cfg)
            except Exception as e:  # pragma: no cover
                print(f"[sms-aliyun] init failed: {e}", flush=True)

    def _live(self) -> bool:
        return self._client is not None and bool(self._sign)

    def send_template_sms(
        self,
        *,
        phone: str,
        template_code: str,
        params: Dict[str, str],
    ) -> SmsResult:
        if not self._live():
            return SmsResult(status="failed", raw={"reason": "not_configured"})
        try:  # pragma: no cover
            import json
            from alibabacloud_dysmsapi20170525 import models as sms_models  # type: ignore

            req = sms_models.SendSmsRequest(
                phone_numbers=phone,
                sign_name=self._sign,
                template_code=template_code,
                template_param=json.dumps(params, ensure_ascii=False),
            )
            resp = self._client.send_sms(req)
            body = getattr(resp, "body", None)
            if body and getattr(body, "code", None) == "OK":
                return SmsResult(
                    status="sent",
                    message_id=getattr(body, "biz_id", "") or "",
                    raw={"code": "OK"},
                )
            return SmsResult(
                status="failed",
                raw={"code": getattr(body, "code", None), "msg": getattr(body, "message", None)},
            )
        except Exception as e:  # pragma: no cover
            return SmsResult(status="failed", raw={"error": str(e)})
