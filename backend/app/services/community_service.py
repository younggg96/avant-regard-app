"""
社区服务
"""

from typing import Optional, List
from app.db.supabase import get_supabase
from app.schemas.community import Community, CommunityCategory, CommunityListResponse, CommunityStats


class CommunityService:
    def __init__(self):
        self.db = get_supabase()

    def _format_community(
        self, data: dict, current_user_id: Optional[int] = None
    ) -> Community:
        """格式化社区数据"""
        is_following = False
        if current_user_id:
            is_following = self._check_following(data["id"], current_user_id)

        return Community(
            id=data["id"],
            name=data["name"],
            slug=data["slug"],
            description=data.get("description", ""),
            iconUrl=data.get("icon_url", ""),
            coverUrl=data.get("cover_url", ""),
            category=data.get("category", "GENERAL"),
            isOfficial=data.get("is_official", False),
            isActive=data.get("is_active", True),
            memberCount=data.get("member_count", 0),
            postCount=data.get("post_count", 0),
            sortOrder=data.get("sort_order", 0),
            createdAt=data["created_at"],
            updatedAt=data["updated_at"],
            isFollowing=is_following,
        )

    def _check_following(self, community_id: int, user_id: int) -> bool:
        """检查用户是否关注了社区"""
        result = (
            self.db.table("community_follows")
            .select("id")
            .eq("community_id", community_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)

    def get_all_communities(
        self, current_user_id: Optional[int] = None
    ) -> List[Community]:
        """获取所有激活的社区"""
        result = (
            self.db.table("communities")
            .select("*")
            .eq("is_active", True)
            .order("sort_order", desc=True)
            .order("member_count", desc=True)
            .execute()
        )
        return [self._format_community(c, current_user_id) for c in result.data or []]

    def get_popular_communities(
        self, limit: int = 5, current_user_id: Optional[int] = None
    ) -> List[Community]:
        """获取热门社区（按成员数和帖子数综合排序）"""
        result = (
            self.db.table("communities")
            .select("*")
            .eq("is_active", True)
            .order("member_count", desc=True)
            .order("post_count", desc=True)
            .limit(limit)
            .execute()
        )
        return [self._format_community(c, current_user_id) for c in result.data or []]

    def get_following_communities(
        self, user_id: int, current_user_id: Optional[int] = None
    ) -> List[Community]:
        """获取用户关注的社区"""
        result = (
            self.db.table("community_follows")
            .select("community_id, communities(*)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )

        communities = []
        for item in result.data or []:
            c = item.get("communities")
            if c and c.get("is_active", True):
                communities.append(self._format_community(c, current_user_id))
        return communities

    def get_community_list(
        self, user_id: Optional[int] = None
    ) -> CommunityListResponse:
        """获取社区列表（热门、关注、全部）"""
        popular = self.get_popular_communities(limit=5, current_user_id=user_id)
        following = []
        if user_id:
            following = self.get_following_communities(user_id, user_id)
        all_communities = self.get_all_communities(user_id)

        return CommunityListResponse(
            popular=popular,
            following=following,
            all=all_communities,
        )

    def get_community_by_id(
        self, community_id: int, current_user_id: Optional[int] = None
    ) -> Optional[Community]:
        """获取单个社区"""
        result = (
            self.db.table("communities")
            .select("*")
            .eq("id", community_id)
            .execute()
        )
        if not result.data:
            return None
        return self._format_community(result.data[0], current_user_id)

    def get_community_by_slug(
        self, slug: str, current_user_id: Optional[int] = None
    ) -> Optional[Community]:
        """通过 slug 获取社区"""
        result = (
            self.db.table("communities")
            .select("*")
            .eq("slug", slug)
            .execute()
        )
        if not result.data:
            return None
        return self._format_community(result.data[0], current_user_id)

    def create_community(
        self,
        name: str,
        slug: str,
        description: str = "",
        icon_url: str = "",
        cover_url: str = "",
        category: str = "GENERAL",
        is_official: bool = False,
        sort_order: int = 0,
    ) -> Optional[Community]:
        """创建社区（管理员）"""
        insert_data = {
            "name": name,
            "slug": slug,
            "description": description,
            "icon_url": icon_url,
            "cover_url": cover_url,
            "category": category,
            "is_official": is_official,
            "sort_order": sort_order,
        }

        result = self.db.table("communities").insert(insert_data).execute()
        if not result.data:
            return None
        return self._format_community(result.data[0])

    def update_community(
        self, community_id: int, **kwargs
    ) -> Optional[Community]:
        """更新社区（管理员）"""
        update_data = {}
        field_mapping = {
            "name": "name",
            "description": "description",
            "icon_url": "icon_url",
            "cover_url": "cover_url",
            "category": "category",
            "is_official": "is_official",
            "is_active": "is_active",
            "sort_order": "sort_order",
        }

        for key, db_field in field_mapping.items():
            if key in kwargs and kwargs[key] is not None:
                update_data[db_field] = kwargs[key]

        if not update_data:
            return self.get_community_by_id(community_id)

        self.db.table("communities").update(update_data).eq("id", community_id).execute()
        return self.get_community_by_id(community_id)

    def delete_community(self, community_id: int) -> bool:
        """删除社区（管理员）"""
        result = (
            self.db.table("communities")
            .delete()
            .eq("id", community_id)
            .execute()
        )
        return bool(result.data)

    def follow_community(self, community_id: int, user_id: int) -> bool:
        """关注社区"""
        try:
            self.db.table("community_follows").insert(
                {"community_id": community_id, "user_id": user_id}
            ).execute()
            # 更新成员数
            self.db.rpc(
                "increment_community_member_count", {"community_id_param": community_id}
            ).execute()
            return True
        except:
            return False

    def unfollow_community(self, community_id: int, user_id: int) -> bool:
        """取消关注社区"""
        result = (
            self.db.table("community_follows")
            .delete()
            .eq("community_id", community_id)
            .eq("user_id", user_id)
            .execute()
        )
        if result.data:
            # 更新成员数
            self.db.rpc(
                "decrement_community_member_count", {"community_id_param": community_id}
            ).execute()
            return True
        return False

    def get_community_stats(self, community_id: int) -> Optional[CommunityStats]:
        """获取社区统计信息"""
        community = self.get_community_by_id(community_id)
        if not community:
            return None

        # 获取今日帖子数
        from datetime import datetime, timedelta
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today - timedelta(days=7)

        today_result = (
            self.db.table("posts")
            .select("id", count="exact")
            .eq("community_id", community_id)
            .eq("status", "PUBLISHED")
            .gte("created_at", today.isoformat())
            .execute()
        )

        week_result = (
            self.db.table("posts")
            .select("id", count="exact")
            .eq("community_id", community_id)
            .eq("status", "PUBLISHED")
            .gte("created_at", week_ago.isoformat())
            .execute()
        )

        return CommunityStats(
            memberCount=community.memberCount,
            postCount=community.postCount,
            todayPostCount=today_result.count or 0,
            weekPostCount=week_result.count or 0,
        )

    def search_communities(
        self, keyword: str, limit: int = 20, current_user_id: Optional[int] = None
    ) -> List[Community]:
        """搜索社区"""
        result = (
            self.db.table("communities")
            .select("*")
            .eq("is_active", True)
            .or_(f"name.ilike.*{keyword}*,description.ilike.*{keyword}*")
            .order("member_count", desc=True)
            .limit(limit)
            .execute()
        )
        return [self._format_community(c, current_user_id) for c in result.data or []]


# 单例
community_service = CommunityService()
