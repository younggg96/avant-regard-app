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

    # =====================================================
    # 后台调度器 (订单 / 钱包 / 物流)
    # =====================================================
    # lifespan 启动时是否自动拉起 AsyncIOScheduler。
    # - 本地 / 单测建议关掉,避免抢库；
    # - 多副本部署时只在一个 worker 开启（pod 名前缀或 leader 选举决定）。
    ENABLE_BACKGROUND_SCHEDULER: bool = False
    # 各任务执行频率,生产保守一些避免抖动。
    SCHEDULER_HOLDS_INTERVAL_SECONDS: int = 60        # 30 分钟 hold 过期检测
    SCHEDULER_OFFERS_INTERVAL_SECONDS: int = 120      # 24h offer 过期
    SCHEDULER_SHIPMENTS_INTERVAL_SECONDS: int = 300   # 72h 未发货检测
    SCHEDULER_AUTO_CONFIRM_INTERVAL_SECONDS: int = 600  # 7 天自动确认
    SCHEDULER_WALLET_INTERVAL_SECONDS: int = 300      # T+3 pending → available
    SCHEDULER_SETTLE_INTERVAL_SECONDS: int = 300      # completed → settled
    SCHEDULER_TRACKING_INTERVAL_SECONDS: int = 600    # 物流轨迹拉取
    SCHEDULER_REMINDERS_INTERVAL_SECONDS: int = 1800  # 自动确认 3/5 天提醒(Batch 5)
    SCHEDULER_REVIEW_AUTO_INTERVAL_SECONDS: int = 3600  # 7 天自动好评 / 15 天单方公开(Batch 6)

    # =====================================================
    # 实名认证 / 银行卡四要素 (阿里云 实人认证 / 银联四要素)
    # =====================================================
    # 身份证号 / 持卡人姓名 等敏感字段 AES 加密的对称密钥。
    # 必须是 Fernet 接受的 32-byte url-safe base64,缺省时服务层拒绝写库,
    # 避免明文落盘。生成方法:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    KYC_ENCRYPTION_KEY: str = ""

    # 阿里云实人认证(身份证 + 姓名 OCR 二要素 / 三要素 / 活体)
    ALIYUN_VERIFY_APP_CODE: str = ""           # 市场 API AppCode
    ALIYUN_VERIFY_ID2_URL: str = (             # 身份证二要素验证(姓名 + 身份证号)
        "https://idcert.market.alicloudapi.com/idcard"
    )
    # 阿里云银行卡四要素(姓名 + 身份证 + 银行卡 + 手机号)
    ALIYUN_BANK4_URL: str = (
        "https://bcard4.market.alicloudapi.com/bankcard4"
    )

    # 选择真实 provider:留空 / mock → MockVerifyProvider(开发用,所有请求都通过)
    VERIFY_PROVIDER: str = "mock"  # mock / aliyun

    # =====================================================
    # 支付通道(Stripe / 支付宝 / 微信支付)
    # =====================================================
    # 默认 provider:留空或 "mock" 时 OrderService 创建订单走 stub intent,
    # 生产应配 PAYMENT_PROVIDER=stripe(海外)或留空让 factory 按 currency 路由。
    PAYMENT_PROVIDER: str = ""
    # 即便默认 provider 是 stripe/alipay/wechat,这一开关额外把 mock 注入
    # payment-options 列表,便于 staging 环境联调订单状态机而不真实扣款。
    PAYMENT_ENABLE_MOCK: str = ""

    # Stripe 后端密钥(sk_live_ / sk_test_ / rk_*)。建议优先用 Restricted API Key(rk_)。
    # 仅服务器端可见,绝对不要塞进 EXPO_PUBLIC_*。
    STRIPE_API_KEY: str = ""
    # Webhook 验签密钥(whsec_*)。未配置时 stripe webhook 路由直接 400,
    # 避免未验证的事件推进订单状态机。
    STRIPE_WEBHOOK_SECRET: str = ""
    # Stripe Account ID(acct_*)。可选,Connect 场景需要;普通收单留空即可。
    STRIPE_ACCOUNT_ID: str = ""

    # Stripe Connect Onboarding 跳转 URL。
    # - REFRESH 在 Onboarding URL 过期或用户中途取消时, Stripe 会跳到这里;
    #   建议指向一个前端页面, 该页再调 /wallet/me/connect/onboard 重新拿 URL。
    # - RETURN  Onboarding 完成后跳到这里;前端页可调 /wallet/me/connect/refresh 拉最新状态。
    STRIPE_CONNECT_REFRESH_URL: str = ""
    STRIPE_CONNECT_RETURN_URL: str = ""

    # 支付宝 App 支付(国内 CNY 主通道之一)
    ALIPAY_APP_ID: str = ""
    ALIPAY_PRIVATE_KEY: str = ""
    ALIPAY_PUBLIC_KEY: str = ""
    ALIPAY_NOTIFY_URL: str = ""

    # 微信支付 v3(国内 CNY 主通道之一)
    WECHAT_APP_ID: str = ""
    WECHAT_MCH_ID: str = ""
    WECHAT_API_V3_KEY: str = ""
    WECHAT_PRIVATE_KEY: str = ""
    WECHAT_CERT_SERIAL_NO: str = ""
    WECHAT_NOTIFY_URL: str = ""


settings = Settings()
