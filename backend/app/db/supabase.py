"""
Supabase 客户端配置

Uses custom httpx transport with retries and tuned keepalive to prevent
HTTP/2 GOAWAY (ConnectionTerminated) errors on long-lived connections.
See: https://github.com/supabase/supabase-py/issues/1064
"""

from httpx import Client as HttpxClient, HTTPTransport, Limits
from supabase import create_client, Client, ClientOptions
from app.core.config import settings


def _make_httpx_client() -> HttpxClient:
    transport = HTTPTransport(
        retries=3,
        http2=True,
        limits=Limits(
            max_connections=100,
            max_keepalive_connections=1,
            keepalive_expiry=30,
        ),
    )
    return HttpxClient(transport=transport)


_anon_httpx = _make_httpx_client()
_admin_httpx = _make_httpx_client()

supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_KEY,
    options=ClientOptions(httpx_client=_anon_httpx),
)

supabase_admin: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_KEY,
    options=ClientOptions(httpx_client=_admin_httpx),
)


def get_supabase() -> Client:
    """获取 Supabase 客户端"""
    return supabase


def get_supabase_admin() -> Client:
    """获取管理员 Supabase 客户端"""
    return supabase_admin
