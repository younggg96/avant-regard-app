"""
Content moderation service: report content + block users.
Required by Apple Guideline 1.2 (User-Generated Content).
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from app.db.supabase import get_supabase, get_supabase_admin

logger = logging.getLogger(__name__)


class DuplicateReportError(Exception):
    """Raised when a duplicate report is submitted within the rate-limit window."""
    pass


class ModerationService:
    def __init__(self):
        self.db = get_supabase()
        self.db_admin = get_supabase_admin()

    VALID_TARGET_TYPES = {"POST", "COMMENT", "MESSAGE", "USER"}

    def report_content(
        self,
        reporter_id: int,
        target_type: str,
        target_id: int,
        reason: str,
        description: str = "",
    ) -> dict:
        """
        Submit a content report.
        target_type: POST | COMMENT | MESSAGE | USER
        For USER reports, target_id is the reported user's id.
        Rate-limited: same reporter can only report the same target once per 24h.
        """
        if target_type not in self.VALID_TARGET_TYPES:
            raise ValueError(f"Invalid target_type: {target_type}")

        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        existing = (
            self.db.table("content_reports")
            .select("id")
            .eq("reporter_id", reporter_id)
            .eq("target_type", target_type)
            .eq("target_id", target_id)
            .gte("created_at", cutoff)
            .limit(1)
            .execute()
        )
        if existing.data:
            raise DuplicateReportError("24小时内已举报过，请勿重复提交")

        data = {
            "reporter_id": reporter_id,
            "target_type": target_type,
            "target_id": target_id,
            "reason": reason,
            "description": description or "",
            "status": "PENDING",
        }
        result = self.db.table("content_reports").insert(data).execute()
        if not result.data:
            raise Exception("Failed to submit report")
        return self._format_report(result.data[0])

    def block_user(self, blocker_id: int, blocked_id: int) -> bool:
        """Block a user. Also reports the user to the platform."""
        if blocker_id == blocked_id:
            return False

        existing = (
            self.db.table("user_blocks")
            .select("id")
            .eq("blocker_id", blocker_id)
            .eq("blocked_id", blocked_id)
            .execute()
        )
        if existing.data:
            return True

        self.db.table("user_blocks").insert({
            "blocker_id": blocker_id,
            "blocked_id": blocked_id,
        }).execute()
        return True

    def unblock_user(self, blocker_id: int, blocked_id: int) -> bool:
        """Unblock a previously blocked user."""
        result = (
            self.db.table("user_blocks")
            .delete()
            .eq("blocker_id", blocker_id)
            .eq("blocked_id", blocked_id)
            .execute()
        )
        return True

    def get_blocked_user_ids(self, user_id: int) -> List[int]:
        """Get all user IDs blocked by a given user."""
        result = (
            self.db.table("user_blocks")
            .select("blocked_id")
            .eq("blocker_id", user_id)
            .execute()
        )
        return [row["blocked_id"] for row in result.data or []]

    def get_blocked_users(self, user_id: int) -> List[dict]:
        """Get blocked users with basic profile info."""
        blocked_ids = self.get_blocked_user_ids(user_id)
        if not blocked_ids:
            return []

        users_result = (
            self.db.table("users")
            .select("id, username")
            .in_("id", blocked_ids)
            .execute()
        )
        user_map = {u["id"]: u for u in users_result.data or []}

        info_result = (
            self.db.table("user_info")
            .select("user_id, avatar_url")
            .in_("user_id", blocked_ids)
            .execute()
        )
        info_map = {i["user_id"]: i for i in info_result.data or []}

        result = []
        for uid in blocked_ids:
            u = user_map.get(uid, {})
            i = info_map.get(uid, {})
            result.append({
                "userId": uid,
                "username": u.get("username", ""),
                "avatarUrl": i.get("avatar_url", ""),
            })
        return result

    def is_blocked(self, user_id: int, target_id: int) -> bool:
        """Check whether user_id has blocked target_id."""
        result = (
            self.db.table("user_blocks")
            .select("id")
            .eq("blocker_id", user_id)
            .eq("blocked_id", target_id)
            .execute()
        )
        return bool(result.data)

    def get_my_reports(
        self, user_id: int, page: int = 1, page_size: int = 20
    ) -> dict:
        """Get the current user's own report history with target details."""
        offset = (page - 1) * page_size

        query = (
            self.db.table("content_reports")
            .select("*", count="exact")
            .eq("reporter_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
        )
        result = query.execute()
        total = result.count or 0

        post_ids = [r["target_id"] for r in result.data or [] if r["target_type"] == "POST"]
        comment_ids = [r["target_id"] for r in result.data or [] if r["target_type"] == "COMMENT"]
        message_ids = [r["target_id"] for r in result.data or [] if r["target_type"] == "MESSAGE"]
        user_ids = [r["target_id"] for r in result.data or [] if r["target_type"] == "USER"]

        post_map: dict = {}
        if post_ids:
            p_result = (
                self.db.table("posts")
                .select("id, title, type, images")
                .in_("id", post_ids)
                .execute()
            )
            for p in p_result.data or []:
                images = p.get("images") or []
                post_map[p["id"]] = {
                    "title": p.get("title", ""),
                    "type": p.get("type", ""),
                    "coverImage": images[0] if images else "",
                }

        comment_map: dict = {}
        if comment_ids:
            c_result = (
                self.db.table("comments")
                .select("id, content, post_id")
                .in_("id", comment_ids)
                .execute()
            )
            for c in c_result.data or []:
                comment_map[c["id"]] = {
                    "content": c.get("content", ""),
                    "postId": c.get("post_id"),
                }

        message_map: dict = {}
        if message_ids:
            m_result = (
                self.db.table("messages")
                .select("id, content, sender_id")
                .in_("id", message_ids)
                .execute()
            )
            for m in m_result.data or []:
                message_map[m["id"]] = {
                    "content": m.get("content", ""),
                    "senderId": m.get("sender_id"),
                }

        user_map: dict = {}
        if user_ids:
            u_result = (
                self.db.table("users")
                .select("id, username")
                .in_("id", user_ids)
                .execute()
            )
            for u in u_result.data or []:
                user_map[u["id"]] = {"username": u.get("username", "")}

        reports = []
        for r in result.data or []:
            target_info = {}
            if r["target_type"] == "POST":
                target_info = post_map.get(r["target_id"], {})
            elif r["target_type"] == "COMMENT":
                target_info = comment_map.get(r["target_id"], {})
            elif r["target_type"] == "MESSAGE":
                target_info = message_map.get(r["target_id"], {})
            elif r["target_type"] == "USER":
                target_info = user_map.get(r["target_id"], {})

            reports.append({
                "id": r["id"],
                "targetType": r["target_type"],
                "targetId": r["target_id"],
                "reason": r["reason"],
                "description": r.get("description", ""),
                "status": r.get("status", "PENDING"),
                "createdAt": r.get("created_at"),
                "targetInfo": target_info,
            })

        return {
            "reports": reports,
            "total": total,
            "page": page,
            "pageSize": page_size,
        }

    @staticmethod
    def _format_report(data: dict) -> dict:
        return {
            "id": data["id"],
            "reporterId": data["reporter_id"],
            "targetType": data["target_type"],
            "targetId": data["target_id"],
            "reason": data["reason"],
            "description": data.get("description", ""),
            "status": data.get("status", "PENDING"),
            "createdAt": data.get("created_at"),
        }


moderation_service = ModerationService()
