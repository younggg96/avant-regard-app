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
    REDIS_URL: str = ""
    REDIS_CONNECTION_STRING: str = ""
    REDIS_HOST: str = ""
    REDIS_PORT: str = ""
    REDIS_PASSWORD: str = ""

    @property
    def redis_url(self) -> str:
        """按优先级解析 Redis 连接地址：REDIS_URL > REDIS_CONNECTION_STRING > 拼接"""
        if self.REDIS_URL:
            return self.REDIS_URL
        if self.REDIS_CONNECTION_STRING:
            return self.REDIS_CONNECTION_STRING
        if self.REDIS_HOST and self.REDIS_PORT:
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
