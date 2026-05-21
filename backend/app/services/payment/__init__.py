"""
PRD 模块四 · 支付通道适配层。

设计要点（见 plan 第 6 节决策）：
  - 决策结论：采用「适配器模式」。订单引擎不直接依赖任何具体支付平台，
    全部通过 PaymentProvider 协议调用 create_intent / confirm / refund。
  - 当前实现仅提供 MockPaymentProvider，足以打通 Phase 4 全链路自测。
  - 上线前由运营/合规拍板真实通道（Stripe / 支付宝 / 微信），实现对应
    的 StripeProvider / AlipayProvider / WechatProvider，注册到工厂方法即可。
"""
from .base import PaymentProvider, PaymentIntent, PaymentResult
from .mock import MockPaymentProvider
from .factory import get_payment_provider

__all__ = [
    "PaymentProvider",
    "PaymentIntent",
    "PaymentResult",
    "MockPaymentProvider",
    "get_payment_provider",
]
