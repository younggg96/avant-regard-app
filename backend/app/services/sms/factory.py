"""
SMS provider 工厂。
"""
from __future__ import annotations

import os
from typing import Optional

from .base import SmsProvider
from .mock import MockSmsProvider
from .aliyun_provider import AliyunSmsProvider


_CACHE: Optional[SmsProvider] = None


def get_sms_provider() -> SmsProvider:
    global _CACHE
    if _CACHE is not None:
        return _CACHE
    name = (os.getenv("SMS_PROVIDER") or "mock").lower()
    if name == "aliyun":
        _CACHE = AliyunSmsProvider()
    else:
        _CACHE = MockSmsProvider()
    return _CACHE
