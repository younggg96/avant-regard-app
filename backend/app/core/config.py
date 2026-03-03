"""
应用配置 - 使用 Supabase Auth 认证
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
import json


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_KEY: str

    # Redis (可选，用于缓存和速率限制)
    # 支持多种变量名：REDIS_URL / REDIS_URI / REDIS_CONNECTION_STRING / REDIS_HOST+PORT
    REDIS_URL: str = ""
    REDIS_URI: str = ""
    REDIS_CONNECTION_STRING: str = ""
    REDIS_HOST: str = ""
    REDIS_PORT: str = ""
    REDIS_PASSWORD: str = ""

    @property
    def redis_url(self) -> str:
        """按优先级解析 Redis 连接地址"""
        candidates = [
            self.REDIS_URL,
            self.REDIS_URI,
            self.REDIS_CONNECTION_STRING,
        ]
        for candidate in candidates:
            if candidate and "${" not in candidate:
                url = candidate
                if not url.startswith(("redis://", "rediss://", "unix://")):
                    url = f"redis://{url}"
                return url

        if self.REDIS_HOST and self.REDIS_PORT and "${" not in self.REDIS_HOST:
            password_part = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
            return f"redis://{password_part}{self.REDIS_HOST}:{self.REDIS_PORT}/0"

        return ""

    # Server
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = 8000
    DEBUG: bool = True
    CORS_ORIGINS: str = '["*"]'

    @property
    def cors_origins_list(self) -> List[str]:
        if self.DEBUG:
            return ["*"]
        try:
            return json.loads(self.CORS_ORIGINS)
        except:
            return ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
