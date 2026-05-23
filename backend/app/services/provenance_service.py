"""
PRD 模块三 · Provenance / Price History / Collections 服务。

Phase 3 范围：
  - listing 提交审核通过时由 store_product_service 调 `seed_initial_events` 播种基础履历；
  - 订单完成时（P4）将由 order_service 调 `append_resale_event` + `record_sale_price`；
  - 详情页加载 BottomSheet 时直接调本服务的查询接口。
"""
from typing import List, Optional, Tuple
from statistics import median
from datetime import datetime, timedelta

from app.db.supabase import get_supabase, get_supabase_admin, execute_with_retry
from app.schemas.provenance import (
    ProvenanceEvent,
    ProvenanceEventCreate,
    PriceHistoryBucket,
    PriceHistorySummary,
    UserCollection,
    UserCollectionCreate,
    UserCollectionUpdate,
)


class ProvenanceService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

    # ------------------------------------------------------------------
    # 履历事件
    # ------------------------------------------------------------------

    @staticmethod
    def _format_event(row: dict) -> ProvenanceEvent:
        return ProvenanceEvent(
            id=row["id"],
            productId=row["product_id"],
            eventType=row["event_type"],
            actorKind=row["actor_kind"],
            actorUserId=row.get("actor_user_id"),
            actorMerchantId=row.get("actor_merchant_id"),
            actorBrandId=row.get("actor_brand_id"),
            occurredAt=row.get("occurred_at"),
            description=row.get("description"),
            metadata=row.get("metadata"),
            createdAt=row.get("created_at"),
        )

    def list_events(self, product_id: int) -> List[ProvenanceEvent]:
        res = execute_with_retry(
            lambda: self.db.table("product_provenance_events")
            .select("*")
            .eq("product_id", product_id)
            .order("occurred_at", desc=True, nullsfirst=False)
            .order("id", desc=True)
            .execute(),
            label="provenance.list",
        )
        return [self._format_event(r) for r in (res.data or [])]

    def append_event(
        self, product_id: int, data: ProvenanceEventCreate
    ) -> ProvenanceEvent:
        insert = {
            "product_id": product_id,
            "event_type": data.eventType.value,
            "actor_kind": data.actorKind.value,
            "actor_user_id": data.actorUserId,
            "actor_merchant_id": data.actorMerchantId,
            "actor_brand_id": data.actorBrandId,
            "occurred_at": data.occurredAt.isoformat() if data.occurredAt else None,
            "description": data.description,
            "metadata": data.metadata,
        }
        res = self.db.table("product_provenance_events").insert(insert).execute()
        if not res.data:
            raise RuntimeError("failed to append provenance")
        return self._format_event(res.data[0])

    def seed_initial_events(
        self,
        product_id: int,
        *,
        seller_kind: str,
        seller_user_id: Optional[int],
        merchant_id: Optional[int],
        original_show_id: Optional[int],
        original_acquired_at: Optional[str],
        brand_id: Optional[int],
    ) -> None:
        """listing 进入 active 时自动播种 2~3 条履历。

        - 若关联了秀场：origin_show 事件
        - merchant_acquired 或 collector_owned（按 seller_kind）
        - on_sale_now
        """
        events: List[dict] = []
        if original_show_id:
            events.append(
                {
                    "product_id": product_id,
                    "event_type": "origin_show",
                    "actor_kind": "brand",
                    "actor_brand_id": brand_id,
                    "occurred_at": original_acquired_at,
                    "description": "品牌秀场首次亮相",
                    "metadata": {"showId": original_show_id},
                }
            )
        if seller_kind == "merchant":
            events.append(
                {
                    "product_id": product_id,
                    "event_type": "merchant_acquired",
                    "actor_kind": "merchant",
                    "actor_merchant_id": merchant_id,
                    "occurred_at": original_acquired_at,
                    "description": "买手店入手",
                }
            )
        else:
            events.append(
                {
                    "product_id": product_id,
                    "event_type": "collector_owned",
                    "actor_kind": "user",
                    "actor_user_id": seller_user_id,
                    "occurred_at": original_acquired_at,
                    "description": "藏家持有",
                }
            )
        events.append(
            {
                "product_id": product_id,
                "event_type": "on_sale_now",
                "actor_kind": "system",
                "description": "当前正在售出",
            }
        )
        if not events:
            return
        try:
            self.db.table("product_provenance_events").insert(events).execute()
        except Exception as e:
            print(f"[provenance] seed initial events failed: {e}")

    def append_sold_event(
        self, product_id: int, buyer_user_id: int, sold_at: datetime
    ) -> None:
        """订单完成时由 P4 order_service 调用。"""
        try:
            self.db.table("product_provenance_events").insert(
                {
                    "product_id": product_id,
                    "event_type": "sold",
                    "actor_kind": "user",
                    "actor_user_id": buyer_user_id,
                    "occurred_at": sold_at.date().isoformat(),
                    "description": "已成交转入新藏家",
                }
            ).execute()
        except Exception as e:
            print(f"[provenance] append sold event failed: {e}")

    # ------------------------------------------------------------------
    # 价格历史
    # ------------------------------------------------------------------

    def record_sale_price(
        self,
        *,
        product_id: Optional[int],
        brand_name: Optional[str],
        category_id: Optional[int],
        size: Optional[str],
        condition: Optional[str],
        price_cents: int,
        currency: str = "CNY",
        source: str = "order",
    ) -> None:
        try:
            self.db.table("product_price_history").insert(
                {
                    "product_id": product_id,
                    "brand_name": brand_name,
                    "category_id": category_id,
                    "size": size,
                    "condition": condition,
                    "price_cents": price_cents,
                    "currency": currency,
                    "source": source,
                }
            ).execute()
        except Exception as e:
            print(f"[provenance] record_sale_price failed: {e}")

    def summarize_recent_prices(
        self,
        *,
        brand_name: str,
        category_id: Optional[int] = None,
        size: Optional[str] = None,
        condition: Optional[str] = None,
        months: int = 6,
        bucket_count: int = 8,
    ) -> PriceHistorySummary:
        """PRD 3.3 价格基准柱状图。

        简版：从 product_price_history 拉最近 N 个月按目标 SKU 维度聚合，
        构造等宽分桶。返回 PriceHistorySummary（如果没数据，sampleSize=0）。
        """
        since = (datetime.utcnow() - timedelta(days=30 * months)).isoformat()
        q = (
            self.db.table("product_price_history")
            .select("price_cents")
            .eq("brand_name", brand_name)
            .gte("sold_at", since)
        )
        if category_id is not None:
            q = q.eq("category_id", category_id)
        if size:
            q = q.eq("size", size)
        if condition:
            q = q.eq("condition", condition)
        try:
            res = q.execute()
        except Exception:
            res = None
        prices: List[int] = [r["price_cents"] for r in ((res.data if res else None) or [])]
        if not prices:
            return PriceHistorySummary(
                brand=brand_name,
                sampleSize=0,
                minPriceCents=0,
                maxPriceCents=0,
                medianPriceCents=0,
                p25PriceCents=0,
                p75PriceCents=0,
                buckets=[],
            )

        prices_sorted = sorted(prices)
        n = len(prices_sorted)

        def pct(p: float) -> int:
            idx = max(0, min(n - 1, int(n * p)))
            return prices_sorted[idx]

        lo, hi = prices_sorted[0], prices_sorted[-1]
        if lo == hi:
            return PriceHistorySummary(
                brand=brand_name,
                sampleSize=n,
                minPriceCents=lo,
                maxPriceCents=hi,
                medianPriceCents=lo,
                p25PriceCents=lo,
                p75PriceCents=lo,
                buckets=[
                    PriceHistoryBucket(
                        bucketLabel=f"{lo // 100}",
                        count=n,
                        avgPriceCents=lo,
                    )
                ],
            )

        bucket_width = max(1, (hi - lo) // bucket_count)
        buckets: List[PriceHistoryBucket] = []
        for i in range(bucket_count):
            bucket_lo = lo + i * bucket_width
            bucket_hi = lo + (i + 1) * bucket_width if i < bucket_count - 1 else hi + 1
            items = [p for p in prices_sorted if bucket_lo <= p < bucket_hi]
            if not items:
                continue
            buckets.append(
                PriceHistoryBucket(
                    bucketLabel=f"{bucket_lo // 100}-{bucket_hi // 100}",
                    count=len(items),
                    avgPriceCents=sum(items) // len(items),
                )
            )

        return PriceHistorySummary(
            brand=brand_name,
            sampleSize=n,
            minPriceCents=lo,
            maxPriceCents=hi,
            medianPriceCents=int(median(prices_sorted)),
            p25PriceCents=pct(0.25),
            p75PriceCents=pct(0.75),
            buckets=buckets,
        )

    # ------------------------------------------------------------------
    # 用户多收藏夹
    # ------------------------------------------------------------------

    @staticmethod
    def _format_collection(row: dict, item_count: Optional[int] = None) -> UserCollection:
        return UserCollection(
            id=row["id"],
            userId=row["user_id"],
            name=row["name"],
            description=row.get("description"),
            visibility=row.get("visibility", "private"),
            coverProductId=row.get("cover_product_id"),
            sortOrder=row.get("sort_order", 0),
            itemCount=item_count,
            createdAt=row.get("created_at"),
            updatedAt=row.get("updated_at"),
        )

    def list_my_collections(self, user_id: int) -> List[UserCollection]:
        res = (
            self.db.table("user_collections")
            .select("*")
            .eq("user_id", user_id)
            .order("sort_order", desc=False)
            .order("created_at", desc=True)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return []
        # 简单 N+1 计数；收藏夹数量通常很少
        result: List[UserCollection] = []
        for r in rows:
            try:
                cnt = (
                    self.db.table("store_product_favorites")
                    .select("id", count="exact")
                    .eq("user_id", user_id)
                    .eq("collection_id", r["id"])
                    .limit(0)
                    .execute()
                )
                count = cnt.count or 0
            except Exception:
                count = 0
            result.append(self._format_collection(r, item_count=count))
        return result

    def create_collection(
        self, user_id: int, data: UserCollectionCreate
    ) -> UserCollection:
        res = (
            self.db.table("user_collections")
            .insert(
                {
                    "user_id": user_id,
                    "name": data.name,
                    "description": data.description,
                    "visibility": data.visibility,
                }
            )
            .execute()
        )
        if not res.data:
            raise RuntimeError("create collection failed")
        return self._format_collection(res.data[0])

    def update_collection(
        self, collection_id: int, user_id: int, data: UserCollectionUpdate
    ) -> UserCollection:
        patch: dict = {}
        if data.name is not None:
            patch["name"] = data.name
        if data.description is not None:
            patch["description"] = data.description
        if data.visibility is not None:
            patch["visibility"] = data.visibility
        if data.coverProductId is not None:
            patch["cover_product_id"] = data.coverProductId
        if data.sortOrder is not None:
            patch["sort_order"] = data.sortOrder
        if not patch:
            res = (
                self.db.table("user_collections")
                .select("*")
                .eq("id", collection_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if not res.data:
                raise ValueError("收藏夹不存在")
            return self._format_collection(res.data[0])
        res = (
            self.db.table("user_collections")
            .update(patch)
            .eq("id", collection_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not res.data:
            raise ValueError("收藏夹不存在或无权限")
        return self._format_collection(res.data[0])

    def delete_collection(self, collection_id: int, user_id: int) -> bool:
        res = (
            self.db.table("user_collections")
            .delete()
            .eq("id", collection_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(res.data)

    def move_favorite_to_collection(
        self, *, product_id: int, user_id: int, collection_id: Optional[int]
    ) -> None:
        """切换某商品的所在收藏夹（NULL 表示默认收藏夹）。"""
        self.db.table("store_product_favorites").update(
            {"collection_id": collection_id}
        ).eq("user_id", user_id).eq("product_id", product_id).execute()

    def get_collection(
        self, collection_id: int, user_id: int
    ) -> Optional[UserCollection]:
        """获取收藏夹元数据（含 itemCount）；不存在或非本人所有返回 None。"""
        res = (
            self.db.table("user_collections")
            .select("*")
            .eq("id", collection_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None
        try:
            cnt = (
                self.db.table("store_product_favorites")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .eq("collection_id", collection_id)
                .limit(0)
                .execute()
            )
            count = cnt.count or 0
        except Exception:
            count = 0
        return self._format_collection(rows[0], item_count=count)


provenance_service = ProvenanceService()
