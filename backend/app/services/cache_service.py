"""
Redis 缓存服务 - 用于加速 API 请求
"""

import json
import hashlib
from typing import Optional, Any, Callable
from functools import wraps
import redis
from redis.exceptions import ConnectionError, TimeoutError

from app.core.config import settings


class CacheService:
    """Redis 缓存服务"""

    # 缓存时间常量（秒）
    TTL_SHORT = 60 * 5  # 5 分钟 - 用于频繁变动的数据（帖子列表等）
    TTL_MEDIUM = 60 * 30  # 30 分钟 - 用于中等变动的数据
    TTL_LONG = 60 * 60  # 1 小时 - 用于较少变动的数据（品牌、秀场等）
    TTL_STATIC = 60 * 60 * 24  # 24 小时 - 用于静态数据（分类、年份等）

    # 缓存键前缀
    PREFIX_BRANDS = "brands"
    PREFIX_SHOWS = "shows"
    PREFIX_POSTS = "posts"
    PREFIX_USERS = "users"
    PREFIX_COMMUNITIES = "communities"
    PREFIX_BANNERS = "banners"
    PREFIX_STORES = "stores"

    def __init__(self):
        self._client: Optional[redis.Redis] = None
        self._connected = False

    def connect(self) -> bool:
        """连接 Redis"""
        url = settings.redis_url
        if not url:
            print("ℹ️ Redis disabled (no Redis URL configured)")
            self._connected = False
            return False

        try:
            self._client = redis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
            )
            self._client.ping()
            self._connected = True
            print(f"✅ Redis connected successfully ({settings.REDIS_HOST or url})")
            return True
        except (ConnectionError, TimeoutError) as e:
            print(f"⚠️ Redis connection failed: {e}")
            self._connected = False
            return False
        except Exception as e:
            print(f"⚠️ Redis unexpected error: {e}")
            self._connected = False
            return False

    def disconnect(self):
        """断开 Redis 连接"""
        if self._client:
            self._client.close()
            self._connected = False
            print("👋 Redis disconnected")

    @property
    def is_connected(self) -> bool:
        """检查是否已连接"""
        return self._connected and self._client is not None

    def _build_key(self, prefix: str, *args, **kwargs) -> str:
        """构建缓存键"""
        # 将参数组合成唯一的键
        key_parts = [prefix]
        
        # 添加位置参数
        for arg in args:
            key_parts.append(str(arg))
        
        # 添加关键字参数（排序以确保一致性）
        if kwargs:
            sorted_kwargs = sorted(kwargs.items())
            for k, v in sorted_kwargs:
                if v is not None:  # 跳过 None 值
                    key_parts.append(f"{k}:{v}")
        
        # 使用冒号连接
        return ":".join(key_parts)

    def _build_hash_key(self, prefix: str, data: dict) -> str:
        """构建基于数据哈希的缓存键"""
        # 对于复杂参数，使用哈希
        data_str = json.dumps(data, sort_keys=True, default=str)
        hash_value = hashlib.md5(data_str.encode()).hexdigest()[:8]
        return f"{prefix}:hash:{hash_value}"

    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        if not self.is_connected:
            return None
        
        try:
            data = self._client.get(key)
            if data:
                return json.loads(data)
            return None
        except (ConnectionError, TimeoutError):
            self._connected = False
            return None
        except json.JSONDecodeError:
            return None
        except Exception:
            return None

    def set(self, key: str, value: Any, ttl: int = TTL_MEDIUM) -> bool:
        """设置缓存"""
        if not self.is_connected:
            return False
        
        try:
            data = json.dumps(value, default=str)
            self._client.setex(key, ttl, data)
            return True
        except (ConnectionError, TimeoutError):
            self._connected = False
            return False
        except Exception:
            return False

    def delete(self, key: str) -> bool:
        """删除缓存"""
        if not self.is_connected:
            return False
        
        try:
            self._client.delete(key)
            return True
        except (ConnectionError, TimeoutError):
            self._connected = False
            return False
        except Exception:
            return False

    def delete_pattern(self, pattern: str) -> int:
        """删除匹配模式的所有缓存键"""
        if not self.is_connected:
            return 0
        
        try:
            keys = self._client.keys(pattern)
            if keys:
                return self._client.delete(*keys)
            return 0
        except (ConnectionError, TimeoutError):
            self._connected = False
            return 0
        except Exception:
            return 0

    def clear_prefix(self, prefix: str) -> int:
        """清除某个前缀下的所有缓存"""
        return self.delete_pattern(f"{prefix}:*")

    # ==================== 便捷方法 ====================

    def get_or_set(
        self, key: str, getter: Callable, ttl: int = TTL_MEDIUM
    ) -> Any:
        """
        获取缓存，如果不存在则调用 getter 获取数据并缓存
        """
        # 尝试从缓存获取
        cached = self.get(key)
        if cached is not None:
            return cached
        
        # 调用 getter 获取数据
        data = getter()
        
        # 缓存数据
        if data is not None:
            self.set(key, data, ttl)
        
        return data

    # ==================== 品牌缓存 ====================

    def get_brands_list_key(
        self,
        keyword: Optional[str] = None,
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> str:
        """获取品牌列表缓存键"""
        return self._build_key(
            self.PREFIX_BRANDS,
            "list",
            keyword=keyword,
            category=category,
            page=page,
            page_size=page_size,
        )

    def get_brand_key(self, brand_id: int) -> str:
        """获取单个品牌缓存键"""
        return self._build_key(self.PREFIX_BRANDS, "detail", brand_id)

    def get_brand_by_name_key(self, name: str) -> str:
        """获取品牌（按名称）缓存键"""
        return self._build_key(self.PREFIX_BRANDS, "name", name)

    def get_brand_categories_key(self) -> str:
        """获取品牌分类列表缓存键"""
        return self._build_key(self.PREFIX_BRANDS, "categories")

    def invalidate_brands(self):
        """清除所有品牌相关缓存"""
        self.clear_prefix(self.PREFIX_BRANDS)

    # ==================== 秀场缓存 ====================

    def get_shows_list_key(
        self,
        keyword: Optional[str] = None,
        brand: Optional[str] = None,
        year: Optional[int] = None,
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> str:
        """获取秀场列表缓存键"""
        return self._build_key(
            self.PREFIX_SHOWS,
            "list",
            keyword=keyword,
            brand=brand,
            year=year,
            category=category,
            page=page,
            page_size=page_size,
        )

    def get_show_key(self, show_id) -> str:
        """获取单个秀场缓存键"""
        return self._build_key(self.PREFIX_SHOWS, "detail", show_id)

    def get_shows_by_brand_key(self, brand_name: str) -> str:
        """获取品牌秀场列表缓存键"""
        return self._build_key(self.PREFIX_SHOWS, "brand", brand_name)

    def get_show_categories_key(self) -> str:
        """获取秀场分类列表缓存键"""
        return self._build_key(self.PREFIX_SHOWS, "categories")

    def get_show_years_key(self) -> str:
        """获取秀场年份列表缓存键"""
        return self._build_key(self.PREFIX_SHOWS, "years")

    def invalidate_shows(self):
        """清除所有秀场相关缓存"""
        self.clear_prefix(self.PREFIX_SHOWS)

    # ==================== 帖子缓存 ====================

    def get_posts_list_key(self, limit: int = 50, user_id: Optional[int] = None) -> str:
        """获取帖子列表缓存键"""
        return self._build_key(
            self.PREFIX_POSTS, "list", limit=limit, user_id=user_id
        )

    def get_post_key(self, post_id: int, user_id: Optional[int] = None) -> str:
        """获取单个帖子缓存键"""
        return self._build_key(self.PREFIX_POSTS, "detail", post_id, user_id=user_id)

    def get_posts_by_user_key(
        self, user_id: int, status: Optional[str] = None
    ) -> str:
        """获取用户帖子列表缓存键"""
        return self._build_key(
            self.PREFIX_POSTS, "user", user_id, status=status
        )

    def get_posts_by_show_key(self, show_id: int) -> str:
        """获取秀场帖子列表缓存键"""
        return self._build_key(self.PREFIX_POSTS, "show", show_id)

    def get_posts_by_community_key(self, community_id: int) -> str:
        """获取社区帖子列表缓存键"""
        return self._build_key(self.PREFIX_POSTS, "community", community_id)

    def get_forum_posts_key(self, limit: int = 50) -> str:
        """获取论坛帖子列表缓存键"""
        return self._build_key(self.PREFIX_POSTS, "forum", limit=limit)

    def invalidate_posts(self):
        """清除所有帖子相关缓存"""
        self.clear_prefix(self.PREFIX_POSTS)

    def invalidate_post(self, post_id: int):
        """清除单个帖子相关缓存"""
        # 清除帖子详情缓存
        self.delete_pattern(f"{self.PREFIX_POSTS}:detail:{post_id}:*")
        # 清除帖子列表缓存（因为列表也可能包含该帖子）
        self.delete_pattern(f"{self.PREFIX_POSTS}:list:*")
        self.delete_pattern(f"{self.PREFIX_POSTS}:forum:*")

    # ==================== 社区缓存 ====================

    def get_communities_list_key(self) -> str:
        """获取社区列表缓存键"""
        return self._build_key(self.PREFIX_COMMUNITIES, "list")

    def get_community_key(self, community_id: int) -> str:
        """获取单个社区缓存键"""
        return self._build_key(self.PREFIX_COMMUNITIES, "detail", community_id)

    def invalidate_communities(self):
        """清除所有社区相关缓存"""
        self.clear_prefix(self.PREFIX_COMMUNITIES)

    # ==================== Banner 缓存 ====================

    def get_banners_key(self) -> str:
        """获取 Banner 列表缓存键"""
        return self._build_key(self.PREFIX_BANNERS, "list")

    def invalidate_banners(self):
        """清除所有 Banner 相关缓存"""
        self.clear_prefix(self.PREFIX_BANNERS)

    # ==================== 买手店缓存 ====================

    def get_stores_list_key(
        self,
        keyword: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> str:
        """获取买手店列表缓存键"""
        return self._build_key(
            self.PREFIX_STORES, "list", keyword=keyword, page=page, page_size=page_size
        )

    def get_store_key(self, store_id: int) -> str:
        """获取单个买手店缓存键"""
        return self._build_key(self.PREFIX_STORES, "detail", store_id)

    def invalidate_stores(self):
        """清除所有买手店相关缓存"""
        self.clear_prefix(self.PREFIX_STORES)

    # ==================== 统计信息 ====================

    def get_stats(self) -> dict:
        """获取缓存统计信息"""
        if not self.is_connected:
            return {"connected": False}
        
        try:
            info = self._client.info("stats")
            memory = self._client.info("memory")
            keyspace = self._client.info("keyspace")
            
            return {
                "connected": True,
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "used_memory": memory.get("used_memory_human", "N/A"),
                "total_keys": sum(
                    db.get("keys", 0) 
                    for db in keyspace.values() 
                    if isinstance(db, dict)
                ),
            }
        except Exception as e:
            return {"connected": True, "error": str(e)}


# 全局缓存服务实例
cache_service = CacheService()
