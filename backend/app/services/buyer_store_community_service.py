"""
买手店社区服务 - 处理用户提交、评论、评分、收藏功能
"""

from typing import Optional, List, Tuple
from datetime import datetime

from app.db.supabase import get_supabase, get_supabase_admin
from app.schemas.buyer_store import (
    UserSubmittedStoreCreate,
    UserSubmittedStore,
    BuyerStoreCommentCreate,
    BuyerStoreComment,
    BuyerStoreCommentReply,
    BuyerStoreRatingCreate,
    BuyerStoreRating,
    BuyerStoreRatingStats,
    ReviewSubmissionRequest,
    BatchReviewRequest,
    UserFavoritedStore,
    UserStoreComment,
    UserStoreRatingItem,
    UserStoreActivity,
)


class BuyerStoreCommunityService:
    """买手店社区服务"""

    def __init__(self):
        self.supabase = get_supabase()
        self.supabase_admin = get_supabase_admin()

    # ==================== 用户提交买手店 ====================

    def submit_store(
        self, user_id: int, data: UserSubmittedStoreCreate
    ) -> UserSubmittedStore:
        """用户提交买手店"""
        result = (
            self.supabase.table("user_submitted_stores")
            .insert(
                {
                    "user_id": user_id,
                    "name": data.name,
                    "address": data.address,
                    "city": data.city,
                    "country": data.country,
                    "latitude": data.latitude,
                    "longitude": data.longitude,
                    "brands": data.brands,
                    "style": data.style,
                    "phone": data.phone,
                    "hours": data.hours,
                    "description": data.description,
                    "images": data.images,
                    "status": "PENDING",
                }
            )
            .execute()
        )

        if result.data:
            return self._format_submitted_store(result.data[0])
        raise Exception("提交失败")

    def get_user_submissions(
        self, user_id: int, page: int = 1, page_size: int = 20
    ) -> Tuple[List[UserSubmittedStore], int]:
        """获取用户提交的买手店列表"""
        offset = (page - 1) * page_size

        # 获取总数
        count_result = (
            self.supabase.table("user_submitted_stores")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        total = count_result.count or 0

        # 获取列表 - 使用明确的外键关系名
        result = (
            self.supabase.table("user_submitted_stores")
            .select(
                "*, users!user_submitted_stores_user_id_fkey(username, user_info(avatar_url))"
            )
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        stores = [self._format_submitted_store(s) for s in result.data]
        return stores, total

    def get_approved_user_submissions(
        self, user_id: int, page: int = 1, page_size: int = 20
    ) -> Tuple[List[UserSubmittedStore], int]:
        """获取用户已通过审核的买手店提交（公开可见）"""
        offset = (page - 1) * page_size

        count_result = (
            self.supabase.table("user_submitted_stores")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("status", "APPROVED")
            .execute()
        )
        total = count_result.count or 0

        result = (
            self.supabase.table("user_submitted_stores")
            .select(
                "*, users!user_submitted_stores_user_id_fkey(username, user_info(avatar_url))"
            )
            .eq("user_id", user_id)
            .eq("status", "APPROVED")
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        stores = [self._format_submitted_store(s) for s in result.data]
        return stores, total

    def get_pending_submissions(
        self, page: int = 1, page_size: int = 20
    ) -> Tuple[List[UserSubmittedStore], int]:
        """获取待审核的买手店列表（管理员）"""
        offset = (page - 1) * page_size

        # 获取总数
        count_result = (
            self.supabase.table("user_submitted_stores")
            .select("id", count="exact")
            .eq("status", "PENDING")
            .execute()
        )
        total = count_result.count or 0

        # 获取列表 - 使用明确的外键关系名
        result = (
            self.supabase.table("user_submitted_stores")
            .select(
                "*, users!user_submitted_stores_user_id_fkey(username, user_info(avatar_url))"
            )
            .eq("status", "PENDING")
            .order("created_at", desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        stores = [self._format_submitted_store(s) for s in result.data]
        return stores, total

    def delete_user_submission(self, submission_id: int, user_id: int) -> bool:
        """删除用户自己的提交（仅限 PENDING/REJECTED 状态）"""
        result = (
            self.supabase.table("user_submitted_stores")
            .select("id, user_id, status")
            .eq("id", submission_id)
            .single()
            .execute()
        )
        row = result.data
        if not row or row["user_id"] != user_id:
            return False
        if row["status"] not in ("PENDING", "REJECTED"):
            return False
        self.supabase.table("user_submitted_stores").delete().eq(
            "id", submission_id
        ).execute()
        return True

    def _generate_store_id(self, city: str, submission_id: int) -> str:
        """为用户提交的买手店生成唯一ID，格式: u-{city}-{submission_id}"""
        import re
        # 保留英文字母和数字，中文转拼音首字母太复杂，直接用submission_id保证唯一
        city_slug = re.sub(r'[^a-zA-Z0-9]', '', city.lower())[:10] or "city"
        return f"u-{city_slug}-{submission_id}"

    def _build_buyer_store_from_submission(self, submission: dict, store_id: str) -> dict:
        """从user_submitted_stores行构建buyer_stores插入数据"""
        return {
            "id": store_id,
            "name": submission["name"],
            "address": submission["address"],
            "city": submission["city"],
            "country": submission["country"],
            "latitude": submission.get("latitude"),
            "longitude": submission.get("longitude"),
            "brands": submission.get("brands") or [],
            "style": submission.get("style") or [],
            "phone": submission.get("phone") or [],
            "hours": submission.get("hours"),
            "description": submission.get("description"),
            "images": submission.get("images") or [],
            "is_open": True,
            "submitted_by": submission.get("user_id"),
        }

    def review_submission(
        self, submission_id: int, reviewer_id: int, data: ReviewSubmissionRequest
    ) -> UserSubmittedStore:
        """审核用户提交的买手店。
        批准时自动在 buyer_stores 表中创建对应记录。
        """
        submission_result = (
            self.supabase.table("user_submitted_stores")
            .select("*")
            .eq("id", submission_id)
            .execute()
        )
        if not submission_result.data:
            raise Exception("找不到提交记录")

        submission = submission_result.data[0]
        if submission.get("status") != "PENDING":
            raise Exception(f"该提交已被处理，当前状态: {submission['status']}")

        update_data = {
            "status": data.status,
            "reviewed_by": reviewer_id,
            "reviewed_at": datetime.now().isoformat(),
        }

        if data.status == "REJECTED":
            update_data["reject_reason"] = data.rejectReason

        elif data.status == "APPROVED":
            store_id = data.storeId or self._generate_store_id(
                submission["city"], submission_id
            )
            update_data["approved_store_id"] = store_id

            buyer_store_data = self._build_buyer_store_from_submission(
                submission, store_id
            )
            insert_result = (
                self.supabase_admin.table("buyer_stores")
                .insert(buyer_store_data)
                .execute()
            )
            if not insert_result.data:
                raise Exception("写入 buyer_stores 表失败")

        result = (
            self.supabase_admin.table("user_submitted_stores")
            .update(update_data)
            .eq("id", submission_id)
            .execute()
        )
        if result.data:
            return self._format_submitted_store(result.data[0])
        raise Exception("更新提交状态失败")

    def batch_review_submissions(
        self, submission_ids: list, reviewer_id: int, data: BatchReviewRequest
    ) -> dict:
        """批量审核用户提交的买手店"""
        success_count = 0
        failed_ids = []

        for sid in submission_ids:
            try:
                single_req = ReviewSubmissionRequest(
                    status=data.status,
                    rejectReason=data.rejectReason,
                )
                self.review_submission(sid, reviewer_id, single_req)
                success_count += 1
            except Exception:
                failed_ids.append(sid)

        return {
            "success": success_count,
            "failed": len(failed_ids),
            "failedIds": failed_ids,
        }

    def _format_submitted_store(self, data: dict) -> UserSubmittedStore:
        """格式化用户提交的买手店数据"""
        user_data = data.get("users", {}) or {}
        user_info = user_data.get("user_info", {}) or {}

        return UserSubmittedStore(
            id=data["id"],
            userId=data["user_id"],
            username=user_data.get("username", ""),
            userAvatar=user_info.get("avatar_url"),
            name=data["name"],
            address=data["address"],
            city=data["city"],
            country=data["country"],
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            brands=data.get("brands", []),
            style=data.get("style", []),
            phone=data.get("phone", []),
            hours=data.get("hours"),
            description=data.get("description"),
            images=data.get("images", []),
            status=data["status"],
            rejectReason=data.get("reject_reason"),
            reviewedBy=data.get("reviewed_by"),
            reviewedAt=data.get("reviewed_at"),
            approvedStoreId=data.get("approved_store_id"),
            createdAt=data["created_at"],
            updatedAt=data["updated_at"],
        )

    # ==================== 买手店评论 ====================

    def get_store_comments(
        self, store_id: str, page: int = 1, page_size: int = 20
    ) -> Tuple[List[BuyerStoreComment], int]:
        """获取买手店评论列表"""
        offset = (page - 1) * page_size

        # 获取总数（只统计顶级评论）
        count_result = (
            self.supabase.table("buyer_store_comments")
            .select("id", count="exact")
            .eq("store_id", store_id)
            .is_("parent_id", "null")
            .execute()
        )
        total = count_result.count or 0

        # 获取顶级评论 - 使用明确的外键关系名
        result = (
            self.supabase.table("buyer_store_comments")
            .select(
                "*, users!buyer_store_comments_user_id_fkey(username, user_info(avatar_url))"
            )
            .eq("store_id", store_id)
            .is_("parent_id", "null")
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        comments = []
        for c in result.data:
            comment = self._format_comment(c)
            # 获取回复
            replies = self._get_comment_replies(c["id"])
            comment.replies = replies
            comments.append(comment)

        return comments, total

    def create_comment(
        self, store_id: str, data: BuyerStoreCommentCreate
    ) -> BuyerStoreComment:
        """创建买手店评论"""
        insert_data = {
            "store_id": store_id,
            "user_id": data.userId,
            "content": data.content,
            "parent_id": data.parentId,
            "reply_to_user_id": data.replyToUserId,
        }

        result = (
            self.supabase.table("buyer_store_comments").insert(insert_data).execute()
        )

        if result.data:
            # 如果是回复，更新父评论的回复数
            if data.parentId:
                self.supabase.rpc(
                    "increment_reply_count", {"comment_id": data.parentId}
                ).execute()

            return self._format_comment(result.data[0])
        raise Exception("评论失败")

    def delete_comment(self, comment_id: int, user_id: int) -> bool:
        """删除评论"""
        # 先获取评论信息
        comment = (
            self.supabase.table("buyer_store_comments")
            .select("*")
            .eq("id", comment_id)
            .single()
            .execute()
        )

        if not comment.data:
            return False

        # 检查权限
        if comment.data["user_id"] != user_id:
            raise Exception("无权删除此评论")

        # 如果是回复，减少父评论的回复数
        if comment.data["parent_id"]:
            self.supabase.rpc(
                "decrement_reply_count", {"comment_id": comment.data["parent_id"]}
            ).execute()

        # 删除评论
        self.supabase.table("buyer_store_comments").delete().eq(
            "id", comment_id
        ).execute()

        return True

    def like_comment(self, comment_id: int, user_id: int) -> bool:
        """点赞评论"""
        try:
            self.supabase.table("buyer_store_comment_likes").insert(
                {
                    "comment_id": comment_id,
                    "user_id": user_id,
                }
            ).execute()

            # 更新点赞数
            self.supabase.rpc(
                "increment_comment_like_count", {"p_comment_id": comment_id}
            ).execute()

            return True
        except Exception:
            return False

    def unlike_comment(self, comment_id: int, user_id: int) -> bool:
        """取消点赞评论"""
        result = (
            self.supabase.table("buyer_store_comment_likes")
            .delete()
            .eq("comment_id", comment_id)
            .eq("user_id", user_id)
            .execute()
        )

        if result.data:
            # 更新点赞数
            self.supabase.rpc(
                "decrement_comment_like_count", {"p_comment_id": comment_id}
            ).execute()
            return True
        return False

    def _get_comment_replies(
        self, parent_id: int, limit: int = 3
    ) -> List[BuyerStoreCommentReply]:
        """获取评论的回复"""
        result = (
            self.supabase.table("buyer_store_comments")
            .select(
                "*, users!buyer_store_comments_user_id_fkey(username, user_info(avatar_url)), reply_to:users!buyer_store_comments_reply_to_user_id_fkey(username)"
            )
            .eq("parent_id", parent_id)
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
        )

        return [self._format_reply(r) for r in result.data]

    def get_all_replies(self, comment_id: int) -> List[BuyerStoreCommentReply]:
        """获取评论的所有回复"""
        result = (
            self.supabase.table("buyer_store_comments")
            .select(
                "*, users!buyer_store_comments_user_id_fkey(username, user_info(avatar_url)), reply_to:users!buyer_store_comments_reply_to_user_id_fkey(username)"
            )
            .eq("parent_id", comment_id)
            .order("created_at", desc=False)
            .execute()
        )

        return [self._format_reply(r) for r in result.data]

    def _format_comment(self, data: dict) -> BuyerStoreComment:
        """格式化评论数据"""
        user_data = data.get("users", {}) or {}
        user_info = user_data.get("user_info", {}) or {}

        return BuyerStoreComment(
            id=data["id"],
            storeId=data["store_id"],
            userId=data["user_id"],
            username=user_data.get("username", ""),
            userAvatar=user_info.get("avatar_url"),
            content=data["content"],
            likeCount=data.get("like_count", 0),
            replyCount=data.get("reply_count", 0),
            replies=[],
            createdAt=data["created_at"],
            updatedAt=data["updated_at"],
        )

    def _format_reply(self, data: dict) -> BuyerStoreCommentReply:
        """格式化回复数据"""
        user_data = data.get("users", {}) or {}
        user_info = user_data.get("user_info", {}) or {}
        reply_to = data.get("reply_to", {}) or {}

        return BuyerStoreCommentReply(
            id=data["id"],
            storeId=data["store_id"],
            parentId=data["parent_id"],
            userId=data["user_id"],
            username=user_data.get("username", ""),
            userAvatar=user_info.get("avatar_url"),
            replyToUserId=data.get("reply_to_user_id"),
            replyToUsername=reply_to.get("username"),
            content=data["content"],
            likeCount=data.get("like_count", 0),
            createdAt=data["created_at"],
            updatedAt=data["updated_at"],
        )

    # ==================== 买手店评分 ====================

    def rate_store(
        self, store_id: str, data: BuyerStoreRatingCreate
    ) -> BuyerStoreRating:
        """给买手店评分（如果已评分则更新）"""
        # 使用 upsert 实现创建或更新
        result = (
            self.supabase.table("buyer_store_ratings")
            .upsert(
                {
                    "store_id": store_id,
                    "user_id": data.userId,
                    "rating": data.rating,
                },
                on_conflict="store_id,user_id",
            )
            .execute()
        )

        if result.data:
            return self._format_rating(result.data[0])
        raise Exception("评分失败")

    def get_user_rating(
        self, store_id: str, user_id: int
    ) -> Optional[BuyerStoreRating]:
        """获取用户对买手店的评分"""
        result = (
            self.supabase.table("buyer_store_ratings")
            .select("*, users(username, user_info(avatar_url))")
            .eq("store_id", store_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if result.data and len(result.data) > 0:
            return self._format_rating(result.data[0])
        return None

    def get_rating_stats(self, store_id: str) -> BuyerStoreRatingStats:
        """获取买手店评分统计"""
        result = (
            self.supabase.table("buyer_store_rating_stats")
            .select("*")
            .eq("store_id", store_id)
            .limit(1)
            .execute()
        )

        if result.data and len(result.data) > 0:
            data = result.data[0]
            return BuyerStoreRatingStats(
                storeId=store_id,
                averageRating=float(data.get("average_rating", 0)),
                ratingCount=data.get("rating_count", 0),
                fiveStarCount=data.get("five_star_count", 0),
                fourStarCount=data.get("four_star_count", 0),
                threeStarCount=data.get("three_star_count", 0),
                twoStarCount=data.get("two_star_count", 0),
                oneStarCount=data.get("one_star_count", 0),
            )

        return BuyerStoreRatingStats(
            storeId=store_id,
            averageRating=0,
            ratingCount=0,
        )

    def _format_rating(self, data: dict) -> BuyerStoreRating:
        """格式化评分数据"""
        user_data = data.get("users", {}) or {}
        user_info = user_data.get("user_info", {}) or {}

        return BuyerStoreRating(
            id=data["id"],
            storeId=data["store_id"],
            userId=data["user_id"],
            username=user_data.get("username", ""),
            userAvatar=user_info.get("avatar_url"),
            rating=data["rating"],
            createdAt=data["created_at"],
            updatedAt=data["updated_at"],
        )

    # ==================== 买手店收藏 ====================

    def favorite_store(self, store_id: str, user_id: int) -> bool:
        """收藏买手店"""
        try:
            self.supabase.table("buyer_store_favorites").insert(
                {
                    "store_id": store_id,
                    "user_id": user_id,
                }
            ).execute()
            return True
        except Exception:
            return False

    def unfavorite_store(self, store_id: str, user_id: int) -> bool:
        """取消收藏买手店"""
        result = (
            self.supabase.table("buyer_store_favorites")
            .delete()
            .eq("store_id", store_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)

    def is_favorited(self, store_id: str, user_id: int) -> bool:
        """检查是否已收藏"""
        result = (
            self.supabase.table("buyer_store_favorites")
            .select("id")
            .eq("store_id", store_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return result.data is not None and len(result.data) > 0

    def get_user_favorites(
        self, user_id: int, page: int = 1, page_size: int = 20
    ) -> Tuple[List[str], int]:
        """获取用户收藏的买手店ID列表"""
        offset = (page - 1) * page_size

        # 获取总数
        count_result = (
            self.supabase.table("buyer_store_favorites")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        total = count_result.count or 0

        # 获取列表
        result = (
            self.supabase.table("buyer_store_favorites")
            .select("store_id")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        store_ids = [r["store_id"] for r in result.data]
        return store_ids, total

    def get_store_favorite_count(self, store_id: str) -> int:
        """获取买手店收藏数"""
        result = (
            self.supabase.table("buyer_store_favorites")
            .select("id", count="exact")
            .eq("store_id", store_id)
            .execute()
        )
        return result.count or 0

    def get_store_comment_count(self, store_id: str) -> int:
        """获取买手店评论数"""
        result = (
            self.supabase.table("buyer_store_comments")
            .select("id", count="exact")
            .eq("store_id", store_id)
            .execute()
        )
        return result.count or 0

    # ==================== 用户买手店动态 ====================

    def _get_store_lookup(self, store_ids: List[str]) -> dict:
        """批量获取买手店基础信息，返回 {store_id: row} 字典"""
        if not store_ids:
            return {}
        result = (
            self.supabase.table("buyer_stores")
            .select("id, name, city, country, images")
            .in_("id", list(set(store_ids)))
            .execute()
        )
        return {row["id"]: row for row in (result.data or [])}

    def get_user_favorited_stores_with_details(
        self, user_id: int, page: int = 1, page_size: int = 50
    ) -> Tuple[List[UserFavoritedStore], int]:
        """获取用户收藏的买手店（含店铺详情）"""
        offset = (page - 1) * page_size

        count_result = (
            self.supabase.table("buyer_store_favorites")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        total = count_result.count or 0

        result = (
            self.supabase.table("buyer_store_favorites")
            .select("store_id, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        store_ids = [r["store_id"] for r in result.data]
        store_map = self._get_store_lookup(store_ids)

        items = []
        for r in result.data:
            store = store_map.get(r["store_id"])
            if not store:
                continue
            images = store.get("images") or []
            items.append(UserFavoritedStore(
                storeId=r["store_id"],
                storeName=store["name"],
                storeCity=store["city"],
                storeCountry=store["country"],
                storeImage=images[0] if images else None,
                createdAt=r["created_at"],
            ))
        return items, total

    def get_user_comments_with_store_info(
        self, user_id: int, page: int = 1, page_size: int = 50
    ) -> Tuple[List[UserStoreComment], int]:
        """获取用户发表的买手店评论（含店铺信息）"""
        offset = (page - 1) * page_size

        count_result = (
            self.supabase.table("buyer_store_comments")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .is_("parent_id", "null")
            .execute()
        )
        total = count_result.count or 0

        result = (
            self.supabase.table("buyer_store_comments")
            .select("id, store_id, content, like_count, created_at")
            .eq("user_id", user_id)
            .is_("parent_id", "null")
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        store_ids = [r["store_id"] for r in result.data]
        store_map = self._get_store_lookup(store_ids)

        items = []
        for r in result.data:
            store = store_map.get(r["store_id"])
            if not store:
                continue
            images = store.get("images") or []
            items.append(UserStoreComment(
                storeId=r["store_id"],
                storeName=store["name"],
                storeCity=store["city"],
                storeCountry=store["country"],
                storeImage=images[0] if images else None,
                commentId=r["id"],
                content=r["content"],
                likeCount=r.get("like_count", 0),
                createdAt=r["created_at"],
            ))
        return items, total

    def get_user_ratings_with_store_info(
        self, user_id: int, page: int = 1, page_size: int = 50
    ) -> Tuple[List[UserStoreRatingItem], int]:
        """获取用户的买手店评分记录（含店铺信息）"""
        offset = (page - 1) * page_size

        count_result = (
            self.supabase.table("buyer_store_ratings")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        total = count_result.count or 0

        result = (
            self.supabase.table("buyer_store_ratings")
            .select("store_id, rating, created_at, updated_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        store_ids = [r["store_id"] for r in result.data]
        store_map = self._get_store_lookup(store_ids)

        items = []
        for r in result.data:
            store = store_map.get(r["store_id"])
            if not store:
                continue
            images = store.get("images") or []
            items.append(UserStoreRatingItem(
                storeId=r["store_id"],
                storeName=store["name"],
                storeCity=store["city"],
                storeCountry=store["country"],
                storeImage=images[0] if images else None,
                rating=r["rating"],
                createdAt=r["created_at"],
                updatedAt=r["updated_at"],
            ))
        return items, total

    def get_user_store_activity(self, user_id: int) -> UserStoreActivity:
        """获取用户全部买手店动态汇总"""
        favorites, fav_total = self.get_user_favorited_stores_with_details(user_id)
        comments, cmt_total = self.get_user_comments_with_store_info(user_id)
        ratings, rat_total = self.get_user_ratings_with_store_info(user_id)

        return UserStoreActivity(
            favorites=favorites,
            favoritesTotal=fav_total,
            comments=comments,
            commentsTotal=cmt_total,
            ratings=ratings,
            ratingsTotal=rat_total,
        )


# 创建服务实例
buyer_store_community_service = BuyerStoreCommunityService()
