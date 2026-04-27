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
                for m in merchant_result.data or []:
                    merchant_map[m["user_id"]] = {
                        "storeId": m["store_id"],
                        "status": m["status"],
                    }
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


# 单例
admin_service = AdminService()
