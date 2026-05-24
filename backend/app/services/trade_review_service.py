"""
PRD 模块 5 · 双盲互评。

规则：
  - 同一订单同一角色只能评一次
  - visible 在双方都提交后由 DB trigger 自动 = TRUE；这里只负责写入
  - 暴露：submit / list_for_user / list_for_order
"""
from __future__ import annotations

from typing import Optional, List, Tuple, Dict, Any

from app.db.supabase import get_supabase_admin, execute_with_retry
from app.schemas.disputes import TradeReview
from app.services.order_service import order_service


class TradeReviewService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

    @staticmethod
    def _format(row: dict) -> TradeReview:
        return TradeReview(
            id=row["id"],
            orderId=row["order_id"],
            reviewerUserId=row["reviewer_user_id"],
            reviewerRole=row["reviewer_role"],
            targetUserId=row["target_user_id"],
            rating=row["rating"],
            payload=row.get("payload_json"),
            comment=row.get("comment"),
            visible=row.get("visible", False),
            submittedAt=row.get("submitted_at"),
        )

    def submit(
        self,
        *,
        order_id: int,
        reviewer_user_id: int,
        rating: int,
        payload: Optional[Dict[str, Any]],
        comment: Optional[str],
    ) -> TradeReview:
        order = order_service.get_order(order_id)
        if not order:
            raise ValueError("订单不存在")
        if order.status not in ("completed", "settled", "resolved"):
            raise ValueError("订单未完成，无法评价")

        if order.buyerUserId == reviewer_user_id:
            role = "buyer"
            target = order.sellerUserId
        elif order.sellerUserId == reviewer_user_id:
            role = "seller"
            target = order.buyerUserId
        else:
            raise PermissionError("仅订单双方可评价")
        if not target:
            raise ValueError("缺少对方用户身份，暂时无法评价（merchant 卖家 P5 后续接入）")

        payload_row = {
            "order_id": order_id,
            "reviewer_user_id": reviewer_user_id,
            "reviewer_role": role,
            "target_user_id": target,
            "rating": rating,
            "payload_json": payload,
            "comment": comment,
        }
        try:
            res = self.db.table("trade_reviews").insert(payload_row).execute()
        except Exception:
            raise ValueError("已评价过")
        if not res.data:
            raise RuntimeError("写入评价失败")
        review = self._format(res.data[0])

        # 通知对方：单方评价时只触发轻提醒；DB trigger 在双方都提交后会把 visible 翻 True
        # —— 我们这里二次查询以判断是否已 visible，再决定 push 文案。
        try:
            from app.services.notification_service import notification_service
            from app.schemas.notification import NotificationType
            visible_now = bool(res.data[0].get("visible"))
            if visible_now:
                title = "互评已公开"
                message = "对方已完成评价，双方评价现在已互相可见"
            else:
                title = "收到一条评价"
                message = "对方已对你做出评价，互评将在你也提交后公开"
            notification_service.create_notification(
                user_id=target,
                notification_type=NotificationType.SYSTEM,
                title=title,
                message=message,
                action_data={
                    "navigateTo": "OrderReviews",
                    "navigateParams": {"orderId": order_id},
                },
                send_push=True,
            )
        except Exception as e:  # noqa: BLE001
            print(f"[trade_review] notify counterparty failed: {e}")

        return review

    def list_for_user(
        self,
        user_id: int,
        *,
        only_visible: bool = True,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[TradeReview], int]:
        q = (
            self.db.table("trade_reviews")
            .select("*", count="exact")
            .eq("target_user_id", user_id)
        )
        if only_visible:
            q = q.eq("visible", True)
        q = q.order("submitted_at", desc=True)
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = execute_with_retry(lambda: q.execute(), label="trade_reviews.list")
        return [self._format(r) for r in (res.data or [])], (res.count or 0)

    def list_for_order(self, order_id: int, *, viewer_user_id: int) -> List[TradeReview]:
        res = (
            self.db.table("trade_reviews")
            .select("*")
            .eq("order_id", order_id)
            .execute()
        )
        rows = res.data or []
        # 单方 review 仅自己可看
        filtered = []
        for r in rows:
            if r.get("visible") or r["reviewer_user_id"] == viewer_user_id:
                filtered.append(self._format(r))
        return filtered


trade_review_service = TradeReviewService()
