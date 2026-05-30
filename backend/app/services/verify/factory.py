"""
实名 provider 工厂。
"""
from __future__ import annotations

from typing import Optional

from app.core.config import settings
from .base import VerifyProvider, IdentitySessionProvider
from .mock import MockVerifyProvider, MockIdentitySessionProvider
from .aliyun_provider import AliyunVerifyProvider
from .stripe_identity_provider import StripeIdentityProvider


_CACHE: Optional[VerifyProvider] = None
_SESSION_CACHE: Optional[IdentitySessionProvider] = None


def get_verify_provider() -> VerifyProvider:
    """中国大陆同步二要素 / 四要素 provider(姓名 + 身份证号 [+ 银行卡 + 手机])。"""
    global _CACHE
    if _CACHE is not None:
        return _CACHE
    name = (settings.VERIFY_PROVIDER or "mock").lower()
    if name == "aliyun":
        _CACHE = AliyunVerifyProvider()
    else:
        _CACHE = MockVerifyProvider()
    return _CACHE


def get_identity_session_provider() -> IdentitySessionProvider:
    """会话式(证件 + 活体自拍)实名 provider,海外(美国等)用。

    生产配 IDENTITY_SESSION_PROVIDER=stripe(复用 STRIPE_API_KEY);
    留空 / mock → MockIdentitySessionProvider(开发即时通过)。
    """
    global _SESSION_CACHE
    if _SESSION_CACHE is not None:
        return _SESSION_CACHE
    name = (settings.IDENTITY_SESSION_PROVIDER or "mock").lower()
    if name in ("stripe", "stripe_identity"):
        _SESSION_CACHE = StripeIdentityProvider()
    else:
        _SESSION_CACHE = MockIdentitySessionProvider()
    return _SESSION_CACHE


def resolve_region(region: Optional[str]) -> str:
    """归一化前端传来的地区标识 → "CN" | "US"。

    CN(中国大陆)走同步二要素;其它(US / 海外)走会话式证件 + 自拍。
    """
    r = (region or "").strip().upper()
    if r in ("CN", "CHINA", "CNY", "ZH"):
        return "CN"
    return "US"
