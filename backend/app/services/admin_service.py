"""
管理员服务
"""
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from app.db.supabase import get_supabase, get_supabase_admin
from app.schemas.post import Post
from app.schemas.comment import PostComment
from app.schemas.community import Community, CommunityCategory
from app.schemas.brand import BrandSubmission
from app.services.post_service import post_service


class AdminService:
    def __init__(self):
        self.db = get_supabase_admin()
        self.db_admin = get_supabase_admin()

    # ==================== 帖子管理 ====================

    def get_pending_posts(self) -> List[Post]:
        """获取待审核帖子列表"""
        result = self.db.table("posts").select("*").eq("status", "PUBLISHED").eq("audit_status", "PENDING").order("created_at", desc=True).execute()
        return [post_service._format_post(p) for p in result.data or []]

    def approve_post(self, post_id: int, remark: str = None) -> bool:
        """手动审核通过帖子（覆盖自动审核结果），并同步更新社区帖子计数"""
        post_result = self.db.table("posts").select("community_id, audit_status, grade").eq("id", post_id).execute()
        was_pending = post_result.data and post_result.data[0].get("audit_status") != "APPROVED"
        community_id = post_result.data[0].get("community_id") if post_result.data else None

        result = self.db.table("posts").update({
            "audit_status": "APPROVED"
        }).eq("id", post_id).execute()

        if result.data and was_pending and community_id:
            try:
                self.db.rpc(
                    "increment_community_post_count",
                    {"community_id_param": community_id},
                ).execute()
            except Exception:
                pass

        return bool(result.data)

    def reject_post(self, post_id: int, remark: str = None) -> bool:
        """审核拒绝帖子，若之前已通过则同步递减社区帖子计数"""
        post_result = self.db.table("posts").select("community_id, audit_status").eq("id", post_id).execute()
        was_approved = post_result.data and post_result.data[0].get("audit_status") == "APPROVED"
        community_id = post_result.data[0].get("community_id") if post_result.data else None

        result = self.db.table("posts").update({
            "audit_status": "REJECTED"
        }).eq("id", post_id).execute()

        if result.data and was_approved and community_id:
            try:
                self.db.rpc(
                    "decrement_community_post_count",
                    {"community_id_param": community_id},
                ).execute()
            except Exception:
                pass

        return bool(result.data)

    def admin_delete_post(self, post_id: int) -> bool:
        """管理员删除帖子（不需要验证用户）"""
        result = self.db.table("posts").delete().eq("id", post_id).execute()
        return bool(result.data)

    def get_all_posts(
        self,
        page: int = 1,
        page_size: int = 20,
        keyword: str = None,
        status: str = None,
        audit_status: str = None,
        post_type: str = None,
    ) -> dict:
        """获取所有帖子（分页、搜索、筛选）"""
        query = self.db.table("posts").select("*", count="exact")

        if status:
            query = query.eq("status", status)
        if audit_status:
            query = query.eq("audit_status", audit_status)
        if post_type:
            query = query.eq("post_type", post_type)
        if keyword:
            query = query.or_(f"title.ilike.*{keyword}*,content_text.ilike.*{keyword}*")

        result = (
            query.order("created_at", desc=True)
            .range((page - 1) * page_size, page * page_size - 1)
            .execute()
        )

        total = result.count if result.count is not None else 0
        posts = [post_service._format_post(p) for p in result.data or []]

        return {
            "posts": [p.model_dump() for p in posts],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size if total > 0 else 0,
        }

    def get_reported_posts(self, page: int = 1, page_size: int = 20) -> dict:
        """获取被投诉的帖子列表（含投诉详情）"""
        reports_result = (
            self.db.table("content_reports")
            .select("*", count="exact")
            .eq("target_type", "POST")
            .order("created_at", desc=True)
            .range((page - 1) * page_size, page * page_size - 1)
            .execute()
        )

        total = reports_result.count if reports_result.count is not None else 0
        items = []

        for report in reports_result.data or []:
            post_result = (
                self.db.table("posts")
                .select("*")
                .eq("id", report["target_id"])
                .execute()
            )
            post_data = None
            if post_result.data:
                post_data = post_service._format_post(post_result.data[0]).model_dump()

            reporter_result = (
                self.db.table("users")
                .select("username")
                .eq("id", report["reporter_id"])
                .execute()
            )
            reporter_name = reporter_result.data[0]["username"] if reporter_result.data else "未知"

            items.append({
                "report": {
                    "id": report["id"],
                    "reporterId": report["reporter_id"],
                    "reporterName": reporter_name,
                    "reason": report["reason"],
                    "description": report.get("description", ""),
                    "status": report.get("status", "PENDING"),
                    "createdAt": report.get("created_at"),
                },
                "post": post_data,
            })

        return {
            "items": items,
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size if total > 0 else 0,
        }

    def update_post_audit_status(self, post_id: int, audit_status: str) -> bool:
        """更新帖子审核状态"""
        result = (
            self.db.table("posts")
            .update({"audit_status": audit_status})
            .eq("id", post_id)
            .execute()
        )
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

    def _get_next_brand_id(self) -> int:
        """查询 brands 表当前最大 id + 1，绕过失步的序列"""
        result = (
            self.db.table("brands")
            .select("id")
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        return (result.data[0]["id"] + 1) if result.data else 1

    def _insert_brand(self, brand_data: dict, max_retries: int = 5):
        """使用显式 id 插入品牌，避免序列失步导致的主键冲突"""
        last_error = None
        for _ in range(max_retries):
            try:
                next_id = self._get_next_brand_id()
                data = {**brand_data, "id": next_id}
                result = self.db.table("brands").insert(data).execute()
                if result.data:
                    return result.data[0]
                raise Exception("插入品牌失败：返回数据为空")
            except Exception as e:
                last_error = e
                err = str(e) + str(getattr(e, 'code', '')) + str(getattr(e, 'message', ''))
                if "23505" in err or "duplicate key" in err.lower():
                    continue
                raise
        raise last_error  # type: ignore[misc]

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
        }

        new_brand = self._insert_brand(brand_data)

        cover_image = submission.get("cover_image")
        if cover_image and new_brand:
            try:
                self.db.table("brand_images").insert({
                    "brand_id": new_brand["id"],
                    "image_url": cover_image,
                    "status": "APPROVED",
                    "is_selected": True,
                    "uploaded_by": submission.get("user_id"),
                }).execute()
            except Exception:
                pass

        self.db.table("brand_submissions").update({
            "status": "APPROVED",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", submission_id).execute()

        # 等级规则引擎: 品牌提交审核通过时计入 archive_uploaded
        user_id = submission.get("user_id")
        if user_id:
            try:
                from app.services.level_service import level_service
                from app.schemas.level import LevelAction
                level_service.record_action(user_id, LevelAction.ARCHIVE_UPLOADED)
            except Exception as level_err:
                print(f"[WARN] level_service.record_action(archive-brand) failed: {level_err}")

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

    def _get_first_brand_images(self, brand_ids: list) -> dict:
        """批量获取每个品牌的第一张已选中展示图片 URL"""
        if not brand_ids:
            return {}
        try:
            result = (
                self.db.table("brand_images")
                .select("brand_id, image_url")
                .in_("brand_id", brand_ids)
                .eq("status", "APPROVED")
                .eq("is_selected", True)
                .order("sort_order")
                .order("created_at")
                .execute()
            )
            mapping = {}
            for r in result.data or []:
                bid = r["brand_id"]
                if bid not in mapping and r.get("image_url"):
                    mapping[bid] = r["image_url"]
            return mapping
        except Exception:
            return {}

    def _format_admin_brand(self, data: dict, cover_image_url: str = None) -> dict:
        """格式化品牌数据（管理员视角），coverImage 由 brand_images 派生"""
        return {
            "id": data["id"],
            "name": data["name"],
            "category": data.get("category"),
            "foundedYear": data.get("founded_year"),
            "founder": data.get("founder"),
            "country": data.get("country"),
            "website": data.get("website"),
            "coverImage": cover_image_url,
            # AI 发帖助手: 风格关联 (053) - 0 / null 都视为未关联
            "primaryStyleId": data.get("primary_style_id"),
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

        brand_ids = [b["id"] for b in result.data or []]
        image_map = self._get_first_brand_images(brand_ids)
        brands = [
            self._format_admin_brand(b, cover_image_url=image_map.get(b["id"]))
            for b in result.data or []
        ]

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
        }
        for key, db_field in field_mapping.items():
            if key in kwargs and kwargs[key] is not None:
                update_data[db_field] = kwargs[key]

        # primary_style_id 单独处理: 0 / "" / None 都解释为"清空关联",
        # 因为前端 select 把"未关联"映射成 0 比 null 更常见。
        if "primary_style_id" in kwargs:
            psid = kwargs["primary_style_id"]
            update_data["primary_style_id"] = psid if psid else None

        if not update_data:
            result = self.db.table("brands").select("*").eq("id", brand_id).execute()
            if not result.data:
                return None
            image_map = self._get_first_brand_images([brand_id])
            return self._format_admin_brand(result.data[0], cover_image_url=image_map.get(brand_id))

        self.db.table("brands").update(update_data).eq("id", brand_id).execute()
        result = self.db.table("brands").select("*").eq("id", brand_id).execute()
        if not result.data:
            return None
        image_map = self._get_first_brand_images([brand_id])
        return self._format_admin_brand(result.data[0], cover_image_url=image_map.get(brand_id))

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

    def get_brand_images(self, brand_id: int, approved_only: bool = False) -> list:
        """获取品牌图片（管理员视角默认返回所有状态，包括 PENDING）"""
        query = (
            self.db.table("brand_images")
            .select("*")
            .eq("brand_id", brand_id)
        )
        if approved_only:
            query = query.eq("status", "APPROVED")
        else:
            query = query.in_("status", ["APPROVED", "PENDING"])
        result = query.order("sort_order").order("created_at").execute()
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


    # ==================== 用户列表 ====================

    def get_users(
        self, keyword: str = None, page: int = 1, page_size: int = 20
    ) -> dict:
        """Get paginated user list with optional search."""
        offset = (page - 1) * page_size

        query = self.db.table("users").select("*", count="exact")
        if keyword and keyword.strip():
            safe = keyword.strip()
            if safe.isdigit():
                query = query.or_(f"id.eq.{safe},username.ilike.*{safe}*")
            else:
                query = query.ilike("username", f"*{safe}*")

        query = query.order("id", desc=True).range(offset, offset + page_size - 1)
        result = query.execute()
        total = result.count or 0

        user_ids = [u["id"] for u in result.data or []]
        info_map: dict = {}
        if user_ids:
            info_result = (
                self.db.table("user_info")
                .select("user_id, avatar_url, bio, location, gender, age")
                .in_("user_id", user_ids)
                .execute()
            )
            info_map = {i["user_id"]: i for i in info_result.data or []}

        title_map: dict = {}
        if user_ids:
            try:
                titles_result = (
                    self.db.table("user_titles")
                    .select("*")
                    .in_("user_id", user_ids)
                    .order("is_primary", desc=True)
                    .order("created_at", desc=True)
                    .execute()
                )
                for t in titles_result.data or []:
                    uid = t["user_id"]
                    if uid not in title_map:
                        title_map[uid] = []
                    title_map[uid].append(self._format_title(t))
            except Exception:
                pass

        post_count_map: dict = {}
        follower_count_map: dict = {}
        following_count_map: dict = {}
        merchant_map: dict = {}
        if user_ids:
            try:
                posts_result = (
                    self.db.table("posts")
                    .select("user_id")
                    .in_("user_id", user_ids)
                    .eq("status", "PUBLISHED")
                    .limit(10000)
                    .execute()
                )
                for p in posts_result.data or []:
                    uid = p["user_id"]
                    post_count_map[uid] = post_count_map.get(uid, 0) + 1
            except Exception:
                pass
            try:
                followers_result = (
                    self.db.table("user_follows")
                    .select("following_id")
                    .in_("following_id", user_ids)
                    .limit(10000)
                    .execute()
                )
                for f in followers_result.data or []:
                    uid = f["following_id"]
                    follower_count_map[uid] = follower_count_map.get(uid, 0) + 1
                following_result = (
                    self.db.table("user_follows")
                    .select("follower_id")
                    .in_("follower_id", user_ids)
                    .limit(10000)
                    .execute()
                )
                for f in following_result.data or []:
                    uid = f["follower_id"]
                    following_count_map[uid] = following_count_map.get(uid, 0) + 1
            except Exception:
                pass
            try:
                merchant_result = (
                    self.db.table("store_merchants")
                    .select("user_id, store_id, status")
                    .in_("user_id", user_ids)
                    .execute()
                )
                # 一个用户可能在多家买手店入驻;  优先保留 APPROVED 的那条,
                # 让前端按 "merchant.status == 'APPROVED'" 一条判定就够用.
                for m in merchant_result.data or []:
                    uid = m["user_id"]
                    existing = merchant_map.get(uid)
                    if existing and existing.get("status") == "APPROVED":
                        continue
                    merchant_map[uid] = {
                        "storeId": m["store_id"],
                        "status": m["status"],
                    }
            except Exception:
                pass

        level_map: dict = {}
        if user_ids:
            try:
                level_result = (
                    self.db.table("user_levels")
                    .select("user_id, current_level")
                    .in_("user_id", user_ids)
                    .execute()
                )
                for l in level_result.data or []:
                    level_map[l["user_id"]] = int(l.get("current_level") or 0)
            except Exception:
                pass

        users = []
        for u in result.data or []:
            info = info_map.get(u["id"], {})
            users.append({
                "id": u["id"],
                "username": u.get("username", ""),
                "email": u.get("email", ""),
                "phone": u.get("phone", ""),
                "status": u.get("status", "ACTIVE"),
                "userType": u.get("user_type", "USER"),
                "isAdmin": u.get("is_admin", False),
                "avatarUrl": info.get("avatar_url", ""),
                "bio": info.get("bio", ""),
                "location": info.get("location", ""),
                "gender": info.get("gender", "OTHER"),
                "age": info.get("age", 0),
                "createdAt": u.get("created_at"),
                "titles": title_map.get(u["id"], []),
                "postCount": post_count_map.get(u["id"], 0),
                "followerCount": follower_count_map.get(u["id"], 0),
                "followingCount": following_count_map.get(u["id"], 0),
                "merchant": merchant_map.get(u["id"]),
                "currentLevel": level_map.get(u["id"], 0),
            })

        return {
            "users": users,
            "total": total,
            "page": page,
            "pageSize": page_size,
        }

    # ==================== 举报管理 ====================

    def get_reports(
        self, status: str = None, page: int = 1, page_size: int = 20
    ) -> dict:
        """Get paginated content reports."""
        offset = (page - 1) * page_size

        query = self.db.table("content_reports").select("*", count="exact")
        if status:
            query = query.eq("status", status)

        query = query.order("created_at", desc=True).range(offset, offset + page_size - 1)
        result = query.execute()
        total = result.count or 0

        reporter_ids = list({r["reporter_id"] for r in result.data or []})
        user_map = {}
        if reporter_ids:
            u_result = (
                self.db.table("users")
                .select("id, username")
                .in_("id", reporter_ids)
                .execute()
            )
            user_map = {u["id"]: u["username"] for u in u_result.data or []}

        reports = []
        for r in result.data or []:
            reports.append({
                "id": r["id"],
                "reporterId": r["reporter_id"],
                "reporterName": user_map.get(r["reporter_id"], ""),
                "targetType": r["target_type"],
                "targetId": r["target_id"],
                "reason": r["reason"],
                "description": r.get("description", ""),
                "status": r.get("status", "PENDING"),
                "createdAt": r.get("created_at"),
            })

        return {
            "reports": reports,
            "total": total,
            "page": page,
            "pageSize": page_size,
        }

    def update_report_status(self, report_id: int, status: str) -> bool:
        """Update a report's status (REVIEWED / RESOLVED / DISMISSED)."""
        result = (
            self.db.table("content_reports")
            .update({"status": status})
            .eq("id", report_id)
            .execute()
        )
        return bool(result.data)

    def admin_delete_chat_message(self, message_id: int) -> dict | None:
        """管理员删除聊天消息（软删除：标记 is_deleted 并清空内容），返回消息信息"""
        msg_result = (
            self.db.table("messages")
            .select("id, sender_id, conversation_id")
            .eq("id", message_id)
            .execute()
        )
        if not msg_result.data:
            return None

        self.db.table("messages").update(
            {"is_deleted": True, "content": ""}
        ).eq("id", message_id).execute()

        row = msg_result.data[0]
        return {
            "messageId": row["id"],
            "senderId": row["sender_id"],
            "conversationId": row["conversation_id"],
        }

    # ==================== 聊天会话审计（admin 监控） ====================
    #
    # 给管理员后台用的「只读」聊天检索接口,核心思路:
    #   - admin 视角不受 conversation_participants / blocks / is_deleted 任何限制,
    #     和普通用户用的 chat_service 严格分开,避免误用。
    #   - 三个入口:
    #       1. 按用户(用户名 / 手机号 / 邮箱 / userId)找会话
    #       2. 按消息关键词全文搜(text 类消息)
    #       3. 进具体会话看完整消息流
    #   - 输出 camelCase,和 frontend/src/services/adminService.ts 里的类型对齐。
    #
    # 为了避免 N+1, 列表接口里用「批量取 users → 批量取 user_info / titles」的
    # 套路,与 `get_users` / `get_reports` 一致。

    def _build_chat_user_brief_map(self, user_ids: List[int]) -> Dict[int, dict]:
        """批量取 (id, username, avatar_url) 给 admin chat 列表 / 详情用。"""
        if not user_ids:
            return {}
        unique_ids = list({uid for uid in user_ids if uid is not None})
        if not unique_ids:
            return {}

        users_data: Dict[int, dict] = {}
        try:
            u_result = (
                self.db.table("users")
                .select("id, username, email, phone")
                .in_("id", unique_ids)
                .execute()
            )
            for u in u_result.data or []:
                users_data[u["id"]] = {
                    "id": u["id"],
                    "username": u.get("username", ""),
                    "email": u.get("email", ""),
                    "phone": u.get("phone", ""),
                    "avatarUrl": "",
                }
        except Exception:
            pass

        try:
            info_result = (
                self.db.table("user_info")
                .select("user_id, avatar_url")
                .in_("user_id", unique_ids)
                .execute()
            )
            for info in info_result.data or []:
                uid = info["user_id"]
                if uid in users_data:
                    users_data[uid]["avatarUrl"] = info.get("avatar_url") or ""
        except Exception:
            pass

        # 没查到的占位,前端不会因为缺字段报错。
        for uid in unique_ids:
            users_data.setdefault(
                uid,
                {
                    "id": uid,
                    "username": "",
                    "email": "",
                    "phone": "",
                    "avatarUrl": "",
                },
            )
        return users_data

    def _resolve_user_ids_for_keyword(self, keyword: str) -> List[int]:
        """关键字 → user_id 列表(纯数字按 id 精确匹配,其他按 username/email/phone 模糊)."""
        safe = (keyword or "").strip()
        if not safe:
            return []
        try:
            if safe.isdigit():
                # 既匹配 id, 也匹配 username = 数字,兼顾两种命名习惯。
                query = self.db.table("users").select("id").or_(
                    f"id.eq.{safe},username.ilike.*{safe}*,phone.ilike.*{safe}*"
                )
            else:
                # PostgREST .or_() 字段间用逗号,不能写成 SQL 的 OR 关键字。
                query = self.db.table("users").select("id").or_(
                    f"username.ilike.*{safe}*,email.ilike.*{safe}*,phone.ilike.*{safe}*"
                )
            result = query.limit(200).execute()
            return [row["id"] for row in result.data or []]
        except Exception:
            return []

    def list_chat_conversations(
        self,
        *,
        keyword: Optional[str] = None,
        user_id: Optional[int] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """admin: 列出会话,可按用户筛选或按关键字找参与者。

        筛选优先级:
          1. ``user_id`` 指定时,只看该用户参与的会话;
          2. 否则按 ``keyword`` 解析出 user_id 列表后取并集;
          3. 都没有时,按 updated_at 倒序列全部会话(给\"看最近活跃聊天\"用)。
        """
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        offset = (page - 1) * page_size

        target_user_ids: Optional[List[int]] = None
        if user_id is not None:
            target_user_ids = [user_id]
        elif keyword and keyword.strip():
            target_user_ids = self._resolve_user_ids_for_keyword(keyword)
            if not target_user_ids:
                # 关键字命中 0 个用户 → 直接返回空,避免给 PostgREST 发空 in_()。
                return {"conversations": [], "total": 0, "page": page, "pageSize": page_size}

        # 先确定要查的 conversation_id 集合。
        conv_ids: Optional[List[int]] = None
        if target_user_ids is not None:
            try:
                cp_result = (
                    self.db.table("conversation_participants")
                    .select("conversation_id")
                    .in_("user_id", target_user_ids)
                    .execute()
                )
                conv_ids = list({r["conversation_id"] for r in cp_result.data or []})
            except Exception:
                conv_ids = []
            if not conv_ids:
                return {"conversations": [], "total": 0, "page": page, "pageSize": page_size}

        # 查 conversations 主表(分页 + 排序)。
        query = self.db.table("conversations").select("*", count="exact")
        if conv_ids is not None:
            query = query.in_("id", conv_ids)
        query = (
            query.order("last_message_at", desc=True, nullsfirst=False)
            .order("id", desc=True)
            .range(offset, offset + page_size - 1)
        )
        result = query.execute()
        total = result.count or 0
        rows = result.data or []
        if not rows:
            return {"conversations": [], "total": total, "page": page, "pageSize": page_size}

        page_conv_ids = [r["id"] for r in rows]

        # 批量取参与者。
        participants_by_conv: Dict[int, List[int]] = {cid: [] for cid in page_conv_ids}
        try:
            part_result = (
                self.db.table("conversation_participants")
                .select("conversation_id, user_id")
                .in_("conversation_id", page_conv_ids)
                .execute()
            )
            for p in part_result.data or []:
                participants_by_conv.setdefault(p["conversation_id"], []).append(p["user_id"])
        except Exception:
            pass

        # 顺带数一下每个会话的消息总数(含已软删,运营要知道历史规模)。
        message_count_by_conv: Dict[int, int] = {cid: 0 for cid in page_conv_ids}
        for cid in page_conv_ids:
            try:
                cnt_result = (
                    self.db.table("messages")
                    .select("id", count="exact")
                    .eq("conversation_id", cid)
                    .limit(1)
                    .execute()
                )
                message_count_by_conv[cid] = cnt_result.count or 0
            except Exception:
                message_count_by_conv[cid] = 0

        # 批量取用户档案。
        all_uids: List[int] = []
        for uids in participants_by_conv.values():
            all_uids.extend(uids)
        user_brief = self._build_chat_user_brief_map(all_uids)

        # 拼装最终结构。
        from app.services.chat_service import format_chat_message_preview
        conversations: List[dict] = []
        for row in rows:
            cid = row["id"]
            uids = participants_by_conv.get(cid, [])
            participants = [user_brief.get(uid, {"id": uid, "username": "", "avatarUrl": ""}) for uid in uids]
            preview_raw = row.get("last_message_text") or ""
            preview = format_chat_message_preview(preview_raw, "text") if preview_raw else ""
            conversations.append({
                "id": cid,
                "participants": participants,
                "lastMessageText": row.get("last_message_text"),
                "lastMessagePreview": preview,
                "lastMessageAt": row.get("last_message_at"),
                "createdAt": row.get("created_at"),
                "updatedAt": row.get("updated_at"),
                "messageCount": message_count_by_conv.get(cid, 0),
            })

        return {
            "conversations": conversations,
            "total": total,
            "page": page,
            "pageSize": page_size,
        }

    def get_chat_conversation_detail(
        self,
        conversation_id: int,
        *,
        before_id: Optional[int] = None,
        limit: int = 100,
    ) -> Optional[dict]:
        """admin: 取某会话的参与者 + 一页消息(默认按 id 倒序拿最近 100 条).

        返回结构:
          {
            "conversation": {id, participants, ...},
            "messages": [...],   # 顺序为「时间正序」便于前端直接渲染
            "hasMore": bool,     # 是否还有更早的消息
          }

        与普通 chat 接口不同的是,这里不过滤 ``is_deleted``,管理员仍能看到已被
        软删的消息,辅助审核 / 仲裁。
        """
        limit = max(1, min(200, limit))

        conv_result = (
            self.db.table("conversations")
            .select("*")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
        )
        if not conv_result.data:
            return None
        conv_row = conv_result.data[0]

        part_result = (
            self.db.table("conversation_participants")
            .select("user_id, joined_at, last_read_at")
            .eq("conversation_id", conversation_id)
            .execute()
        )
        participant_rows = part_result.data or []
        user_brief = self._build_chat_user_brief_map([p["user_id"] for p in participant_rows])
        participants = []
        for p in participant_rows:
            uid = p["user_id"]
            brief = user_brief.get(uid, {"id": uid, "username": "", "avatarUrl": ""})
            participants.append({
                **brief,
                "joinedAt": p.get("joined_at"),
                "lastReadAt": p.get("last_read_at"),
            })

        # 多取一条做 hasMore 判断。
        msg_query = (
            self.db.table("messages")
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("id", desc=True)
            .limit(limit + 1)
        )
        if before_id is not None:
            msg_query = msg_query.lt("id", before_id)
        msg_result = msg_query.execute()
        msg_rows = msg_result.data or []
        has_more = len(msg_rows) > limit
        if has_more:
            msg_rows = msg_rows[:limit]

        # 顺带把消息的 sender 信息一起补上(参与者外的 sender 也要带,因为
        # 客服 / 系统消息也可能用 sender_id 而不在参与者表里)。
        sender_ids = list({m["sender_id"] for m in msg_rows})
        unknown_senders = [sid for sid in sender_ids if sid not in user_brief]
        if unknown_senders:
            user_brief.update(self._build_chat_user_brief_map(unknown_senders))

        # 时间正序输出,前端从上往下渲染。
        msg_rows_sorted = list(reversed(msg_rows))
        messages = []
        for m in msg_rows_sorted:
            sid = m["sender_id"]
            sender = user_brief.get(sid, {"id": sid, "username": "", "avatarUrl": ""})
            messages.append({
                "id": m["id"],
                "conversationId": m["conversation_id"],
                "senderId": sid,
                "senderName": sender.get("username", ""),
                "senderAvatar": sender.get("avatarUrl", ""),
                "content": m.get("content", ""),
                "messageType": m.get("message_type", "text"),
                "createdAt": m.get("created_at"),
                "isDeleted": bool(m.get("is_deleted")),
            })

        return {
            "conversation": {
                "id": conv_row["id"],
                "participants": participants,
                "lastMessageText": conv_row.get("last_message_text"),
                "lastMessageAt": conv_row.get("last_message_at"),
                "createdAt": conv_row.get("created_at"),
                "updatedAt": conv_row.get("updated_at"),
            },
            "messages": messages,
            "hasMore": has_more,
        }

    def search_chat_messages(
        self,
        keyword: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """admin: 全文搜聊天消息(只搜 text 类,卡片类 content 是 JSON,搜出来意义不大).

        命中的消息会带上 sender 信息 + 它所在的会话参与者,方便运营在搜索结果
        卡片上直接看到「谁在哪个会话里说了这句话」。
        """
        safe = (keyword or "").strip()
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        if not safe:
            return {"messages": [], "total": 0, "page": page, "pageSize": page_size}

        offset = (page - 1) * page_size
        try:
            result = (
                self.db.table("messages")
                .select("*", count="exact")
                .eq("message_type", "text")
                .eq("is_deleted", False)
                .ilike("content", f"*{safe}*")
                .order("id", desc=True)
                .range(offset, offset + page_size - 1)
                .execute()
            )
        except Exception:
            return {"messages": [], "total": 0, "page": page, "pageSize": page_size}

        rows = result.data or []
        total = result.count or 0
        if not rows:
            return {"messages": [], "total": total, "page": page, "pageSize": page_size}

        sender_ids = list({m["sender_id"] for m in rows})
        user_brief = self._build_chat_user_brief_map(sender_ids)

        # 批量取每条命中消息所在会话的全部参与者(便于在结果里展示「谁和谁的聊天」)。
        conv_ids = list({m["conversation_id"] for m in rows})
        participants_by_conv: Dict[int, List[int]] = {cid: [] for cid in conv_ids}
        try:
            part_result = (
                self.db.table("conversation_participants")
                .select("conversation_id, user_id")
                .in_("conversation_id", conv_ids)
                .execute()
            )
            for p in part_result.data or []:
                participants_by_conv.setdefault(p["conversation_id"], []).append(p["user_id"])
        except Exception:
            pass

        extra_uids = []
        for uids in participants_by_conv.values():
            extra_uids.extend(uids)
        missing = [uid for uid in set(extra_uids) if uid not in user_brief]
        if missing:
            user_brief.update(self._build_chat_user_brief_map(missing))

        messages = []
        for m in rows:
            sid = m["sender_id"]
            sender = user_brief.get(sid, {"id": sid, "username": "", "avatarUrl": ""})
            participant_uids = participants_by_conv.get(m["conversation_id"], [])
            participants = [
                user_brief.get(uid, {"id": uid, "username": "", "avatarUrl": ""})
                for uid in participant_uids
            ]
            messages.append({
                "id": m["id"],
                "conversationId": m["conversation_id"],
                "senderId": sid,
                "senderName": sender.get("username", ""),
                "senderAvatar": sender.get("avatarUrl", ""),
                "content": m.get("content", ""),
                "messageType": m.get("message_type", "text"),
                "createdAt": m.get("created_at"),
                "isDeleted": bool(m.get("is_deleted")),
                "participants": participants,
            })

        return {
            "messages": messages,
            "total": total,
            "page": page,
            "pageSize": page_size,
        }

    # ==================== 用户头衔管理 ====================

    def get_user_titles(self, user_id: int) -> list:
        """获取用户的所有头衔"""
        result = (
            self.db.table("user_titles")
            .select("*")
            .eq("user_id", user_id)
            .order("is_primary", desc=True)
            .order("created_at", desc=True)
            .execute()
        )
        return [self._format_title(t) for t in result.data or []]

    def add_user_title(self, user_id: int, title: str, granted_by: int) -> dict:
        """给用户添加头衔"""
        existing = (
            self.db.table("user_titles")
            .select("id")
            .eq("user_id", user_id)
            .eq("title", title)
            .execute()
        )
        if existing.data:
            raise ValueError("该用户已拥有此头衔")

        has_any = (
            self.db.table("user_titles")
            .select("id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        is_first = not has_any.data

        result = (
            self.db.table("user_titles")
            .insert({
                "user_id": user_id,
                "title": title,
                "is_primary": is_first,
                "granted_by": granted_by,
            })
            .execute()
        )
        if not result.data:
            raise Exception("添加头衔失败")
        return self._format_title(result.data[0])

    def remove_user_title(self, title_id: int) -> bool:
        """删除用户头衔"""
        title_result = (
            self.db.table("user_titles")
            .select("user_id, is_primary")
            .eq("id", title_id)
            .execute()
        )
        if not title_result.data:
            return False

        was_primary = title_result.data[0]["is_primary"]
        user_id = title_result.data[0]["user_id"]

        self.db.table("user_titles").delete().eq("id", title_id).execute()

        if was_primary:
            remaining = (
                self.db.table("user_titles")
                .select("id")
                .eq("user_id", user_id)
                .order("created_at")
                .limit(1)
                .execute()
            )
            if remaining.data:
                self.db.table("user_titles").update(
                    {"is_primary": True}
                ).eq("id", remaining.data[0]["id"]).execute()

        return True

    def _format_title(self, data: dict) -> dict:
        return {
            "id": data["id"],
            "userId": data["user_id"],
            "title": data["title"],
            "isPrimary": data.get("is_primary", False),
            "grantedBy": data.get("granted_by"),
            "createdAt": data.get("created_at"),
        }

    # ==================== 屏蔽关系 ====================

    def get_all_blocks(self, page: int = 1, page_size: int = 20) -> dict:
        """Get all block relationships with user info."""
        offset = (page - 1) * page_size

        query = (
            self.db.table("user_blocks")
            .select("*", count="exact")
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
        )
        result = query.execute()
        total = result.count or 0

        all_ids = list({
            uid
            for r in result.data or []
            for uid in (r["blocker_id"], r["blocked_id"])
        })
        user_map = {}
        if all_ids:
            u_result = (
                self.db.table("users")
                .select("id, username")
                .in_("id", all_ids)
                .execute()
            )
            user_map = {u["id"]: u["username"] for u in u_result.data or []}

        blocks = []
        for r in result.data or []:
            blocks.append({
                "id": r["id"],
                "blockerId": r["blocker_id"],
                "blockerName": user_map.get(r["blocker_id"], ""),
                "blockedId": r["blocked_id"],
                "blockedName": user_map.get(r["blocked_id"], ""),
                "createdAt": r.get("created_at"),
            })

        return {
            "blocks": blocks,
            "total": total,
            "page": page,
            "pageSize": page_size,
        }


    # ==================== 增长统计 ====================

    def get_growth_stats(self, days: int = 30) -> dict:
        """获取最近 N 天的用户/帖子/评论每日新增数量 + 累计用户总数"""
        from datetime import timedelta

        end = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        start = end - timedelta(days=days)
        start_iso = start.isoformat()

        # 统计窗口之前已有的用户总数
        users_before = (
            self.db.table("users")
            .select("id", count="exact")
            .lt("created_at", start_iso)
            .execute()
        )
        base_user_count = users_before.count or 0

        users_raw = (
            self.db.table("users")
            .select("created_at")
            .gte("created_at", start_iso)
            .order("created_at")
            .execute()
        )
        posts_raw = (
            self.db.table("posts")
            .select("created_at")
            .gte("created_at", start_iso)
            .order("created_at")
            .execute()
        )
        comments_raw = (
            self.db.table("post_comments")
            .select("created_at")
            .gte("created_at", start_iso)
            .order("created_at")
            .execute()
        )

        def bucket(rows):
            counts: dict[str, int] = {}
            for r in rows or []:
                day = r.get("created_at", "")[:10]
                if day:
                    counts[day] = counts.get(day, 0) + 1
            return counts

        user_counts = bucket(users_raw.data)
        post_counts = bucket(posts_raw.data)
        comment_counts = bucket(comments_raw.data)

        series = []
        cumulative_users = base_user_count
        cursor = start
        while cursor < end:
            d = cursor.strftime("%Y-%m-%d")
            daily_users = user_counts.get(d, 0)
            cumulative_users += daily_users
            series.append({
                "date": d,
                "users": daily_users,
                "posts": post_counts.get(d, 0),
                "comments": comment_counts.get(d, 0),
                "totalUsers": cumulative_users,
            })
            cursor += timedelta(days=1)

        return {"days": days, "series": series}

    def get_demographics(self) -> dict:
        """Aggregate gender / age-bracket / location distribution from user_info."""
        rows = (
            self.db.table("user_info")
            .select("gender, age, location")
            .execute()
        ).data or []

        gender_counts: dict[str, int] = {}
        age_brackets: dict[str, int] = {
            "<18": 0, "18-24": 0, "25-30": 0, "31-40": 0, "41-50": 0, "50+": 0,
        }
        region_counts: dict[str, int] = {}

        for r in rows:
            g = (r.get("gender") or "OTHER").upper()
            gender_counts[g] = gender_counts.get(g, 0) + 1

            age = r.get("age") or 0
            if age > 0:
                if age < 18:
                    age_brackets["<18"] += 1
                elif age <= 24:
                    age_brackets["18-24"] += 1
                elif age <= 30:
                    age_brackets["25-30"] += 1
                elif age <= 40:
                    age_brackets["31-40"] += 1
                elif age <= 50:
                    age_brackets["41-50"] += 1
                else:
                    age_brackets["50+"] += 1

            loc = (r.get("location") or "").strip()
            if loc:
                region_counts[loc] = region_counts.get(loc, 0) + 1

        sorted_regions = sorted(region_counts.items(), key=lambda x: x[1], reverse=True)[:15]

        return {
            "gender": gender_counts,
            "ageBrackets": age_brackets,
            "regions": [{"name": n, "count": c} for n, c in sorted_regions],
        }

    # ==================== 交易订单（管理员视图） ====================
    #
    # 管理员后台的「交易管理」面板用。前台买卖双方各自只看自己的订单
    # (`order_service.list_orders`)，admin 这里要的是「跨所有用户」的全局视
    # 角，并把 buyer / seller / merchant / product 等关联实体一次性 join 出来，
    # 避免列表页 N+1。
    #
    # 设计取舍：
    #   - 复用 `orders` 表，不引入 view；筛选条件直接走 PostgREST。
    #   - 关联用户 / 商品 / 商家信息一律走 batch select 在内存里 join，
    #     和 get_users / get_reports 同款写法，便于审计与一致性维护。
    #   - 金额对外返回原始 cents + currency；前端按 currency 选择展示符号。

    @staticmethod
    def _format_admin_order(
        row: Dict[str, Any],
        *,
        buyer: Optional[Dict[str, Any]] = None,
        seller: Optional[Dict[str, Any]] = None,
        merchant: Optional[Dict[str, Any]] = None,
        product: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """把 orders 行 + 关联实体打平成前端友好的字典。

        命名约定：camelCase 给前端，保持与 web/src/lib/services/admin.ts 其他
        响应一致。资金字段保留原始 cents，前端按 currency 自行格式化。
        """
        shipping_addr = row.get("shipping_address_json") or {}
        return {
            "id": row["id"],
            "orderNo": row.get("order_no"),
            "productId": row.get("product_id"),
            "buyerUserId": row.get("buyer_user_id"),
            "sellerUserId": row.get("seller_user_id"),
            "sellerMerchantId": row.get("seller_merchant_id"),
            "offerId": row.get("offer_id"),
            "listingPriceCents": row.get("listing_price_cents") or 0,
            "paidPriceCents": row.get("paid_price_cents") or 0,
            "commissionRateBps": row.get("commission_rate_bps") or 0,
            "commissionCents": row.get("commission_cents") or 0,
            "sellerPayoutCents": row.get("seller_payout_cents") or 0,
            "currency": row.get("currency") or "CNY",
            "status": row.get("status"),
            "paymentProvider": row.get("payment_provider"),
            "paymentIntentId": row.get("payment_intent_id"),
            "shippingDueAt": row.get("shipping_due_at"),
            "autoConfirmDueAt": row.get("auto_confirm_due_at"),
            "settlementDueAt": row.get("settlement_due_at"),
            "paidAt": row.get("paid_at"),
            "shippedAt": row.get("shipped_at"),
            "deliveredAt": row.get("delivered_at"),
            "completedAt": row.get("completed_at"),
            "settledAt": row.get("settled_at"),
            "refundedAt": row.get("refunded_at"),
            "cancelReason": row.get("cancel_reason"),
            "createdAt": row.get("created_at"),
            "updatedAt": row.get("updated_at"),
            # ---------- 摘要 join ----------
            "buyer": buyer,
            "seller": seller,
            "merchant": merchant,
            "product": product,
            "shippingAddress": shipping_addr or None,
        }

    def _enrich_orders(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """批量把 buyer / seller / merchant / product 信息挂回订单行。"""
        if not rows:
            return []

        buyer_ids = {r.get("buyer_user_id") for r in rows if r.get("buyer_user_id")}
        seller_ids = {r.get("seller_user_id") for r in rows if r.get("seller_user_id")}
        all_user_ids = list(buyer_ids | seller_ids)
        merchant_ids = list({r.get("seller_merchant_id") for r in rows if r.get("seller_merchant_id")})
        product_ids = list({r.get("product_id") for r in rows if r.get("product_id")})

        user_map: Dict[int, Dict[str, Any]] = {}
        avatar_map: Dict[int, str] = {}
        if all_user_ids:
            try:
                u_res = (
                    self.db.table("users")
                    .select("id, username, phone, email")
                    .in_("id", all_user_ids)
                    .execute()
                )
                for u in u_res.data or []:
                    user_map[u["id"]] = {
                        "id": u["id"],
                        "username": u.get("username", ""),
                        "phone": u.get("phone", ""),
                        "email": u.get("email", ""),
                    }
            except Exception:
                pass
            try:
                info_res = (
                    self.db.table("user_info")
                    .select("user_id, avatar_url")
                    .in_("user_id", all_user_ids)
                    .execute()
                )
                for i in info_res.data or []:
                    if i.get("avatar_url"):
                        avatar_map[i["user_id"]] = i["avatar_url"]
            except Exception:
                pass

        for uid, brief in user_map.items():
            brief["avatarUrl"] = avatar_map.get(uid)

        merchant_map: Dict[int, Dict[str, Any]] = {}
        if merchant_ids:
            try:
                m_res = (
                    self.db.table("store_merchants")
                    .select("id, store_id, user_id, status")
                    .in_("id", merchant_ids)
                    .execute()
                )
                # 拉关联买手店名以便前端展示
                store_ids = list({m["store_id"] for m in m_res.data or [] if m.get("store_id")})
                store_name_map: Dict[int, str] = {}
                if store_ids:
                    try:
                        s_res = (
                            self.db.table("buyer_stores")
                            .select("id, name")
                            .in_("id", store_ids)
                            .execute()
                        )
                        store_name_map = {s["id"]: s.get("name", "") for s in s_res.data or []}
                    except Exception:
                        pass
                for m in m_res.data or []:
                    merchant_map[m["id"]] = {
                        "id": m["id"],
                        "storeId": m.get("store_id"),
                        "storeName": store_name_map.get(m.get("store_id"), ""),
                        "userId": m.get("user_id"),
                        "status": m.get("status"),
                    }
            except Exception:
                pass

        product_map: Dict[int, Dict[str, Any]] = {}
        if product_ids:
            try:
                p_res = (
                    self.db.table("store_products")
                    .select("id, title, brand, price_cents, currency, images")
                    .in_("id", product_ids)
                    .execute()
                )
                for p in p_res.data or []:
                    images = p.get("images") or []
                    product_map[p["id"]] = {
                        "id": p["id"],
                        "title": p.get("title"),
                        "brand": p.get("brand"),
                        "priceCents": p.get("price_cents"),
                        "currency": p.get("currency", "CNY"),
                        "coverImage": images[0] if images else None,
                    }
            except Exception:
                pass

        out: List[Dict[str, Any]] = []
        for r in rows:
            buyer = user_map.get(r.get("buyer_user_id")) if r.get("buyer_user_id") else None
            seller = user_map.get(r.get("seller_user_id")) if r.get("seller_user_id") else None
            merchant = merchant_map.get(r.get("seller_merchant_id")) if r.get("seller_merchant_id") else None
            # 买手店卖家场景：seller_user_id 为空，把 merchant.user 解析回 seller
            if seller is None and merchant and merchant.get("userId"):
                seller = user_map.get(merchant["userId"])
            product = product_map.get(r.get("product_id")) if r.get("product_id") else None
            out.append(
                self._format_admin_order(
                    r, buyer=buyer, seller=seller, merchant=merchant, product=product
                )
            )
        return out

    def get_all_orders(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        user_id: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """获取所有订单列表（分页 + 过滤）。

        - ``status``：订单状态精确匹配（pending_payment / paid / shipped / ...）。
        - ``keyword``：按订单号前缀搜索；纯数字时也命中 product_id。
        - ``user_id``：限定买家或卖家是该用户，便于在 admin 用户详情里跳转过来查单。
        - ``start_date`` / ``end_date``：ISO 时间，按 created_at 闭区间过滤。
        """
        offset = (page - 1) * page_size

        query = self.db.table("orders").select("*", count="exact")
        if status:
            query = query.eq("status", status)
        if user_id is not None:
            # `or_` 在新版本 supabase-py 上同时支持多个等值条件。
            query = query.or_(
                f"buyer_user_id.eq.{user_id},seller_user_id.eq.{user_id}"
            )
        if keyword:
            kw = keyword.strip()
            if kw:
                if kw.isdigit():
                    query = query.or_(
                        f"order_no.ilike.*{kw}*,product_id.eq.{kw}"
                    )
                else:
                    query = query.ilike("order_no", f"*{kw}*")
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date)

        query = query.order("created_at", desc=True).range(offset, offset + page_size - 1)
        result = query.execute()
        total = result.count or 0
        items = self._enrich_orders(result.data or [])

        return {
            "items": items,
            "total": total,
            "page": page,
            "pageSize": page_size,
        }

    def get_order_detail(self, order_id: int) -> Optional[Dict[str, Any]]:
        """订单详情（管理员）。除了 list 字段外再带上物流与最近的售后单。"""
        res = (
            self.db.table("orders")
            .select("*")
            .eq("id", order_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        enriched = self._enrich_orders(res.data)
        detail = enriched[0]

        # 物流凭证 + 最新一条 tracking_event
        try:
            ship_res = (
                self.db.table("order_shipments")
                .select("*")
                .eq("order_id", order_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if ship_res.data:
                s = ship_res.data[0]
                detail["shipment"] = {
                    "carrier": s.get("carrier"),
                    "trackingNo": s.get("tracking_no"),
                    "images": s.get("images") or [],
                    "signedAt": s.get("signed_at"),
                    "latestStatusCode": s.get("latest_status_code"),
                    "latestDescription": s.get("latest_description"),
                    "latestLocation": s.get("latest_location"),
                    "latestEventAt": s.get("latest_event_at"),
                }
        except Exception:
            detail["shipment"] = None

        # 关联的钱包 pending_payouts 行（卖家结算）
        try:
            pp_res = (
                self.db.table("pending_payouts")
                .select("id, amount_cents, currency, status, release_at, released_at, created_at")
                .eq("order_id", order_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if pp_res.data:
                pp = pp_res.data[0]
                detail["pendingPayout"] = {
                    "id": pp["id"],
                    "amountCents": pp.get("amount_cents") or 0,
                    "currency": pp.get("currency", "CNY"),
                    "status": pp.get("status"),
                    "releaseAt": pp.get("release_at"),
                    "releasedAt": pp.get("released_at"),
                    "createdAt": pp.get("created_at"),
                }
        except Exception:
            pass

        return detail

    def get_order_stats(self, days: int = 30) -> Dict[str, Any]:
        """订单聚合统计：总单数 / 已完成 / 退款 / GMV / 平台佣金 / 卖家实收。

        - ``days``：按 created_at 看最近 N 天。设 0 表示「全量」。
        - 金额仅累加 ``status in {paid, shipped, delivered, completed, settled}``，
          这样 GMV 不会把 pending_payment / refunded 也算进去。

        实现走客户端聚合：admin 后台量级很小（迄今 < 10w），一次拉回所有
        命中行做 group by 比让 PostgREST 走多个 count 查询更省往返。
        """
        from datetime import timedelta

        query = self.db.table("orders").select(
            "id, status, paid_price_cents, commission_cents, "
            "seller_payout_cents, currency, created_at"
        )
        if days and days > 0:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            query = query.gte("created_at", cutoff)

        # 后台后续可能要按月份切片做趋势图；这里先返回汇总数。
        rows = (query.limit(50000).execute()).data or []

        REVENUE_STATUSES = {"paid", "shipped", "delivered", "completed", "settled"}

        status_counts: Dict[str, int] = {}
        gmv_by_currency: Dict[str, int] = {}
        commission_by_currency: Dict[str, int] = {}
        payout_by_currency: Dict[str, int] = {}
        completed_count = 0
        refunded_count = 0

        for r in rows:
            status = r.get("status") or "unknown"
            status_counts[status] = status_counts.get(status, 0) + 1
            if status in {"completed", "settled"}:
                completed_count += 1
            if status in {"refunded", "refunded_auto"}:
                refunded_count += 1

            if status in REVENUE_STATUSES:
                cur = r.get("currency") or "CNY"
                gmv_by_currency[cur] = (
                    gmv_by_currency.get(cur, 0) + (r.get("paid_price_cents") or 0)
                )
                commission_by_currency[cur] = (
                    commission_by_currency.get(cur, 0) + (r.get("commission_cents") or 0)
                )
                payout_by_currency[cur] = (
                    payout_by_currency.get(cur, 0) + (r.get("seller_payout_cents") or 0)
                )

        def _to_list(m: Dict[str, int]) -> List[Dict[str, Any]]:
            return [{"currency": c, "amountCents": v} for c, v in sorted(m.items())]

        return {
            "days": days,
            "totalOrders": len(rows),
            "completedOrders": completed_count,
            "refundedOrders": refunded_count,
            "statusCounts": status_counts,
            "gmv": _to_list(gmv_by_currency),
            "commission": _to_list(commission_by_currency),
            "sellerPayout": _to_list(payout_by_currency),
        }

    # ==================== Styles 风格字典 (V3 #25) ====================

    def _format_style(self, row: dict) -> dict:
        """JSONB 多语言列原样透出, 前端 (web admin) 自己根据当前 locale 取 key。
        AI 发帖助手 mobile 端走 ai_post_service 那一路, 不读这里。"""
        return {
            "id": row["id"],
            "slug": row["slug"],
            "nameI18n": row.get("name_i18n") or {},
            "descriptionI18n": row.get("description_i18n") or {},
            "coverUrl": row.get("cover_url"),
            "sortOrder": row.get("sort_order", 0),
            "isActive": row.get("is_active", True),
            "createdAt": row.get("created_at"),
            "updatedAt": row.get("updated_at"),
        }

    def list_styles(self) -> List[dict]:
        result = (
            self.db.table("styles")
            .select("*")
            .order("sort_order")
            .execute()
        )
        rows = result.data or []
        styles = [self._format_style(r) for r in rows]

        # 顺手统计每个 style 关联了多少 brands,前端列表直接展示。
        # 这里用一次扫表 group-by 而不是 N+1; styles 总数 ~10-20,可接受。
        try:
            brands = (
                self.db.table("brands")
                .select("primary_style_id")
                .not_.is_("primary_style_id", "null")
                .execute()
            )
            counts: Dict[int, int] = {}
            for b in brands.data or []:
                sid = b.get("primary_style_id")
                if sid:
                    counts[sid] = counts.get(sid, 0) + 1
            for s in styles:
                s["brandCount"] = counts.get(s["id"], 0)
        except Exception:
            for s in styles:
                s["brandCount"] = 0
        return styles

    def create_style(
        self,
        *,
        slug: str,
        name_i18n: Dict[str, Any],
        description_i18n: Dict[str, Any],
        cover_url: Optional[str],
        sort_order: int,
        is_active: bool,
    ) -> Optional[dict]:
        try:
            result = (
                self.db.table("styles")
                .insert(
                    {
                        "slug": slug,
                        "name_i18n": name_i18n,
                        "description_i18n": description_i18n or {},
                        "cover_url": cover_url,
                        "sort_order": sort_order,
                        "is_active": is_active,
                    }
                )
                .execute()
            )
        except Exception as e:
            # slug unique 冲突 / CHECK 约束失败都走这里。
            # 不抛 HTTP 异常,让 route 层翻译成 400。
            print(f"[admin] create_style failed: {e}", flush=True)
            return None
        return self._format_style(result.data[0]) if result.data else None

    def update_style(
        self,
        style_id: int,
        *,
        slug: Optional[str] = None,
        name_i18n: Optional[Dict[str, Any]] = None,
        description_i18n: Optional[Dict[str, Any]] = None,
        cover_url: Optional[str] = None,
        sort_order: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[dict]:
        update_data: Dict[str, Any] = {}
        if slug is not None:
            update_data["slug"] = slug
        if name_i18n is not None:
            update_data["name_i18n"] = name_i18n
        if description_i18n is not None:
            update_data["description_i18n"] = description_i18n
        if cover_url is not None:
            update_data["cover_url"] = cover_url
        if sort_order is not None:
            update_data["sort_order"] = sort_order
        if is_active is not None:
            update_data["is_active"] = is_active

        if update_data:
            self.db.table("styles").update(update_data).eq("id", style_id).execute()

        result = self.db.table("styles").select("*").eq("id", style_id).execute()
        if not result.data:
            return None
        return self._format_style(result.data[0])

    def delete_style(self, style_id: int) -> bool:
        # ON DELETE SET NULL 由 047 的外键约束兜底,brands.primary_style_id 自动清空。
        result = self.db.table("styles").delete().eq("id", style_id).execute()
        return bool(result.data)


# 单例
admin_service = AdminService()
