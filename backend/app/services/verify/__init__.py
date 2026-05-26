"""
实名认证 / 银行卡四要素 适配层。

设计:
  - VerifyProvider 协议封装两类验证:
      verify_id_card(name, id_no)         身份证二要素
      verify_bank_card4(name, id_no, bank_no, phone)  银行卡四要素
  - 默认 MockVerifyProvider 开发用,直接通过。
  - 真实接 AliyunVerifyProvider 时由 settings.ALIYUN_VERIFY_APP_CODE 启用。
"""
from .base import VerifyProvider, VerifyResult
from .factory import get_verify_provider

__all__ = ["VerifyProvider", "VerifyResult", "get_verify_provider"]
