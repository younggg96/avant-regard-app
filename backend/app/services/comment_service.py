"""
评论服务
"""
from typing import Optional, List
from app.db.supabase import get_supabase
from app.schemas.comment import PostComment, ImageReview


class CommentService:
    def __init__(self):
        self.db = get_supabase()

    def _format_comment(self, comment_data: dict) -> PostComment:
        """格式化评论数据"""
        # 获取用户名
        username = ""
        user_result = self.db.table("users").select("username").eq("id", comment_data["user_id"]).execute()
        if user_result.data:
            username = user_result.data[0]["username"]
        
        return PostComment(
            id=comment_data["id"],
            postId=comment_data["post_id"],
            userId=comment_data["user_id"],
            username=username,
            content=comment_data["content"],
            likeCount=comment_data.get("like_count", 0),
            createdAt=comment_data["created_at"],
            updatedAt=comment_data["updated_at"]
        )

    def get_post_comments(self, post_id: int) -> List[PostComment]:
        """获取帖子评论"""
        result = self.db.table("post_comments").select("*").eq("post_id", post_id).order("created_at", desc=True).execute()
        return [self._format_comment(c) for c in result.data or []]

    def create_comment(self, post_id: int, user_id: int, content: str) -> Optional[PostComment]:
        """创建评论"""
        result = self.db.table("post_comments").insert({
            "post_id": post_id,
            "user_id": user_id,
            "content": content
        }).execute()
        
        if not result.data:
            return None
        
        # 更新帖子评论数
        self.db.rpc("increment_post_comment_count", {"post_id_param": post_id}).execute()
        
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
        """删除评论"""
        # 获取评论信息
        comment_result = self.db.table("post_comments").select("post_id").eq("id", comment_id).eq("user_id", user_id).execute()
        if not comment_result.data:
            return False
        
        post_id = comment_result.data[0]["post_id"]
        
        # 删除评论
        result = self.db.table("post_comments").delete().eq("id", comment_id).eq("user_id", user_id).execute()
        if result.data:
            # 更新帖子评论数
            self.db.rpc("decrement_post_comment_count", {"post_id_param": post_id}).execute()
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
