"""
帖子服务
"""

from typing import Optional, List, Union
from app.db.supabase import get_supabase
from app.schemas.post import Post, PostType, PostStatus, AuditStatus
from app.services.notification_service import notification_service


class PostService:
    def __init__(self):
        self.db = get_supabase()

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

        # 检查当前用户是否点赞/收藏
        liked_by_me = False
        favorited_by_me = False
        if current_user_id:
            liked_by_me = self._check_liked(post_data["id"], current_user_id)
            favorited_by_me = self._check_favorited(post_data["id"], current_user_id)

        # 获取 show_ids
        show_ids = post_data.get("show_ids") or []

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

        return Post(
            id=post_data["id"],
            userId=post_data["user_id"],
            username=username,
            postType=post_data["post_type"],
            status=post_data["status"],
            auditStatus=post_data.get("audit_status"),
            title=post_data["title"],
            contentText=post_data.get("content_text", ""),
            imageUrls=post_data.get("image_urls", []),
            likeCount=post_data.get("like_count", 0),
            favoriteCount=post_data.get("favorite_count", 0),
            commentCount=post_data.get("comment_count", 0),
            createdAt=post_data["created_at"],
            updatedAt=post_data["updated_at"],
            productName=post_data.get("product_name"),
            brandName=post_data.get("brand_name"),
            rating=post_data.get("rating"),
            showIds=show_ids,
            communityId=community_id,
            communityName=community_name,
            communitySlug=community_slug,
            likedByMe=liked_by_me,
            favoritedByMe=favorited_by_me,
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

    def get_posts(self, current_user_id: Optional[int] = None) -> List[Post]:
        """获取帖子列表（仅已发布且审核通过的）"""
        result = (
            self.db.table("posts")
            .select("*")
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .order("created_at", desc=True)
            .execute()
        )
        return [self._format_post(p, current_user_id) for p in result.data or []]

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
        product_name: str = None,
        brand_name: str = None,
        rating: int = None,
        show_ids: List[Union[int, str]] = None,
        community_id: int = None,
    ) -> Optional[Post]:
        """创建帖子"""
        # 插入帖子
        insert_data = {
            "user_id": user_id,
            "post_type": post_type,
            "status": post_status,
            "audit_status": "PENDING" if post_status == "PUBLISHED" else None,
            "title": title,
            "content_text": content_text,
            "image_urls": image_urls or [],
            "product_name": product_name,
            "brand_name": brand_name,
            "rating": rating,
            "show_ids": show_ids or [],
            "community_id": community_id,
        }

        result = self.db.table("posts").insert(insert_data).execute()

        if not result.data:
            return None

        post = result.data[0]

        # 更新社区帖子数
        if community_id and post_status == "PUBLISHED":
            try:
                self.db.rpc(
                    "increment_community_post_count", {"community_id_param": community_id}
                ).execute()
            except:
                pass

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
        # 单品评价专用字段
        if "product_name" in kwargs:
            update_data["product_name"] = kwargs["product_name"]
        if "brand_name" in kwargs:
            update_data["brand_name"] = kwargs["brand_name"]
        if "rating" in kwargs:
            update_data["rating"] = kwargs["rating"]
        if "show_ids" in kwargs:
            update_data["show_ids"] = kwargs["show_ids"]
        # 论坛帖子专用字段
        if "community_id" in kwargs:
            update_data["community_id"] = kwargs["community_id"]

        self.db.table("posts").update(update_data).eq("id", post_id).execute()

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
            
            return True
        except:
            return False
    
    def _send_like_notification(self, post_id: int, liker_id: int):
        """发送点赞通知"""
        try:
            # 获取帖子信息
            post_result = self.db.table("posts").select("user_id, title, image_urls").eq("id", post_id).execute()
            if not post_result.data:
                return
            
            post = post_result.data[0]
            post_owner_id = post["user_id"]
            
            # 不给自己发通知
            if post_owner_id == liker_id:
                return
            
            # 获取点赞者信息
            liker_result = self.db.table("users").select("username").eq("id", liker_id).execute()
            liker_name = liker_result.data[0]["username"] if liker_result.data else "用户"
            
            # 获取点赞者头像
            liker_avatar_result = self.db.table("user_info").select("avatar_url").eq("user_id", liker_id).execute()
            liker_avatar = liker_avatar_result.data[0]["avatar_url"] if liker_avatar_result.data else None
            
            # 获取帖子第一张图片
            post_image = post.get("image_urls", [])[0] if post.get("image_urls") else None
            
            notification_service.notify_post_liked(
                post_owner_id=post_owner_id,
                liker_id=liker_id,
                liker_name=liker_name,
                post_id=post_id,
                post_title=post["title"],
                liker_avatar=liker_avatar,
                post_image=post_image
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
        # 使用 PostgreSQL 数组操作符 @> 查询包含指定 show_id 的帖子
        # 注意：show_ids 在数据库中存储为字符串数组，所以需要将 show_id 转为字符串
        result = (
            self.db.table("posts")
            .select("*")
            .contains("show_ids", [str(show_id)])
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .order("created_at", desc=True)
            .execute()
        )
        return [self._format_post(p, current_user_id) for p in result.data or []]

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
        self, keyword: str, limit: int = 50, current_user_id: Optional[int] = None
    ) -> List[Post]:
        """
        搜索帖子（支持标题、内容、作者名搜索）
        仅返回已发布且审核通过的帖子
        """
        # 清理关键词
        safe_keyword = self._sanitize_search_keyword(keyword)
        if not safe_keyword:
            return []
        
        try:
            # 搜索帖子标题和内容
            # 使用 or 条件搜索标题和内容
            result = (
                self.db.table("posts")
                .select("*")
                .eq("status", "PUBLISHED")
                .eq("audit_status", "APPROVED")
                .or_(f"title.ilike.*{safe_keyword}*,content_text.ilike.*{safe_keyword}*")
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            
            posts_from_content = [self._format_post(p, current_user_id) for p in result.data or []]
            post_ids = {p.id for p in posts_from_content}
            
            # 搜索作者名匹配的帖子
            user_result = (
                self.db.table("users")
                .select("id")
                .ilike("username", f"*{safe_keyword}*")
                .execute()
            )
            
            if user_result.data:
                user_ids = [u["id"] for u in user_result.data]
                for user_id in user_ids:
                    user_posts_result = (
                        self.db.table("posts")
                        .select("*")
                        .eq("user_id", user_id)
                        .eq("status", "PUBLISHED")
                        .eq("audit_status", "APPROVED")
                        .order("created_at", desc=True)
                        .limit(limit)
                        .execute()
                    )
                    for p in user_posts_result.data or []:
                        if p["id"] not in post_ids:
                            posts_from_content.append(self._format_post(p, current_user_id))
                            post_ids.add(p["id"])
            
            # 按创建时间排序
            posts_from_content.sort(key=lambda x: x.createdAt, reverse=True)
            return posts_from_content[:limit]
        except Exception as e:
            print(f"Search posts error: {e}")
            return []


    def get_posts_by_community_id(
        self, community_id: int, current_user_id: Optional[int] = None
    ) -> List[Post]:
        """获取某个社区的帖子"""
        result = (
            self.db.table("posts")
            .select("*")
            .eq("community_id", community_id)
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .order("created_at", desc=True)
            .execute()
        )
        return [self._format_post(p, current_user_id) for p in result.data or []]

    def get_forum_posts(
        self, current_user_id: Optional[int] = None
    ) -> List[Post]:
        """获取所有论坛帖子（有 community_id 的帖子，仅已发布且审核通过的）"""
        result = (
            self.db.table("posts")
            .select("*")
            .not_.is_("community_id", "null")  # 有社区 ID 的帖子都算论坛帖子
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .order("created_at", desc=True)
            .execute()
        )
        return [self._format_post(p, current_user_id) for p in result.data or []]


# 单例
post_service = PostService()
