"""
管理员服务
"""
from typing import List
from app.db.supabase import get_supabase, get_supabase_admin
from app.schemas.post import Post
from app.services.post_service import post_service


class AdminService:
    def __init__(self):
        self.db = get_supabase()
        self.db_admin = get_supabase_admin()

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

    def delete_user(self, user_id: int) -> bool:
        """删除用户及其所有关联数据"""
        # 使用管理员客户端删除用户
        # 级联删除会自动清理关联数据
        result = self.db_admin.table("users").delete().eq("id", user_id).execute()
        return bool(result.data)


# 单例
admin_service = AdminService()
