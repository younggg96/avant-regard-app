"""
Auth issue report service.

Collects pre-login problem reports (OTP undelivered, register/login failure, etc.)
so support staff can follow up with the user. Reporter may be unauthenticated,
so there is no user FK — we rely on the submitted contact channel (phone/email).
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.db.supabase import get_supabase_admin

logger = logging.getLogger(__name__)


class AuthReportRateLimitError(Exception):
    """Raised when the same contact submits reports too frequently."""
    pass


class AuthReportService:
    VALID_ISSUE_TYPES = {
        "OTP_NOT_RECEIVED",
        "REGISTER_FAILED",
        "LOGIN_FAILED",
        "OTHER",
    }
    VALID_CONTACT_TYPES = {"PHONE", "EMAIL", "OTHER"}

    # Per-contact rate limit: at most N reports per window.
    RATE_LIMIT_WINDOW_MIN = 10
    RATE_LIMIT_MAX = 5

    # Hard caps to avoid abuse / DB bloat.
    MAX_DESCRIPTION_LEN = 1000
    MAX_CONTACT_LEN = 200
    MAX_DEVICE_INFO_LEN = 500

    def __init__(self):
        # Use admin client: endpoint is public, but we write with service role
        # so anon RLS cannot block inserts.
        self.db = get_supabase_admin()

    def submit_report(
        self,
        issue_type: str,
        contact_type: str,
        contact_value: str,
        description: str = "",
        app_version: str = "",
        platform: str = "",
        device_info: str = "",
        client_ip: str = "",
    ) -> dict:
        """Persist a new auth issue report. Raises on validation / rate-limit."""
        if issue_type not in self.VALID_ISSUE_TYPES:
            raise ValueError(f"Invalid issue_type: {issue_type}")
        if contact_type not in self.VALID_CONTACT_TYPES:
            raise ValueError(f"Invalid contact_type: {contact_type}")

        contact_value = (contact_value or "").strip()
        if not contact_value:
            raise ValueError("contact_value is required")
        if len(contact_value) > self.MAX_CONTACT_LEN:
            raise ValueError("contact_value is too long")

        description = (description or "").strip()[: self.MAX_DESCRIPTION_LEN]
        device_info = (device_info or "").strip()[: self.MAX_DEVICE_INFO_LEN]

        self._enforce_rate_limit(contact_value)

        payload = {
            "issue_type": issue_type,
            "contact_type": contact_type,
            "contact_value": contact_value,
            "description": description,
            "app_version": (app_version or "")[:32],
            "platform": (platform or "")[:16],
            "device_info": device_info,
            "client_ip": (client_ip or "")[:64],
            "status": "PENDING",
        }
        result = self.db.table("auth_issue_reports").insert(payload).execute()
        if not result.data:
            raise RuntimeError("Failed to insert auth issue report")

        logger.info(
            "auth_issue_report.created id=%s type=%s contact=%s",
            result.data[0].get("id"),
            issue_type,
            contact_value,
        )
        return self._format(result.data[0])

    def _enforce_rate_limit(self, contact_value: str) -> None:
        cutoff = (
            datetime.now(timezone.utc)
            - timedelta(minutes=self.RATE_LIMIT_WINDOW_MIN)
        ).isoformat()
        recent = (
            self.db.table("auth_issue_reports")
            .select("id", count="exact")
            .eq("contact_value", contact_value)
            .gte("created_at", cutoff)
            .execute()
        )
        count = recent.count or 0
        if count >= self.RATE_LIMIT_MAX:
            raise AuthReportRateLimitError(
                f"提交过于频繁，请 {self.RATE_LIMIT_WINDOW_MIN} 分钟后再试"
            )

    @staticmethod
    def _format(row: dict) -> dict:
        return {
            "id": row.get("id"),
            "issueType": row.get("issue_type"),
            "contactType": row.get("contact_type"),
            "contactValue": row.get("contact_value"),
            "description": row.get("description", ""),
            "status": row.get("status", "PENDING"),
            "createdAt": row.get("created_at"),
        }


auth_report_service = AuthReportService()
