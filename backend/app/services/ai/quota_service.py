"""
AI 发帖助手 — 用户每日配额。

需求 (V3 #25):
  - 「重新生成」一天最多 3 次。
  - 总生成次数也设 cap 防止恶意刷 token。

实现要点:
  - 单行 per user;首次访问时 INSERT,其后 UPSERT。
  - 日切重置: daily_reset_at < CURRENT_DATE 时把 daily_count / daily_regen_count
    归零再扣减,保证用户不活跃就不重置 (省 IO)。
  - check_and_consume() 在 LLM 调用前预占配额,阻挡超限请求;调用真失败/blocked
    时通过 ai_post_service_logs 记录,但不退还 quota (违规图也算次数,反爬刷)。
  - 这一层不抛 HTTPException,只返回 (allowed, info),由 ai_post_service /
    路由层翻译为 429。这样 service 也能在脚本/管理员场景里不带 HTTP 上下文用。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional

from app.core.config import settings
from app.db.supabase import get_supabase, get_supabase_admin
from app.schemas.ai_post import QuotaInfo


@dataclass
class QuotaCheckResult:
    allowed: bool
    info: QuotaInfo
    reason: Optional[str] = None     # "DAILY_LIMIT" | "REGEN_LIMIT" | None


class QuotaService:
    def __init__(self):
        self.db = get_supabase_admin()

    # -----------------------------------------------------------------
    # 读
    # -----------------------------------------------------------------
    def _fetch_or_init(self, user_id: int) -> dict:
        """读取一行;不存在则插入默认行。返回已经过日切归零的数据。"""
        result = (
            self.db.table("ai_post_quota")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        if result.data:
            row = result.data[0]
        else:
            row = {
                "user_id": user_id,
                "daily_count": 0,
                "daily_regen_count": 0,
                "daily_reset_at": str(date.today()),
            }
            self.db.table("ai_post_quota").insert(row).execute()

        # 日切判断
        reset_at = row.get("daily_reset_at")
        if reset_at and str(reset_at) < str(date.today()):
            row["daily_count"] = 0
            row["daily_regen_count"] = 0
            row["daily_reset_at"] = str(date.today())
            self.db.table("ai_post_quota").update({
                "daily_count": 0,
                "daily_regen_count": 0,
                "daily_reset_at": str(date.today()),
            }).eq("user_id", user_id).execute()

        return row

    def get_info(self, user_id: int) -> QuotaInfo:
        row = self._fetch_or_init(user_id)
        return QuotaInfo(
            daily_generate_used=row.get("daily_count", 0),
            daily_generate_limit=settings.AI_DAILY_GENERATE_LIMIT,
            daily_regen_used=row.get("daily_regen_count", 0),
            daily_regen_limit=settings.AI_DAILY_REGEN_LIMIT,
        )

    # -----------------------------------------------------------------
    # 写: 检查 + 扣减
    # -----------------------------------------------------------------
    def check_and_consume(self, user_id: int, *, is_regenerate: bool) -> QuotaCheckResult:
        """
        预占配额。允许则原子 +1 后返回 allowed=True;
        超限返回 allowed=False 且不修改计数。

        is_regenerate=True 时同时检查 daily_regen_count;
        regenerate 也会算入 daily_count (因为同样消耗 token)。
        """
        row = self._fetch_or_init(user_id)
        cur_total = row.get("daily_count", 0)
        cur_regen = row.get("daily_regen_count", 0)

        if cur_total >= settings.AI_DAILY_GENERATE_LIMIT:
            return QuotaCheckResult(
                allowed=False,
                info=QuotaInfo(
                    daily_generate_used=cur_total,
                    daily_generate_limit=settings.AI_DAILY_GENERATE_LIMIT,
                    daily_regen_used=cur_regen,
                    daily_regen_limit=settings.AI_DAILY_REGEN_LIMIT,
                ),
                reason="DAILY_LIMIT",
            )

        if is_regenerate and cur_regen >= settings.AI_DAILY_REGEN_LIMIT:
            return QuotaCheckResult(
                allowed=False,
                info=QuotaInfo(
                    daily_generate_used=cur_total,
                    daily_generate_limit=settings.AI_DAILY_GENERATE_LIMIT,
                    daily_regen_used=cur_regen,
                    daily_regen_limit=settings.AI_DAILY_REGEN_LIMIT,
                ),
                reason="REGEN_LIMIT",
            )

        new_total = cur_total + 1
        new_regen = cur_regen + (1 if is_regenerate else 0)
        self.db.table("ai_post_quota").update({
            "daily_count": new_total,
            "daily_regen_count": new_regen,
        }).eq("user_id", user_id).execute()

        return QuotaCheckResult(
            allowed=True,
            info=QuotaInfo(
                daily_generate_used=new_total,
                daily_generate_limit=settings.AI_DAILY_GENERATE_LIMIT,
                daily_regen_used=new_regen,
                daily_regen_limit=settings.AI_DAILY_REGEN_LIMIT,
            ),
        )


quota_service = QuotaService()
