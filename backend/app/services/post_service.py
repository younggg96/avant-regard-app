"""
帖子服务
"""

from typing import Optional, List
from app.db.supabase import get_supabase
from app.schemas.post import Post, PostType, PostStatus, AuditStatus


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
            showId=post_data.get("show_id"),
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
        show_id: int = None,
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
        }

        # 关联秀场
        if show_id:
            insert_data["show_id"] = show_id

        result = self.db.table("posts").insert(insert_data).execute()

        if not result.data:
            return None

        post = result.data[0]

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
        if "show_id" in kwargs:
            update_data["show_id"] = kwargs["show_id"]

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
        """获取某个秀场关联的帖子（通过 posts.show_id 直接查询）"""
        result = (
            self.db.table("posts")
            .select("*")
            .eq("show_id", show_id)
            .eq("status", "PUBLISHED")
            .eq("audit_status", "APPROVED")
            .order("created_at", desc=True)
            .execute()
        )
        return [self._format_post(p, current_user_id) for p in result.data or []]


# 单例
post_service = PostService()
