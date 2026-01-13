"""
帖子服务
"""

from typing import Optional, List
from app.db.supabase import get_supabase
from app.schemas.post import Post, PostType, PostStatus, AuditStatus, ShowImageDetail


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

        # 获取关联的秀场图片
        show_images = self._get_post_show_images(post_data["id"])
        show_image_ids = [img.id for img in show_images]

        # 检查当前用户是否点赞/收藏
        liked_by_me = False
        favorited_by_me = False
        if current_user_id:
            liked_by_me = self._check_liked(post_data["id"], current_user_id)
            favorited_by_me = self._check_favorited(post_data["id"], current_user_id)

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
            showImageIds=show_image_ids if show_image_ids else None,
            showImages=show_images if show_images else None,
            likedByMe=liked_by_me,
            favoritedByMe=favorited_by_me,
        )

    def _get_post_show_images(self, post_id: int) -> List[ShowImageDetail]:
        """获取帖子关联的秀场图片"""
        result = (
            self.db.table("post_show_images")
            .select(
                "show_image_id, sort_order, show_images(id, image_url, sort_order, show_id, shows(season, category, city, collection_ts, designer_id, designers(name)))"
            )
            .eq("post_id", post_id)
            .order("sort_order")
            .execute()
        )

        images = []
        for item in result.data or []:
            si = item.get("show_images")
            if si:
                show = si.get("shows", {}) or {}
                designer = show.get("designers", {}) or {}
                images.append(
                    ShowImageDetail(
                        id=si["id"],
                        imageUrl=si["image_url"],
                        sortOrder=si.get("sort_order"),
                        showId=si.get("show_id"),
                        season=show.get("season"),
                        category=show.get("category"),
                        city=show.get("city"),
                        collectionTs=show.get("collection_ts"),
                        designerId=show.get("designer_id"),
                        designerName=designer.get("name"),
                    )
                )
        return images

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
        show_image_ids: List[int] = None,
    ) -> Optional[Post]:
        """创建帖子"""
        # 插入帖子
        result = (
            self.db.table("posts")
            .insert(
                {
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
                }
            )
            .execute()
        )

        if not result.data:
            return None

        post = result.data[0]

        # 关联秀场图片
        if show_image_ids:
            records = [
                {"post_id": post["id"], "show_image_id": sid, "sort_order": i}
                for i, sid in enumerate(show_image_ids)
            ]
            self.db.table("post_show_images").insert(records).execute()

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
            return True
        except:
            return False

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
        """获取某个秀场关联的帖子"""
        # 获取秀场的图片ID
        images_result = (
            self.db.table("show_images").select("id").eq("show_id", show_id).execute()
        )
        image_ids = [img["id"] for img in images_result.data or []]

        if not image_ids:
            return []

        # 获取关联这些图片的帖子
        result = (
            self.db.table("post_show_images")
            .select("post_id, posts(*)")
            .in_("show_image_id", image_ids)
            .execute()
        )

        # 去重并过滤已发布且审核通过的帖子
        seen_ids = set()
        posts = []
        for item in result.data or []:
            p = item.get("posts")
            if p and p["id"] not in seen_ids:
                if p["status"] == "PUBLISHED" and p.get("audit_status") == "APPROVED":
                    seen_ids.add(p["id"])
                    posts.append(self._format_post(p, current_user_id))
        return posts


# 单例
post_service = PostService()
