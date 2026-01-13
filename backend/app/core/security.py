"""
安全相关 - 使用 Supabase Auth
"""
from passlib.context import CryptContext

# 密码哈希上下文（用于本地密码验证，可选）
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    """生成密码哈希"""
    return pwd_context.hash(password)
