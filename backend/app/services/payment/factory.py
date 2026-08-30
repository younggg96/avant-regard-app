"""
支付通道工厂。

设计：
  - 默认 provider 由 PAYMENT_PROVIDER 决定（开发用 mock）。
  - PAYMENT_PROVIDER=mock 是"全局 mock"开关：区域路由被短路，只剩 mock。
  - 业务侧可以根据 region/currency 调 `resolve_provider(region/currency/preferred)` 拿到真实通道。
  - 区域路由：中国（CN / currency=CNY）→ 微信 + 支付宝；其它（默认 US）→ Stripe。
  - 单例缓存避免重复初始化 SDK。
"""
from __future__ import annotations

import os
from typing import Dict, List, Optional

from .base import PaymentProvider
from .mock import MockPaymentProvider
from .stripe_provider import StripeProvider
from .alipay_provider import AlipayProvider
from .wechat_provider import WechatProvider


_PROVIDER_CACHE: Dict[str, PaymentProvider] = {}


def _instantiate(name: str) -> PaymentProvider:
    name = (name or "mock").lower()
    if name == "stripe":
        return StripeProvider()
    if name == "alipay":
        return AlipayProvider()
    if name in ("wechat", "wechatpay", "wxpay"):
        return WechatProvider()
    if name == "mock":
        return MockPaymentProvider()
    print(f"[payment] unknown provider '{name}', falling back to mock")
    return MockPaymentProvider()


def get_payment_provider_by_name(name: str) -> PaymentProvider:
    """按 provider 名拿一个单例。未知 → mock。"""
    key = (name or "mock").lower()
    if key not in _PROVIDER_CACHE:
        _PROVIDER_CACHE[key] = _instantiate(key)
    return _PROVIDER_CACHE[key]


def get_payment_provider() -> PaymentProvider:
    """默认 provider —— 由 PAYMENT_PROVIDER 环境变量决定，未配置则 mock。"""
    return get_payment_provider_by_name(os.getenv("PAYMENT_PROVIDER") or "mock")


# ----------------------------------------------------------------- region


def list_provider_options(
    region: Optional[str] = None,
    currency: Optional[str] = None,
) -> List[str]:
    """根据 region/currency 决定向前端展示的支付选项。

    规则：
      - currency=CNY 或 region=CN → 微信 + 支付宝 + Stripe (海外卡)
        Stripe 支持 CNY 直接收单,海外用户买国内商品需要这个;
        本地用户依然会优先选支付宝/微信(列在前面)。
      - 其它 → Stripe (覆盖 US/EU 等海外区主通道)
      - PAYMENT_PROVIDER=mock → 只返回 ["mock"]。这是"整个部署都跑 mock
        支付"的语义(国内当前如此:没有支付宝/微信商户号,也不接 Stripe)。
        不能只是追加 mock —— 否则 resolve_provider 拿 options[0] 会选到
        没配密钥的支付宝,下单直接报错。
      - PAYMENT_ENABLE_MOCK=1 → 真实通道之外再追加 mock,用于真实通道
        已配好、但想顺带留个 mock 入口联调的环境。
      - Stripe 选项只有在配置了 STRIPE_API_KEY 时才会展示, 避免没配 key
        却让用户能选 Stripe 然后拉起 PaymentSheet 时才报错。
    """
    region = (region or "").upper()
    currency = (currency or "").upper()
    options: List[str] = []

    if (os.getenv("PAYMENT_PROVIDER") or "").lower() == "mock":
        return ["mock"]

    stripe_configured = bool(os.getenv("STRIPE_API_KEY"))

    if region == "CN" or currency == "CNY":
        options = ["alipay", "wechat"]
        if stripe_configured:
            options.append("stripe")
    else:
        if stripe_configured:
            options = ["stripe"]
        else:
            options = []

    if os.getenv("PAYMENT_ENABLE_MOCK") == "1":
        options = options + ["mock"]

    # 去重保持顺序
    seen = set()
    deduped: List[str] = []
    for o in options:
        if o not in seen:
            seen.add(o)
            deduped.append(o)
    return deduped


def resolve_provider(
    *,
    preferred: Optional[str] = None,
    region: Optional[str] = None,
    currency: Optional[str] = None,
) -> PaymentProvider:
    """业务调用入口：优先 preferred，再按区域规则。"""
    options = list_provider_options(region=region, currency=currency)
    if preferred and preferred.lower() in options:
        return get_payment_provider_by_name(preferred)
    if options:
        return get_payment_provider_by_name(options[0])
    return get_payment_provider()
