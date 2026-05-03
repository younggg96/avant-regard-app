"""
帖子服务
"""

import random
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Union

from app.db.supabase import get_supabase
from app.schemas.post import Post, PostType, PostStatus, AuditStatus, GRADE_REWARD_MAP, PostGrade
from app.services.notification_service import notification_service

GRADE_PRIORITY = {"A": 0, "B": 1, "C": 2, "D": 3, "F": 4}

DEFAULT_RECOMMEND_CONFIG = {
    "pool_ratios": {"core": 0.5, "discovery": 0.3, "random": 0.2},
    "core_pool": {"grades": ["A", "B", "C"]},
    "discovery_pool": {"enabled": True},
    "random_pool": {"grades": ["A", "B"]},
    "cold_start": {"days": 7, "grades": ["A", "B"]},
}


class PostService:
    def __init__(self):
        self.db = get_supabase()

    def _validate_show_ids(self, show_ids: List[Union[int, str]]) -> List[str]:
        """
        验证并转换 show_ids 为字符串列表
        支持整数 ID 和 MongoDB ObjectId 字符串
        """
        if not show_ids:
            return []
        
        valid_ids = []
        for sid in show_ids:
            if sid is not None:
                # 统一转换为字符串（支持整数和 MongoDB ObjectId）
                valid_ids.append(str(sid))
        return valid_ids

    def _format_post(
        self, post_data: dict, current_user_id: Optional[int] = None
    ) -> Post:
        """格式化帖子数据"""
        # 获取用户名
        username = ""
        user_result = (
            self.db.table("users")
            .select("username")
            .eq("id", post_data["user_id"])
            .execute()
        )
        if user_result.data:
            username = user_result.data[0]["username"]

        # 获取用户头像
        avatar_url = None
        user_info_result = (
            self.db.table("user_info")
            .select("avatar_url")
            .eq("user_id", post_data["user_id"])
            .execute()
        )
        if user_info_result.data:
            avatar_url = user_info_result.data[0].get("avatar_url")

        # 检查当前用户是否点赞/收藏/想要
        liked_by_me = False
        favorited_by_me = False
        wanted_by_me = False
        if current_user_id:
            liked_by_me = self._check_liked(post_data["id"], current_user_id)
            favorited_by_me = self._check_favorited(post_data["id"], current_user_id)
            wanted_by_me = self._check_wanted(post_data["id"], current_user_id)

        # 获取 show_ids
        show_ids = post_data.get("show_ids") or []

        # 获取 brand_ids
        brand_ids = post_data.get("brand_ids") or []

        # 获取社区信息
        community_id = post_data.get("community_id")
        community_name = None
        community_slug = None
        if community_id:
            community_result = (
                self.db.table("communities")
                .select("name, slug")
                .eq("id", community_id)
                .execute()
            )
            if community_result.data:
                community_name = community_result.data[0]["name"]
                community_slug = community_result.data[0]["slug"]

        # 清理 post_type 中可能存在的空白字符
        post_type = (
            post_data["post_type"].strip() if post_data.get("post_type") else "ARTICLES"
        )

        grade_value = post_data.get("grade")
        grade_reward = None
        if grade_value:
            try:
                grade_reward = GRADE_REWARD_MAP.get(PostGrade(grade_value), 0)
            except ValueError:
                pass

        return Post(
            id=post_data["id"],
            userId=post_data["user_id"],
            username=username,
            avatarUrl=avatar_url,
            postType=post_type,
            status=post_data["status"],
            auditStatus=post_data.get("audit_status"),
            title=post_data["title"],
            contentText=post_data.get("content_text", ""),
            imageUrls=post_data.get("image_urls", []),
            coverWidth=post_data.get("cover_width"),
            coverHeight=post_data.get("cover_height"),
            likeCount=post_data.get("like_count", 0),
            favoriteCount=post_data.get("favorite_count", 0),
            commentCount=post_data.get("comment_count", 0),
            wantCount=post_data.get("want_count", 0),
            createdAt=post_data["created_at"],
            updatedAt=post_data["updated_at"],
            productName=post_data.get("product_name"),
            brandName=post_data.get("brand_name"),
            rating=post_data.get("rating"),
            showIds=show_ids,
            brandIds=brand_ids,
            itemBrand=post_data.get("item_brand"),
            itemBrandId=post_data.get("item_brand_id"),
            itemCategory=post_data.get("item_category"),
            itemSizes=post_data.get("item_sizes") or [],
            itemColors=post_data.get("item_colors") or [],
            communityId=community_id,
            communityName=community_name,
            communitySlug=community_slug,
            grade=grade_value,
            gradeReward=grade_reward,
            likedByMe=liked_by_me,
            favoritedByMe=favorited_by_me,
            wantedByMe=wanted_by_me,
        )

    def _check_liked(self, post_id: int, user_id: int) -> bool:
        """检查用户是否点赞了帖子"""
        result = (
            self.db.table("post_likes")
            .select("id")
            .eq("post_id", post_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)

    def _check_favorited(self, post_id: int, user_id: int) -> bool:
        """检查用户是否收藏了帖子"""
        result = (
            self.db.table("post_favorites")
            .select("id")
            .eq("post_id", post_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)

    def _check_wanted(self, post_id: int, user_id: int) -> bool:
        """检查用户是否想要该帖子"""
        result = (
            self.db.table("post_wants")
            .select("id")
            .eq("post_id", post_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)

    def _get_blocked_user_ids(self, user_id: Optional[int]) -> set:
        """获取当前用户屏蔽的用户 ID 集合"""
        if not user_id:
            return set()
        from app.services.moderation_service import moderation_service
        ids = moderation_service.get_blocked_user_ids(user_id)
        if ids:
            print(f"[BlockFilter] user {user_id} has blocked: {ids}")
        return set(ids)

    def _filter_blocked(self, rows: list, blocked_ids: set) -> list:
        """从结果中过滤掉被屏蔽用户的数据"""
        if not blocked_ids:
            return rows
        return [r for r in rows if r["user_id"] not in blocked_ids]

    def get_posts(
        self, current_user_id: Optional[int] = None, limit: int = 50
    ) -> List[Post]:
        """获取帖子列表（仅已发布且审核通过的）"""
        blocked_ids = self._get_blocked_user_ids(current_user_id)
        result = (
            self.db.table("posts")
            .select("*")
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        filtered = self._filter_blocked(result.data or [], blocked_ids)
        return [self._format_post(p, current_user_id) for p in filtered]

    def get_post_by_id(
        self, post_id: int, current_user_id: Optional[int] = None
    ) -> Optional[Post]:
        """获取单个帖子"""
        result = self.db.table("posts").select("*").eq("id", post_id).execute()
        if not result.data:
            return None
        return self._format_post(result.data[0], current_user_id)

    def create_post(
        self,
        user_id: int,
        post_type: str,
        post_status: str,
        title: str,
        content_text: str = "",
        image_urls: List[str] = None,
        cover_width: Optional[int] = None,
        cover_height: Optional[int] = None,
        product_name: str = None,
        brand_name: str = None,
        rating: float = None,
        show_ids: List[Union[int, str]] = None,
        brand_ids: List[int] = None,
        community_id: int = None,
        item_brand: str = None,
        item_brand_id: int = None,
        item_category: str = None,
        item_sizes: List[str] = None,
        item_colors: List[str] = None,
        # AI 发帖助手 (V3 #25):
        # generated_by_ai = True 时,generation_metadata 必须含 log_id, 用于
        # 反查 ai_post_service_logs 与 A/B 实验。这里做一次最小校验,
        # 其余字段交给上层 ai_post_service 保证完整性。
        generated_by_ai: bool = False,
        generation_metadata: Optional[dict] = None,
    ) -> Optional[Post]:
        """创建帖子"""
        # 验证 show_ids（确保是有效的整数列表）
        validated_show_ids = self._validate_show_ids(show_ids or [])

        if generated_by_ai:
            if not generation_metadata or "log_id" not in generation_metadata:
                raise ValueError("AI 帖必须提供 generation_metadata.log_id")

        # 插入帖子
        insert_data = {
            "user_id": user_id,
            "post_type": post_type,
            "status": post_status,
            "audit_status": "PENDING" if post_status == "PUBLISHED" else None,
            "title": title,
            "content_text": content_text,
            "image_urls": image_urls or [],
            "cover_width": cover_width,
            "cover_height": cover_height,
            "product_name": product_name,
            "brand_name": brand_name,
            "rating": rating,
            "show_ids": validated_show_ids,
            "brand_ids": brand_ids or [],
            "community_id": community_id,
            "item_brand": item_brand,
            "item_brand_id": item_brand_id,
            "item_category": item_category,
            "item_sizes": item_sizes or [],
            "item_colors": item_colors or [],
            "generated_by_ai": generated_by_ai,
            "generation_metadata": generation_metadata,
        }

        result = self.db.table("posts").insert(insert_data).execute()

        if not result.data:
            return None

        post = result.data[0]

        # AI 帖反向回填 ai_post_service_logs.post_id, 形成双向引用,
        # 便于运营从任一端查另一端。失败不影响发帖主流程。
        if generated_by_ai and generation_metadata:
            log_id = generation_metadata.get("log_id")
            if log_id:
                try:
                    from app.services.ai.log_repo import ai_post_log_repo
                    ai_post_log_repo.attach_post(int(log_id), post["id"])
                except Exception as e:
                    print(f"[create_post] attach_post failed: {e}", flush=True)

        if post_status == "PUBLISHED":
            from app.services.grading_service import grade_post_async
            grade_post_async(post["id"])

            # 等级规则引擎: 已发布帖子计入 post_created 计数
            from app.services.level_service import level_service
            from app.schemas.level import LevelAction
            level_service.record_action(user_id, LevelAction.POST_CREATED)

        return self._format_post(post, user_id)

    def update_post(self, post_id: int, user_id: int, **kwargs) -> Optional[Post]:
        """更新帖子"""
        # 验证帖子所有权
        post_result = (
            self.db.table("posts")
            .select("*")
            .eq("id", post_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not post_result.data:
            return None

        update_data = {}
        if "post_type" in kwargs:
            update_data["post_type"] = kwargs["post_type"]
        if "status" in kwargs:
            update_data["status"] = kwargs["status"]
            # 发布时设置审核状态为待审核
            if kwargs["status"] == "PUBLISHED":
                update_data["audit_status"] = "PENDING"
        if "title" in kwargs:
            update_data["title"] = kwargs["title"]
        if "content_text" in kwargs:
            update_data["content_text"] = kwargs["content_text"]
        if "image_urls" in kwargs:
            update_data["image_urls"] = kwargs["image_urls"]
        # 封面尺寸（同 image_urls[0] 联动变化；若 image_urls 变了但没传 cover_*,
        # 调用方应显式清 None，否则我们保持原值不动以避免误覆盖）
        if "cover_width" in kwargs:
            update_data["cover_width"] = kwargs["cover_width"]
        if "cover_height" in kwargs:
            update_data["cover_height"] = kwargs["cover_height"]
        # 单品评价专用字段
        if "product_name" in kwargs:
            update_data["product_name"] = kwargs["product_name"]
        if "brand_name" in kwargs:
            update_data["brand_name"] = kwargs["brand_name"]
        if "rating" in kwargs:
            update_data["rating"] = kwargs["rating"]
        if "show_ids" in kwargs:
            # 验证 show_ids（确保是有效的整数列表）
            update_data["show_ids"] = self._validate_show_ids(kwargs["show_ids"] or [])
        if "brand_ids" in kwargs:
            update_data["brand_ids"] = kwargs["brand_ids"]
        # 单品信息字段
        if "item_brand" in kwargs:
            update_data["item_brand"] = kwargs["item_brand"]
        if "item_brand_id" in kwargs:
            update_data["item_brand_id"] = kwargs["item_brand_id"]
        if "item_category" in kwargs:
            update_data["item_category"] = kwargs["item_category"]
        if "item_sizes" in kwargs:
            update_data["item_sizes"] = kwargs["item_sizes"] or []
        if "item_colors" in kwargs:
            update_data["item_colors"] = kwargs["item_colors"] or []
        # 论坛帖子专用字段
        if "community_id" in kwargs:
            update_data["community_id"] = kwargs["community_id"]

        self.db.table("posts").update(update_data).eq("id", post_id).execute()

        if update_data.get("status") == "PUBLISHED":
            from app.services.grading_service import grade_post_async
            grade_post_async(post_id)

        return self.get_post_by_id(post_id, user_id)

    def delete_post(self, post_id: int, user_id: int) -> bool:
        """删除帖子"""
        result = (
            self.db.table("posts")
            .delete()
            .eq("id", post_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)

    def like_post(self, post_id: int, user_id: int) -> bool:
        """点赞帖子"""
        try:
            self.db.table("post_likes").insert(
                {"post_id": post_id, "user_id": user_id}
            ).execute()
            # 更新点赞数
            self.db.rpc(
                "increment_post_like_count", {"post_id_param": post_id}
            ).execute()

            # 发送通知
            self._send_like_notification(post_id, user_id)

            # 等级规则引擎: post_liked 计数器 +1
            from app.services.level_service import level_service
            from app.schemas.level import LevelAction
            level_service.record_action(user_id, LevelAction.POST_LIKED)

            return True
        except:
            return False

    def _send_like_notification(self, post_id: int, liker_id: int):
        """发送点赞通知"""
        try:
            # 获取帖子信息
            post_result = (
                self.db.table("posts")
                .select("user_id, title, image_urls")
                .eq("id", post_id)
                .execute()
            )
            if not post_result.data:
                return

            post = post_result.data[0]
            post_owner_id = post["user_id"]

            # 不给自己发通知
            if post_owner_id == liker_id:
                return

            # 获取点赞者信息
            liker_result = (
                self.db.table("users").select("username").eq("id", liker_id).execute()
            )
            liker_name = (
                liker_result.data[0]["username"] if liker_result.data else "用户"
            )

            # 获取点赞者头像
            liker_avatar_result = (
                self.db.table("user_info")
                .select("avatar_url")
                .eq("user_id", liker_id)
                .execute()
            )
            liker_avatar = (
                liker_avatar_result.data[0]["avatar_url"]
                if liker_avatar_result.data
                else None
            )

            # 获取帖子第一张图片
            post_image = (
                post.get("image_urls", [])[0] if post.get("image_urls") else None
            )

            notification_service.notify_post_liked(
                post_owner_id=post_owner_id,
                liker_id=liker_id,
                liker_name=liker_name,
                post_id=post_id,
                post_title=post["title"],
                liker_avatar=liker_avatar,
                post_image=post_image,
            )
        except Exception as e:
            print(f"Failed to send like notification: {e}")

    def unlike_post(self, post_id: int, user_id: int) -> bool:
        """取消点赞"""
        result = (
            self.db.table("post_likes")
            .delete()
            .eq("post_id", post_id)
            .eq("user_id", user_id)
            .execute()
        )
        if result.data:
            # 更新点赞数
            self.db.rpc(
                "decrement_post_like_count", {"post_id_param": post_id}
            ).execute()
            return True
        return False

    def favorite_post(self, post_id: int, user_id: int) -> bool:
        """收藏帖子"""
        try:
            self.db.table("post_favorites").insert(
                {"post_id": post_id, "user_id": user_id}
            ).execute()
            # 更新收藏数
            self.db.rpc(
                "increment_post_favorite_count", {"post_id_param": post_id}
            ).execute()
            return True
        except:
            return False

    def unfavorite_post(self, post_id: int, user_id: int) -> bool:
        """取消收藏"""
        result = (
            self.db.table("post_favorites")
            .delete()
            .eq("post_id", post_id)
            .eq("user_id", user_id)
            .execute()
        )
        if result.data:
            # 更新收藏数
            self.db.rpc(
                "decrement_post_favorite_count", {"post_id_param": post_id}
            ).execute()
            return True
        return False

    def want_post(self, post_id: int, user_id: int) -> bool:
        """标记想要"""
        try:
            self.db.table("post_wants").insert(
                {"post_id": post_id, "user_id": user_id}
            ).execute()
            self.db.rpc(
                "increment_post_want_count", {"post_id_param": post_id}
            ).execute()

            # 等级规则引擎: want_clicked 计数器 +1
            from app.services.level_service import level_service
            from app.schemas.level import LevelAction
            level_service.record_action(user_id, LevelAction.WANT_CLICKED)
            return True
        except:
            return False

    def unwant_post(self, post_id: int, user_id: int) -> bool:
        """取消想要"""
        result = (
            self.db.table("post_wants")
            .delete()
            .eq("post_id", post_id)
            .eq("user_id", user_id)
            .execute()
        )
        if result.data:
            self.db.rpc(
                "decrement_post_want_count", {"post_id_param": post_id}
            ).execute()
            return True
        return False

    def get_wanted_posts_by_user_id(
        self, user_id: int, current_user_id: Optional[int] = None
    ) -> List[Post]:
        """获取用户愿望单（标记想要的帖子列表）"""
        result = (
            self.db.table("post_wants")
            .select("post_id, posts(*)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )

        posts = []
        for item in result.data or []:
            p = item.get("posts")
            if p:
                posts.append(self._format_post(p, current_user_id))
        return posts

    def get_posts_by_user_id(
        self, user_id: int, status: str = None, current_user_id: Optional[int] = None
    ) -> List[Post]:
        """获取用户的帖子列表"""
        query = self.db.table("posts").select("*").eq("user_id", user_id)
        if status:
            query = query.eq("status", status)
        result = query.order("created_at", desc=True).execute()
        return [self._format_post(p, current_user_id) for p in result.data or []]

    def get_liked_posts_by_user_id(
        self, user_id: int, current_user_id: Optional[int] = None
    ) -> List[Post]:
        """获取用户点赞的帖子列表"""
        result = (
            self.db.table("post_likes")
            .select("post_id, posts(*)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )

        posts = []
        for item in result.data or []:
            p = item.get("posts")
            if p:
                posts.append(self._format_post(p, current_user_id))
        return posts

    def get_favorite_posts_by_user_id(
        self, user_id: int, current_user_id: Optional[int] = None
    ) -> List[Post]:
        """获取用户收藏的帖子列表"""
        result = (
            self.db.table("post_favorites")
            .select("post_id, posts(*)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )

        posts = []
        for item in result.data or []:
            p = item.get("posts")
            if p:
                posts.append(self._format_post(p, current_user_id))
        return posts

    def get_posts_by_show_id(
        self, show_id: int, current_user_id: Optional[int] = None
    ) -> List[Post]:
        """获取某个秀场关联的帖子（通过 show_ids 数组查询）"""
        show_id_str = str(show_id)
        blocked_ids = self._get_blocked_user_ids(current_user_id)
        result = (
            self.db.table("posts")
            .select("*")
            .contains("show_ids", [show_id_str])
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .order("created_at", desc=True)
            .execute()
        )
        filtered = self._filter_blocked(result.data or [], blocked_ids)
        return [self._format_post(p, current_user_id) for p in filtered]

    def get_posts_by_show_id_str(
        self, show_id: str, current_user_id: Optional[int] = None
    ) -> List[Post]:
        """获取某个秀场关联的帖子（通过 show_ids 数组查询，支持字符串ID）"""
        print(f"Searching for posts with show_id: {show_id}")
        blocked_ids = self._get_blocked_user_ids(current_user_id)
        result = (
            self.db.table("posts")
            .select("*")
            .contains("show_ids", [show_id])
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .order("created_at", desc=True)
            .execute()
        )
        filtered = self._filter_blocked(result.data or [], blocked_ids)
        print(f"Found {len(filtered)} posts for show_id: {show_id}")
        return [self._format_post(p, current_user_id) for p in filtered]

    def get_posts_by_brand_id(
        self, brand_id: int, current_user_id: Optional[int] = None, limit: int = 50
    ) -> List[Post]:
        """
        获取某个品牌关联的所有帖子（通过 brand_ids 数组查询）
        直接查询 brand_ids 数组中包含该品牌 ID 的帖子
        """
        blocked_ids = self._get_blocked_user_ids(current_user_id)
        result = (
            self.db.table("posts")
            .select("*")
            .contains("brand_ids", [str(brand_id)])
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        filtered = self._filter_blocked(result.data or [], blocked_ids)
        return [self._format_post(p, current_user_id) for p in filtered]

    def get_posts_by_brand_name(
        self, brand_name: str, current_user_id: Optional[int] = None, limit: int = 50
    ) -> List[Post]:
        """
        获取某个品牌相关的所有帖子
        通过查询该品牌的所有秀场 ID，然后获取关联这些秀场的帖子
        """
        from app.services.show_service import show_service
        
        # 获取该品牌的所有秀场 ID
        shows = show_service.get_shows_by_brand(brand_name)
        if not shows:
            return []
        
        show_ids = [str(show.id) for show in shows]
        show_ids_array = "{" + ",".join(f'"{sid}"' for sid in show_ids) + "}"

        blocked_ids = self._get_blocked_user_ids(current_user_id)
        result = (
            self.db.table("posts")
            .select("*")
            .filter("show_ids", "ov", show_ids_array)
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        filtered = self._filter_blocked(result.data or [], blocked_ids)
        return [self._format_post(p, current_user_id) for p in filtered]

    def _sanitize_search_keyword(self, keyword: str) -> str:
        """
        清理搜索关键词，转义可能导致 PostgREST 查询失败的特殊字符
        """
        # 转义 PostgREST/PostgreSQL LIKE 模式中的特殊字符
        # % 和 _ 是 LIKE 通配符，需要转义
        # 其他特殊字符如 \, ', " 等也需要处理
        sanitized = keyword.replace("\\", "\\\\")  # 先转义反斜杠
        sanitized = sanitized.replace("%", "\\%")  # 转义百分号
        sanitized = sanitized.replace("_", "\\_")  # 转义下划线
        # 移除可能破坏查询的字符
        sanitized = sanitized.replace(",", " ")  # 逗号会影响 or_ 语法
        sanitized = sanitized.replace(".", " ")  # 点号会影响 PostgREST 语法
        return sanitized.strip()

    def search_posts(
        self, keyword: str, limit: int = 20, offset: int = 0, current_user_id: Optional[int] = None
    ) -> dict:
        """
        搜索帖子（支持标题、内容、作者名搜索）
        仅返回已发布且审核通过的帖子
        返回 { "posts": [...], "total": N }
        """
        safe_keyword = self._sanitize_search_keyword(keyword)
        if not safe_keyword:
            return {"posts": [], "total": 0}

        blocked_ids = self._get_blocked_user_ids(current_user_id)

        try:
            result = (
                self.db.table("posts")
                .select("*")
                .eq("status", "PUBLISHED")
                .eq("audit_status", "APPROVED")
                .or_(
                    f"title.ilike.*{safe_keyword}*,content_text.ilike.*{safe_keyword}*"
                )
                .order("created_at", desc=True)
                .execute()
            )

            posts_from_content = [
                self._format_post(p, current_user_id)
                for p in result.data or []
                if p["user_id"] not in blocked_ids
            ]
            post_ids = {p.id for p in posts_from_content}

            user_result = (
                self.db.table("users")
                .select("id")
                .ilike("username", f"*{safe_keyword}*")
                .execute()
            )

            if user_result.data:
                user_ids = [
                    u["id"] for u in user_result.data
                    if u["id"] not in blocked_ids
                ]
                for user_id in user_ids:
                    user_posts_result = (
                        self.db.table("posts")
                        .select("*")
                        .eq("user_id", user_id)
                        .eq("status", "PUBLISHED")
                        .eq("audit_status", "APPROVED")
                        .order("created_at", desc=True)
                        .execute()
                    )
                    for p in user_posts_result.data or []:
                        if p["id"] not in post_ids:
                            posts_from_content.append(
                                self._format_post(p, current_user_id)
                            )
                            post_ids.add(p["id"])

            posts_from_content.sort(key=lambda x: x.createdAt, reverse=True)
            total = len(posts_from_content)
            paginated = posts_from_content[offset:offset + limit]
            return {"posts": paginated, "total": total}
        except Exception as e:
            print(f"Search posts error: {e}")
            return {"posts": [], "total": 0}

    def get_posts_by_community_id(
        self, community_id: int, current_user_id: Optional[int] = None
    ) -> List[Post]:
        """获取某个社区的帖子"""
        blocked_ids = self._get_blocked_user_ids(current_user_id)
        result = (
            self.db.table("posts")
            .select("*")
            .eq("community_id", community_id)
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .order("created_at", desc=True)
            .execute()
        )
        filtered = self._filter_blocked(result.data or [], blocked_ids)
        return [self._format_post(p, current_user_id) for p in filtered]

    def get_forum_posts(
        self, current_user_id: Optional[int] = None, limit: int = 50
    ) -> List[Post]:
        """获取所有论坛帖子（有 community_id 的帖子，仅已发布且审核通过的）"""
        blocked_ids = self._get_blocked_user_ids(current_user_id)
        result = (
            self.db.table("posts")
            .select("*")
            .not_.is_("community_id", "null")
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        filtered = self._filter_blocked(result.data or [], blocked_ids)
        return [self._format_post(p, current_user_id) for p in filtered]

    def _load_recommend_config(self) -> dict:
        """从 app_config 加载推荐配置，缺失字段用默认值补全。

        Tolerates three failure modes so the recommendation pipeline never
        crashes on a cold-start database:
          1. `app_config` table missing (PostgREST 404).
          2. No row for `recommend_config` (maybe_single may return None or raise).
          3. Saved JSON missing/partial sections (e.g. older schema).
        """
        saved = None
        try:
            result = (
                self.db.table("app_config")
                .select("value")
                .eq("key", "recommend_config")
                .maybe_single()
                .execute()
            )
            if result is not None and getattr(result, "data", None):
                saved = result.data.get("value") or None
        except Exception as e:
            print(f"[RecommendConfig] Failed to load, using defaults: {e}")

        merged = {}
        for section, defaults in DEFAULT_RECOMMEND_CONFIG.items():
            section_saved = (saved or {}).get(section) if isinstance(saved, dict) else None
            if isinstance(defaults, dict):
                merged[section] = {**defaults, **(section_saved or {})}
            else:
                merged[section] = section_saved if section_saved is not None else defaults
        return merged

    def _sort_by_grade_and_time(self, posts: list) -> list:
        """按 grade 升序（A 优先）、同级按 created_at 倒序"""
        result = list(posts)
        result.sort(key=lambda p: p.get("created_at") or "", reverse=True)
        result.sort(key=lambda p: GRADE_PRIORITY.get(p.get("grade"), 99))
        return result

    def _get_cold_start_posts(
        self, current_user_id: Optional[int], blocked_ids: set, limit: int,
        cfg: dict = None,
    ) -> List[Post]:
        """冷启动：近 N 天指定级别帖子，按互动量（点赞+收藏+评论）排序"""
        cs = (cfg or DEFAULT_RECOMMEND_CONFIG)["cold_start"]
        seven_days_ago = (
            datetime.now(timezone.utc) - timedelta(days=cs["days"])
        ).isoformat()

        result = (
            self.db.table("posts")
            .select("*")
            .is_("community_id", "null")
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .in_("grade", cs["grades"])
            .gte("created_at", seven_days_ago)
            .order("created_at", desc=True)
            .limit(limit * 2)
            .execute()
        )
        filtered = self._filter_blocked(result.data or [], blocked_ids)

        filtered.sort(
            key=lambda p: (
                (p.get("like_count") or 0)
                + (p.get("favorite_count") or 0)
                + (p.get("comment_count") or 0)
            ),
            reverse=True,
        )
        return [self._format_post(p, current_user_id) for p in filtered[:limit]]

    def _fetch_core_pool(
        self, followed_brand_ids: List[int], blocked_ids: set, limit: int,
        cfg: dict = None,
    ) -> list:
        """核心池：用户关注品牌的指定级别帖子"""
        grades = (cfg or DEFAULT_RECOMMEND_CONFIG)["core_pool"]["grades"]
        brand_ids_pg = "{" + ",".join(str(bid) for bid in followed_brand_ids) + "}"
        result = (
            self.db.table("posts")
            .select("*")
            .filter("brand_ids", "ov", brand_ids_pg)
            .is_("community_id", "null")
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .in_("grade", grades)
            .order("created_at", desc=True)
            .limit(limit * 2)
            .execute()
        )
        filtered = self._filter_blocked(result.data or [], blocked_ids)
        return self._sort_by_grade_and_time(filtered)[:limit]

    def _fetch_discovery_pool(
        self,
        followed_brand_ids: List[int],
        blocked_ids: set,
        limit: int,
        seen_ids: set,
        cfg: dict = None,
    ) -> list:
        """发现池：关注品牌所属品类下其他品牌的帖子（通过 shows.category 关联）"""
        if not (cfg or DEFAULT_RECOMMEND_CONFIG)["discovery_pool"]["enabled"]:
            return []

        brands_result = (
            self.db.table("brands")
            .select("name")
            .in_("id", followed_brand_ids)
            .execute()
        )
        followed_names = {b["name"] for b in brands_result.data or []}
        if not followed_names:
            return []

        shows_result = (
            self.db.table("shows")
            .select("category")
            .in_("brand_name", list(followed_names))
            .execute()
        )
        categories = {
            s["category"] for s in shows_result.data or [] if s.get("category")
        }
        if not categories:
            return []

        cat_shows_result = (
            self.db.table("shows")
            .select("brand_name")
            .in_("category", list(categories))
            .execute()
        )
        other_names = {
            s["brand_name"]
            for s in cat_shows_result.data or []
            if s.get("brand_name") and s["brand_name"] not in followed_names
        }
        if not other_names:
            return []

        other_brands_result = (
            self.db.table("brands")
            .select("id")
            .in_("name", list(other_names))
            .execute()
        )
        other_brand_ids = [b["id"] for b in other_brands_result.data or []]
        if not other_brand_ids:
            return []

        brand_ids_pg = "{" + ",".join(str(bid) for bid in other_brand_ids) + "}"
        result = (
            self.db.table("posts")
            .select("*")
            .filter("brand_ids", "ov", brand_ids_pg)
            .is_("community_id", "null")
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .order("created_at", desc=True)
            .limit(limit * 3)
            .execute()
        )
        filtered = self._filter_blocked(result.data or [], blocked_ids)
        deduped = [p for p in filtered if p["id"] not in seen_ids]
        return self._sort_by_grade_and_time(deduped)[:limit]

    def _fetch_random_pool(
        self, blocked_ids: set, limit: int, seen_ids: set,
        cfg: dict = None,
    ) -> list:
        """随机池：全站其他品类的随机优质帖子"""
        grades = (cfg or DEFAULT_RECOMMEND_CONFIG)["random_pool"]["grades"]
        result = (
            self.db.table("posts")
            .select("*")
            .is_("community_id", "null")
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .in_("grade", grades)
            .order("created_at", desc=True)
            .limit(limit * 5)
            .execute()
        )
        filtered = self._filter_blocked(result.data or [], blocked_ids)
        deduped = [p for p in filtered if p["id"] not in seen_ids]

        if len(deduped) > limit:
            deduped = random.sample(deduped, limit)

        return self._sort_by_grade_and_time(deduped)

    def get_recommend_posts(
        self, current_user_id: Optional[int] = None, limit: int = 50
    ) -> List[Post]:
        """
        基于规则引擎的推荐帖子（参数从 app_config 动态加载）

        分发比例、评级筛选、冷启动天数均可通过管理后台调整
        """
        cfg = self._load_recommend_config()
        blocked_ids = self._get_blocked_user_ids(current_user_id)

        followed_brand_ids: List[int] = []
        if current_user_id:
            follow_result = (
                self.db.table("brand_follows")
                .select("brand_id")
                .eq("user_id", current_user_id)
                .execute()
            )
            followed_brand_ids = [f["brand_id"] for f in follow_result.data or []]

        if not followed_brand_ids:
            return self._get_cold_start_posts(
                current_user_id, blocked_ids, limit, cfg
            )

        ratios = cfg["pool_ratios"]
        core_limit = max(1, round(limit * ratios["core"]))
        discover_limit = max(1, round(limit * ratios["discovery"]))
        random_limit = limit - core_limit - discover_limit

        seen_ids: set = set()

        core_posts = self._fetch_core_pool(
            followed_brand_ids, blocked_ids, core_limit, cfg
        )
        seen_ids.update(p["id"] for p in core_posts)

        discover_posts = self._fetch_discovery_pool(
            followed_brand_ids, blocked_ids, discover_limit, seen_ids, cfg
        )
        seen_ids.update(p["id"] for p in discover_posts)

        random_posts = self._fetch_random_pool(
            blocked_ids, random_limit, seen_ids, cfg
        )

        all_raw = core_posts + discover_posts + random_posts
        return [self._format_post(p, current_user_id) for p in all_raw]

    def get_following_posts(
        self, current_user_id: int, limit: int = 50
    ) -> List[Post]:
        """获取关注用户的帖子（当前用户关注的人发布的非论坛帖子）"""
        follow_result = (
            self.db.table("user_follows")
            .select("following_id")
            .eq("follower_id", current_user_id)
            .execute()
        )
        following_ids = [f["following_id"] for f in follow_result.data or []]
        if not following_ids:
            return []

        blocked_ids = self._get_blocked_user_ids(current_user_id)
        if blocked_ids:
            following_ids = [fid for fid in following_ids if fid not in blocked_ids]
            if not following_ids:
                return []

        result = (
            self.db.table("posts")
            .select("*")
            .in_("user_id", following_ids)
            .is_("community_id", "null")
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [self._format_post(p, current_user_id) for p in result.data or []]


# 单例
post_service = PostService()
