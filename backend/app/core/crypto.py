"""
对称加密小工具 · 用于 KYC 身份证号 / 银行卡号 等敏感字段。

设计:
  - 选用 Fernet (cryptography 库),AES128 + HMAC-SHA256,自带版本号 / IV,简单稳定。
  - 主密钥来自 settings.KYC_ENCRYPTION_KEY,缺省时 encrypt() 抛 RuntimeError,
    宁可阻塞业务也不允许明文落盘(生产场景 fatal 退而求其次都不行)。
  - 公开的输入输出统一是 str(base64-url-safe),数据库直接 VARCHAR 存即可。

未来如果要做密钥轮换,迁移到 MultiFernet 即可,接口不变。
"""
from __future__ import annotations

import functools
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


@functools.lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    key = (settings.KYC_ENCRYPTION_KEY or "").strip()
    if not key:
        raise RuntimeError(
            "KYC_ENCRYPTION_KEY 未配置。生成方法:"
            'python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        )
    try:
        return Fernet(key.encode("utf-8"))
    except Exception as e:
        raise RuntimeError(f"KYC_ENCRYPTION_KEY 格式不合法(需要 32-byte url-safe base64): {e}")


def encrypt_str(plaintext: Optional[str]) -> Optional[str]:
    if plaintext is None or plaintext == "":
        return None
    return _get_fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_str(ciphertext: Optional[str]) -> Optional[str]:
    if ciphertext is None or ciphertext == "":
        return None
    try:
        return _get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        # 兼容历史明文数据:无法解密的串直接当明文返回,
        # 让旧数据可读;新写入一律加密。
        return ciphertext


def looks_encrypted(s: Optional[str]) -> bool:
    """启发式判断字符串是否是 Fernet 密文(用于决定是否需要回填重写)。"""
    if not s:
        return False
    # Fernet token 总是 "gAAAAA..." 开头(version byte 0x80 = base64 g)
    return s.startswith("gAAAAA") and len(s) > 40
