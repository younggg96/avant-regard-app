"""
用户等级服务 / 异步规则引擎

===== 核心红线 =====
  1. **只升不降**:      数据库触发器 + 服务层双重校验,current_level 只可增不可减.
  2. **极简驱动**:      任务通过累计计数判定; 绝不引入积分经济 / 每日打卡 / 签到.
  3. **人工管控**:      Lv4 达标后进入 level_upgrade_requests 审批队列;
                       Lv5 只能由 Admin 直接赋予; 抽奖开奖严禁系统自动.

===== 规则引擎工作方式 =====
    上游业务服务 (post_service / follow_service / comment_service / ...)
    在完成一次用户行为后调用 `level_service.record_action(user_id, action)`.
    `record_action` 把任务下发到后台线程池执行,避免阻塞请求主路径:
      1) 累加 counters JSONB 计数器
      2) 调用 _evaluate 根据 LEVEL_RULES 判断是否达到下一级
      3) Lv1/2/3 自动升级并下发站内信;
         Lv4 达标仅创建 PENDING 升级申请, 不改 current_level;
         Lv5 不触发, 必须走 admin_grant_level.
"""

from __future__ import annotations

import logging
import threading
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.db.supabase import get_supabase
from app.schemas.level import (
    LevelAction,
    LevelSpec,
    LevelTaskProgress,
    LevelTaskSpec,
    UpgradeRequestInfo,
    UserBenefitInfo,
    UserLevelStatus,
)
from app.schemas.notification import NotificationType

logger = logging.getLogger(__name__)


# =====================================================
# 1. 规则表:  所有升级条件的单一事实源
#    任何等级 / 任务文案变更只在这里改,服务层 & 前端均以此为准.
# =====================================================

LEVEL_RULES: List[LevelSpec] = [
    LevelSpec(
        level=1,
        title="萌新",
        subtitle="迈出第一步",
        mode="AUTO",
        tasks=[
            LevelTaskSpec(action=LevelAction.POST_CREATED,       target=1, label="发布 1 篇帖子"),
            LevelTaskSpec(action=LevelAction.COMMUNITY_FOLLOWED, target=1, label="关注 1 个社区"),
        ],
    ),
    LevelSpec(
        level=2,
        title="活跃",
        subtitle="开始与社区互动",
        mode="AUTO",
        tasks=[
            LevelTaskSpec(action=LevelAction.POST_LIKED,    target=10, label="点赞 10 篇帖子"),
            LevelTaskSpec(action=LevelAction.USER_FOLLOWED, target=3,  label="关注 3 个用户"),
        ],
    ),
    LevelSpec(
        level=3,
        title="探店官",
        subtitle="解锁月度抽奖入口",
        benefit="每月参与一次专属抽奖",
        mode="AUTO",
        tasks=[
            LevelTaskSpec(action=LevelAction.WANT_CLICKED,    target=10, label='点击 10 个 "我想去"'),
            LevelTaskSpec(action=LevelAction.STORE_COMMENTED, target=5,  label="评论 5 家买手店"),
        ],
    ),
    LevelSpec(
        level=4,
        title="档案官",
        subtitle="达标后需 Admin 审核",
        benefit="获得免费活动门票 1 次",
        mode="AUDIT",
        tasks=[
            LevelTaskSpec(action=LevelAction.ARCHIVE_UPLOADED, target=3,
                          label="上传 3 个秀场 / 买手店档案"),
        ],
    ),
    LevelSpec(
        level=5,
        title="荣誉官",
        subtitle="仅运营人工授予",
        benefit="年度权益 (线下对接,联系运营使用)",
        mode="MANUAL",
        tasks=[],
    ),
]


def _spec_by_level(level: int) -> Optional[LevelSpec]:
    """按 level 找规则项; 未定义返回 None."""
    for s in LEVEL_RULES:
        if s.level == level:
            return s
    return None


# =====================================================
# 2. 异步执行器:  规则引擎跑在后台线程,避免阻塞 API
# =====================================================

_LEVEL_EXEC = ThreadPoolExecutor(max_workers=2, thread_name_prefix="level-engine")


