"""
支付通道工厂：从环境变量 PAYMENT_PROVIDER 选择具体 provider。

支持的值：
  - mock   (默认；开发与内测)
  - stripe / alipay / wechat（未来扩展）

未实现的 provider 暂时回退到 MockPaymentProvider，并打 warning 日志。
"""
import os
from .base import PaymentProvider
from .mock import MockPaymentProvider


_provider_singleton: PaymentProvider | None = None


def get_payment_provider() -> PaymentProvider:
    global _provider_singleton
    if _provider_singleton is not None:
        return _provider_singleton

    name = (os.getenv("PAYMENT_PROVIDER") or "mock").lower()
    if name == "mock":
        _provider_singleton = MockPaymentProvider()
    else:
        # TODO: 实现 Stripe / Alipay / Wechat provider
        print(f"[payment] provider '{name}' not implemented yet, falling back to mock")
        _provider_singleton = MockPaymentProvider()
    return _provider_singleton
