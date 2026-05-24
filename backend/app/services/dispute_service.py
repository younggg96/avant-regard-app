"""
PRD 模块 5 · 售后 / 仲裁服务。

订单进入 disputed 状态后由 admin / CS 仲裁；仲裁结论分两类：
  - resolved_refund   退款给买家（order 进入 refunded，库存 hold 释放）
  - resolved_release  放款给卖家（order 进入 resolved 后由 settle_completed 走 T+7）

通知策略（2026-05 加）：
  - open_dispute   → 给 买家 / 卖家 / 客服 三方各发一张 `dispute` 卡片 + push
  - withdraw       → 给买卖双方 push「争议已撤销」
  - take           → 给买卖双方 push「客服已受理」
  - resolve        → 双方 push「客服已裁决」（裁决方向决定文案）
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

from app.db.supabase import get_supabase_admin, execute_with_retry
from app.schemas.disputes import Dispute, DisputeStatus
from app.services.order_service import order_service
from app.schemas.orders import OrderStatus

logger = logging.getLogger(__name__)


class DisputeService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

    # ------------------------------------------------------------------
    # Chat card + push helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _dispute_status_label(status: str) -> str:
        return {
            "open": "已发起",
            "investigating": "处理中",
            "resolved_refund": "已裁决退款",
            "resolved_release": "已裁决放款",
            "withdrawn": "已撤销",
        }.get(status, status)

    @staticmethod
    def _dispute_reason_label(reason: str) -> str:
        return {
            "not_as_described": "与描述不符",
            "damaged": "商品损坏",
            "not_received": "未收到货",
            "fake": "疑似假货",
            "other": "其他问题",
        }.get(reason, reason)

    @staticmethod
    def _push_title_for(status: str) -> str:
        if status == "open":
            return "已发起争议"
        if status == "investigating":
            return "客服已受理"
        if status == "withdrawn":
            return "争议已撤销"
        if status == "resolved_refund":
            return "客服已裁决：退款给买家"
        if status == "resolved_release":
            return "客服已裁决：放款给卖家"
        return "争议状态更新"

    def _build_card_payload(
        self,
        dispute_row: Dict[str, Any],
        *,
        order_id: int,
        reason: str,
        status: str,
        note: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "disputeId": dispute_row["id"],
            "orderId": order_id,
            "reason": self._dispute_reason_label(reason),
            "rawReason": reason,
            "status": self._dispute_status_label(status),
            "rawStatus": status,
        }
        if note:
            payload["note"] = note
        return payload

    def _send_dispute_card(
        self,
        *,
        sender_user_id: int,
        recipient_user_id: int,
        payload: Dict[str, Any],
        order_id: int,
        push_title: str,
    ) -> None:
        """开 / 复用买卖双方私聊会话，发一张 `dispute` 富媒体卡片 + push。失败静默。"""
        if not recipient_user_id or sender_user_id == recipient_user_id:
            return
        try:
            from app.services.chat_service import ChatService
            chat = ChatService()
            conv_id = chat.create_conversation(sender_user_id, recipient_user_id)
            chat.send_message(
                conversation_id=conv_id,
                sender_id=sender_user_id,
                content=json.dumps(payload, ensure_ascii=False),
                message_type="dispute",
                send_push=True,
                push_title=push_title,
                push_navigate_to="OrderDetail",
                push_navigate_params={"orderId": order_id},
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("[dispute] send dispute card failed: %s", e)

    def _send_dispute_push(
        self,
        *,
        recipient_user_id: int,
        title: str,
        message: str,
        order_id: int,
    ) -> None:
        """没有合适的 chat 上下文时（如自己撤销给自己发不出去），直接走 in-app + push。"""
        try:
            from app.services.notification_service import notification_service
            from app.schemas.notification import NotificationType
            notification_service.create_notification(
                user_id=recipient_user_id,
                notification_type=NotificationType.SYSTEM,
                title=title,
                message=message,
                action_data={
                    "navigateTo": "OrderDetail",
                    "navigateParams": {"orderId": order_id},
                },
                send_push=True,
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("[dispute] notify failed: %s", e)

    def _notify_dispute_event(
        self,
        *,
        dispute_row: Dict[str, Any],
        order_id: int,
        reason: str,
        status: str,
        note: Optional[str] = None,
        cs_user_id: Optional[int] = None,
    ) -> None:
        """统一通知入口：买家、卖家、客服都需要被同步通知到。

        - 取订单的 buyer / seller userId
        - 取 cs 用户 id（来自 dispute_row.cs_handler_user_id 或 trading_support_service）
        - 给三方各发一张卡片 + push
        """
        try:
            order = order_service.get_order(order_id)
            if not order:
                return
            buyer_id = order.buyerUserId
            seller_id = order.sellerUserId
            if not seller_id:
                # 买手店订单的 sellerUserId 为空，需要从 merchant 反查
                try:
                    raw_res = (
                        order_service.db.table("orders")
                        .select("seller_user_id, seller_merchant_id")
                        .eq("id", order_id)
                        .limit(1)
                        .execute()
                    )
                    if raw_res.data:
                        seller_id = order_service._resolve_seller_user_id(raw_res.data[0])
                except Exception:
                    seller_id = None
            cs_id = cs_user_id or dispute_row.get("cs_handler_user_id")
            if not cs_id:
                try:
                    from app.services.trading_support_service import trading_support_service
                    cs_id = trading_support_service.resolve_cs_user_id(
                        dispute_row.get("opener_user_id") or buyer_id or 0
                    )
                except Exception:
                    cs_id = None

            payload = self._build_card_payload(
                dispute_row,
                order_id=order_id,
                reason=reason,
                status=status,
                note=note,
            )
            push_title = self._push_title_for(status)
            opener_id = dispute_row.get("opener_user_id")

            # 选一个 sender（必须是会话参与者）—— 优先让 opener 当 sender，
            # 让对端看到的卡片"来自"发起方；客服分支固定 buyer/seller 当 sender。
            # 收件方向：买家 ↔ 卖家、买家 ↔ 客服、卖家 ↔ 客服
            pairs: List[Tuple[Optional[int], Optional[int]]] = []
            if buyer_id and seller_id and buyer_id != seller_id:
                if opener_id == seller_id:
                    pairs.append((seller_id, buyer_id))
                else:
                    pairs.append((buyer_id, seller_id))
            if cs_id and buyer_id and cs_id != buyer_id:
                pairs.append((buyer_id, cs_id))
            if cs_id and seller_id and cs_id != seller_id and seller_id != buyer_id:
                pairs.append((seller_id, cs_id))

            for sender, recipient in pairs:
                if not sender or not recipient or sender == recipient:
                    continue
                self._send_dispute_card(
                    sender_user_id=sender,
                    recipient_user_id=recipient,
                    payload=payload,
                    order_id=order_id,
                    push_title=push_title,
                )

            # 发起人自己也需要一条 in-app notification（push 不会发给自己，
            # 但通知列表里要有"自己发起的争议"的记录）
            if opener_id:
                self._send_dispute_push(
                    recipient_user_id=opener_id,
                    title=push_title,
                    message=f"订单 #{order.orderNo} · {self._dispute_reason_label(reason)}",
                    order_id=order_id,
                )
        except Exception as e:  # noqa: BLE001
            logger.warning("[dispute] notify_dispute_event failed: %s", e)

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
        dispute_row = res.data[0]

        # 通知买家 / 卖家 / 客服三方
        self._notify_dispute_event(
            dispute_row=dispute_row,
            order_id=order_id,
            reason=reason,
            status="open",
            note=description,
        )

        return self._format(dispute_row)

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

        updated_row = {**d, "status": "withdrawn", "resolved_at": now}
        self._notify_dispute_event(
            dispute_row=updated_row,
            order_id=d["order_id"],
            reason=d.get("reason", ""),
            status="withdrawn",
        )

        return self._format(updated_row)

    def take(self, dispute_id: int, cs_user_id: int) -> Dispute:
        d = self._get_or_raise(dispute_id)
        if d["status"] != "open":
            raise ValueError("当前状态不可受理")
        self.db.table("disputes").update(
            {"status": "investigating", "cs_handler_user_id": cs_user_id}
        ).eq("id", dispute_id).execute()

        updated_row = {**d, "status": "investigating", "cs_handler_user_id": cs_user_id}
        self._notify_dispute_event(
            dispute_row=updated_row,
            order_id=d["order_id"],
            reason=d.get("reason", ""),
            status="investigating",
            cs_user_id=cs_user_id,
        )

        return self._format(updated_row)

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

        updated_row = {**d, "status": decision, "cs_decision": note, "resolved_at": now}
        self._notify_dispute_event(
            dispute_row=updated_row,
            order_id=d["order_id"],
            reason=d.get("reason", ""),
            status=decision,
            note=note,
            cs_user_id=cs_user_id,
        )

        return self._format(updated_row)

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
