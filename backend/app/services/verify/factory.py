"""
实名 provider 工厂。
"""
from __future__ import annotations

from typing import Optional

from app.core.config import settings
from .base import VerifyProvider
from .mock import MockVerifyProvider
from .aliyun_provider import AliyunVerifyProvider


_CACHE: Optional[VerifyProvider] = None


def get_verify_provider() -> VerifyProvider:
    global _CACHE
    if _CACHE is not None:
        return _CACHE
    name = (settings.VERIFY_PROVIDER or "mock").lower()
    if name == "aliyun":
        _CACHE = AliyunVerifyProvider()
    else:
        _CACHE = MockVerifyProvider()
    return _CACHE
