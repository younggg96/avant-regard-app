"""
PRD 模块 8 · Plus 订阅服务。

- subscribe(user_id, plan) 创建订阅 + 调 PaymentProvider 拿 intent
- confirm_subscription(sub_id) 由 webhook 调（或 mock 直接置 active）
- is_user_plus(user_id) 给抽佣率 / 鉴定免费券 / 数据面板 用
- commission_rate_for(user_id) 接入 OrderService 的 _commission_for_user

抽佣率说明:
    PRD 已改为统一 1% (100 bps) 抽佣, 不再按 Plus / 普通区分。
    PLUS_COMMISSION_BPS 与 DEFAULT_COMMISSION_BPS 保持 100, 是为了 schema
    (PlusStatus.commissionRateBps) 仍能向前端返回当前实际费率, 也方便后续
    若产品恢复差异化抽佣时再回填两个常量。OrderService 里有同名常量, 二者
    必须一致, 改一处务必同步另一处。
"""
from __future__ import annotations

from typing import Optional, Tuple, List
from datetime import datetime, timedelta

from app.db.supabase import get_supabase_admin
from app.schemas.archive_plus import (
    PlusSubscription,
    PlusPlan,
    PlusStatus,
)
from app.services.payment import get_payment_provider


# 价格设定（PRD 未明示具体价；按 China 行业惯例的占位价）
PLUS_PRICE_MONTHLY_CENTS = 2900
PLUS_PRICE_ANNUAL_CENTS = 29800

PLUS_COMMISSION_BPS = 100
DEFAULT_COMMISSION_BPS = 100


