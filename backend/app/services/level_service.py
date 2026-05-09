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
        title="Rookie",
        subtitle="迈出第一步",
        mode="AUTO",
        tasks=[
            LevelTaskSpec(action=LevelAction.POST_CREATED,       target=1, label="发布 1 篇帖子"),
            LevelTaskSpec(action=LevelAction.COMMUNITY_FOLLOWED, target=1, label="关注 1 个社区"),
        ],
    ),
    LevelSpec(
        level=2,
        title="Head",
        subtitle="开始与社区互动",
        mode="AUTO",
        tasks=[
            LevelTaskSpec(action=LevelAction.POST_LIKED,    target=10, label="点赞 10 篇帖子"),
            LevelTaskSpec(action=LevelAction.USER_FOLLOWED, target=3,  label="关注 3 个用户"),
        ],
    ),
    LevelSpec(
        level=3,
        title="Digger",
        subtitle="解锁月度抽奖入口",
        benefit="每月参与一次专属抽奖",
        mode="AUTO",
        tasks=[
            LevelTaskSpec(action=LevelAction.WANT_CLICKED,    target=10, label='点击 10 个 "我想要"'),
            LevelTaskSpec(action=LevelAction.STORE_COMMENTED, target=5,  label="评论 5 家买手店"),
        ],
    ),
    LevelSpec(
        level=4,
        title="Archivist",
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
        title="CONNOISSEUR",
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
        """待审批的 Lv4 升级工单列表, 按提交时间升序.

        不走 PostgREST 嵌入式 select. 原因:
          `level_upgrade_requests` 同时有 `user_id` 和 `reviewed_by` 两条外键
          指向 `users(id)`, 隐式写 `users(username)` 会触发 PostgREST PGRST201
          歧义; 更糟的是 Supabase 前置 nginx / Kong 偶发会把这种非 200 响应
          吞成非 JSON 的 502 HTML 页, postgrest-py 抛 "JSON could not be
          generated", 被我们的异常 handler 翻成 502 "数据服务暂不可用".

        因此保持与 `list_users_by_level` 同一风格: 先拉骨架, 再按 user_id
        批量查 username. 读放大一次, 但稳定且对 RLS 透明.
        """
        res = (
            self.db.table("level_upgrade_requests")
            .select("id, user_id, target_level, status, remark, created_at, reviewed_at")
            .eq("status", "PENDING")
            .order("created_at", desc=False)
            .execute()
        )
        rows = list(res.data or [])
        if not rows:
            return []

        user_ids = list({r["user_id"] for r in rows})
        username_map: Dict[int, Optional[str]] = {}
        try:
            u_res = (
                self.db.table("users")
                .select("id, username")
                .in_("id", user_ids)
                .execute()
            )
            username_map = {
                u["id"]: u.get("username") for u in (u_res.data or [])
            }
        except Exception as e:  # noqa: BLE001
            # 补不到 username 不影响审批本身, 降级为 None 继续返回.
            logger.warning("fetch usernames for pending requests failed: %s", e)

        return [
            UpgradeRequestInfo(
                id=r["id"],
                userId=r["user_id"],
                username=username_map.get(r["user_id"]),
                targetLevel=r["target_level"],
                status=r["status"],
                remark=r.get("remark") or "",
                createdAt=r["created_at"],
                reviewedAt=r.get("reviewed_at"),
            )
            for r in rows
        ]

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

    # ---- 3.6 存量回填 --------------------------------------------------
    #
    # 等级系统上线前的老用户没有 counters, 需要根据业务表的真实行为做一次回溯:
    #   1) 从业务表统计真实累计 (不是"操作次数", 是当前表里仍存在的行数).
    #   2) 合并到 user_level_progress.counters (取 max 以兼容已有记录).
    #   3) 静默升级到符合条件的 Lv1/2/3, Lv4 达标仅创建 PENDING.
    #
    # 幂等关键:
    #   - current_level 有 only-ascent 触发器, 重复跑不会回退;
    #   - _silent_grant_benefit 在已存在记录时 **跳过**, 不会把 quota 翻倍;
    #   - level_upgrade_requests 的 PENDING 有 unique index, 不会重复建单;
    #   - 静默升级不发站内信, 避免老用户收到成百上千条升级通知.

    def _count_real_actions(self, user_id: int) -> Dict[str, int]:
        """从业务表统计某 user 的真实累计行为计数.

        每个 action 的口径与 record_action 调用点一致:
          - POST_CREATED:       posts WHERE user_id=? AND status='PUBLISHED'
          - COMMUNITY_FOLLOWED: community_follows WHERE user_id=?
          - POST_LIKED:         post_likes WHERE user_id=?
          - USER_FOLLOWED:      user_follows WHERE follower_id=?
          - WANT_CLICKED:       post_wants WHERE user_id=?
          - STORE_COMMENTED:    buyer_store_comments WHERE user_id=? AND parent_id IS NULL
          - ARCHIVE_UPLOADED:   三张审核通过的提交表的和
        """
        def _count(table: str, field: str, val: Any, extra: Optional[Dict[str, Any]] = None) -> int:
            """
            计数某张业务表命中记录数.

            注意:
              - `.select(field, count="exact")` 里 select 的列必须**确实存在**,
                否则 PostgREST 会抛 "column does not exist", 被 except 吞后返回 0.
                这里选用作过滤条件的 `field` 作为 select 列, 保证它一定存在.
              - 捕获异常时打 error 级 + 堆栈, 方便在生产环境定位表名 / 列名问题.
            """
            try:
                q = self.db.table(table).select(field, count="exact").eq(field, val)
                for k, v in (extra or {}).items():
                    if v is None:
                        q = q.is_(k, "null")
                    else:
                        q = q.eq(k, v)
                res = q.execute()
                return int(res.count or 0)
            except Exception as e:  # noqa: BLE001
                logger.exception(
                    "backfill count failed · table=%s field=%s val=%s extra=%s · err=%s",
                    table, field, val, extra, e,
                )
                return 0

        post_created       = _count("posts",                "user_id",     user_id, {"status": "PUBLISHED"})
        community_followed = _count("community_follows",    "user_id",     user_id)
        post_liked         = _count("post_likes",           "user_id",     user_id)
        user_followed      = _count("user_follows",         "follower_id", user_id)
        want_clicked       = _count("post_wants",           "user_id",     user_id)
        store_commented    = _count("buyer_store_comments", "user_id",     user_id, {"parent_id": None})
        archive_stores     = _count("user_submitted_stores", "user_id",    user_id, {"status": "APPROVED"})
        archive_shows      = _count("shows",                "created_by",  user_id, {"status": "APPROVED"})
        archive_brands     = _count("brand_submissions",    "user_id",     user_id, {"status": "APPROVED"})

        return {
            LevelAction.POST_CREATED.value:       post_created,
            LevelAction.COMMUNITY_FOLLOWED.value: community_followed,
            LevelAction.POST_LIKED.value:         post_liked,
            LevelAction.USER_FOLLOWED.value:      user_followed,
            LevelAction.WANT_CLICKED.value:       want_clicked,
            LevelAction.STORE_COMMENTED.value:    store_commented,
            LevelAction.ARCHIVE_UPLOADED.value:   archive_stores + archive_shows + archive_brands,
        }

    def _silent_grant_benefit(self, user_id: int, benefit_id: int, quota: int) -> None:
        """幂等发放权益:  已有记录 -> **不动**; 没有 -> 新建.

        与 _grant_benefit 的"累加"语义不同, 专供回填使用, 避免重复发福利.
        """
        existing = (
            self.db.table("user_level_benefits")
            .select("id")
            .eq("user_id", user_id)
            .eq("benefit_id", benefit_id)
            .execute()
        )
        if existing.data:
            return
        self.db.table("user_level_benefits").insert({
            "user_id":    user_id,
            "benefit_id": benefit_id,
            "quota":      quota,
            "used":       0,
        }).execute()

    def _silent_grant_level_benefits(self, user_id: int, level: int) -> None:
        """批量幂等发放某 level 对应的所有权益."""
        res = (
            self.db.table("level_benefits")
            .select("id, benefit_type, default_quota")
            .eq("level_required", level)
            .eq("is_active", True)
            .execute()
        )
        for b in res.data or []:
            self._silent_grant_benefit(user_id, b["id"], b["default_quota"])

    def _silent_upgrade(self, user_id: int, new_level: int) -> None:
        """回填专用: 只写等级 + 幂等发权益 + Lv3+ 进当月抽奖池, 不发通知."""
        now = datetime.utcnow().isoformat()
        self.db.table("user_levels").update({
            "current_level":    new_level,
            "last_level_up_at": now,
            "pending_level":    None,
        }).eq("user_id", user_id).execute()

        self._silent_grant_level_benefits(user_id, new_level)

        if new_level >= 3:
            try:
                from app.services.lottery_service import lottery_service
                lottery_service.ensure_user_entered_current_round(user_id)
            except Exception as e:  # noqa: BLE001
                logger.warning("silent enroll lottery failed user=%s: %s", user_id, e)

    def _ensure_pending_request_silent(self, user_id: int, target_level: int) -> None:
        """回填专用: Lv4 达标后去重创建 PENDING, 不发通知."""
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
        try:
            self.db.table("level_upgrade_requests").insert({
                "user_id":      user_id,
                "target_level": target_level,
                "status":       "PENDING",
                "remark":       "backfill: 达标自动入审核队列",
            }).execute()
            self.db.table("user_levels").update({"pending_level": target_level}) \
                .eq("user_id", user_id).execute()
        except Exception as e:  # noqa: BLE001
            msg = str(e).lower()
            if "duplicate" in msg or "unique" in msg or "conflict" in msg:
                return
            logger.warning("backfill ensure_pending_request failed user=%s: %s", user_id, e)

    def backfill_user(self, user_id: int, dry_run: bool = False) -> Dict[str, Any]:
        """对单个用户做一次等级回溯.

        Args:
            user_id: 目标用户
            dry_run: 只计算不写库, 用于脚本预览

        Returns:
            {
              "userId":        int,
              "beforeLevel":   int,
              "afterLevel":    int,
              "pendingLevel":  int | None,
              "counters":      dict,
              "dryRun":        bool,
            }
        """
        with _lock_for(user_id):
            real_counters = self._count_real_actions(user_id)
            existing = self._get_counters(user_id)
            merged = {
                k: max(int(real_counters.get(k, 0)), int(existing.get(k, 0)))
                for k in set(real_counters) | set(existing)
            }

            # dry_run 下避免 _get_row 的 lazy-create 写库
            if dry_run:
                r = (
                    self.db.table("user_levels")
                    .select("current_level, pending_level, last_level_up_at")
                    .eq("user_id", user_id)
                    .execute()
                )
                row = r.data[0] if r.data else {
                    "current_level": 0, "pending_level": None, "last_level_up_at": None
                }
            else:
                row = self._get_row(user_id)

            before = int(row.get("current_level") or 0)

            # 模拟升级路径, 找出"能升到的最高 AUTO 等级"和"是否触发 Lv4 PENDING"
            current = before
            pending_level: Optional[int] = row.get("pending_level")

            while current < 5:
                nxt = current + 1
                spec = _spec_by_level(nxt)
                if not spec:
                    break
                if not all(int(merged.get(t.action, 0)) >= t.target for t in spec.tasks):
                    break
                if spec.mode == "AUTO":
                    if not dry_run:
                        self._silent_upgrade(user_id, nxt)
                    current = nxt
                    continue
                if spec.mode == "AUDIT":
                    if not dry_run:
                        self._ensure_pending_request_silent(user_id, nxt)
                    pending_level = nxt
                    break
                # MANUAL (Lv5): 不自动触发
                break

            if not dry_run:
                self.db.table("user_level_progress").upsert({
                    "user_id":    user_id,
                    "counters":   merged,
                    "updated_at": datetime.utcnow().isoformat(),
                }, on_conflict="user_id").execute()

            return {
                "userId":       user_id,
                "beforeLevel":  before,
                "afterLevel":   current,
                "pendingLevel": pending_level,
                "counters":     merged,
                "dryRun":       dry_run,
            }

    def backfill_all(
        self,
        dry_run: bool = False,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """全量扫描 users 表, 对每个 user 做回填.

        返回统计汇总; 明细逐个用户写入结构化日志便于事后审计.
        """
        page_size = 500
        scanned = 0
        changed = 0  # 实际升级到更高等级的数量
        pending_created = 0
        errors = 0
        level_distribution: Dict[int, int] = defaultdict(int)

        cursor = offset
        while True:
            q = (
                self.db.table("users")
                .select("id")
                .order("id")
                .range(cursor, cursor + page_size - 1)
            )
            res = q.execute()
            rows = res.data or []
            if not rows:
                break

            for r in rows:
                uid = int(r["id"])
                try:
                    result = self.backfill_user(uid, dry_run=dry_run)
                    scanned += 1
                    if result["afterLevel"] > result["beforeLevel"]:
                        changed += 1
                    if (
                        result["pendingLevel"]
                        and result["pendingLevel"] != result["beforeLevel"]
                    ):
                        pending_created += 1
                    level_distribution[result["afterLevel"]] += 1

                    logger.info(
                        "backfill user=%s before=%s after=%s pending=%s counters=%s",
                        uid,
                        result["beforeLevel"],
                        result["afterLevel"],
                        result["pendingLevel"],
                        result["counters"],
                    )
                except Exception as exc:  # noqa: BLE001
                    errors += 1
                    logger.exception("backfill user=%s failed: %s", uid, exc)

                if limit is not None and scanned >= limit:
                    break

            if limit is not None and scanned >= limit:
                break
            cursor += page_size
            if len(rows) < page_size:
                break

        return {
            "scanned":           scanned,
            "upgraded":          changed,
            "pendingCreated":    pending_created,
            "errors":            errors,
            "levelDistribution": dict(level_distribution),
            "dryRun":            dry_run,
        }

    # ---- 3.7 通知 ------------------------------------------------------

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

    # ---- 3.8 Admin 视角:  用户等级总览 ----------------------------

    def list_users_by_level(
        self,
        page: int = 1,
        page_size: int = 20,
        level: Optional[int] = None,
    ) -> Dict[str, Any]:
        """分页返回"所有用户等级" (按等级 DESC, 同级按升级时间 DESC).

        Admin 总览页用. 设计思路:
          1. 先拉一份"所有用户 + 等级"的轻量骨架 (user_id + level 字段),
             数据量 = 注册用户数, 目前几百条量级, 拉全内存排序+分页完全可控.
          2. 再按当前页 20 个 user_id, 批量补 username / avatar / merchant.

        这样做的好处:
          - Lv0 用户 (无 user_levels 行) 能天然混在同一序列里分页, 不会
            出现 "第一页有人, 后面页全空" 的怪象.
          - 排序稳定: current_level DESC → last_level_up_at DESC → user_id ASC.

        参数:
          - level=None   全量
          - level=0      仅 Lv0 (未达 Lv1 或无 user_levels 行)
          - level=1..5   精确等级
        """
        page = max(1, int(page))
        page_size = max(1, min(int(page_size), 100))

        # --- 1) 拉"用户 × 等级"的轻量骨架 ---
        # 单独拉, 避免 PostgREST nested select 在跨 schema / RLS 下的坑.
        # 当前注册用户 < 1万, .range(0, 9999) 足够; 超过后应改为分批迭代.
        MAX_SCAN = 10000
        user_rows: List[Dict[str, Any]] = []
        try:
            ur = (
                self.db.table("users")
                .select("id")
                .order("id", desc=False)
                .range(0, MAX_SCAN - 1)
                .execute()
            )
            user_rows = list(ur.data or [])
        except Exception as e:  # noqa: BLE001
            logger.exception("fetch all users failed: %s", e)

        level_rows: List[Dict[str, Any]] = []
        try:
            lr = (
                self.db.table("user_levels")
                .select("user_id, current_level, pending_level, last_level_up_at")
                .range(0, MAX_SCAN - 1)
                .execute()
            )
            level_rows = list(lr.data or [])
        except Exception as e:  # noqa: BLE001
            logger.exception("fetch user_levels failed: %s", e)

        level_map: Dict[int, Dict[str, Any]] = {
            r["user_id"]: r for r in level_rows
        }

        merged: List[Dict[str, Any]] = []
        for u in user_rows:
            uid = u["id"]
            lvl_row = level_map.get(uid) or {}
            merged.append({
                "user_id":          uid,
                "current_level":    int(lvl_row.get("current_level") or 0),
                "pending_level":    lvl_row.get("pending_level"),
                "last_level_up_at": lvl_row.get("last_level_up_at"),
            })

        # --- 2) 过滤 + 排序 + 分页 ---
        if level is not None:
            merged = [r for r in merged if r["current_level"] == int(level)]

        def _ts_ord(s: Optional[str]) -> int:
            """ISO 时间串 -> 单调递增整数, 空值返回 0."""
            if not s:
                return 0
            return int("".join(ch for ch in s if ch.isdigit()) or 0)

        # 排序键: 等级 DESC → 升级时间 DESC (NULL 最后) → user_id ASC
        def _sort_key(r: Dict[str, Any]):
            ts_ord = _ts_ord(r.get("last_level_up_at"))
            return (-r["current_level"], ts_ord == 0, -ts_ord, r["user_id"])

        merged.sort(key=_sort_key)

        total = len(merged)
        start = (page - 1) * page_size
        rows = merged[start : start + page_size]

        user_ids = [r["user_id"] for r in rows]
        if not user_ids:
            return {"users": [], "total": total, "page": page, "pageSize": page_size}

        # --- 3) 批量补充 username / avatar / merchant ---
        users_map: Dict[int, Dict[str, Any]] = {}
        try:
            u_res = (
                self.db.table("users")
                .select("id, username")
                .in_("id", user_ids)
                .execute()
            )
            for u in u_res.data or []:
                users_map[u["id"]] = u
        except Exception as e:  # noqa: BLE001
            logger.warning("fetch users failed: %s", e)

        info_map: Dict[int, Dict[str, Any]] = {}
        try:
            info_res = (
                self.db.table("user_info")
                .select("user_id, avatar_url")
                .in_("user_id", user_ids)
                .execute()
            )
            for i in info_res.data or []:
                info_map[i["user_id"]] = i
        except Exception as e:  # noqa: BLE001
            logger.warning("fetch user_info failed: %s", e)

        merchant_map: Dict[int, Dict[str, Any]] = {}
        try:
            m_res = (
                self.db.table("store_merchants")
                .select("user_id, store_id, status")
                .in_("user_id", user_ids)
                .execute()
            )
            # 同一 user 可能多条, 优先保留 APPROVED
            for m in m_res.data or []:
                uid = m["user_id"]
                if uid in merchant_map and merchant_map[uid].get("status") == "APPROVED":
                    continue
                merchant_map[uid] = {
                    "storeId": m["store_id"],
                    "status":  m["status"],
                }
        except Exception as e:  # noqa: BLE001
            logger.warning("fetch store_merchants failed: %s", e)

        items = []
        for r in rows:
            uid = r["user_id"]
            u = users_map.get(uid, {})
            info = info_map.get(uid, {})
            items.append({
                "userId":        uid,
                "username":      u.get("username", ""),
                "avatarUrl":     info.get("avatar_url", ""),
                "currentLevel":  int(r.get("current_level") or 0),
                "pendingLevel":  r.get("pending_level"),
                "lastLevelUpAt": r.get("last_level_up_at"),
                "merchant":      merchant_map.get(uid),
            })

        return {
            "users":    items,
            "total":    total,
            "page":     page,
            "pageSize": page_size,
        }


# 单例
level_service = LevelService()
