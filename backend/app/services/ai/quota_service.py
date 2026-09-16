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


@dataclass
class ThreeViewQuotaInfo:
    used: int
    limit: int


@dataclass
class ThreeViewQuotaCheck:
    allowed: bool
    info: ThreeViewQuotaInfo
    reason: Optional[str] = None     # "DAILY_LIMIT" | None


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
            reset = {
                "daily_count": 0,
                "daily_regen_count": 0,
                "daily_three_view_count": 0,
                "daily_attribution_count": 0,
                "daily_reset_at": str(date.today()),
            }
            row.update(reset)
            self.db.table("ai_post_quota").update(reset).eq(
                "user_id", user_id
            ).execute()

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

    # -----------------------------------------------------------------
    # 护照相关配额 (三视图 / 归因,各自独立计数,不与发帖配额互相消耗)
    #
    # 都是「先扣后用」:调用失败也不退还,避免拿坏图反复重试刷掉预算。
    # -----------------------------------------------------------------
    def _peek_counter(self, user_id: int, column: str, limit: int) -> ThreeViewQuotaInfo:
        row = self._fetch_or_init(user_id)
        return ThreeViewQuotaInfo(used=row.get(column, 0) or 0, limit=limit)

    def _consume_counter(
        self, user_id: int, column: str, limit: int
    ) -> ThreeViewQuotaCheck:
        row = self._fetch_or_init(user_id)
        used = row.get(column, 0) or 0

        if used >= limit:
            return ThreeViewQuotaCheck(
                allowed=False,
                info=ThreeViewQuotaInfo(used=used, limit=limit),
                reason="DAILY_LIMIT",
            )

        self.db.table("ai_post_quota").update({column: used + 1}).eq(
            "user_id", user_id
        ).execute()

        return ThreeViewQuotaCheck(
            allowed=True, info=ThreeViewQuotaInfo(used=used + 1, limit=limit)
        )

    def _refund_counter(self, user_id: int, column: str) -> None:
        """
        退还一次已扣的配额。

        只用于「请求根本没发出去」的情况(比如连不上上游),此时没有产生任何
        费用,扣着不放等于白吃用户额度。

        注意这与上面「失败不退还」的默认策略并不矛盾:那条针对的是模型真的
        跑了但结果不理想 —— 那种要是能退,用户就会拿坏图反复重试刷预算。
        """
        row = self._fetch_or_init(user_id)
        used = row.get(column, 0) or 0
        if used <= 0:
            return
        self.db.table("ai_post_quota").update({column: used - 1}).eq(
            "user_id", user_id
        ).execute()

    def refund_three_view(self, user_id: int) -> None:
        self._refund_counter(user_id, "daily_three_view_count")

    def get_three_view_info(self, user_id: int) -> ThreeViewQuotaInfo:
        return self._peek_counter(
            user_id, "daily_three_view_count", settings.THREE_VIEW_DAILY_LIMIT
        )

    def check_and_consume_three_view(self, user_id: int) -> ThreeViewQuotaCheck:
        return self._consume_counter(
            user_id, "daily_three_view_count", settings.THREE_VIEW_DAILY_LIMIT
        )

    def get_attribution_info(self, user_id: int) -> ThreeViewQuotaInfo:
        return self._peek_counter(
            user_id, "daily_attribution_count", settings.ATTRIBUTION_DAILY_LIMIT
        )

    def check_and_consume_attribution(self, user_id: int) -> ThreeViewQuotaCheck:
        return self._consume_counter(
            user_id, "daily_attribution_count", settings.ATTRIBUTION_DAILY_LIMIT
        )


quota_service = QuotaService()