class PlusService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

    @staticmethod
    def _format(row: dict, *, client_secret: Optional[str] = None) -> PlusSubscription:
        return PlusSubscription(
            id=row["id"],
            userId=row["user_id"],
            plan=row["plan"],
            periodStart=row["period_start"],
            periodEnd=row["period_end"],
            priceCents=row["price_cents"],
            currency=row.get("currency", "CNY"),
            source=row.get("source", "mock"),
            paymentIntentId=row.get("payment_intent_id"),
            # client_secret 不存库(stripe 文档明确不让长期持久化), 由 subscribe
            # 调用结果一次性透传给前端。后续 confirm-mock / list 都拿不到。
            clientSecret=client_secret,
            status=row["status"],
            autoRenew=row.get("auto_renew", False),
            createdAt=row.get("created_at"),
        )

    def _now(self) -> datetime:
        return datetime.utcnow()

    def get_active(self, user_id: int) -> Optional[PlusSubscription]:
        res = (
            self.db.table("plus_subscriptions")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "active")
            .gte("period_end", self._now().isoformat())
            .order("period_end", desc=True)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return self._format(res.data[0])

    def is_user_plus(self, user_id: int) -> bool:
        return self.get_active(user_id) is not None

    def commission_rate_for(self, user_id: int) -> int:
        return PLUS_COMMISSION_BPS if self.is_user_plus(user_id) else DEFAULT_COMMISSION_BPS

    @staticmethod
    def _plan_meta(plan: PlusPlan) -> Tuple[int, timedelta]:
        if plan == PlusPlan.MONTHLY:
            return PLUS_PRICE_MONTHLY_CENTS, timedelta(days=30)
        if plan == PlusPlan.ANNUAL:
            return PLUS_PRICE_ANNUAL_CENTS, timedelta(days=365)
        raise ValueError("非法套餐")

    def subscribe(self, user_id: int, plan: PlusPlan) -> PlusSubscription:
        """创建/复用订阅 + 支付意图。

        - period_start/end **不在此刻**写, 推迟到 confirm 时根据真实付款
          时间设置, 否则用户付款拖延几天会让权益时间整体偏移。
        - 同一 (user_id, plan) 还在 pending_payment 时, 复用最近一行,
          只刷新 payment_intent_id; 防止用户连续点订阅累出 stale rows。
        - 已经 active 时直接返回当前订阅, 不重复扣费。
        """
        price, _period = self._plan_meta(plan)

        active = self.get_active(user_id)
        if active is not None:
            return active

        now = self._now()
        # 占位 period 仅用于 schema 不允许 null;真实值在 confirm 时写。
        # 用 now / now + 7d 作为占位, 这样即便意外没 confirm 也不会
        # 把用户提前判定为 plus(get_active 要求 status=active)。
        placeholder_end = (now + timedelta(days=7)).isoformat()

        existing = (
            self.db.table("plus_subscriptions")
            .select("*")
            .eq("user_id", user_id)
            .eq("plan", plan.value)
            .eq("status", "pending_payment")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if existing.data:
            row = existing.data[0]
        else:
            payload = {
                "user_id": user_id,
                "plan": plan.value,
                "period_start": now.isoformat(),
                "period_end": placeholder_end,
                "price_cents": price,
                "status": "pending_payment",
            }
            res = self.db.table("plus_subscriptions").insert(payload).execute()
            if not res.data:
                raise RuntimeError("创建订阅失败")
            row = res.data[0]

        provider = get_payment_provider()
        intent = provider.create_intent(
            order_id=row["id"],
            amount_cents=price,
            currency=row.get("currency", "CNY"),
            # scope=plus 让 webhook 把 intent 路由到 plus_subscriptions 表
            metadata={
                "scope": "plus",
                "plusPlan": plan.value,
                "userId": str(user_id),
                "subId": str(row["id"]),
            },
        )
        self.db.table("plus_subscriptions").update(
            {"payment_intent_id": intent.intent_id, "source": intent.provider}
        ).eq("id", row["id"]).execute()
        row.update({"payment_intent_id": intent.intent_id, "source": intent.provider})
        return self._format(row, client_secret=intent.client_secret)

    def _activate(self, row: dict) -> dict:
        """共用激活逻辑: pending_payment → active, 同时按当前时间重写
        period_start/end。供 confirm() 与 webhook 调用。幂等。"""
        if row["status"] == "active":
            return row
        if row["status"] != "pending_payment":
            return row
        try:
            plan = PlusPlan(row["plan"])
        except ValueError:
            print(f"[plus] unknown plan {row.get('plan')} for sub {row['id']}", flush=True)
            return row
        _price, period = self._plan_meta(plan)
        now = self._now()
        update = {
            "status": "active",
            "period_start": now.isoformat(),
            "period_end": (now + period).isoformat(),
        }
        self.db.table("plus_subscriptions").update(update).eq("id", row["id"]).execute()
        row.update(update)
        return row

    def confirm(self, sub_id: int, user_id: int) -> PlusSubscription:
        res = (
            self.db.table("plus_subscriptions")
            .select("*")
            .eq("id", sub_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise ValueError("订阅不存在")
        row = res.data[0]
        if row["user_id"] != user_id:
            raise PermissionError("无权操作")
        row = self._activate(row)
        return self._format(row)

    def confirm_by_intent(self, intent_id: str) -> Optional[PlusSubscription]:
        """Webhook 入口:按 payment_intent_id 找订阅并激活。
        没找到返回 None(可能是 intent 不属于 plus)。"""
        res = (
            self.db.table("plus_subscriptions")
            .select("*")
            .eq("payment_intent_id", intent_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        row = self._activate(res.data[0])
        return self._format(row)

    def cancel(self, sub_id: int, user_id: int) -> PlusSubscription:
        res = (
            self.db.table("plus_subscriptions")
            .select("*")
            .eq("id", sub_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise ValueError("订阅不存在")
        row = res.data[0]
        if row["user_id"] != user_id:
            raise PermissionError("无权操作")
        self.db.table("plus_subscriptions").update(
            {"status": "canceled", "auto_renew": False}
        ).eq("id", sub_id).execute()
        row.update({"status": "canceled", "auto_renew": False})
        return self._format(row)

    def status_for(self, user_id: int) -> PlusStatus:
        sub = self.get_active(user_id)
        return PlusStatus(
            isActive=sub is not None,
            subscription=sub,
            commissionRateBps=PLUS_COMMISSION_BPS if sub else DEFAULT_COMMISSION_BPS,
        )

    def list_for_user(self, user_id: int) -> List[PlusSubscription]:
        res = (
            self.db.table("plus_subscriptions")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [self._format(r) for r in (res.data or [])]


plus_service = PlusService()
