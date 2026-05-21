"""
PRD 模块 8 · Plus 订阅服务。

- subscribe(user_id, plan) 创建订阅 + 调 PaymentProvider 拿 intent
- confirm_subscription(sub_id) 由 webhook 调（或 mock 直接置 active）
- is_user_plus(user_id) 给抽佣率 / 鉴定免费券 / 数据面板 用
- commission_rate_for(user_id) 接入 OrderService 的 _commission_for_user
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

PLUS_COMMISSION_BPS = 600
DEFAULT_COMMISSION_BPS = 800


class PlusService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

    @staticmethod
    def _format(row: dict) -> PlusSubscription:
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

    def subscribe(self, user_id: int, plan: PlusPlan) -> PlusSubscription:
        if plan == PlusPlan.MONTHLY:
            price = PLUS_PRICE_MONTHLY_CENTS
            period = timedelta(days=30)
        elif plan == PlusPlan.ANNUAL:
            price = PLUS_PRICE_ANNUAL_CENTS
            period = timedelta(days=365)
        else:
            raise ValueError("非法套餐")

        now = self._now()
        payload = {
            "user_id": user_id,
            "plan": plan.value,
            "period_start": now.isoformat(),
            "period_end": (now + period).isoformat(),
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
            metadata={"plusPlan": plan.value},
        )
        self.db.table("plus_subscriptions").update(
            {"payment_intent_id": intent.intent_id, "source": intent.provider}
        ).eq("id", row["id"]).execute()
        row.update({"payment_intent_id": intent.intent_id, "source": intent.provider})
        return self._format(row)

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
        if row["status"] != "pending_payment":
            return self._format(row)
        self.db.table("plus_subscriptions").update({"status": "active"}).eq(
            "id", sub_id
        ).execute()
        row["status"] = "active"
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
