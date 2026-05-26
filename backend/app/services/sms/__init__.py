"""
短信通道适配层。

提供 SmsProvider 协议;真实接入阿里云 / 腾讯云 SMS 时实现 send_template_sms 即可。
mock provider 仅打日志,不真实发短信,方便本地联调与单测。
"""
from .base import SmsProvider, SmsResult
from .factory import get_sms_provider

__all__ = ["SmsProvider", "SmsResult", "get_sms_provider"]