# =====================================================
# 2.1 进程内 per-user 锁:
#     规则引擎的 JSONB counters / benefits 扣减都是 read-modify-write,
#     Supabase Python client 不提供行级事务, 需要在服务内序列化同一 user 的写操作,
#     避免:
#       1) counters: 同时发生两次行为 -> 后写覆盖前写 (丢失更新).
#       2) benefits: 用户双击核销 -> 两次读到同样的 used -> 重复核销但只扣一次配额.
#
# 这里只能防护单进程并发; 若将来横向扩容须改为 DB RPC 原子更新 + 唯一约束.
# 锁字典用 WeakValue 模式会更严谨, 这里用普通 dict 配合全局字典锁保守实现.
# =====================================================

_USER_LOCKS: Dict[int, threading.Lock] = defaultdict(threading.Lock)
_USER_LOCKS_GUARD = threading.Lock()


def _lock_for(user_id: int) -> threading.Lock:
    """获取 user 级串行锁. 同一进程内同一用户的写路径会被序列化."""
    with _USER_LOCKS_GUARD:
        return _USER_LOCKS[int(user_id)]


# =====================================================
# 3. 核心服务
# =====================================================

class LevelService:
    def __init__(self) -> None:
        self.db = get_supabase()

    # ---- 3.1 公共查询 --------------------------------------------------

    def _get_row(self, user_id: int) -> Dict[str, Any]:
        """取 user_levels 行, 无则 lazy 创建 Lv0."""
        res = (
            self.db.table("user_levels")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        if res.data:
            return res.data[0]
        self.db.table("user_levels").insert(
            {"user_id": user_id, "current_level": 0}
        ).execute()
        return {"user_id": user_id, "current_level": 0,
                "pending_level": None, "last_level_up_at": None}

    def _get_counters(self, user_id: int) -> Dict[str, int]:
        """取 user_level_progress 计数器, 无则返回空 dict."""
        res = (
            self.db.table("user_level_progress")
            .select("counters")
            .eq("user_id", user_id)
            .execute()
        )
        if res.data:
            return res.data[0].get("counters") or {}
        return {}

    def get_user_level(self, user_id: int) -> int:
        return int(self._get_row(user_id).get("current_level") or 0)

    def get_status(self, user_id: int) -> UserLevelStatus:
        """组装 `我的等级` 页面需要的完整状态."""
        row = self._get_row(user_id)
        counters = self._get_counters(user_id)
        current_level = int(row.get("current_level") or 0)
        next_level = current_level + 1 if current_level < 5 else None

        next_tasks: List[LevelTaskProgress] = []
        next_spec: Optional[LevelSpec] = _spec_by_level(next_level) if next_level else None
        if next_spec:
            for t in next_spec.tasks:
                progress = int(counters.get(t.action, 0))
                next_tasks.append(LevelTaskProgress(
                    action=t.action,
                    label=t.label,
                    target=t.target,
                    progress=min(progress, t.target),
                    completed=progress >= t.target,
                ))

        return UserLevelStatus(
            userId=user_id,
            currentLevel=current_level,
            pendingLevel=row.get("pending_level"),
            lastLevelUpAt=row.get("last_level_up_at"),
            nextLevel=next_level,
            nextLevelTitle=next_spec.title if next_spec else None,
            nextLevelBenefit=next_spec.benefit if next_spec else None,
            nextTasks=next_tasks,
            benefits=self.list_user_benefits(user_id),
        )

    # ---- 3.2 计数 & 规则引擎 -----------------------------------------

    def record_action(self, user_id: int, action: str, delta: int = 1) -> None:
        """对外入口: 在后台线程执行, fire-and-forget."""
        if not user_id or delta == 0:
            return
        _LEVEL_EXEC.submit(self._record_action_safe, user_id, action, delta)

    def _record_action_safe(self, user_id: int, action: str, delta: int) -> None:
        try:
            self._record_action_sync(user_id, action, delta)
        except Exception as exc:  # noqa: BLE001
            logger.exception("level rule engine failure (user=%s action=%s): %s",
                             user_id, action, exc)

    def _record_action_sync(self, user_id: int, action: str, delta: int) -> None:
        # 串行化同一用户的计数更新, 避免并发行为触发的 read-modify-write 丢失.
        with _lock_for(user_id):
            # 1) 累加 counters
            counters = self._get_counters(user_id)
            counters[action] = int(counters.get(action, 0)) + delta
            self.db.table("user_level_progress").upsert(
                {"user_id": user_id, "counters": counters,
                 "updated_at": datetime.utcnow().isoformat()},
                on_conflict="user_id",
            ).execute()

            # 2) 评估下一级 (位于锁内, 保证 _apply_upgrade / _ensure_pending_request
            #    不会与另一条行为同时触发相同升级路径)
            self._evaluate(user_id, counters)

    def _evaluate(self, user_id: int, counters: Dict[str, int]) -> None:
        """从当前等级向上依次检查, 把能自动升的全部升完 (处理一次记录触发多次升级)."""
        row = self._get_row(user_id)
        current_level = int(row.get("current_level") or 0)

        while current_level < 5:
            next_level = current_level + 1
            spec = _spec_by_level(next_level)
            if not spec:
                break

            # 任务未满足 -> 跳出
            if not all(
                int(counters.get(t.action, 0)) >= t.target
                for t in spec.tasks
            ):
                break

            if spec.mode == "AUTO":
                self._apply_upgrade(user_id, next_level)
                current_level = next_level
                continue

            if spec.mode == "AUDIT":
                # Lv4 达标:  创建 PENDING 审批, 不改 current_level
                self._ensure_pending_request(user_id, next_level)
                break

            # MANUAL (Lv5) -> 不自动触发
            break

    def _apply_upgrade(self, user_id: int, new_level: int) -> None:
        """写入 current_level + 下发站内信 + 触发对应权益."""
        now = datetime.utcnow().isoformat()
        self.db.table("user_levels").update({
            "current_level": new_level,
            "last_level_up_at": now,
            "pending_level": None,
        }).eq("user_id", user_id).execute()

        self._grant_level_benefits(user_id, new_level)
        self._notify_level_up(user_id, new_level)

        # 升到 Lv3+ 自动进入当月抽奖池 (懒加载模式, 延迟避免循环 import)
        if new_level >= 3:
            try:
                from app.services.lottery_service import lottery_service
                lottery_service.ensure_user_entered_current_round(user_id)
            except Exception as e:  # noqa: BLE001
                logger.warning("enroll lottery failed user=%s: %s", user_id, e)

    def _ensure_pending_request(self, user_id: int, target_level: int) -> None:
        """Lv4 达标 -> 如果没有 PENDING 记录则创建."""
        existing = (
            self.db.table("level_upgrade_requests")
            .select("id")
            .eq("user_id", user_id)
            .eq("target_level", target_level)
            .eq("status", "PENDING")
            .execute()
        )
        if existing.data:
            return
        self.db.table("level_upgrade_requests").insert({
            "user_id": user_id,
            "target_level": target_level,
            "status": "PENDING",
        }).execute()
        self.db.table("user_levels").update({"pending_level": target_level}) \
            .eq("user_id", user_id).execute()
        self._notify_pending_audit(user_id, target_level)

    # ---- 3.3 权益授予 --------------------------------------------------

    def _grant_level_benefits(self, user_id: int, level: int) -> None:
        """升级时自动发放该等级对应的权益 (Lv4 -> 1 张免费门票; Lv5 -> 年度权益)."""
        res = (
            self.db.table("level_benefits")
            .select("id, benefit_type, default_quota")
            .eq("level_required", level)
            .eq("is_active", True)
            .execute()
        )
        for b in res.data or []:
            self._grant_benefit(user_id, b["id"], b["default_quota"])

    def _grant_benefit(self, user_id: int, benefit_id: int, quota: int) -> None:
        """新建或累加 user_level_benefits.quota."""
        existing = (
            self.db.table("user_level_benefits")
            .select("id, quota")
            .eq("user_id", user_id)
            .eq("benefit_id", benefit_id)
            .execute()
        )
        if existing.data:
            self.db.table("user_level_benefits").update({
                "quota": int(existing.data[0]["quota"]) + int(quota),
            }).eq("id", existing.data[0]["id"]).execute()
        else:
            self.db.table("user_level_benefits").insert({
                "user_id": user_id,
                "benefit_id": benefit_id,
                "quota": quota,
                "used": 0,
            }).execute()

    def list_user_benefits(self, user_id: int) -> List[UserBenefitInfo]:
        """用户持有的所有权益 (展示 + 核销时复用)."""
        res = (
            self.db.table("user_level_benefits")
            .select("id, benefit_id, quota, used, level_benefits(benefit_type,name,description)")
            .eq("user_id", user_id)
            .execute()
        )
        out: List[UserBenefitInfo] = []
        for r in res.data or []:
            meta = r.get("level_benefits") or {}
            if isinstance(meta, list):
                meta = meta[0] if meta else {}
            out.append(UserBenefitInfo(
                benefitId=r["id"],
                benefitType=meta.get("benefit_type", ""),
                name=meta.get("name", ""),
                description=meta.get("description", ""),
                quota=int(r["quota"]),
                used=int(r["used"]),
                remaining=max(int(r["quota"]) - int(r["used"]), 0),
            ))
        return out

    # ---- 3.4 核销 ------------------------------------------------------

    def redeem_free_ticket(
        self,
        user_id: int,
        object_type: str = "EVENT",
        object_id: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> Tuple[int, int]:
        """Lv4 用户核销免费门票.
        返回 (redemption_id, remaining_quota).
        失败抛 ValueError (等级不足 / 配额不足).
        """
        # 双花保护: 锁内完整走 "读配额 -> 写 used -> 写流水".
        # 单进程内可防并发; 多进程部署时须再叠加 DB 层 UPDATE ... WHERE used < quota 原子更新.
        with _lock_for(user_id):
            level = self.get_user_level(user_id)
            if level < 4:
                raise ValueError("未达到 Lv4, 无法使用免费门票")

            benefit_row = (
                self.db.table("level_benefits")
                .select("id, benefit_type")
                .eq("benefit_type", "FREE_TICKET_LV4")
                .eq("is_active", True)
                .execute()
            )
            if not benefit_row.data:
                raise ValueError("免费门票权益未配置")
            benefit_id = benefit_row.data[0]["id"]

            user_benefit = (
                self.db.table("user_level_benefits")
                .select("*")
                .eq("user_id", user_id)
                .eq("benefit_id", benefit_id)
                .execute()
            )
            if not user_benefit.data:
                raise ValueError("未持有免费门票权益")
            ub = user_benefit.data[0]
            new_used = int(ub["used"]) + 1
            if new_used > int(ub["quota"]):
                raise ValueError("免费门票已全部使用")

            # 扣减配额 (DB CHECK used <= quota 作为最后一道防线)
            self.db.table("user_level_benefits").update({
                "used": new_used,
            }).eq("id", ub["id"]).execute()

            # 写核销流水
            ins = self.db.table("benefit_redemptions").insert({
                "user_id": user_id,
                "user_benefit_id": ub["id"],
                "benefit_type": "FREE_TICKET_LV4",
                "redeemed_object_type": object_type,
                "redeemed_object_id": object_id,
                "meta": meta or {},
            }).execute()

            redemption_id = ins.data[0]["id"] if ins.data else 0
            remaining = max(int(ub["quota"]) - new_used, 0)
            return redemption_id, remaining

    # ---- 3.5 Admin: 升级审批 / 手动赋等级 -----------------------------

    def list_pending_requests(self) -> List[UpgradeRequestInfo]:
        res = (
            self.db.table("level_upgrade_requests")
            .select("*, users(username)")
            .eq("status", "PENDING")
            .order("created_at", desc=False)
            .execute()
        )
        out: List[UpgradeRequestInfo] = []
        for r in res.data or []:
            user_meta = r.get("users") or {}
            if isinstance(user_meta, list):
                user_meta = user_meta[0] if user_meta else {}
            out.append(UpgradeRequestInfo(
                id=r["id"],
                userId=r["user_id"],
                username=user_meta.get("username"),
                targetLevel=r["target_level"],
                status=r["status"],
                remark=r.get("remark", ""),
                createdAt=r["created_at"],
                reviewedAt=r.get("reviewed_at"),
            ))
        return out

    def review_upgrade_request(
        self, request_id: int, reviewer_id: int, approve: bool, remark: str = ""
    ) -> bool:
        """Admin 审批 Lv4 升级."""
        res = (
            self.db.table("level_upgrade_requests")
            .select("*")
            .eq("id", request_id)
            .eq("status", "PENDING")
            .execute()
        )
        if not res.data:
            return False
        req = res.data[0]

        # 与 record_action / admin_grant_level 串行, 防止并发下 pending_level / current_level
        # 交叉写入造成状态错乱.
        with _lock_for(req["user_id"]):
            now = datetime.utcnow().isoformat()
            self.db.table("level_upgrade_requests").update({
                "status": "APPROVED" if approve else "REJECTED",
                "reviewed_by": reviewer_id,
                "reviewed_at": now,
                "remark": remark,
            }).eq("id", request_id).execute()

            self.db.table("user_levels").update({"pending_level": None}) \
                .eq("user_id", req["user_id"]).execute()

            if approve:
                self._apply_upgrade(req["user_id"], int(req["target_level"]))
            else:
                self._notify_audit_rejected(req["user_id"], int(req["target_level"]), remark)
        return True

    def admin_grant_level(
        self,
        user_id: int,
        level: int,
        reviewer_id: int,
        remark: str = "",
    ) -> bool:
        """Admin 直接赋等级 (主要供 Lv5).

        为满足"高价值权益人工管控"红线的审计要求, 每次赋级同时向
        level_upgrade_requests 落一条 APPROVED 记录, 记录 reviewer_id + remark,
        确保 "谁在什么时间因为什么原因把某用户提到几级" 有迹可查.
        """
        if level < 1 or level > 5:
            return False
        with _lock_for(user_id):
            row = self._get_row(user_id)
            if int(row.get("current_level") or 0) >= level:
                return False  # 只升不降, 且不支持"重复赋同级"
            self._apply_upgrade(user_id, level)
            try:
                now = datetime.utcnow().isoformat()
                self.db.table("level_upgrade_requests").insert({
                    "user_id":      user_id,
                    "target_level": level,
                    "status":       "APPROVED",
                    "reviewed_by":  reviewer_id,
                    "reviewed_at":  now,
                    "remark":       remark or f"Admin manual grant to Lv{level}",
                }).execute()
            except Exception as e:  # noqa: BLE001
                logger.warning("admin_grant_level audit log failed: %s", e)
        return True

    # ---- 3.6 通知 ------------------------------------------------------

    def _notify_level_up(self, user_id: int, level: int) -> None:
        """升级成功后发站内信; 前端会监听这些通知触发全屏动画."""
        spec = _spec_by_level(level)
        if not spec:
            return
        try:
            from app.services.notification_service import notification_service
            notification_service.create_notification(
                user_id=user_id,
                notification_type=NotificationType.SYSTEM,
                title=f"恭喜升级到 Lv{level} · {spec.title}",
                message=spec.benefit or "等级已更新",
                action_data={
                    "navigateTo": "MyLevel",
                    "navigateParams": {},
                    "levelUpTo": level,
                    "levelTitle": spec.title,
                },
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("notify_level_up failed: %s", e)

    def _notify_pending_audit(self, user_id: int, target_level: int) -> None:
        try:
            from app.services.notification_service import notification_service
            notification_service.create_notification(
                user_id=user_id,
                notification_type=NotificationType.SYSTEM,
                title=f"Lv{target_level} 升级审核中",
                message="您已达成任务,等待运营审核通过后即可解锁权益",
                action_data={"navigateTo": "MyLevel", "navigateParams": {}},
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("notify_pending_audit failed: %s", e)

    def _notify_audit_rejected(self, user_id: int, target_level: int, remark: str) -> None:
        try:
            from app.services.notification_service import notification_service
            notification_service.create_notification(
                user_id=user_id,
                notification_type=NotificationType.SYSTEM,
                title=f"Lv{target_level} 升级申请未通过",
                message=remark or "如有疑问请联系运营",
                action_data={"navigateTo": "MyLevel", "navigateParams": {}},
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("notify_audit_rejected failed: %s", e)


# 单例
level_service = LevelService()
