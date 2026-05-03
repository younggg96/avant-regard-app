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
    SERVER_PORT: int = 8080
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

    # =====================================================
    # AI 发帖助手 (V3 #25)
    # =====================================================
    # 文字生成主力: DeepSeek (OpenAI 兼容协议)
    # 视觉理解: Qwen-VL (DashScope OpenAI 兼容协议)
    # 图片内容安全: 阿里云绿网 (Green-CIP)
    #
    # 任一 *_API_KEY 缺失时,服务层会抛 RuntimeError 并落 status='error'
    # 日志,而不是把请求挂死或静默降级,便于运维排查。
    AI_DEFAULT_PROVIDER: str = "deepseek"        # deepseek / qwen / moonshot

    # DeepSeek
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    DEEPSEEK_MODEL: str = "deepseek-chat"

    # 通义千问 (含视觉模型)
    QWEN_API_KEY: str = ""
    QWEN_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    QWEN_TEXT_MODEL: str = "qwen-plus"
    QWEN_VL_MODEL: str = "qwen-vl-plus"          # 图片+简述模式专用

    # Moonshot (Kimi)
    MOONSHOT_API_KEY: str = ""
    MOONSHOT_BASE_URL: str = "https://api.moonshot.cn/v1"
    MOONSHOT_MODEL: str = "moonshot-v1-8k"

    # LLM 调用通用配置
    AI_REQUEST_TIMEOUT: int = 30                 # 秒, 超时后重试一次
    AI_MAX_OUTPUT_TOKENS: int = 1024
    AI_TEMPERATURE: float = 0.8

    # 配额 (per user / day, UTC date 切日)
    AI_DAILY_GENERATE_LIMIT: int = 10
    AI_DAILY_REGEN_LIMIT: int = 3                # 需求硬规定: 重新生成 <= 3 次/天

    # 图片内容安全 (阿里云绿网 Green-CIP)
    # 未配置时服务层会拒绝 IMAGE_BRIEF 模式 (status='blocked'),
    # 不做静默降级,避免违规图直接喂给 LLM 与发布。
    IMAGE_MODERATION_ENABLED: bool = True
    ALIYUN_GREEN_ACCESS_KEY_ID: str = ""
    ALIYUN_GREEN_ACCESS_KEY_SECRET: str = ""
    ALIYUN_GREEN_REGION: str = "cn-shanghai"     # 与子账号开通区域一致
    # 命中即拦截的场景列表 (绿网 scenes 字段);广告与二维码默认开,
    # 后续可放到 admin 后台动态调整。
    ALIYUN_GREEN_IMAGE_SCENES: str = "porn,terrorism,ad"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def aliyun_green_image_scenes_list(self) -> List[str]:
        return [s.strip() for s in self.ALIYUN_GREEN_IMAGE_SCENES.split(",") if s.strip()]


settings = Settings()
