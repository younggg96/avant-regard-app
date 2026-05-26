"""
PRD 模块 5 · 双盲互评 + 自动关闭。

规则:
  - 同一订单同一角色只能评一次
  - visible 在双方都提交后由 DB trigger 自动 = TRUE
  - 单方提交满 15 天后,cron 把其设为 visible(对方放弃评价)
  - 双方都没评满 7 天后,cron 自动写一条 5 星好评(双方各一条),双方互见
  - photos_json: 评价配图,最多 3 张,机审 + 敏感词过滤
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, List, Tuple, Dict, Any

from app.db.supabase import get_supabase_admin, execute_with_retry
from app.schemas.disputes import TradeReview
from app.services.order_service import order_service


# 评价文字简易敏感词过滤(无第三方依赖时的兜底)。
# 真实生产可接阿里云内容安全(本仓库已经引入了 imageaudit SDK)。
_SENSITIVE_KEYWORDS = (
    "诈骗", "假货高仿", "卖家是骗子", "举报",
    "fuck", "shit", "bitch",
)


def _contains_sensitive(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    return any(k.lower() in lowered for k in _SENSITIVE_KEYWORDS)


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
            photos=row.get("photos_json") or [],
            visible=row.get("visible", False),
            submittedAt=row.get("submitted_at"),
            autoClosedAt=row.get("auto_closed_at"),
        )

    def submit(
        self,
        *,
        order_id: int,
        reviewer_user_id: int,
        rating: int,
        payload: Optional[Dict[str, Any]],
        comment: Optional[str],
        photos: Optional[List[str]] = None,
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

        # 机审 1:文字敏感词
        if _contains_sensitive(comment or ""):
            raise ValueError("评价文字包含不当内容,请修改后再提交")

        # 机审 2:图片张数 / URL 形态(实际内容审核接阿里云 imageaudit,
        # 这里只做条数限制 + URL 长度兜底)
        clean_photos: List[str] = []
        for url in (photos or [])[:3]:
            if isinstance(url, str) and 5 < len(url) < 800:
                clean_photos.append(url)

        payload_row = {
            "order_id": order_id,
            "reviewer_user_id": reviewer_user_id,
            "reviewer_role": role,
            "target_user_id": target,
            "rating": rating,
            "payload_json": payload,
            "comment": comment,
            "photos_json": clean_photos,
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

    # ------------------------------------------------------------------
    # Cron · 7 天自动好评 / 15 天单方公开
    # ------------------------------------------------------------------

    def run_auto_close(self) -> int:
        """Cron 入口。每小时跑一次。

        规则:
          A) `completed_at` 距今 ≥ 7 天 且双方都没评过 → 系统自动写 5 星好评 × 2
          B) 单方已评 + `submitted_at` 距今 ≥ 15 天 + 对方仍未评 → 把已评的 visible 翻 true
        """
        now = datetime.utcnow()
        affected = 0
        affected += self._auto_good_review_after_7d(now)
        affected += self._unilateral_reveal_after_15d(now)
        return affected

    def _auto_good_review_after_7d(self, now: datetime) -> int:
        cutoff = (now - timedelta(days=7)).isoformat()
        try:
            res = (
                self.db.table("orders")
                .select("id, buyer_user_id, seller_user_id, completed_at")
                .in_("status", ["completed", "settled"])
                .lt("completed_at", cutoff)
                .execute()
            )
        except Exception:
            return 0
        rows = res.data or []
        count = 0
        for o in rows:
            order_id = o["id"]
            buyer = o.get("buyer_user_id")
            seller = o.get("seller_user_id")
            if not (buyer and seller):
                continue
            # 查现有评价
            ex = (
                self.db.table("trade_reviews")
                .select("reviewer_role")
                .eq("order_id", order_id)
                .execute()
            )
            existing_roles = {r["reviewer_role"] for r in (ex.data or [])}

            to_insert = []
            if "buyer" not in existing_roles:
                to_insert.append(
                    {
                        "order_id": order_id,
                        "reviewer_user_id": buyer,
                        "reviewer_role": "buyer",
                        "target_user_id": seller,
                        "rating": 5,
                        "payload_json": {"autoClosed": True},
                        "comment": "系统默认好评(超时未评)",
                        "photos_json": [],
                        "auto_closed_at": now.isoformat(),
                    }
                )
            if "seller" not in existing_roles:
                to_insert.append(
                    {
                        "order_id": order_id,
                        "reviewer_user_id": seller,
                        "reviewer_role": "seller",
                        "target_user_id": buyer,
                        "rating": 5,
                        "payload_json": {"autoClosed": True},
                        "comment": "系统默认好评(超时未评)",
                        "photos_json": [],
                        "auto_closed_at": now.isoformat(),
                    }
                )
            if not to_insert:
                continue
            try:
                self.db.table("trade_reviews").insert(to_insert).execute()
                count += len(to_insert)
            except Exception as e:
                print(f"[review] auto close insert failed order={order_id}: {e}")
        return count

    def _unilateral_reveal_after_15d(self, now: datetime) -> int:
        cutoff = (now - timedelta(days=15)).isoformat()
        try:
            res = (
                self.db.table("trade_reviews")
                .select("id, order_id, submitted_at")
                .eq("visible", False)
                .lt("submitted_at", cutoff)
                .execute()
            )
        except Exception:
            return 0
        rows = res.data or []
        count = 0
        for r in rows:
            try:
                self.db.table("trade_reviews").update({"visible": True}).eq(
                    "id", r["id"]
                ).execute()
                count += 1
            except Exception as e:
                print(f"[review] reveal {r.get('id')} failed: {e}")
        return count


trade_review_service = TradeReviewService()
# 调度器导入约定别名(scheduler_service 期望 review_service)
review_service = trade_review_service
