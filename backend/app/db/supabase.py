"""
Supabase 客户端配置与瞬时故障重试

Uses HTTP/1.1 with retries to avoid HTTP/2 GOAWAY (ConnectionTerminated)
errors that occur when the remote server closes long-lived HTTP/2 connections.
See: https://github.com/supabase/supabase-py/issues/1064
"""

import time
from typing import Callable, TypeVar

import httpx
from postgrest.exceptions import APIError
from supabase import create_client, Client

from app.core.config import settings


T = TypeVar("T")

# PostgREST/nginx 网关偶发返回的瞬时上游错误。业务错误（PG 错误码如 23505）不在此列。
_TRANSIENT_HTTP_CODES = {502, 503, 504}
_TRANSIENT_NETWORK_EXC = (
    httpx.ConnectError,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    httpx.RemoteProtocolError,
    httpx.PoolTimeout,
)
# Supabase/PostgREST 遇到上游非 JSON 响应时的标志性 message
_UPSTREAM_NON_JSON_MARKER = "JSON could not be generated"


def _create_client(url: str, key: str) -> Client:
    """Create a Supabase client with retry-capable httpx transport when possible."""
    try:
        from httpx import Client as HttpxClient, HTTPTransport, Limits
        from supabase import ClientOptions

        transport = HTTPTransport(
            retries=3,
            http2=False,
            limits=Limits(
                max_connections=100,
                max_keepalive_connections=20,
                keepalive_expiry=30,
            ),
        )
        http_client = HttpxClient(transport=transport)
        return create_client(
            url, key, options=ClientOptions(httpx_client=http_client)
        )
    except Exception as e:
        print(f"[Supabase] Custom httpx transport not available ({e}), using defaults")
        return create_client(url, key)


supabase: Client = _create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
supabase_admin: Client = _create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


def get_supabase() -> Client:
    """获取 Supabase 客户端"""
    return supabase


def get_supabase_admin() -> Client:
    """获取管理员 Supabase 客户端"""
    return supabase_admin


def is_transient_supabase_error(exc: BaseException) -> bool:
    """判断一个异常是否属于"上游瞬时故障"，值得重试。

    仅包括：
    - httpx 网络层异常（连接、读/写超时、连接池耗尽、HTTP/2 协议错误）。
    - PostgREST `APIError` 且 `code` 属于 {502, 503, 504}。
    - PostgREST `APIError` 且 message 为 "JSON could not be generated"（上游返回
      非 JSON，通常是 nginx/Kong 的 502/504 HTML 页面）。

    **不**包括业务层 PostgREST 错误（PG 错误码字符串，如 `23505`、`PGRST116`），
    这些是确定性错误，重试无意义。
    """
    if isinstance(exc, _TRANSIENT_NETWORK_EXC):
        return True
    if isinstance(exc, APIError):
        code = exc.code
        try:
            if int(code) in _TRANSIENT_HTTP_CODES:
                return True
        except (ValueError, TypeError):
            pass
        if _UPSTREAM_NON_JSON_MARKER in (exc.message or ""):
            return True
    return False


def execute_with_retry(
    query_fn: Callable[[], T],
    *,
    retries: int = 2,
    base_delay: float = 0.4,
    label: str = "supabase",
) -> T:
    """执行一次 Supabase 查询；仅对瞬时上游/网络错误做指数退避重试。

    典型用法（把 `.execute()` 的调用包起来）::

        result = execute_with_retry(
            lambda: self.db.table("buyer_stores").select("*").execute()
        )

    参数:
        query_fn: 无参回调，内部做一次 `.execute()`。每次重试都会重新调用它，
                  以便 postgrest-py 重建底层 httpx 请求。
        retries: 除首次外的重试次数，默认 2（最多 3 次尝试，总退避 ~1.2s）。
        base_delay: 第 1 次重试等待秒数，之后指数翻倍。
        label: 日志前缀，便于定位热点路径。

    非瞬时错误（例如 PG 主键冲突）会立刻抛出，不进入重试。
    """
    last_exc: BaseException | None = None
    total_attempts = retries + 1
    for attempt in range(total_attempts):
        try:
            return query_fn()
        except Exception as exc:
            if not is_transient_supabase_error(exc) or attempt == retries:
                raise
            last_exc = exc
            delay = base_delay * (2 ** attempt)
            print(
                f"[{label}] transient error on attempt {attempt + 1}/{total_attempts}: "
                f"{type(exc).__name__}: {exc!s}; retrying in {delay:.2f}s",
                flush=True,
            )
            time.sleep(delay)

    # 理论上不会到这里：要么 return，要么在最后一次失败时 raise。
    if last_exc is not None:
        raise last_exc
    raise RuntimeError("execute_with_retry: unreachable")
