"""
PRD 模块 6 · My Archive 服务。

- 订单进入 completed 时自动 snapshot 一条 user_archive_items
- 用户「一键转卖」：用 archive 数据 prefill 新 listing，落地新 product_id 后回写 relisted_*。
"""
from __future__ import annotations

from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime

from app.db.supabase import get_supabase_admin, execute_with_retry
from app.schemas.archive_plus import (
    ArchiveItem,
    ArchiveAnalytics,
    ArchiveItemManualCreate,
    ArchiveHoldingRecord,
    ArchiveHoldingCreate,
)


class ArchiveService:
    # 可被「手动转入 MY ARCHIVE」的订单状态：买家已实际拿到/完成的单。
    TRANSFERABLE_ORDER_STATUSES = {
        "delivered",
        "completed",
        "settled",
        "resolved",
    }

    def __init__(self) -> None:
        self.db = get_supabase_admin()

    @staticmethod
    def _resolve_seller_user_id(order_row: dict) -> Optional[int]:
        """C2C 取 seller_user_id；买手店卖家回退 merchant.user_id。"""
        if order_row.get("seller_user_id"):
            return order_row["seller_user_id"]
        merchant_id = order_row.get("seller_merchant_id")
        if not merchant_id:
            return None
        try:
            from app.services.store_merchant_service import store_merchant_service

            merchant = store_merchant_service.get_merchant_by_id(merchant_id)
            if merchant:
                return getattr(merchant, "userId", None)
        except Exception:
            return None
        return None

    def _product_snapshot(self, product_id: int) -> dict:
        prod_res = (
            self.db.table("store_products")
            .select(
                "id, title, brand, size, color, condition, original_show_id, images"
            )
            .eq("id", product_id)
            .limit(1)
            .execute()
        )
        return prod_res.data[0] if prod_res.data else {}

    def _insert_archive_payload(self, payload: dict) -> Optional[ArchiveItem]:
        try:
            res = self.db.table("user_archive_items").insert(payload).execute()
        except Exception as insert_err:
            if payload.pop("original_show_id", None) is not None:
                res = self.db.table("user_archive_items").insert(payload).execute()
            else:
                raise insert_err
        if not res.data:
            return None
        return self._format(res.data[0])

    @staticmethod
    def _format(row: dict) -> ArchiveItem:
        return ArchiveItem(
            id=row["id"],
            userId=row["user_id"],
            productId=row.get("product_id"),
            orderId=row.get("order_id"),
            title=row.get("title"),
            brandName=row.get("brand_name"),
            size=row.get("size"),
            color=row.get("color"),
            condition=row.get("condition"),
            originalShowId=row.get("original_show_id"),
            acquiredPriceCents=row.get("acquired_price_cents"),
            currency=row.get("currency", "CNY"),
            photos=row.get("photos") or [],
            acquiredAt=row.get("acquired_at"),
            note=row.get("note"),
            relistedProductId=row.get("relisted_product_id"),
            relistedAt=row.get("relisted_at"),
            source=row.get("source", "order"),
            storageLocation=row.get("storage_location"),
            isCurrentlyOwned=row.get("is_currently_owned", True),
            createdAt=row.get("created_at"),
            updatedAt=row.get("updated_at"),
        )

    @staticmethod
    def _format_holding(row: dict) -> ArchiveHoldingRecord:
        return ArchiveHoldingRecord(
            id=row["id"],
            archiveItemId=row["archive_item_id"],
            userId=row["user_id"],
            heldFrom=row.get("held_from"),
            heldTo=row.get("held_to"),
            status=row.get("status", "owned"),
            note=row.get("note"),
            counterpartUserId=row.get("counterpart_user_id"),
            counterpartName=row.get("counterpart_name"),
            relatedProductId=row.get("related_product_id"),
            relatedOrderId=row.get("related_order_id"),
            createdAt=row.get("created_at"),
        )

    def snapshot_from_order(self, order_id: int) -> Optional[ArchiveItem]:
        """订单完成后调用，自动生成 archive 条目。"""
        try:
            order_res = (
                self.db.table("orders")
                .select("*")
                .eq("id", order_id)
                .limit(1)
                .execute()
            )
            if not order_res.data:
                return None
            order = order_res.data[0]

            # 幂等：同一订单已入库则直接返回既有条目，避免重复 snapshot
            # （自动入库与手动「转入藏品」可能先后触发同一订单）。
            existing = (
                self.db.table("user_archive_items")
                .select("*")
                .eq("order_id", order_id)
                .eq("user_id", order["buyer_user_id"])
                .limit(1)
                .execute()
            )
            if existing.data:
                return self._format(existing.data[0])

            prod_res = (
                self.db.table("store_products")
                .select(
                    "id, title, brand, size, color, condition, original_show_id, images"
                )
                .eq("id", order["product_id"])
                .limit(1)
                .execute()
            )
            prod = prod_res.data[0] if prod_res.data else {}

            payload = {
                "user_id": order["buyer_user_id"],
                "product_id": order["product_id"],
                "order_id": order_id,
                "title": prod.get("title"),
                "brand_name": prod.get("brand"),
                "size": prod.get("size"),
                "color": prod.get("color"),
                "condition": prod.get("condition"),
                "original_show_id": prod.get("original_show_id"),
                "acquired_price_cents": order["paid_price_cents"],
                "currency": order.get("currency", "CNY"),
                "photos": prod.get("images") or [],
                "acquired_at": (order.get("completed_at") or order.get("paid_at") or datetime.utcnow().isoformat())[:10],
                "source": "order",
            }
            try:
                res = self.db.table("user_archive_items").insert(payload).execute()
            except Exception as insert_err:
                # 秀场外键失效时降级：去掉 original_show_id 再试一次。
                if payload.pop("original_show_id", None) is not None:
                    res = self.db.table("user_archive_items").insert(payload).execute()
                else:
                    raise insert_err
            if not res.data:
                return None
            return self._format(res.data[0])
        except Exception as e:
            print(f"[archive] snapshot_from_order failed: {e}")
            return None

    def snapshot_sold_from_order(
        self, order_id: int, seller_user_id: int
    ) -> Optional[ArchiveItem]:
        """卖家售出后手动/自动写入 MY ARCHIVE（已售回忆，不再持有）。"""
        try:
            order_res = (
                self.db.table("orders")
                .select("*")
                .eq("id", order_id)
                .limit(1)
                .execute()
            )
            if not order_res.data:
                return None
            order = order_res.data[0]

            existing = (
                self.db.table("user_archive_items")
                .select("*")
                .eq("order_id", order_id)
                .eq("user_id", seller_user_id)
                .limit(1)
                .execute()
            )
            if existing.data:
                return self._format(existing.data[0])

            prod = self._product_snapshot(order["product_id"])
            sold_at = (
                order.get("completed_at")
                or order.get("paid_at")
                or datetime.utcnow().isoformat()
            )[:10]

            payload = {
                "user_id": seller_user_id,
                "product_id": order["product_id"],
                "order_id": order_id,
                "title": prod.get("title"),
                "brand_name": prod.get("brand"),
                "size": prod.get("size"),
                "color": prod.get("color"),
                "condition": prod.get("condition"),
                "original_show_id": prod.get("original_show_id"),
                "acquired_price_cents": order["paid_price_cents"],
                "currency": order.get("currency", "CNY"),
                "photos": prod.get("images") or [],
                "acquired_at": sold_at,
                "source": "order",
                "is_currently_owned": False,
            }
            item = self._insert_archive_payload(payload)
            if not item:
                return None

            try:
                self.add_holding(
                    item.id,
                    seller_user_id,
                    ArchiveHoldingCreate(
                        heldFrom=sold_at,
                        status="resold",
                        note="订单售出 · 入藏",
                        counterpartUserId=order.get("buyer_user_id"),
                        relatedOrderId=order_id,
                    ),
                )
            except Exception as e:
                print(f"[archive] seller sold holding failed: {e}")
            return item
        except Exception as e:
            print(f"[archive] snapshot_sold_from_order failed: {e}")
            return None

    def get_by_order(self, order_id: int, user_id: int) -> Optional[ArchiveItem]:
        """查询某订单是否已转入当前用户的 MY ARCHIVE。"""
        res = (
            self.db.table("user_archive_items")
            .select("*")
            .eq("order_id", order_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return self._format(res.data[0])

    def transfer_from_order(self, order_id: int, user_id: int) -> ArchiveItem:
        """手动把订单相关单品转入 MY ARCHIVE（买家购入 / 卖家售出）。

        - 仅订单买家或卖家本人可操作
        - 订单需处于已收货/完成等状态
        - 幂等：已入库则返回既有条目
        """
        order_res = (
            self.db.table("orders")
            .select(
                "id, buyer_user_id, seller_user_id, seller_merchant_id, status"
            )
            .eq("id", order_id)
            .limit(1)
            .execute()
        )
        if not order_res.data:
            raise ValueError("订单不存在")
        order = order_res.data[0]
        seller_id = self._resolve_seller_user_id(order)
        is_buyer = order.get("buyer_user_id") == user_id
        is_seller = seller_id == user_id
        if not is_buyer and not is_seller:
            raise PermissionError("只能将与本订单相关的商品转入藏品")
        if order.get("status") not in self.TRANSFERABLE_ORDER_STATUSES:
            raise ValueError("该订单尚未完成收货，暂时无法转入藏品")

        existing = self.get_by_order(order_id, user_id)
        if existing:
            return existing

        if is_buyer:
            item = self.snapshot_from_order(order_id)
        else:
            item = self.snapshot_sold_from_order(order_id, seller_id)
        if not item:
            raise ValueError("转入藏品失败，请稍后重试")
        return item

    def list_for_user(
        self,
        user_id: int,
        *,
        page: int = 1,
        page_size: int = 30,
    ) -> Tuple[List[ArchiveItem], int]:
        q = (
            self.db.table("user_archive_items")
            .select("*", count="exact")
            .eq("user_id", user_id)
            .order("acquired_at", desc=True)
        )
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = execute_with_retry(lambda: q.execute(), label="archive.list")
        return [self._format(r) for r in (res.data or [])], (res.count or 0)

    def get(self, archive_id: int) -> Optional[ArchiveItem]:
        res = (
            self.db.table("user_archive_items")
            .select("*")
            .eq("id", archive_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return self._format(res.data[0])

    def mark_relisted(self, archive_id: int, new_product_id: int) -> None:
        self.db.table("user_archive_items").update(
            {
                "relisted_product_id": new_product_id,
                "relisted_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", archive_id).execute()

    # ------------------------------------------------------------------
    # PDF p.21 · 独立上传 MY ARCHIVE 条目（不依赖订单）
    # ------------------------------------------------------------------

    def manual_create(
        self, user_id: int, body: ArchiveItemManualCreate
    ) -> ArchiveItem:
        payload = {
            "user_id": user_id,
            "title": body.title,
            "brand_name": body.brandName,
            "size": body.size,
            "color": body.color,
            "condition": body.condition,
            "original_show_id": body.originalShowId,
            "acquired_price_cents": body.acquiredPriceCents,
            "currency": body.currency,
            "photos": body.photos or [],
            "acquired_at": body.acquiredAt,
            "note": body.note,
            "storage_location": body.storageLocation,
            "source": "manual",
            "is_currently_owned": True,
        }
        res = self.db.table("user_archive_items").insert(payload).execute()
        item = self._format(res.data[0])

        # 自动开一段 owned 持有记录
        try:
            self.add_holding(
                item.id,
                user_id,
                ArchiveHoldingCreate(
                    heldFrom=body.acquiredAt,
                    status="owned",
                    note="独立上传 · 入藏",
                ),
            )
        except Exception as e:
            print(f"[archive] open initial holding failed: {e}")
        return item

    # ------------------------------------------------------------------
    # PDF p.22 · 持有记录
    # ------------------------------------------------------------------

    def list_holdings(
        self, archive_id: int, user_id: int
    ) -> List[ArchiveHoldingRecord]:
        # 仅本人可看
        item = self.get(archive_id)
        if not item or item.userId != user_id:
            return []
        res = (
            self.db.table("archive_holding_history")
            .select("*")
            .eq("archive_item_id", archive_id)
            .order("held_from", desc=True)
            .execute()
        )
        return [self._format_holding(r) for r in (res.data or [])]

    def add_holding(
        self,
        archive_id: int,
        user_id: int,
        body: ArchiveHoldingCreate,
    ) -> ArchiveHoldingRecord:
        item = self.get(archive_id)
        if not item:
            raise ValueError("Archive item not found")
        if item.userId != user_id:
            raise PermissionError("Cannot record holding for another user's item")

        payload = {
            "archive_item_id": archive_id,
            "user_id": user_id,
            "held_from": body.heldFrom,
            "held_to": body.heldTo,
            "status": body.status,
            "note": body.note,
            "counterpart_user_id": body.counterpartUserId,
            "counterpart_name": body.counterpartName,
            "related_product_id": body.relatedProductId,
            "related_order_id": body.relatedOrderId,
        }
        res = self.db.table("archive_holding_history").insert(payload).execute()

        # 若新记录是 transferred / resold / lent / returned 且 held_to 为空，
        # 标记 archive item 为「不再持有」直到下一条 owned 记录闭合。
        if body.status in {"transferred", "resold"} and not body.heldTo:
            self.db.table("user_archive_items").update(
                {"is_currently_owned": False}
            ).eq("id", archive_id).execute()
        elif body.status == "owned":
            self.db.table("user_archive_items").update(
                {"is_currently_owned": True}
            ).eq("id", archive_id).execute()

        return self._format_holding(res.data[0])

    def analytics(self, user_id: int) -> ArchiveAnalytics:
        res = (
            self.db.table("user_archive_items")
            .select("brand_name, acquired_price_cents, acquired_at")
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []
        total = len(rows)
        total_cents = sum((r.get("acquired_price_cents") or 0) for r in rows)
        brand_breakdown: Dict[str, int] = {}
        year_breakdown: Dict[str, int] = {}
        for r in rows:
            b = r.get("brand_name") or "未知"
            brand_breakdown[b] = brand_breakdown.get(b, 0) + 1
            y = (r.get("acquired_at") or "")[:4]
            if y:
                year_breakdown[y] = year_breakdown.get(y, 0) + 1
        return ArchiveAnalytics(
            totalItems=total,
            totalAcquiredCents=total_cents,
            brandBreakdown=brand_breakdown,
            yearBreakdown=year_breakdown,
            avgPriceCents=(total_cents // total) if total else 0,
        )


archive_service = ArchiveService()
