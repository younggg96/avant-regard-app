"""
PRD 模块 5 · 售后 / 仲裁服务。

订单进入 disputed 状态后由 admin / CS 仲裁；仲裁结论分两类：
  - resolved_refund   退款给买家（order 进入 refunded，库存 hold 释放）
  - resolved_release  放款给卖家（order 进入 resolved 后由 settle_completed 走 T+7）
"""
from __future__ import annotations

from typing import Optional, List, Tuple
from datetime import datetime

from app.db.supabase import get_supabase_admin, execute_with_retry
from app.schemas.disputes import Dispute, DisputeStatus
from app.services.order_service import order_service
from app.schemas.orders import OrderStatus


class DisputeService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

    @staticmethod
    def _format(row: dict) -> Dispute:
        return Dispute(
            id=row["id"],
            orderId=row["order_id"],
            openerUserId=row["opener_user_id"],
            openerRole=row["opener_role"],
            reason=row["reason"],
            description=row.get("description"),
            evidencePhotos=row.get("evidence_photos") or [],
            status=row["status"],
            csHandlerUserId=row.get("cs_handler_user_id"),
            csDecision=row.get("cs_decision"),
            resolvedAt=row.get("resolved_at"),
            createdAt=row.get("created_at"),
            updatedAt=row.get("updated_at"),
        )

    def open_dispute(
        self,
        *,
        order_id: int,
        opener_user_id: int,
        reason: str,
        description: Optional[str],
        evidence_photos: list,
    ) -> Dispute:
        order = order_service.get_order(order_id)
        if not order:
            raise ValueError("订单不存在")
        # 判断角色
        if order.buyerUserId == opener_user_id:
            role = "buyer"
        elif order.sellerUserId == opener_user_id:
            role = "seller"
        else:
            raise PermissionError("仅订单双方可发起争议")

        # 订单状态切换到 disputed
        try:
            order_service.transition_status(
                order_id, OrderStatus.DISPUTED, actor_user_id=opener_user_id
            )
        except ValueError:
            # 已经在 disputed 也可以继续
            pass

        payload = {
            "order_id": order_id,
            "opener_user_id": opener_user_id,
            "opener_role": role,
            "reason": reason,
            "description": description,
            "evidence_photos": evidence_photos,
            "status": "open",
        }
        res = self.db.table("disputes").insert(payload).execute()
        if not res.data:
            raise RuntimeError("创建争议失败")
        return self._format(res.data[0])

    def withdraw(self, dispute_id: int, user_id: int) -> Dispute:
        d = self._get_or_raise(dispute_id)
        if d["opener_user_id"] != user_id:
            raise PermissionError("仅发起人可撤销")
        if d["status"] not in ("open", "investigating"):
            raise ValueError("当前状态不可撤销")
        now = datetime.utcnow().isoformat()
        self.db.table("disputes").update(
            {"status": "withdrawn", "resolved_at": now}
        ).eq("id", dispute_id).execute()
        # 订单回滚到 resolved（避免卡死）
        try:
            order_service.transition_status(
                d["order_id"],
                OrderStatus.RESOLVED,
                actor_user_id=user_id,
                is_admin=True,
            )
        except Exception:
            pass
        return self._format({**d, "status": "withdrawn", "resolved_at": now})

    def take(self, dispute_id: int, cs_user_id: int) -> Dispute:
        d = self._get_or_raise(dispute_id)
        if d["status"] != "open":
            raise ValueError("当前状态不可受理")
        self.db.table("disputes").update(
            {"status": "investigating", "cs_handler_user_id": cs_user_id}
        ).eq("id", dispute_id).execute()
        return self._format({**d, "status": "investigating", "cs_handler_user_id": cs_user_id})

    def resolve(
        self,
        dispute_id: int,
        cs_user_id: int,
        *,
        decision: str,   # resolved_refund / resolved_release
        note: Optional[str] = None,
    ) -> Dispute:
        d = self._get_or_raise(dispute_id)
        if d["status"] not in ("open", "investigating"):
            raise ValueError("当前状态不可裁决")
        if decision not in ("resolved_refund", "resolved_release"):
            raise ValueError("非法裁决")
        now = datetime.utcnow().isoformat()
        self.db.table("disputes").update(
            {
                "status": decision,
                "cs_handler_user_id": cs_user_id,
                "cs_decision": note,
                "resolved_at": now,
            }
        ).eq("id", dispute_id).execute()

        # 同步推进订单
        order = order_service.get_order(d["order_id"])
        if order:
            try:
                order_service.transition_status(
                    order.id,
                    OrderStatus.RESOLVED,
                    actor_user_id=cs_user_id,
                    is_admin=True,
                )
            except Exception:
                pass
            if decision == "resolved_refund":
                try:
                    order_service.transition_status(
                        order.id,
                        OrderStatus.REFUNDED,
                        actor_user_id=cs_user_id,
                        is_admin=True,
                        reason=note,
                    )
                except Exception:
                    pass
            else:
                # 直接 settled，让卖家可拿到钱
                try:
                    order_service.transition_status(
                        order.id,
                        OrderStatus.SETTLED,
                        actor_user_id=cs_user_id,
                        is_admin=True,
                    )
                except Exception:
                    pass

        return self._format({**d, "status": decision, "cs_decision": note, "resolved_at": now})

    def list_pending(self, *, page: int = 1, page_size: int = 30) -> Tuple[List[Dispute], int]:
        q = (
            self.db.table("disputes")
            .select("*", count="exact")
            .in_("status", ["open", "investigating"])
            .order("created_at", desc=False)
        )
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = execute_with_retry(lambda: q.execute(), label="disputes.list")
        return [self._format(r) for r in (res.data or [])], (res.count or 0)

    def list_for_order(self, order_id: int) -> List[Dispute]:
        res = (
            self.db.table("disputes")
            .select("*")
            .eq("order_id", order_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [self._format(r) for r in (res.data or [])]

    def _get_or_raise(self, dispute_id: int) -> dict:
        res = (
            self.db.table("disputes").select("*").eq("id", dispute_id).limit(1).execute()
        )
        if not res.data:
            raise ValueError("争议不存在")
        return res.data[0]


dispute_service = DisputeService()
