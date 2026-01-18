"""
管理员服务
"""
from typing import List, Optional
from app.db.supabase import get_supabase, get_supabase_admin
from app.schemas.post import Post
from app.schemas.comment import PostComment
from app.services.post_service import post_service


class AdminService:
    def __init__(self):
        self.db = get_supabase()
        self.db_admin = get_supabase_admin()

    # ==================== 帖子管理 ====================

    def get_pending_posts(self) -> List[Post]:
        """获取待审核帖子列表"""
        result = self.db.table("posts").select("*").eq("status", "PUBLISHED").eq("audit_status", "PENDING").order("created_at", desc=True).execute()
        return [post_service._format_post(p) for p in result.data or []]

    def approve_post(self, post_id: int, remark: str = None) -> bool:
        """审核通过帖子"""
        result = self.db.table("posts").update({
            "audit_status": "APPROVED"
        }).eq("id", post_id).execute()
        return bool(result.data)

    def reject_post(self, post_id: int, remark: str = None) -> bool:
        """审核拒绝帖子"""
        result = self.db.table("posts").update({
            "audit_status": "REJECTED"
        }).eq("id", post_id).execute()
        return bool(result.data)

    def admin_delete_post(self, post_id: int) -> bool:
        """管理员删除帖子（不需要验证用户）"""
        # 直接删除帖子，关联数据（点赞、收藏、评论）通过数据库级联删除
        result = self.db.table("posts").delete().eq("id", post_id).execute()
        return bool(result.data)

    # ==================== 用户管理 ====================

    def delete_user(self, user_id: int) -> bool:
        """删除用户及其所有关联数据"""
        # 使用管理员客户端删除用户
        # 级联删除会自动清理关联数据
        result = self.db_admin.table("users").delete().eq("id", user_id).execute()
        return bool(result.data)

    # ==================== 评论管理 ====================

    def _format_admin_comment(self, comment_data: dict) -> dict:
        """格式化评论数据（管理员视角，包含帖子信息）"""
        # 获取用户名
        username = ""
        user_result = self.db.table("users").select("username").eq("id", comment_data["user_id"]).execute()
        if user_result.data:
            username = user_result.data[0]["username"]
        
        # 获取帖子标题
        post_title = ""
        post_result = self.db.table("posts").select("title").eq("id", comment_data["post_id"]).execute()
        if post_result.data:
            post_title = post_result.data[0].get("title", "")
        
        return {
            "id": comment_data["id"],
            "postId": comment_data["post_id"],
            "postTitle": post_title,
            "userId": comment_data["user_id"],
            "username": username,
            "content": comment_data["content"],
            "likeCount": comment_data.get("like_count", 0),
            "createdAt": comment_data["created_at"],
            "updatedAt": comment_data["updated_at"]
        }

    def get_all_comments(self, page: int = 1, page_size: int = 20) -> dict:
        """获取所有评论（分页）"""
        offset = (page - 1) * page_size
        
        # 获取总数
        count_result = self.db.table("post_comments").select("id", count="exact").execute()
        total = count_result.count or 0
        
        # 获取分页数据
        result = self.db.table("post_comments").select("*").order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
        
        comments = [self._format_admin_comment(c) for c in result.data or []]
        
        return {
            "comments": comments,
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size if total > 0 else 0
        }

    def admin_delete_comment(self, comment_id: int) -> bool:
        """管理员删除评论（不需要验证用户）"""
        # 获取评论信息以更新帖子评论数
        comment_result = self.db.table("post_comments").select("post_id").eq("id", comment_id).execute()
        if not comment_result.data:
            return False
        
        post_id = comment_result.data[0]["post_id"]
        
        # 删除评论
        result = self.db.table("post_comments").delete().eq("id", comment_id).execute()
        if result.data:
            # 更新帖子评论数
            try:
                self.db.rpc("decrement_post_comment_count", {"post_id_param": post_id}).execute()
            except:
                pass  # 忽略更新评论数失败
            return True
        return False

    def get_comments_by_post(self, post_id: int) -> List[dict]:
        """获取指定帖子的所有评论"""
        result = self.db.table("post_comments").select("*").eq("post_id", post_id).order("created_at", desc=True).execute()
        return [self._format_admin_comment(c) for c in result.data or []]

    def get_comments_by_user(self, user_id: int) -> List[dict]:
        """获取指定用户的所有评论"""
        result = self.db.table("post_comments").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return [self._format_admin_comment(c) for c in result.data or []]


# 单例
admin_service = AdminService()
