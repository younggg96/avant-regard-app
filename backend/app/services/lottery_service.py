"""
月度抽奖服务

红线:
  * 严禁系统自动开奖 (`draw_round` 仅供 admin 路由调用).
  * 通知策略:  仅中奖者收到站内信+推送; 未中奖者不发任何通知,避免打扰.
  * 奖池由 lottery_rounds.prize_config JSONB 配置,服务层不写死任何奖品.
"""

from __future__ import annotations

import logging
import random
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.db.supabase import get_supabase
from app.schemas.level import (
    AdminDrawWinnerRequest,
    LotteryEntryInfo,
    LotteryPrize,
    LotteryRoundInfo,
)
from app.schemas.notification import NotificationType

logger = logging.getLogger(__name__)


def _current_month() -> str:
    now = datetime.utcnow()
    return f"{now.year:04d}-{now.month:02d}"


class LotteryService:
    def __init__(self) -> None:
        self.db = get_supabase()

    # ---- 期数 ----------------------------------------------------------

    def _get_or_create_round(self, month: Optional[str] = None) -> Dict[str, Any]:
        """幂等: 存在返回, 不存在建期 (OPEN)."""
        month = month or _current_month()
        existing = (
            self.db.table("lottery_rounds")
            .select("*")
            .eq("month", month)
            .execute()
        )
        if existing.data:
            return existing.data[0]
        ins = (
            self.db.table("lottery_rounds")
            .insert({
                "month": month,
                "prize_config": [],
                "status": "OPEN",
            })
            .execute()
        )
        return ins.data[0]

    def get_current_round(self) -> LotteryRoundInfo:
        row = self._get_or_create_round()
        return self._to_round_info(row)

    def list_rounds(self, limit: int = 24) -> List[LotteryRoundInfo]:
        res = (
            self.db.table("lottery_rounds")
            .select("*")
            .order("month", desc=True)
            .limit(limit)
            .execute()
        )
        return [self._to_round_info(r) for r in res.data or []]

    def admin_upsert_round(
        self,
        month: Optional[str],
        prize_config: List[LotteryPrize],
    ) -> LotteryRoundInfo:
        """Admin 建期 / 更新奖池. 已开奖的期数禁止再改奖池."""
        month = month or _current_month()
        row = self._get_or_create_round(month)
        if row["status"] != "OPEN":
            raise ValueError(f"{month} 已开奖或已关闭, 不能再修改奖池")

        serialized = [p.model_dump() for p in prize_config]
        upd = (
            self.db.table("lottery_rounds")
            .update({"prize_config": serialized})
            .eq("id", row["id"])
            .execute()
        )
        return self._to_round_info(upd.data[0] if upd.data else row)

    # ---- 参与 ----------------------------------------------------------

    def ensure_user_entered_current_round(self, user_id: int) -> None:
        """Lv3+ 用户在当月自动进池 (幂等). 不校验等级由调用方保证."""
        rnd = self._get_or_create_round()
        if rnd["status"] != "OPEN":
            return
        try:
            self.db.table("lottery_entries").insert({
                "round_id": rnd["id"],
                "user_id": user_id,
            }).execute()
        except Exception as e:  # noqa: BLE001
            # 预期的唯一索引冲突 (已进池) 安静忽略; 其它异常记日志便于排查.
            msg = str(e).lower()
            if "duplicate" in msg or "unique" in msg or "conflict" in msg:
                return
            logger.warning(
                "lottery ensure_user_entered failed user=%s round=%s: %s",
                user_id, rnd.get("id"), e,
            )

    def sync_round_entries(self, round_id: int) -> int:
        """Admin 触发: 把所有 Lv3+ 用户补齐到该期 lottery_entries.

        用于 "每月 1 号批量进池" 或 "紧急补录".
        返回新增的条目数.
        """
        # 取所有 Lv3+ user
        lv_res = (
            self.db.table("user_levels")
            .select("user_id")
            .gte("current_level", 3)
            .execute()
        )
        candidate_ids = [r["user_id"] for r in lv_res.data or []]
        if not candidate_ids:
            return 0

        # 取已进池 user
        entered_res = (
            self.db.table("lottery_entries")
            .select("user_id")
            .eq("round_id", round_id)
            .execute()
        )
        entered_ids = {r["user_id"] for r in entered_res.data or []}

        to_insert = [
            {"round_id": round_id, "user_id": uid}
            for uid in candidate_ids if uid not in entered_ids
        ]
        if not to_insert:
            return 0
        self.db.table("lottery_entries").insert(to_insert).execute()
        return len(to_insert)

    def get_user_entry(self, user_id: int) -> LotteryEntryInfo:
        """当前月用户参与/中奖状态. 未达到 Lv3 => entered=False."""
        rnd = self._get_or_create_round()
        res = (
            self.db.table("lottery_entries")
            .select("*")
            .eq("round_id", rnd["id"])
            .eq("user_id", user_id)
            .execute()
        )
        if not res.data:
            return LotteryEntryInfo(
                roundId=rnd["id"],
                month=rnd["month"],
                entered=False,
                isWinner=False,
                roundStatus=rnd["status"],
            )
        e = res.data[0]
        return LotteryEntryInfo(
            roundId=rnd["id"],
            month=rnd["month"],
            entered=True,
            isWinner=bool(e.get("is_winner")),
            prizeId=e.get("prize_id"),
            prizeName=e.get("prize_name"),
            prizeMeta=e.get("prize_meta"),
            roundStatus=rnd["status"],
        )

    # ---- 开奖 (严格 admin 人工触发) -------------------------------------

    def admin_draw_round(
        self,
        round_id: int,
        operator_id: int,
        explicit_winners: Optional[List[AdminDrawWinnerRequest]] = None,
    ) -> int:
        """开奖:
        * 若传入 explicit_winners, 按指定 user+prize 直接标记 (运营手动指派).
        * 否则按 prize_config 里的 quota 随机抽取 (先内奖 x 名, 再 y 名, ...).

        返回中奖人数.

        只能开奖 status=OPEN 的期数; 开奖后 status=DRAWN, 不可再改.
        """
        rnd_res = self.db.table("lottery_rounds").select("*").eq("id", round_id).execute()
        if not rnd_res.data:
            raise ValueError("抽奖期数不存在")
        rnd = rnd_res.data[0]
        if rnd["status"] != "OPEN":
            raise ValueError("该期数已开奖或关闭")

        prize_config = rnd.get("prize_config") or []
        if not prize_config and not explicit_winners:
            raise ValueError("奖池为空且未手动指派中奖者")

        # 读取参与名单
        entries_res = (
            self.db.table("lottery_entries")
            .select("id, user_id")
            .eq("round_id", round_id)
            .execute()
        )
        entries = entries_res.data or []
        entry_by_user = {e["user_id"]: e for e in entries}

        winners: List[Dict[str, Any]] = []

        if explicit_winners:
            prize_map = {p["prize_id"]: p for p in prize_config} if prize_config else {}
            for w in explicit_winners:
                if w.userId not in entry_by_user:
                    raise ValueError(f"user {w.userId} 未参与本期抽奖")
                prize_meta = prize_map.get(w.prizeId) or {}
                winners.append({
                    "entry_id": entry_by_user[w.userId]["id"],
                    "user_id":  w.userId,
                    "prize_id": w.prizeId,
                    "prize_name": prize_meta.get("name", w.prizeId),
                    "prize_meta": prize_meta.get("meta") or {},
                })
        else:
            remaining_entries = list(entries)
            random.shuffle(remaining_entries)
            for prize in prize_config:
                quota = int(prize.get("quota", 0))
                for _ in range(min(quota, len(remaining_entries))):
                    e = remaining_entries.pop()
                    winners.append({
                        "entry_id": e["id"],
                        "user_id":  e["user_id"],
                        "prize_id": prize["prize_id"],
                        "prize_name": prize["name"],
                        "prize_meta": prize.get("meta") or {},
                    })

        # 标记中奖条目
        for w in winners:
            self.db.table("lottery_entries").update({
                "is_winner": True,
                "prize_id": w["prize_id"],
                "prize_name": w["prize_name"],
                "prize_meta": w["prize_meta"],
            }).eq("id", w["entry_id"]).execute()

        # 关闭期数
        self.db.table("lottery_rounds").update({
            "status": "DRAWN",
            "drawn_at": datetime.utcnow().isoformat(),
            "drawn_by": operator_id,
        }).eq("id", round_id).execute()

        # 只给中奖者发通知 (未中奖不打扰)
        for w in winners:
            self._notify_winner(w["user_id"], rnd["month"], w["prize_name"])

        return len(winners)

    # ---- 辅助 ----------------------------------------------------------

    def _to_round_info(self, row: Dict[str, Any]) -> LotteryRoundInfo:
        prize_cfg = row.get("prize_config") or []
        # entries 统计
        count_res = (
            self.db.table("lottery_entries")
            .select("id", count="exact")
            .eq("round_id", row["id"])
            .execute()
        )
        total = count_res.count or 0
        winners_res = (
            self.db.table("lottery_entries")
            .select("id", count="exact")
            .eq("round_id", row["id"])
            .eq("is_winner", True)
            .execute()
        )
        winners = winners_res.count or 0
        return LotteryRoundInfo(
            id=row["id"],
            month=row["month"],
            status=row["status"],
            prizeConfig=[LotteryPrize(**p) for p in prize_cfg],
            drawnAt=row.get("drawn_at"),
            totalEntries=total,
            totalWinners=winners,
        )

    def _notify_winner(self, user_id: int, month: str, prize_name: str) -> None:
        try:
            from app.services.notification_service import notification_service
            notification_service.create_notification(
                user_id=user_id,
                notification_type=NotificationType.SYSTEM,
                title=f"🎉 恭喜中奖 · {month}",
                message=f"您在本月抽奖中获得:  {prize_name}",
                action_data={
                    "navigateTo": "MyLevel",
                    "navigateParams": {"focus": "lottery"},
                },
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("notify winner failed user=%s: %s", user_id, e)


# 单例
lottery_service = LotteryService()
