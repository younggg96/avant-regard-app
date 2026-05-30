"""
实名认证适配层(中国大陆同步二要素 + 海外会话式证件/自拍)。

设计:
  - VerifyProvider 协议(同步,中国大陆):
      verify_id_card(name, id_no)         身份证二要素
      verify_bank_card4(name, id_no, bank_no, phone)  银行卡四要素
    默认 MockVerifyProvider 开发用直接通过,生产由 ALIYUN_VERIFY_APP_CODE 启用。
  - IdentitySessionProvider 协议(异步会话,海外):
      create_session / retrieve_session / parse_webhook_object
    默认 MockIdentitySessionProvider,生产 IDENTITY_SESSION_PROVIDER=stripe。
  - resolve_region(region) 把前端地区标识归一化为 "CN" | "US",决定走哪条路。
"""
from .base import (
    VerifyProvider,
    VerifyResult,
    VerifySession,
    IdentitySessionProvider,
)
from .factory import (
    get_verify_provider,
    get_identity_session_provider,
    resolve_region,
)

__all__ = [
    "VerifyProvider",
    "VerifyResult",
    "VerifySession",
    "IdentitySessionProvider",
    "get_verify_provider",
    "get_identity_session_provider",
    "resolve_region",
]
