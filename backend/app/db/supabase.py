"""
Supabase 客户端配置
"""

from supabase import create_client, Client
from app.core.config import settings

# 创建 Supabase 客户端
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

# 创建服务端 Supabase 客户端（用于管理员操作）
supabase_admin: Client = create_client(
    settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY
)


def get_supabase() -> Client:
    """获取 Supabase 客户端"""
    return supabase


def get_supabase_admin() -> Client:
    """获取管理员 Supabase 客户端"""
    return supabase_admin
