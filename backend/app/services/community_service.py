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
        self, data: dict, current_user_id: Optional[int] = None,
        real_member_count: Optional[int] = None,
        real_post_count: Optional[int] = None,
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
            memberCount=real_member_count if real_member_count is not None else data.get("member_count", 0),
            postCount=real_post_count if real_post_count is not None else data.get("post_count", 0),
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

    def _compute_real_counts(self, community_id: int) -> tuple:
        """动态计算社区的真实成员数和帖子数，并同步回缓存字段"""
        member_result = (
            self.db.table("community_follows")
            .select("id", count="exact")
            .eq("community_id", community_id)
            .execute()
        )
        real_member_count = member_result.count or 0

        post_result = (
            self.db.table("posts")
            .select("id", count="exact")
            .eq("community_id", community_id)
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .execute()
        )
        real_post_count = post_result.count or 0

        try:
            self.db.table("communities").update({
                "member_count": real_member_count,
                "post_count": real_post_count,
            }).eq("id", community_id).execute()
        except Exception:
            pass

        return real_member_count, real_post_count

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
        """获取单个社区（动态计算真实成员数和帖子数）"""
        result = (
            self.db.table("communities")
            .select("*")
            .eq("id", community_id)
            .execute()
        )
        if not result.data:
            return None

        real_member_count, real_post_count = self._compute_real_counts(community_id)
        return self._format_community(
            result.data[0], current_user_id,
            real_member_count=real_member_count,
            real_post_count=real_post_count,
        )

    def get_community_by_slug(
        self, slug: str, current_user_id: Optional[int] = None
    ) -> Optional[Community]:
        """通过 slug 获取社区（动态计算真实成员数和帖子数）"""
        result = (
            self.db.table("communities")
            .select("*")
            .eq("slug", slug)
            .execute()
        )
        if not result.data:
            return None

        community_id = result.data[0]["id"]
        real_member_count, real_post_count = self._compute_real_counts(community_id)
        return self._format_community(
            result.data[0], current_user_id,
            real_member_count=real_member_count,
            real_post_count=real_post_count,
        )

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
        """关注社区（幂等操作）"""
        print(f"[DEBUG] follow_community called: community_id={community_id}, user_id={user_id}")
        
        # 先检查是否已关注
        if self._check_following(community_id, user_id):
            print(f"[DEBUG] 用户 {user_id} 已关注社区 {community_id}，返回成功")
            return True  # 已关注，直接返回成功（幂等）
        
        try:
            # 插入关注记录
            insert_result = self.db.table("community_follows").insert(
                {"community_id": community_id, "user_id": user_id}
            ).execute()
            print(f"[DEBUG] 插入关注记录结果: {insert_result.data}")
            
            # 更新成员数（忽略错误，不影响关注成功）
            try:
                self.db.rpc(
                    "increment_community_member_count", {"community_id_param": community_id}
                ).execute()
            except Exception as rpc_error:
                print(f"[WARN] 更新成员数失败（不影响关注）: {rpc_error}")
            
            return True
        except Exception as e:
            print(f"[ERROR] 关注社区失败: {e}")
            import traceback
            traceback.print_exc()
            return False

    def unfollow_community(self, community_id: int, user_id: int) -> bool:
        """取消关注社区（幂等操作）"""
        # 先检查是否已关注
        if not self._check_following(community_id, user_id):
            return True  # 未关注，直接返回成功（幂等）
        
        try:
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
        except Exception as e:
            print(f"取消关注社区失败: {e}")
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
