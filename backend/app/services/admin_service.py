"""
管理员服务
"""
from typing import List, Optional
from datetime import datetime, timezone
from app.db.supabase import get_supabase, get_supabase_admin
from app.schemas.post import Post
from app.schemas.comment import PostComment
from app.schemas.community import Community, CommunityCategory
from app.schemas.brand import BrandSubmission
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

    # ==================== 社区管理 ====================

    def _format_community(self, data: dict) -> dict:
        """格式化社区数据"""
        return {
            "id": data["id"],
            "name": data["name"],
            "slug": data["slug"],
            "description": data.get("description", ""),
            "iconUrl": data.get("icon_url", ""),
            "coverUrl": data.get("cover_url", ""),
            "category": data.get("category", "GENERAL"),
            "isOfficial": data.get("is_official", False),
            "isActive": data.get("is_active", True),
            "memberCount": data.get("member_count", 0),
            "postCount": data.get("post_count", 0),
            "sortOrder": data.get("sort_order", 0),
            "createdAt": data["created_at"],
            "updatedAt": data["updated_at"],
        }

    def get_all_communities(self, include_inactive: bool = True) -> List[dict]:
        """获取所有社区（管理员可以看到未激活的社区）"""
        query = self.db.table("communities").select("*")
        if not include_inactive:
            query = query.eq("is_active", True)
        result = query.order("sort_order", desc=True).order("created_at", desc=True).execute()
        return [self._format_community(c) for c in result.data or []]

    def get_community_by_id(self, community_id: int) -> Optional[dict]:
        """获取单个社区详情"""
        result = self.db.table("communities").select("*").eq("id", community_id).execute()
        if not result.data:
            return None
        return self._format_community(result.data[0])

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
    ) -> Optional[dict]:
        """创建社区"""
        insert_data = {
            "name": name,
            "slug": slug,
            "description": description,
            "icon_url": icon_url,
            "cover_url": cover_url,
            "category": category,
            "is_official": is_official,
            "sort_order": sort_order,
            "is_active": True,
            "member_count": 0,
            "post_count": 0,
        }
        result = self.db.table("communities").insert(insert_data).execute()
        if not result.data:
            return None
        return self._format_community(result.data[0])

    def update_community(self, community_id: int, **kwargs) -> Optional[dict]:
        """更新社区"""
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
        """删除社区（同时删除关联的帖子和关注记录）"""
        # 先删除该社区下的所有帖子
        self.db.table("posts").delete().eq("community_id", community_id).execute()
        # 删除关注记录
        self.db.table("community_follows").delete().eq("community_id", community_id).execute()
        # 删除社区
        result = self.db.table("communities").delete().eq("id", community_id).execute()
        return bool(result.data)

    # ==================== 社区帖子管理 ====================

    def get_community_posts(
        self, community_id: int, page: int = 1, page_size: int = 20
    ) -> dict:
        """获取社区内的所有帖子（管理员视角，包括未发布/已拒绝的）"""
        offset = (page - 1) * page_size
        
        # 获取总数
        count_result = (
            self.db.table("posts")
            .select("id", count="exact")
            .eq("community_id", community_id)
            .execute()
        )
        total = count_result.count or 0
        
        # 获取分页数据
        result = (
            self.db.table("posts")
            .select("*")
            .eq("community_id", community_id)
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        
        posts = [post_service._format_post(p) for p in result.data or []]
        
        return {
            "posts": [p.model_dump() for p in posts],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size if total > 0 else 0,
        }

    def delete_community_post(self, community_id: int, post_id: int) -> bool:
        """删除社区内的指定帖子"""
        # 验证帖子属于该社区
        post_result = (
            self.db.table("posts")
            .select("id")
            .eq("id", post_id)
            .eq("community_id", community_id)
            .execute()
        )
        if not post_result.data:
            return False
        
        # 删除帖子
        result = self.db.table("posts").delete().eq("id", post_id).execute()
        if result.data:
            # 更新社区帖子数
            try:
                self.db.rpc("decrement_community_post_count", {"community_id_param": community_id}).execute()
            except:
                pass  # 忽略更新失败
            return True
        return False

    def batch_delete_community_posts(self, community_id: int, post_ids: List[int]) -> dict:
        """批量删除社区内的帖子"""
        success_count = 0
        fail_count = 0
        for post_id in post_ids:
            if self.delete_community_post(community_id, post_id):
                success_count += 1
            else:
                fail_count += 1
        return {"successCount": success_count, "failCount": fail_count}

    # ==================== 品牌提交审核 ====================

    def _format_brand_submission(self, data: dict) -> dict:
        """格式化品牌提交记录（管理员视角，包含用户名）"""
        username = ""
        user_result = self.db.table("users").select("username").eq("id", data["user_id"]).execute()
        if user_result.data:
            username = user_result.data[0]["username"]

        return {
            "id": data["id"],
            "userId": data["user_id"],
            "username": username,
            "name": data["name"],
            "category": data.get("category"),
            "foundedYear": data.get("founded_year"),
            "founder": data.get("founder"),
            "country": data.get("country"),
            "website": data.get("website"),
            "coverImage": data.get("cover_image"),
            "status": data.get("status", "PENDING"),
            "rejectReason": data.get("reject_reason"),
            "reviewedAt": data.get("reviewed_at"),
            "createdAt": data.get("created_at"),
            "updatedAt": data.get("updated_at"),
        }

    def get_pending_brand_submissions(self) -> List[dict]:
        """获取待审核品牌提交列表"""
        result = (
            self.db.table("brand_submissions")
            .select("*")
            .eq("status", "PENDING")
            .order("created_at", desc=True)
            .execute()
        )
        return [self._format_brand_submission(s) for s in result.data or []]

    def _insert_brand_with_retry(self, brand_data: dict, max_retries: int = 10):
        """插入品牌，遇到序列冲突时自动重试（每次重试 nextval 会自动前进）"""
        for attempt in range(max_retries):
            try:
                self.db.table("brands").insert(brand_data).execute()
                return
            except Exception as e:
                is_dup_key = "23505" in str(e) or "duplicate key" in str(e).lower()
                if is_dup_key and attempt < max_retries - 1:
                    continue
                raise

    def approve_brand_submission(self, submission_id: int) -> bool:
        """审核通过品牌提交：更新状态并插入 brands 表"""
        result = (
            self.db.table("brand_submissions")
            .select("*")
            .eq("id", submission_id)
            .eq("status", "PENDING")
            .execute()
        )
        if not result.data:
            return False

        submission = result.data[0]
        brand_name = submission["name"]

        existing = (
            self.db.table("brands")
            .select("id")
            .eq("name", brand_name)
            .execute()
        )
        if existing.data:
            self.db.table("brand_submissions").update({
                "status": "APPROVED",
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", submission_id).execute()
            return True

        brand_data = {
            "name": brand_name,
            "category": submission.get("category"),
            "founded_year": submission.get("founded_year"),
            "founder": submission.get("founder"),
            "country": submission.get("country"),
            "website": submission.get("website"),
            "cover_image": submission.get("cover_image"),
        }

        self._insert_brand_with_retry(brand_data)

        self.db.table("brand_submissions").update({
            "status": "APPROVED",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", submission_id).execute()

        return True

    def reject_brand_submission(self, submission_id: int, reason: Optional[str] = None) -> bool:
        """审核拒绝品牌提交"""
        result = (
            self.db.table("brand_submissions")
            .update({
                "status": "REJECTED",
                "reject_reason": reason,
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", submission_id)
            .eq("status", "PENDING")
            .execute()
        )
        return bool(result.data)

    # ==================== 品牌管理 ====================

    def _format_admin_brand(self, data: dict) -> dict:
        """格式化品牌数据（管理员视角）"""
        return {
            "id": data["id"],
            "name": data["name"],
            "category": data.get("category"),
            "foundedYear": data.get("founded_year"),
            "founder": data.get("founder"),
            "country": data.get("country"),
            "website": data.get("website"),
            "coverImage": data.get("cover_image"),
            "createdAt": data.get("created_at"),
            "updatedAt": data.get("updated_at"),
        }

    def get_all_brands_admin(
        self, keyword: Optional[str] = None, page: int = 1, page_size: int = 50
    ) -> dict:
        """获取品牌列表（管理员，支持搜索和分页）"""
        query = self.db.table("brands").select("*", count="exact")

        if keyword and keyword.strip():
            safe = keyword.strip().replace("%", "\\%").replace("_", "\\_")
            query = query.or_(
                f"name.ilike.*{safe}*,founder.ilike.*{safe}*,country.ilike.*{safe}*"
            )

        query = query.order("name")
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)

        result = query.execute()
        total = result.count or 0
        brands = [self._format_admin_brand(b) for b in result.data or []]

        return {
            "brands": brands,
            "total": total,
            "page": page,
            "pageSize": page_size,
        }

    def update_brand(self, brand_id: int, **kwargs) -> Optional[dict]:
        """更新品牌信息"""
        update_data = {}
        field_mapping = {
            "name": "name",
            "category": "category",
            "founded_year": "founded_year",
            "founder": "founder",
            "country": "country",
            "website": "website",
            "cover_image": "cover_image",
        }
        for key, db_field in field_mapping.items():
            if key in kwargs and kwargs[key] is not None:
                update_data[db_field] = kwargs[key]

        if not update_data:
            result = self.db.table("brands").select("*").eq("id", brand_id).execute()
            if not result.data:
                return None
            return self._format_admin_brand(result.data[0])

        self.db.table("brands").update(update_data).eq("id", brand_id).execute()
        result = self.db.table("brands").select("*").eq("id", brand_id).execute()
        if not result.data:
            return None
        return self._format_admin_brand(result.data[0])

    def delete_brand(self, brand_id: int) -> bool:
        """删除品牌"""
        result = self.db.table("brands").delete().eq("id", brand_id).execute()
        return bool(result.data)

    # ==================== 品牌图片审核 ====================

    def _format_brand_image(self, row: dict) -> dict:
        """格式化品牌图片数据"""
        return {
            "id": row["id"],
            "brandId": row["brand_id"],
            "brandName": row.get("brand_name") or "",
            "imageUrl": row["image_url"],
            "sortOrder": row.get("sort_order", 0),
            "status": row.get("status", "PENDING"),
            "isSelected": row.get("is_selected", False),
            "uploadedBy": row.get("uploaded_by"),
            "createdAt": row.get("created_at"),
        }

    def get_pending_brand_images(self) -> list:
        """获取待审核的品牌图片"""
        result = (
            self.db.table("brand_images")
            .select("*, brands(name)")
            .eq("status", "PENDING")
            .order("created_at", desc=True)
            .execute()
        )
        images = []
        for r in result.data:
            r["brand_name"] = r.get("brands", {}).get("name", "") if r.get("brands") else ""
            images.append(self._format_brand_image(r))
        return images

    def approve_brand_image(self, image_id: int) -> dict:
        """审核通过品牌图片"""
        result = (
            self.db.table("brand_images")
            .update({"status": "APPROVED"})
            .eq("id", image_id)
            .execute()
        )
        if not result.data:
            raise Exception("图片不存在")
        return self._format_brand_image(result.data[0])

    def reject_brand_image(self, image_id: int) -> dict:
        """拒绝品牌图片"""
        result = (
            self.db.table("brand_images")
            .update({"status": "REJECTED"})
            .eq("id", image_id)
            .execute()
        )
        if not result.data:
            raise Exception("图片不存在")
        return self._format_brand_image(result.data[0])

    def delete_brand_image(self, image_id: int) -> bool:
        """删除品牌图片"""
        result = self.db.table("brand_images").delete().eq("id", image_id).execute()
        return bool(result.data)

    def admin_upload_brand_image(self, brand_id: int, image_url: str, admin_id: int) -> dict:
        """管理员上传品牌图片（直接 APPROVED + 选中）"""
        result = self.db.table("brand_images").insert({
            "brand_id": brand_id,
            "image_url": image_url,
            "status": "APPROVED",
            "is_selected": True,
            "uploaded_by": admin_id,
        }).execute()
        if not result.data:
            raise Exception("上传图片失败")
        return self._format_brand_image(result.data[0])

    def get_brand_images(self, brand_id: int) -> list:
        """获取品牌的所有已审核图片"""
        result = (
            self.db.table("brand_images")
            .select("*")
            .eq("brand_id", brand_id)
            .eq("status", "APPROVED")
            .order("sort_order")
            .order("created_at")
            .execute()
        )
        return [self._format_brand_image(r) for r in result.data]

    def toggle_brand_image_selected(self, image_id: int, selected: bool) -> dict:
        """切换品牌图片的选中状态"""
        result = (
            self.db.table("brand_images")
            .update({"is_selected": selected})
            .eq("id", image_id)
            .execute()
        )
        if not result.data:
            raise Exception("图片不存在")
        return self._format_brand_image(result.data[0])


# 单例
admin_service = AdminService()
