"""
PRD 模块 5 · 鉴定服务三档 SKU。

¥99 / 199 / 399 三档；走与商品订单同一套支付适配器（PaymentProvider），
但单独的 authentication_orders 表，结果独立报告。

简化：MVP 阶段仅提供 mock 支付链路 + 一个 admin 决策入口。
"""
from __future__ import annotations

import logging
import secrets
from typing import List, Optional, Tuple
from datetime import datetime

from app.db.supabase import get_supabase_admin, execute_with_retry
from app.schemas.disputes import (
    AuthenticationOrder,
    AuthenticationPackage,
)
from app.services.payment import get_payment_provider

logger = logging.getLogger(__name__)


def _gen_no() -> str:
    return "AUTH" + datetime.utcnow().strftime("%y%m%d%H%M%S") + secrets.token_hex(2).upper()


_RESULT_LABEL = {
    "authentic": "正品",
    "fake": "非正品",
    "inconclusive": "无法判定",
    "pending": "待审核",
}


def _result_label(result: str) -> str:
    return _RESULT_LABEL.get(result, result)


class AuthenticationService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

    # ------------------------------------------------------------------
    # Notification helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _notify_user(
        *,
        user_id: int,
        title: str,
        message: str,
        order_id: int,
    ) -> None:
        """In-app notification + push，深链跳到鉴定列表页（MVP 只有列表）。"""
        try:
            from app.services.notification_service import notification_service
            from app.schemas.notification import NotificationType
            notification_service.create_notification(
                user_id=user_id,
                notification_type=NotificationType.SYSTEM,
                title=title,
                message=message,
                action_data={
                    "navigateTo": "Authentication",
                    "navigateParams": {"focusAuthOrderId": order_id},
                },
                send_push=True,
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("[authentication] notify failed: %s", e)

    # ------------------------------------------------------------------
    # Packages
    # ------------------------------------------------------------------

    def list_packages(self) -> List[AuthenticationPackage]:
        res = (
            self.db.table("authentication_packages")
            .select("*")
            .eq("is_active", True)
            .order("sort_order", desc=False)
            .execute()
        )
        return [
            AuthenticationPackage(
                id=r["id"],
                code=r["code"],
                name=r["name"],
                priceCents=r["price_cents"],
                currency=r.get("currency", "CNY"),
                slaHours=r["sla_hours"],
                description=r.get("description"),
            )
            for r in (res.data or [])
        ]

    def _get_package_by_code(self, code: str) -> dict:
        res = (
            self.db.table("authentication_packages")
            .select("*")
            .eq("code", code)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise ValueError(f"未知套餐 {code}")
        return res.data[0]

    # ------------------------------------------------------------------
    # Auth orders
    # ------------------------------------------------------------------

    @staticmethod
    def _format(row: dict) -> AuthenticationOrder:
        return AuthenticationOrder(
            id=row["id"],
            orderNo=row["order_no"],
            userId=row["user_id"],
            packageId=row["package_id"],
            packageCode=row.get("package_code"),
            productId=row.get("product_id"),
            brandName=row.get("brand_name"),
            itemPhotos=row.get("item_photos") or [],
            note=row.get("note"),
            priceCents=row["price_cents"],
            currency=row.get("currency", "CNY"),
            status=row["status"],
            result=row.get("result", "pending"),
            expertUserId=row.get("expert_user_id"),
            expertReport=row.get("expert_report"),
            certificateUrl=row.get("certificate_url"),
            paymentProvider=row.get("payment_provider"),
            paymentIntentId=row.get("payment_intent_id"),
            paidAt=row.get("paid_at"),
            completedAt=row.get("completed_at"),
            createdAt=row.get("created_at"),
        )

    def create_order(
        self,
        *,
        user_id: int,
        package_code: str,
        product_id: Optional[int],
        brand_name: Optional[str],
        item_photos: List[str],
        note: Optional[str],
    ) -> AuthenticationOrder:
        if not item_photos:
            raise ValueError("至少需要 1 张商品照片")
        pkg = self._get_package_by_code(package_code)
        order_no = _gen_no()
        payload = {
            "order_no": order_no,
            "user_id": user_id,
            "package_id": pkg["id"],
            "product_id": product_id,
            "brand_name": brand_name,
            "item_photos": item_photos,
            "note": note,
            "price_cents": pkg["price_cents"],
            "currency": pkg.get("currency", "CNY"),
            "status": "pending_payment",
            "result": "pending",
        }
        res = self.db.table("authentication_orders").insert(payload).execute()
        if not res.data:
            raise RuntimeError("创建鉴定订单失败")
        row = res.data[0]

        provider = get_payment_provider()
        intent = provider.create_intent(
            order_id=row["id"],
            amount_cents=pkg["price_cents"],
            currency=pkg.get("currency", "CNY"),
            metadata={"authOrderNo": order_no},
        )
        self.db.table("authentication_orders").update(
            {
                "payment_provider": intent.provider,
                "payment_intent_id": intent.intent_id,
            }
        ).eq("id", row["id"]).execute()
        row.update(
            {"payment_provider": intent.provider, "payment_intent_id": intent.intent_id}
        )

        self._notify_user(
            user_id=user_id,
            title="鉴定订单已创建",
            message=f"订单 #{order_no} 已生成，请尽快完成支付。",
            order_id=row["id"],
        )
        return self._format(row)

    def pay_mock(self, order_id: int, user_id: int) -> AuthenticationOrder:
        row = self._get_or_raise(order_id)
        if row["user_id"] != user_id:
            raise PermissionError("无权操作")
        if row["status"] != "pending_payment":
            raise ValueError("当前状态不可支付")
        now = datetime.utcnow().isoformat()
        self.db.table("authentication_orders").update(
            {"status": "reviewing", "paid_at": now}
        ).eq("id", order_id).execute()
        row.update({"status": "reviewing", "paid_at": now})

        self._notify_user(
            user_id=user_id,
            title="鉴定费已收款，专家审核中",
            message=f"订单 #{row['order_no']} 已开始鉴定，请耐心等待报告。",
            order_id=order_id,
        )
        return self._format(row)

    def submit_decision(
        self,
        order_id: int,
        *,
        expert_user_id: int,
        result: str,
        expert_report: str,
        certificate_url: Optional[str],
    ) -> AuthenticationOrder:
        if result not in ("authentic", "fake", "inconclusive"):
            raise ValueError("非法结果")
        row = self._get_or_raise(order_id)
        if row["status"] not in ("paid", "reviewing"):
            raise ValueError("当前状态不可裁决")
        now = datetime.utcnow().isoformat()
        self.db.table("authentication_orders").update(
            {
                "status": "completed",
                "result": result,
                "expert_user_id": expert_user_id,
                "expert_report": expert_report,
                "certificate_url": certificate_url,
                "completed_at": now,
            }
        ).eq("id", order_id).execute()
        row.update(
            {
                "status": "completed",
                "result": result,
                "expert_user_id": expert_user_id,
                "expert_report": expert_report,
                "certificate_url": certificate_url,
                "completed_at": now,
            }
        )

        self._notify_user(
            user_id=row["user_id"],
            title=f"鉴定结果：{_result_label(result)}",
            message=f"订单 #{row['order_no']} 已完成鉴定，点击查看详细报告。",
            order_id=order_id,
        )
        return self._format(row)

    def list_for_user(
        self, user_id: int, *, page: int = 1, page_size: int = 20
    ) -> Tuple[List[AuthenticationOrder], int]:
        q = (
            self.db.table("authentication_orders")
            .select("*", count="exact")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
        )
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = execute_with_retry(lambda: q.execute(), label="auth_orders.list")
        return [self._format(r) for r in (res.data or [])], (res.count or 0)

    def list_for_admin(
        self, *, status: Optional[str] = None, page: int = 1, page_size: int = 30
    ) -> Tuple[List[AuthenticationOrder], int]:
        q = self.db.table("authentication_orders").select("*", count="exact")
        if status:
            q = q.eq("status", status)
        q = q.order("created_at", desc=False)
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = execute_with_retry(lambda: q.execute(), label="auth_orders.admin_list")
        return [self._format(r) for r in (res.data or [])], (res.count or 0)

    def _get_or_raise(self, order_id: int) -> dict:
        res = (
            self.db.table("authentication_orders")
            .select("*")
            .eq("id", order_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise ValueError("鉴定订单不存在")
        return res.data[0]


authentication_service = AuthenticationService()
