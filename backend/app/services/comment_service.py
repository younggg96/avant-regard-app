"""
评论服务
"""
from typing import Optional, List, Dict
from app.db.supabase import get_supabase
from app.schemas.comment import PostComment, CommentReply, ImageReview


class CommentService:
    def __init__(self):
        self.db = get_supabase()

    def _get_user_info(self, user_id: int) -> Dict:
        """获取用户信息（用户名和头像）"""
        user_result = self.db.table("users").select("username").eq("id", user_id).execute()
        user_info_result = self.db.table("user_info").select("avatar_url").eq("user_id", user_id).execute()
        
        username = user_result.data[0]["username"] if user_result.data else ""
        avatar_url = user_info_result.data[0]["avatar_url"] if user_info_result.data else None
        
        return {"username": username, "avatar_url": avatar_url}

    def _format_reply(self, reply_data: dict, user_info_cache: Dict[int, Dict]) -> CommentReply:
        """格式化回复数据"""
        user_id = reply_data["user_id"]
        
        # 从缓存获取用户信息
        if user_id not in user_info_cache:
            user_info_cache[user_id] = self._get_user_info(user_id)
        
        user_info = user_info_cache[user_id]
        
        # 获取被回复用户的用户名
        reply_to_username = None
        reply_to_user_id = reply_data.get("reply_to_user_id")
        if reply_to_user_id:
            if reply_to_user_id not in user_info_cache:
                user_info_cache[reply_to_user_id] = self._get_user_info(reply_to_user_id)
            reply_to_username = user_info_cache[reply_to_user_id]["username"]
        
        return CommentReply(
            id=reply_data["id"],
            postId=reply_data["post_id"],
            parentId=reply_data["parent_id"],
            userId=user_id,
            username=user_info["username"],
            userAvatar=user_info["avatar_url"],
            replyToUserId=reply_to_user_id,
            replyToUsername=reply_to_username,
            content=reply_data["content"],
            likeCount=reply_data.get("like_count", 0),
            createdAt=reply_data["created_at"],
            updatedAt=reply_data["updated_at"]
        )

    def _format_comment(self, comment_data: dict, replies: List[dict] = None, user_info_cache: Dict[int, Dict] = None) -> PostComment:
        """格式化评论数据"""
        if user_info_cache is None:
            user_info_cache = {}
        
        user_id = comment_data["user_id"]
        
        # 从缓存获取用户信息
        if user_id not in user_info_cache:
            user_info_cache[user_id] = self._get_user_info(user_id)
        
        user_info = user_info_cache[user_id]
        
        # 格式化回复
        formatted_replies = []
        if replies:
            formatted_replies = [self._format_reply(r, user_info_cache) for r in replies]
        
        return PostComment(
            id=comment_data["id"],
            postId=comment_data["post_id"],
            userId=user_id,
            username=user_info["username"],
            userAvatar=user_info["avatar_url"],
            content=comment_data["content"],
            likeCount=comment_data.get("like_count", 0),
            replyCount=comment_data.get("reply_count", 0),
            replies=formatted_replies,
            createdAt=comment_data["created_at"],
            updatedAt=comment_data["updated_at"]
        )

    def get_post_comments(self, post_id: int, include_replies: bool = True) -> List[PostComment]:
        """获取帖子评论（包含回复）"""
        # 获取顶级评论（parent_id 为空）
        result = self.db.table("post_comments").select("*").eq("post_id", post_id).is_("parent_id", "null").order("created_at", desc=True).execute()
        
        if not result.data:
            return []
        
        user_info_cache = {}
        comments = []
        
        for comment_data in result.data:
            replies = []
            if include_replies:
                # 获取该评论的回复
                replies_result = self.db.table("post_comments").select("*").eq("parent_id", comment_data["id"]).order("created_at", desc=False).execute()
                replies = replies_result.data or []
            
            comments.append(self._format_comment(comment_data, replies, user_info_cache))
        
        return comments

    def get_comment_replies(self, comment_id: int) -> List[CommentReply]:
        """获取评论的所有回复"""
        result = self.db.table("post_comments").select("*").eq("parent_id", comment_id).order("created_at", desc=False).execute()
        
        user_info_cache = {}
        return [self._format_reply(r, user_info_cache) for r in result.data or []]

    def create_comment(self, post_id: int, user_id: int, content: str, parent_id: int = None, reply_to_user_id: int = None) -> Optional[PostComment]:
        """创建评论或回复"""
        insert_data = {
            "post_id": post_id,
            "user_id": user_id,
            "content": content
        }
        
        if parent_id:
            insert_data["parent_id"] = parent_id
        if reply_to_user_id:
            insert_data["reply_to_user_id"] = reply_to_user_id
        
        result = self.db.table("post_comments").insert(insert_data).execute()
        
        if not result.data:
            return None
        
        # 更新帖子评论数
        self.db.rpc("increment_post_comment_count", {"post_id_param": post_id}).execute()
        
        # 如果是回复，更新父评论的回复数
        if parent_id:
            parent_comment = self.db.table("post_comments").select("reply_count").eq("id", parent_id).execute()
            if parent_comment.data:
                current_count = parent_comment.data[0].get("reply_count", 0) or 0
                self.db.table("post_comments").update({
                    "reply_count": current_count + 1
                }).eq("id", parent_id).execute()
        
        return self._format_comment(result.data[0])

    def like_comment(self, comment_id: int, user_id: int) -> bool:
        """点赞评论"""
        try:
            self.db.table("comment_likes").insert({
                "comment_id": comment_id,
                "user_id": user_id
            }).execute()
            # 更新点赞数
            self.db.table("post_comments").update({
                "like_count": self.db.table("post_comments").select("like_count").eq("id", comment_id).execute().data[0]["like_count"] + 1
            }).eq("id", comment_id).execute()
            return True
        except:
            return False

    def unlike_comment(self, comment_id: int, user_id: int) -> bool:
        """取消点赞评论"""
        result = self.db.table("comment_likes").delete().eq("comment_id", comment_id).eq("user_id", user_id).execute()
        if result.data:
            # 更新点赞数
            current = self.db.table("post_comments").select("like_count").eq("id", comment_id).execute().data[0]["like_count"]
            self.db.table("post_comments").update({
                "like_count": max(0, current - 1)
            }).eq("id", comment_id).execute()
            return True
        return False

    def delete_comment(self, comment_id: int, user_id: int) -> bool:
        """删除评论或回复"""
        # 获取评论信息
        comment_result = self.db.table("post_comments").select("post_id, parent_id").eq("id", comment_id).eq("user_id", user_id).execute()
        if not comment_result.data:
            return False
        
        post_id = comment_result.data[0]["post_id"]
        parent_id = comment_result.data[0].get("parent_id")
        
        # 如果是顶级评论，先获取其回复数量以便后续更新帖子评论总数
        reply_count = 0
        if not parent_id:
            reply_result = self.db.table("post_comments").select("id").eq("parent_id", comment_id).execute()
            reply_count = len(reply_result.data) if reply_result.data else 0
        
        # 删除评论（级联删除会自动删除其回复）
        result = self.db.table("post_comments").delete().eq("id", comment_id).eq("user_id", user_id).execute()
        if result.data:
            # 更新帖子评论数（包括被删除的回复数量）
            for _ in range(1 + reply_count):
                self.db.rpc("decrement_post_comment_count", {"post_id_param": post_id}).execute()
            
            # 如果是回复，更新父评论的回复数
            if parent_id:
                parent_comment = self.db.table("post_comments").select("reply_count").eq("id", parent_id).execute()
                if parent_comment.data:
                    current_count = parent_comment.data[0].get("reply_count", 0) or 0
                    self.db.table("post_comments").update({
                        "reply_count": max(0, current_count - 1)
                    }).eq("id", parent_id).execute()
            
            return True
        return False

    # ==================== 秀场图片评论 ====================

    def _format_image_review(self, review_data: dict) -> ImageReview:
        """格式化秀场图片评论数据"""
        username = ""
        user_result = self.db.table("users").select("username").eq("id", review_data["user_id"]).execute()
        if user_result.data:
            username = user_result.data[0]["username"]
        
        return ImageReview(
            id=review_data["id"],
            userId=review_data["user_id"],
            username=username,
            imageId=review_data["image_id"],
            rating=review_data["rating"],
            content=review_data["content"],
            createdAt=review_data["created_at"],
            updatedAt=review_data["updated_at"]
        )

    def get_image_reviews(self, image_id: int) -> List[ImageReview]:
        """获取秀场图片评论"""
        result = self.db.table("show_image_reviews").select("*").eq("image_id", image_id).order("created_at", desc=True).execute()
        return [self._format_image_review(r) for r in result.data or []]

    def create_image_review(self, image_id: int, user_id: int, rating: int, content: str) -> Optional[ImageReview]:
        """创建秀场图片评论"""
        result = self.db.table("show_image_reviews").insert({
            "image_id": image_id,
            "user_id": user_id,
            "rating": rating,
            "content": content
        }).execute()
        
        if not result.data:
            return None
        
        return self._format_image_review(result.data[0])

    def get_user_image_reviews(self, user_id: int) -> List[ImageReview]:
        """获取用户的所有秀场图片评论"""
        result = self.db.table("show_image_reviews").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return [self._format_image_review(r) for r in result.data or []]

    def delete_image_review(self, review_id: int) -> bool:
        """删除秀场图片评论"""
        result = self.db.table("show_image_reviews").delete().eq("id", review_id).execute()
        return bool(result.data)


# 单例
comment_service = CommentService()
