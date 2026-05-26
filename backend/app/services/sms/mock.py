"""
Mock 短信通道 · 开发用,只打日志不真发短信。
"""
from __future__ import annotations

import uuid
from typing import Dict

from .base import SmsResult


class MockSmsProvider:
    name = "mock"

    def send_template_sms(
        self,
        *,
        phone: str,
        template_code: str,
        params: Dict[str, str],
    ) -> SmsResult:
        # 不发真实短信,但打日志保留可追溯性
        masked = phone[:3] + "****" + phone[-4:] if len(phone) >= 7 else phone
        print(
            f"[sms-mock] phone={masked} template={template_code} params={params}",
            flush=True,
        )
        return SmsResult(
            status="sent",
            message_id=f"mock_{uuid.uuid4().hex[:12]}",
            raw={"stub": True},
        )
