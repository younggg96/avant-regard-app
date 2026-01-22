"""
买手店社区服务 - 处理用户提交、评论、评分、收藏功能
"""

from typing import Optional, List, Tuple
from datetime import datetime

from app.db.supabase import get_supabase
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
)


class BuyerStoreCommunityService:
    """买手店社区服务"""

    def __init__(self):
        self.supabase = get_supabase()

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

    def review_submission(
        self, submission_id: int, reviewer_id: int, data: ReviewSubmissionRequest
    ) -> UserSubmittedStore:
        """审核用户提交的买手店"""
        update_data = {
            "status": data.status,
            "reviewed_by": reviewer_id,
            "reviewed_at": datetime.now().isoformat(),
        }

        if data.status == "REJECTED":
            update_data["reject_reason"] = data.rejectReason
        elif data.status == "APPROVED" and data.storeId:
            update_data["approved_store_id"] = data.storeId

        result = (
            self.supabase.table("user_submitted_stores")
            .update(update_data)
            .eq("id", submission_id)
            .execute()
        )

        if result.data:
            return self._format_submitted_store(result.data[0])
        raise Exception("审核失败")

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
            .maybe_single()
            .execute()
        )

        if result.data:
            return self._format_rating(result.data)
        return None

    def get_rating_stats(self, store_id: str) -> BuyerStoreRatingStats:
        """获取买手店评分统计"""
        result = (
            self.supabase.table("buyer_store_rating_stats")
            .select("*")
            .eq("store_id", store_id)
            .maybe_single()
            .execute()
        )

        if result.data:
            return BuyerStoreRatingStats(
                storeId=store_id,
                averageRating=float(result.data.get("average_rating", 0)),
                ratingCount=result.data.get("rating_count", 0),
                fiveStarCount=result.data.get("five_star_count", 0),
                fourStarCount=result.data.get("four_star_count", 0),
                threeStarCount=result.data.get("three_star_count", 0),
                twoStarCount=result.data.get("two_star_count", 0),
                oneStarCount=result.data.get("one_star_count", 0),
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
            .maybe_single()
            .execute()
        )
        return result.data is not None

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


# 创建服务实例
buyer_store_community_service = BuyerStoreCommunityService()
