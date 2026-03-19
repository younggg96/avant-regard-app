"""
Supabase 客户端配置

Uses HTTP/1.1 with retries to avoid HTTP/2 GOAWAY (ConnectionTerminated)
errors that occur when the remote server closes long-lived HTTP/2 connections.
See: https://github.com/supabase/supabase-py/issues/1064
"""

from supabase import create_client, Client
from app.core.config import settings


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
