"""
短信通道协议。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, Dict, Any


@dataclass
class SmsResult:
    status: str  # sent / failed / rate_limited
    message_id: str = ""
    raw: Dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.status == "sent"


class SmsProvider(Protocol):
    name: str

    def send_template_sms(
        self,
        *,
        phone: str,
        template_code: str,
        params: Dict[str, str],
    ) -> SmsResult:
        ...
