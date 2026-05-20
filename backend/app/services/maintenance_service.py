"""
维护模式服务：通过 app_config 表读写维护状态配置。

维护状态是全站生效的开关，管理员可在后台即时开关：
- 开启后：中间件对非白名单接口统一返回 503（同时保留 code/message/data 信封）
- 前端：轮询 /api/maintenance/status 展示维护提示页

性能考虑：
- is_enabled() 被每个 HTTP 请求调用，因此通过 TTL 内存缓存避免每次都 round-trip 查库。
- 默认缓存 5 秒：管理员切换维护后最多 5 秒生效，已足够及时。
"""
import logging
import time
from typing import Optional

from app.db.supabase import get_supabase, get_supabase_admin

logger = logging.getLogger(__name__)

CONFIG_KEY = "maintenance_mode"

_CACHE_TTL_SECONDS = 5


class MaintenanceService:
    """维护模式配置读写，单例使用。"""

    def __init__(self) -> None:
        self.db = get_supabase_admin()
        self._cached_config: dict | None = None
        self._cache_expires_at: float = 0.0

    @staticmethod
    def _default_config() -> dict:
        return {
            "enabled": False,
            "message": "服务暂时不可用，正在恢复中\n请稍后再试",
        }

    def _invalidate_cache(self) -> None:
        self._cached_config = None
        self._cache_expires_at = 0.0

    def get_config(self) -> dict:
        """读取维护配置。

        优先使用内存缓存（TTL 5s），避免中间件每请求查库。
        读取失败或不存在时返回默认值，保证调用方始终拿到完整结构。
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
            # postgrest-py treats PostgREST 204 (no row for .maybe_single()) as APIError.
            code = getattr(exc, "code", None)
            if code is None and exc.args and isinstance(exc.args[0], dict):
                code = exc.args[0].get("code")
            if str(code) != "204":
                logger.warning("Failed to load maintenance config: %s", exc)
            config = self._default_config()

        self._cached_config = config
        self._cache_expires_at = now + _CACHE_TTL_SECONDS
        return config

    def is_enabled(self) -> bool:
        """中间件使用：只需要一个布尔。任何异常都默认"未维护"，避免读库失败反噬线上。"""
        try:
            return bool(self.get_config().get("enabled", False))
        except Exception:
            return False

    def set_config(self, enabled: bool, message: Optional[str] = None) -> dict:
        """更新维护配置；message 为 None 时保留已有文案。写入成功后立刻刷新缓存。"""
        current = self.get_config()
        payload = {
            "enabled": bool(enabled),
            "message": message if message is not None else current.get(
                "message", self._default_config()["message"]
            ),
        }
        self.db.table("app_config").upsert(
            {"key": CONFIG_KEY, "value": payload},
            on_conflict="key",
        ).execute()
        # 写入成功 → 立刻刷新缓存，管理员本次请求就能拿到最新值
        self._cached_config = payload
        self._cache_expires_at = time.monotonic() + _CACHE_TTL_SECONDS
        return payload


maintenance_service = MaintenanceService()
