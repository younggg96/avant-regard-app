"""
功能开关 (Feature flags) 服务: 通过 app_config 表读写全站开关.

当前唯一受控开关:
- ``lottery_enabled``: 是否对全站 App / Web 用户暴露月度抽奖功能.
  关闭时:
    * 用户侧 ``/api/lottery/*`` 不再返回真实数据 (返回 ``enabled=False``);
    * 客户端通过公开的 ``/api/feature-flags`` 拉到该状态后, 隐藏所有抽奖入口/卡片;
    * Admin 仍然可以编辑奖池 / 开奖, 不被该开关阻断 (避免误关后无法补救).

设计与 ``maintenance_service`` 完全对齐:
- 同样使用 ``app_config`` JSONB 存储, key=``feature_flags``;
- 同样有 5s TTL 内存缓存, 减少高频路由调用查库;
- 同样在 ``set_config`` 后立刻刷新缓存, 让管理员当次请求就能看到最新值.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

CONFIG_KEY = "feature_flags"

_CACHE_TTL_SECONDS = 5


class FeatureFlagsService:
    """全站功能开关读写, 单例使用."""

    def __init__(self) -> None:
        self.db = get_supabase()
        self._cached_config: dict | None = None
        self._cache_expires_at: float = 0.0

    @staticmethod
    def _default_config() -> dict:
        # 默认关闭. app_config 表里没有这一行时, 抽奖入口对所有用户隐藏,
        # 必须由 admin 在管理后台主动打开. 这样新环境 / 漏配也不会让未配置的
        # 抽奖功能"自动可见", 防御性更强.
        return {
            "lotteryEnabled": False,
        }

    def _invalidate_cache(self) -> None:
        self._cached_config = None
        self._cache_expires_at = 0.0

    def get_config(self) -> dict:
        """读取功能开关配置 (TTL 缓存).

        读取失败/不存在时返回默认值, 保证调用方拿到完整结构, 不必判空.
        """
        now = time.monotonic()
        if self._cached_config is not None and now < self._cache_expires_at:
            return self._cached_config

        try:
            result = (
                self.db.table("app_config")
                .select("value")
                .eq("key", CONFIG_KEY)
                .maybe_single()
                .execute()
            )
            if result and result.data and result.data.get("value"):
                value = result.data["value"]
                config = {**self._default_config(), **value}
            else:
                config = self._default_config()
        except Exception as exc:  # noqa: BLE001 — fallback is intentional
            code = getattr(exc, "code", None)
            if code is None and exc.args and isinstance(exc.args[0], dict):
                code = exc.args[0].get("code")
            if str(code) != "204":
                logger.warning("Failed to load feature flags config: %s", exc)
            config = self._default_config()

        self._cached_config = config
        self._cache_expires_at = now + _CACHE_TTL_SECONDS
        return config

    def is_lottery_enabled(self) -> bool:
        """便捷接口: 抽奖功能是否对用户开启. 任何异常默认关闭 (与 default_config 一致)."""
        try:
            return bool(self.get_config().get("lotteryEnabled", False))
        except Exception:
            return False

    def set_config(self, *, lottery_enabled: Optional[bool] = None) -> dict:
        """更新功能开关. 仅传入需要修改的字段, None 字段保留原值.

        写入成功后立刻刷新缓存, 管理员当次请求就能看到最新值.
        """
        current = self.get_config()
        payload = dict(current)
        if lottery_enabled is not None:
            payload["lotteryEnabled"] = bool(lottery_enabled)

        self.db.table("app_config").upsert(
            {"key": CONFIG_KEY, "value": payload},
            on_conflict="key",
        ).execute()

        self._cached_config = payload
        self._cache_expires_at = time.monotonic() + _CACHE_TTL_SECONDS
        return payload


feature_flags_service = FeatureFlagsService()
