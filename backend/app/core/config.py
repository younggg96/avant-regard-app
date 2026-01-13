"""
应用配置 - 使用 Supabase Auth 认证
"""

from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_KEY: str

    # Redis (可选，用于速率限制)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Server
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = 8000
    DEBUG: bool = True
    CORS_ORIGINS: str = '["*"]'

    @property
    def cors_origins_list(self) -> List[str]:
        # 开发环境允许所有来源
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
