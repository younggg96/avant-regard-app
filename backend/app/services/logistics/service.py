"""
物流轨迹应用层。

职责（业务侧只看这一层，不直接接触 provider）：
  - `on_shipment_created`        卖家发货后调用 → subscribe provider + 拉一次初始事件
  - `ingest_event`               webhook / query / Admin 入口都走这里 → 写库 + 推送 + 自动签收
  - `list_events`                订单详情时间轴拉数据
  - `pull_pending_shipments`     cron 兜底（未接 webhook 的运单定时 query）

推送规则参考 PRD 与微信/淘宝的实践：
  - picked_up         首次必推
  - in_transit        同站点不重复，至少 6 小时间隔（防刷屏）
  - out_for_delivery  必推
  - delivered         必推买卖双方（沿用 order_service 已有 IM 卡片 + push 链路）
  - exception         必推双方
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.db.supabase import get_supabase_admin
from app.schemas.tracking import (
    TrackingEvent,
    TrackingEventCreate,
    TrackingFeed,
    TrackingStatus,
)
from .base import NormalizedEvent
from .factory import get_provider_by_name, get_provider_for_carrier


logger = logging.getLogger(__name__)


IN_TRANSIT_MIN_INTERVAL_HOURS = 6


# 推送策略：status_code → 行为
_PUSH_RULES: Dict[str, Dict[str, Any]] = {
    "picked_up":         {"alwaysPush": True,  "broadcastBothParties": False},
    "in_transit":        {"alwaysPush": False, "broadcastBothParties": False, "minIntervalHours": IN_TRANSIT_MIN_INTERVAL_HOURS},
    "out_for_delivery":  {"alwaysPush": True,  "broadcastBothParties": False},
    "delivered":         {"alwaysPush": True,  "broadcastBothParties": True},
    "exception":         {"alwaysPush": True,  "broadcastBothParties": True},
    "returned":          {"alwaysPush": True,  "broadcastBothParties": True},
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _iso_or_now(value: Optional[str]) -> str:
    """各 provider 返回的时间格式可能不规范，统一处理一次。"""
    if not value:
        return _now_iso()
    try:
        # 标准化为 UTC ISO8601
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return _now_iso()


class TrackingService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

    # ------------------------------------------------------------------
    # Shipment 生命周期
    # ------------------------------------------------------------------

    def on_shipment_created(
        self,
        *,
        shipment_id: int,
        order_id: int,
        carrier: str,
        tracking_no: str,
    ) -> None:
        """卖家发货后 order_service.add_shipment 调用。失败静默，不阻塞主流程。"""
        try:
            provider, code = get_provider_for_carrier(carrier)
            # 标记 shipment 走的是哪个聚合方
            self.db.table("order_shipments").update(
                {"provider_source": provider.name}
            ).eq("id", shipment_id).execute()

            # 1) 订阅 webhook（如 provider 支持）
            try:
                provider.subscribe(
                    carrier=code, tracking_no=tracking_no, shipment_id=shipment_id
                )
            except Exception as e:
                logger.warning(
                    "[tracking] subscribe failed: shipment=%s err=%s",
                    shipment_id, e,
                )

            # 2) 拉一次初始事件（顺丰 / 京东 等有时发货后立刻有"已揽件"）
            try:
                events = provider.query(carrier=code, tracking_no=tracking_no)
            except Exception as e:
                logger.warning(
                    "[tracking] initial query failed: shipment=%s err=%s",
                    shipment_id, e,
                )
                events = []
            for ev in events:
                self.ingest_event(
                    shipment_id=shipment_id,
                    order_id=order_id,
                    event=ev,
                    source=provider.name,
                )
        except Exception as e:  # noqa: BLE001
            logger.exception(
                "[tracking] on_shipment_created hard failure shipment=%s: %s",
                shipment_id, e,
            )

    # ------------------------------------------------------------------
    # Event ingestion
    # ------------------------------------------------------------------

    def ingest_event(
        self,
        *,
        shipment_id: int,
        order_id: int,
        event: NormalizedEvent,
        source: str = "mock",
    ) -> Optional[TrackingEvent]:
        """统一入口：webhook / cron query / Admin 手注都走这里。

        步骤：
          1. 唯一约束去重写库
          2. 更新 order_shipments 缓存列
          3. delivered → 自动 transition_status(DELIVERED)（沿用 order_service 已有逻辑，
             包含 IM 双方卡片 + push 通知）
          4. 其他 status：按 _PUSH_RULES 推送给买家（或双方）
        """
        try:
            inserted = self._insert_event(
                shipment_id=shipment_id,
                order_id=order_id,
                event=event,
                source=source,
            )
            if not inserted:
                # 重复事件，安静跳过
                return None

            self._refresh_shipment_cache(shipment_id, inserted)

            # 新轨迹意味着包裹恢复活动,清掉之前 detect_stuck_packages 打上的暂停标记。
            try:
                self.db.table("orders").update(
                    {
                        "tracking_stuck_since": None,
                        "auto_confirm_paused_at": None,
                    }
                ).eq("id", order_id).neq("tracking_stuck_since", None).execute()
            except Exception:
                pass

            if event.status_code == TrackingStatus.DELIVERED:
                # 走 order_service 现有的"DELIVERED 双方卡片 + push"流程
                self._auto_mark_delivered(order_id)
            else:
                self._maybe_push_notification(order_id, inserted)

            return inserted
        except Exception as e:  # noqa: BLE001
            logger.exception(
                "[tracking] ingest_event failure shipment=%s status=%s err=%s",
                shipment_id, event.status_code, e,
            )
            return None

    # ------------------------------------------------------------------
    # Listing / lookup
    # ------------------------------------------------------------------

    def list_events(self, order_id: int) -> TrackingFeed:
        """订单详情拉时间轴。"""
        try:
            res = (
                self.db.table("tracking_events")
                .select("*")
                .eq("order_id", order_id)
                .order("occurred_at", desc=True)
                .limit(100)
                .execute()
            )
            items = [self._format(row) for row in (res.data or [])]
        except Exception as e:  # noqa: BLE001
            logger.exception("[tracking] list_events failed order=%s: %s", order_id, e)
            items = []

        latest = items[0] if items else None
        # 取 shipment 缓存列作为兜底（首次发货还没拉到 event 时也能显示）
        ship_row = None
        try:
            sr = (
                self.db.table("order_shipments")
                .select(
                    "latest_status_code, latest_description, latest_location, "
                    "latest_event_at, provider_source"
                )
                .eq("order_id", order_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            ship_row = sr.data[0] if sr.data else None
        except Exception:
            ship_row = None

        return TrackingFeed(
            items=items,
            latestStatusCode=(latest.statusCode if latest
                              else (ship_row or {}).get("latest_status_code")),
            latestDescription=(latest.description if latest
                               else (ship_row or {}).get("latest_description")),
            latestLocation=(latest.location if latest
                            else (ship_row or {}).get("latest_location")),
            latestEventAt=(latest.occurredAt if latest
                           else (ship_row or {}).get("latest_event_at")),
            providerSource=(ship_row or {}).get("provider_source") if ship_row else None,
        )

    # ------------------------------------------------------------------
    # Admin / Mock 手动注入
    # ------------------------------------------------------------------

    def admin_inject_event(
        self,
        *,
        order_id: int,
        payload: TrackingEventCreate,
    ) -> Optional[TrackingEvent]:
        """Admin 入口：手动写一条事件（dev 联调 + 真物流方失联兜底）。"""
        ship = self._latest_shipment(order_id)
        if not ship:
            raise ValueError("订单还没有发货")

        event = NormalizedEvent(
            occurred_at=_iso_or_now(payload.occurredAt),
            status_code=payload.statusCode,
            description=payload.description,
            location=payload.location,
            raw=payload.rawPayload or {},
        )
        return self.ingest_event(
            shipment_id=int(ship["id"]),
            order_id=order_id,
            event=event,
            source=payload.source or "manual",
        )

    # ------------------------------------------------------------------
    # Cron 兜底
    # ------------------------------------------------------------------

    def pull_pending_shipments(self, *, stale_hours: int = 12) -> int:
        """扫"还在路上 + 上次更新太老"的运单，主动 query 一次。"""
        threshold = (datetime.now(timezone.utc) - timedelta(hours=stale_hours)).isoformat()
        try:
            # 拿 shipped 但 latest_event_at 老的运单
            res = (
                self.db.table("order_shipments")
                .select("id, order_id, carrier, tracking_no, latest_event_at, provider_source")
                .execute()
            )
            rows = res.data or []
        except Exception as e:  # noqa: BLE001
            logger.exception("[tracking] pull_pending list failed: %s", e)
            return 0

        # 仅处理对应订单仍 shipped 的（DB join 写起来麻烦，单独查一遍）
        order_ids = list({r["order_id"] for r in rows})
        if not order_ids:
            return 0
        try:
            ord_res = (
                self.db.table("orders")
                .select("id, status")
                .in_("id", order_ids)
                .execute()
            )
            shipped_ids = {
                r["id"] for r in (ord_res.data or []) if r.get("status") == "shipped"
            }
        except Exception:
            shipped_ids = set()

        scanned = 0
        for r in rows:
            if r["order_id"] not in shipped_ids:
                continue
            if r.get("latest_event_at") and r["latest_event_at"] > threshold:
                continue
            carrier = r.get("carrier") or ""
            tracking_no = r.get("tracking_no") or ""
            if not carrier or not tracking_no:
                continue
            try:
                provider, code = get_provider_for_carrier(carrier)
                events = provider.query(carrier=code, tracking_no=tracking_no)
            except Exception as e:
                logger.warning(
                    "[tracking] cron query failed shipment=%s err=%s", r["id"], e
                )
                events = []
            for ev in events:
                self.ingest_event(
                    shipment_id=int(r["id"]),
                    order_id=int(r["order_id"]),
                    event=ev,
                    source=provider.name,
                )
                scanned += 1
        return scanned

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _latest_shipment(self, order_id: int) -> Optional[Dict[str, Any]]:
        try:
            res = (
                self.db.table("order_shipments")
                .select("*")
                .eq("order_id", order_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            return res.data[0] if res.data else None
        except Exception:
            return None

    def _insert_event(
        self,
        *,
        shipment_id: int,
        order_id: int,
        event: NormalizedEvent,
        source: str,
    ) -> Optional[TrackingEvent]:
        payload = {
            "shipment_id":  shipment_id,
            "order_id":     order_id,
            "occurred_at":  _iso_or_now(event.occurred_at),
            "status_code":  event.status_code.value
                            if hasattr(event.status_code, "value")
                            else str(event.status_code),
            "description":  event.description,
            "location":     event.location,
            "source":       source or "mock",
            "raw_payload":  event.raw or None,
        }
        try:
            res = self.db.table("tracking_events").insert(payload).execute()
            if not res.data:
                return None
            return self._format(res.data[0])
        except Exception as e:
            # UNIQUE 冲突走这里，安静吞掉 —— 跨 provider / cron 双重投递常态
            msg = str(e).lower()
            if "duplicate" in msg or "unique" in msg or "23505" in msg:
                return None
            logger.warning("[tracking] insert event failed: %s", e)
            return None

    def _refresh_shipment_cache(
        self,
        shipment_id: int,
        event: TrackingEvent,
    ) -> None:
        try:
            self.db.table("order_shipments").update(
                {
                    "latest_status_code": event.statusCode,
                    "latest_description": event.description,
                    "latest_location":    event.location,
                    "latest_event_at":    event.occurredAt,
                }
            ).eq("id", shipment_id).execute()
        except Exception as e:  # noqa: BLE001
            logger.warning("[tracking] refresh cache failed: %s", e)

    def _auto_mark_delivered(self, order_id: int) -> None:
        """快递公司报"已签收" → 自动推进订单状态机到 DELIVERED.

        order_service.transition_status 内部会触发买卖双方 IM 卡片 + push，
        我们这里只关心是否值得调它。
        """
        try:
            # 懒导入避免循环
            from app.services.order_service import order_service
            from app.schemas.orders import OrderStatus

            order = order_service.get_order(order_id)
            if not order:
                return
            if order.status not in {"shipped"}:
                # 已经过了 delivered / completed 阶段，跳过
                return
            order_service.transition_status(
                order_id,
                OrderStatus.DELIVERED,
                actor_user_id=0,
                is_admin=True,
                reason="物流回传已签收",
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("[tracking] auto_mark_delivered failed: %s", e)

    def _maybe_push_notification(
        self,
        order_id: int,
        event: TrackingEvent,
    ) -> None:
        """按 _PUSH_RULES 决定是否推送，去重 / 限频 / 单双方都在这里处理。"""
        rule = _PUSH_RULES.get(event.statusCode)
        if not rule:
            return

        # in_transit 限频
        if not rule.get("alwaysPush"):
            min_hours = rule.get("minIntervalHours")
            if min_hours and self._has_recent_push(event, min_hours):
                return

        recipients = self._resolve_recipients(
            order_id, broadcast_both=bool(rule.get("broadcastBothParties"))
        )
        if not recipients:
            return

        title = self._notif_title(event.statusCode)
        body = event.description or self._notif_default_body(event.statusCode)
        action_data = {
            "navigateTo": "OrderDetail",
            "navigateParams": {"orderId": order_id},
            "orderId": order_id,
            "trackingStatus": event.statusCode,
        }

        try:
            from app.services.notification_service import notification_service
            from app.schemas.notification import NotificationType
            for uid in recipients:
                notification_service.create_notification(
                    user_id=uid,
                    notification_type=NotificationType.SYSTEM,
                    title=title,
                    message=body,
                    action_data=action_data,
                )
        except Exception as e:  # noqa: BLE001
            logger.warning("[tracking] push notification failed: %s", e)
            return

        # 标记已推
        try:
            self.db.table("tracking_events").update(
                {"notified_at": _now_iso()}
            ).eq("id", event.id).execute()
        except Exception:
            pass

    def _has_recent_push(
        self,
        event: TrackingEvent,
        min_hours: int,
    ) -> bool:
        """同 shipment + 同 status，min_hours 内已经推过则跳过（防刷屏）。"""
        try:
            cutoff = (
                datetime.now(timezone.utc) - timedelta(hours=min_hours)
            ).isoformat()
            res = (
                self.db.table("tracking_events")
                .select("id, location")
                .eq("shipment_id", event.shipmentId)
                .eq("status_code", event.statusCode)
                .neq("id", event.id)
                .not_.is_("notified_at", "null")
                .gte("notified_at", cutoff)
                .limit(1)
                .execute()
            )
            if not res.data:
                return False
            # 站点变化时即使在窗口内也推一次，与微信物流通知一致
            prev_loc = (res.data[0] or {}).get("location")
            if event.location and prev_loc and event.location != prev_loc:
                return False
            return True
        except Exception:
            return False

    def _resolve_recipients(
        self,
        order_id: int,
        *,
        broadcast_both: bool,
    ) -> List[int]:
        """物流事件默认通知买家；signed / exception 才广播双方。"""
        try:
            res = (
                self.db.table("orders")
                .select("buyer_user_id, seller_user_id, seller_merchant_id")
                .eq("id", order_id)
                .limit(1)
                .execute()
            )
            if not res.data:
                return []
            row = res.data[0]
            buyer_id = row.get("buyer_user_id")
            recipients = [buyer_id] if buyer_id else []
            if broadcast_both:
                seller_id = row.get("seller_user_id")
                if not seller_id and row.get("seller_merchant_id"):
                    try:
                        from app.services.store_merchant_service import (
                            store_merchant_service,
                        )
                        merchant = store_merchant_service.get_merchant_by_id(
                            row["seller_merchant_id"]
                        )
                        seller_id = getattr(merchant, "userId", None) if merchant else None
                    except Exception:
                        seller_id = None
                if seller_id and seller_id not in recipients:
                    recipients.append(seller_id)
            return [r for r in recipients if r]
        except Exception:
            return []

    def _notif_title(self, status_code: str) -> str:
        # 标题简短，文案中性 — push 上字数有限。
        # i18n 处理留给前端展示侧（系统通知本身仍按 zh-CN 文案，足够。）
        if status_code in ("delivered", "exception", "returned"):
            return "您的订单有重要更新"
        return "您的包裹有新动态"

    def _notif_default_body(self, status_code: str) -> str:
        return {
            "picked_up":        "包裹已揽收",
            "in_transit":       "包裹运输中",
            "out_for_delivery": "包裹派送中,请保持电话畅通",
            "delivered":        "包裹已签收",
            "exception":        "物流异常,请查看详情",
            "returned":         "包裹已退回",
        }.get(status_code, "物流状态已更新")

    @staticmethod
    def _format(row: Dict[str, Any]) -> TrackingEvent:
        return TrackingEvent(
            id=row["id"],
            shipmentId=row["shipment_id"],
            orderId=row["order_id"],
            occurredAt=row["occurred_at"],
            statusCode=row["status_code"],
            description=row.get("description"),
            location=row.get("location"),
            source=row.get("source") or "mock",
            createdAt=row.get("created_at"),
        )


tracking_service = TrackingService()
