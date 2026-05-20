"""
商家「看板」(Insights) 服务.

抽自 store_merchant_service —— 后台看板汇总数据访问独立成一个文件:
  - get_overview()           : 顶部汇总卡 (粉丝数/收藏数/评论数/认证状态)
  - get_fan_profile()        : 粉丝画像 Tab —— 城市分布 / 24h 活跃时段 / Top 3 偏好品牌
  - get_promotion_stats()    : 地推数据看板 —— 我想去 / 我去过 累计 + 今日 + 7 天趋势
  - get_visit_comments()     : 「我去过」(打卡) 评论列表 (复用 buyer_store_comments)

设计原则:
  - 所有"粉丝/想去/去过"的语义均映射到现有数据 (避免新增表):
      * 粉丝 / 想去 → buyer_store_favorites      (用户对店铺的强意图)
      * 去过 (打卡) → buyer_store_comments       (顶层评论 = 一次到访打卡)
      * 偏好品牌    → brand_follows              (用户在全站的品牌关注)
      * 城市分布    → user_info.location          (用户填写的常驻城市)
  - 所有聚合放在 Python 层做 (不引入物化视图),数据量级在每店铺 < 万 条粉丝时
    都能在 < 200ms 内返回;真到了 IO 瓶颈再补 RPC / cron 物化.
  - 新增不依赖 RPC,不需要新表/迁移 —— 直接读现有表.
"""

from typing import List, Tuple, Optional
from collections import Counter
from datetime import datetime, timedelta, timezone, date

from app.db.supabase import get_supabase, get_supabase_admin
from app.services.buyer_store_community_service import buyer_store_community_service


# 取近 30 天用于"活跃时段"统计 (短窗口防过期数据干扰,长窗口防抖动)
ACTIVE_WINDOW_DAYS = 30
# 趋势折线窗口 (含今天共 7 天)
TREND_WINDOW_DAYS = 7
# 城市分布 / 偏好品牌 Top N
CITY_TOP_N = 5
BRAND_TOP_N = 3
# 品牌点击看板 V2 缓存 TTL —— 与需求中"聚合任务每小时刷新一次"对齐
BRAND_STATS_CACHE_TTL_SECONDS = 3600
# 看板"内容数据 V2"允许的时间窗口 (天). 0 = 全部时间.
ALLOWED_BRAND_WINDOWS = (7, 30, 0)
# Top 单品 (V3 #16) 默认拉取条数
TOP_PRODUCTS_DEFAULT = 10


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _date_range(days: int) -> List[str]:
    """生成最近 N 天的 ISO date 字符串列表 (从最早到今天)"""
    today = _today_utc()
    return [(today - timedelta(days=days - 1 - i)).isoformat() for i in range(days)]


def _parse_iso_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        # buyer_store_favorites.created_at 形如 "2026-05-02T10:23:45.123456+00:00"
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except Exception:
        try:
            return date.fromisoformat(value[:10])
        except Exception:
            return None


def _parse_iso_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


class StoreInsightsService:
    def __init__(self):
        self.db = get_supabase_admin()

    # ==================== Overview ====================

    def get_overview(self, store_id: str) -> dict:
        """顶部汇总卡数据 (累计粉丝/累计去过/今日新增)"""
        today_iso = _today_utc().isoformat()
        # 时区粗略对齐,前端展示精度可接受 ±1h 的边界误差
        start_of_today = f"{today_iso}T00:00:00+00:00"

        fav_total = (
            self.db.table("buyer_store_favorites")
            .select("id", count="exact")
            .eq("store_id", store_id)
            .execute()
        ).count or 0
        fav_today = (
            self.db.table("buyer_store_favorites")
            .select("id", count="exact")
            .eq("store_id", store_id)
            .gte("created_at", start_of_today)
            .execute()
        ).count or 0
        cmt_total = (
            self.db.table("buyer_store_comments")
            .select("id", count="exact")
            .eq("store_id", store_id)
            .is_("parent_id", "null")
            .execute()
        ).count or 0
        cmt_today = (
            self.db.table("buyer_store_comments")
            .select("id", count="exact")
            .eq("store_id", store_id)
            .is_("parent_id", "null")
            .gte("created_at", start_of_today)
            .execute()
        ).count or 0

        rating_stats = buyer_store_community_service.get_rating_stats(store_id)

        return {
            "wantToGoTotal": fav_total,
            "wantToGoToday": fav_today,
            "visitedTotal": cmt_total,
            "visitedToday": cmt_today,
            "ratingAverage": float(rating_stats.averageRating or 0),
            "ratingCount": rating_stats.ratingCount or 0,
        }

    # ==================== 粉丝画像 ====================

    def _collect_fan_user_ids(self, store_id: str) -> List[int]:
        """聚合"粉丝"的 user_id —— 收藏过 + 评论过的用户合集 (去重)."""
        ids: set[int] = set()

        favs = (
            self.db.table("buyer_store_favorites")
            .select("user_id")
            .eq("store_id", store_id)
            .execute()
        )
        for row in favs.data or []:
            uid = row.get("user_id")
            if uid:
                ids.add(int(uid))

        cmts = (
            self.db.table("buyer_store_comments")
            .select("user_id")
            .eq("store_id", store_id)
            .execute()
        )
        for row in cmts.data or []:
            uid = row.get("user_id")
            if uid:
                ids.add(int(uid))

        return list(ids)

    def _city_distribution(self, user_ids: List[int]) -> List[dict]:
        if not user_ids:
            return []
        # user_info.location 是用户自填,Top N 即可
        chunks = [user_ids[i : i + 200] for i in range(0, len(user_ids), 200)]
        cities: Counter[str] = Counter()
        for chunk in chunks:
            res = (
                self.db.table("user_info")
                .select("location")
                .in_("user_id", chunk)
                .execute()
            )
            for r in res.data or []:
                loc = (r.get("location") or "").strip()
                if loc:
                    cities[loc] += 1
        top = cities.most_common(CITY_TOP_N)
        return [{"city": c, "count": n} for c, n in top]

    def _active_hours(self, store_id: str) -> List[dict]:
        """24 小时直方图 —— 来自最近 30 天 favorites + comments 的 created_at hour."""
        cutoff = (datetime.now(timezone.utc) - timedelta(days=ACTIVE_WINDOW_DAYS)).isoformat()
        buckets = [0] * 24

        for table, filter_kwargs in (
            ("buyer_store_favorites", {}),
            ("buyer_store_comments", {"parent_id": None}),
        ):
            q = (
                self.db.table(table)
                .select("created_at")
                .eq("store_id", store_id)
                .gte("created_at", cutoff)
            )
            # 把"parent_id is null"的过滤补上 (评论表才有)
            if "parent_id" in filter_kwargs:
                q = q.is_("parent_id", "null")
            res = q.execute()
            for row in res.data or []:
                dt = _parse_iso_dt(row.get("created_at"))
                if dt:
                    buckets[dt.hour] += 1

        return [{"hour": h, "count": buckets[h]} for h in range(24)]

    def _preferred_brands(self, user_ids: List[int]) -> List[dict]:
        """Top 3 偏好品牌 —— 来自 brand_follows (全站,不限本店).

        需求文档: "源关注者在全站的 interaction 品牌分布" —— 我们以"品牌关注"
        作为最稳定的 interaction 信号 (likes/views 噪声大),如果以后要换成
        post_likes 维度可以替换 _preferred_brands 内部聚合源.
        """
        if not user_ids:
            return []

        chunks = [user_ids[i : i + 200] for i in range(0, len(user_ids), 200)]
        brand_counter: Counter[int] = Counter()
        for chunk in chunks:
            res = (
                self.db.table("brand_follows")
                .select("brand_id")
                .in_("user_id", chunk)
                .execute()
            )
            for r in res.data or []:
                bid = r.get("brand_id")
                if bid:
                    brand_counter[int(bid)] += 1

        top_pairs = brand_counter.most_common(BRAND_TOP_N)
        if not top_pairs:
            return []

        ids = [bid for bid, _ in top_pairs]
        res = (
            self.db.table("brands")
            .select("id, name")
            .in_("id", ids)
            .execute()
        )
        name_map = {row["id"]: row.get("name", str(row["id"])) for row in (res.data or [])}
        return [
            {"brandId": bid, "brandName": name_map.get(bid, str(bid)), "count": cnt}
            for bid, cnt in top_pairs
        ]

    def get_fan_profile(self, store_id: str) -> dict:
        user_ids = self._collect_fan_user_ids(store_id)
        return {
            "fansTotal": len(user_ids),
            "cityDistribution": self._city_distribution(user_ids),
            "activeHours": self._active_hours(store_id),
            "preferredBrands": self._preferred_brands(user_ids),
        }

    # ==================== 地推数据 (我想去 / 我去过) ====================

    def _trend_for_table(
        self, store_id: str, table: str, parent_only: bool = False
    ) -> List[dict]:
        """近 7 天 daily 新增 —— 取 created_at 的日期分桶 (UTC)."""
        cutoff = (datetime.now(timezone.utc) - timedelta(days=TREND_WINDOW_DAYS)).isoformat()
        q = (
            self.db.table(table)
            .select("created_at")
            .eq("store_id", store_id)
            .gte("created_at", cutoff)
        )
        if parent_only:
            q = q.is_("parent_id", "null")
        res = q.execute()

        per_day: Counter[str] = Counter()
        for row in res.data or []:
            d = _parse_iso_date(row.get("created_at"))
            if d:
                per_day[d.isoformat()] += 1

        labels = _date_range(TREND_WINDOW_DAYS)
        return [{"date": lbl, "count": per_day.get(lbl, 0)} for lbl in labels]

    def get_promotion_stats(self, store_id: str) -> dict:
        overview = self.get_overview(store_id)
        return {
            "wantToGo": {
                "total": overview["wantToGoTotal"],
                "today": overview["wantToGoToday"],
                "trend": self._trend_for_table(store_id, "buyer_store_favorites"),
            },
            "visited": {
                "total": overview["visitedTotal"],
                "today": overview["visitedToday"],
                "trend": self._trend_for_table(
                    store_id, "buyer_store_comments", parent_only=True
                ),
            },
        }

    # ==================== 「我去过」评论列表 ====================

    def get_visit_comments(
        self, store_id: str, page: int = 1, page_size: int = 20
    ) -> Tuple[List, int]:
        """直接复用买手店社区评论列表 —— 评论=打卡.

        商家点击进入后看到的就是用户的"打卡评论",和店铺详情页的评论列表
        是同一份数据,店主在原有评论体系里直接回复即可 (走 POST
        /api/buyer-stores/{store_id}/comments + parent_id).
        """
        return buyer_store_community_service.get_store_comments(store_id, page, page_size)

    # ==================== 内容数据看板 V2 (品牌点击 & TOP 品牌) ====================
    #
    # 需求 (扩展 V3 #16):
    #   - 每个关联品牌的总点击量 = 我想要 + 收藏 + 点赞 + 评论 + 浏览
    #   - TOP 3 品牌排行 (按综合点击量) + 每品牌 5 维构成
    #   - 单品维度仍按「我想要」排序 (V3 #16 保留, 见 get_top_products_by_want)
    #   - 时间维度: 近 7 天 / 30 天 / 全部
    #   - 聚合任务每小时刷新一次, 接口只查缓存表 store_brand_stats
    #
    # 工程实现选择 lazy compute + 1h cache:
    #   - 没有显式 cron infra 的情况下, 商家请求时检查 cache.computed_at,
    #     >1h 触发重算并 upsert 写回, ≤1h 直接读. 用户体感等价"hourly refresh".
    #   - upsert 用 supabase admin 客户端 (绕过潜在 RLS), 因为这是后台
    #     聚合写入, 不属于用户的常规权限范围.

    def _normalize_window(self, window: int) -> int:
        if window not in ALLOWED_BRAND_WINDOWS:
            raise ValueError(
                f"window must be one of {ALLOWED_BRAND_WINDOWS} (got {window})"
            )
        return window

    def _read_brand_stats_cache(self, store_id: str, window: int) -> List[dict]:
        res = (
            self.db.table("store_brand_stats")
            .select("*")
            .eq("store_id", store_id)
            .eq("window_days", window)
            .order("total_count", desc=True)
            .execute()
        )
        return res.data or []

    def _cache_is_fresh(self, rows: List[dict]) -> bool:
        """所有 rows 的 computed_at 都在 TTL 内才算新鲜."""
        if not rows:
            return False
        cutoff = datetime.now(timezone.utc) - timedelta(
            seconds=BRAND_STATS_CACHE_TTL_SECONDS
        )
        for r in rows:
            ts = _parse_iso_dt(r.get("computed_at"))
            if not ts or ts < cutoff:
                return False
        return True

    def _list_store_products(self, store_id: str) -> List[dict]:
        """拉店铺所有商品 (含 brand / view_count / id), 用于按品牌分组聚合."""
        res = (
            self.db.table("store_products")
            .select("id, brand, view_count")
            .eq("store_id", store_id)
            .execute()
        )
        return res.data or []

    def _count_per_product_in_window(
        self, table: str, product_ids: List[int], window: int
    ) -> dict:
        """聚合某事件表 (wants/favorites/likes/comments) 在 window 天内每件商品的计数."""
        if not product_ids:
            return {}
        chunks = [product_ids[i : i + 200] for i in range(0, len(product_ids), 200)]
        per_product: Counter[int] = Counter()
        cutoff_iso: Optional[str] = None
        if window > 0:
            cutoff_iso = (
                datetime.now(timezone.utc) - timedelta(days=window)
            ).isoformat()

        for chunk in chunks:
            q = (
                self.db.table(table)
                .select("product_id")
                .in_("product_id", chunk)
            )
            if cutoff_iso:
                q = q.gte("created_at", cutoff_iso)
            res = q.execute()
            for row in res.data or []:
                pid = row.get("product_id")
                if pid is not None:
                    per_product[int(pid)] += 1
        return per_product

    def _compute_brand_stats(self, store_id: str, window: int) -> List[dict]:
        """从原始事件表聚合 brand × 5 维计数, 返回未排序的 dict 列表."""
        products = self._list_store_products(store_id)
        if not products:
            return []

        # product_id -> brand (去掉 None / 空品牌, 这部分商品不计入 brand 排行)
        pid_brand: dict = {}
        pid_views: dict = {}
        for p in products:
            brand = (p.get("brand") or "").strip()
            if not brand:
                continue
            pid_brand[int(p["id"])] = brand
            pid_views[int(p["id"])] = int(p.get("view_count") or 0)

        product_ids = list(pid_brand.keys())
        if not product_ids:
            return []

        # 4 项可窗口的事件计数
        wants = self._count_per_product_in_window(
            "store_product_wants", product_ids, window
        )
        favorites = self._count_per_product_in_window(
            "store_product_favorites", product_ids, window
        )
        likes = self._count_per_product_in_window(
            "store_product_likes", product_ids, window
        )
        comments = self._count_per_product_in_window(
            "store_product_comments", product_ids, window
        )

        # brand 级聚合
        agg: dict = {}
        for pid, brand in pid_brand.items():
            slot = agg.setdefault(
                brand,
                {
                    "brand": brand,
                    "want_count": 0,
                    "favorite_count": 0,
                    "like_count": 0,
                    "comment_count": 0,
                    "view_count": 0,
                },
            )
            slot["want_count"] += wants.get(pid, 0)
            slot["favorite_count"] += favorites.get(pid, 0)
            slot["like_count"] += likes.get(pid, 0)
            slot["comment_count"] += comments.get(pid, 0)
            # view_count 没有事件表,只能取累计列 (window != 0 时该数值仍是累计总浏览)
            slot["view_count"] += pid_views.get(pid, 0)

        return list(agg.values())

    def _refresh_brand_stats_cache(self, store_id: str, window: int) -> List[dict]:
        """重算并 upsert 写回缓存表, 返回写入后的行 (按 total 倒序)."""
        rows = self._compute_brand_stats(store_id, window)
        admin = get_supabase_admin()

        # 先把这一组 (store_id, window) 的旧行删掉, 避免品牌被下架后留残行
        admin.table("store_brand_stats").delete().eq("store_id", store_id).eq(
            "window_days", window
        ).execute()

        if rows:
            now_iso = datetime.now(timezone.utc).isoformat()
            payload = [
                {
                    "store_id": store_id,
                    "brand": r["brand"],
                    "window_days": window,
                    "want_count": r["want_count"],
                    "favorite_count": r["favorite_count"],
                    "like_count": r["like_count"],
                    "comment_count": r["comment_count"],
                    "view_count": r["view_count"],
                    "computed_at": now_iso,
                }
                for r in rows
            ]
            admin.table("store_brand_stats").insert(payload).execute()

        return self._read_brand_stats_cache(store_id, window)

    def _format_brand_row(self, row: dict) -> dict:
        return {
            "brand": row["brand"],
            "wantCount": int(row.get("want_count", 0)),
            "favoriteCount": int(row.get("favorite_count", 0)),
            "likeCount": int(row.get("like_count", 0)),
            "commentCount": int(row.get("comment_count", 0)),
            "viewCount": int(row.get("view_count", 0)),
            "totalCount": int(row.get("total_count", 0)),
        }

    def get_brand_stats(
        self, store_id: str, window: int = 7, top_n: int = BRAND_TOP_N
    ) -> dict:
        """返回品牌看板数据 (TOP N 排行 + 全量列表 + 缓存元信息)."""
        window = self._normalize_window(window)

        rows = self._read_brand_stats_cache(store_id, window)
        if not self._cache_is_fresh(rows):
            try:
                rows = self._refresh_brand_stats_cache(store_id, window)
            except Exception as e:
                # 写缓存失败时仍返回旧数据 (如果有), 避免拖垮看板;
                # 真没有就 raise, 让前端展示错误.
                if not rows:
                    raise
                print(f"[WARN] refresh brand stats failed: {e}")

        formatted = [self._format_brand_row(r) for r in rows]
        computed_at: Optional[str] = rows[0].get("computed_at") if rows else None

        return {
            "windowDays": window,
            "computedAt": computed_at,
            "topBrands": formatted[:top_n],
            "allBrands": formatted,
        }

    # ==================== 单品维度 Top (V3 #16 保留) ====================

    def get_top_products_by_want(
        self, store_id: str, limit: int = TOP_PRODUCTS_DEFAULT
    ) -> List[dict]:
        """单品按「我想要」倒序 Top N. 字段对齐 frontend StoreProduct 卡片需求."""
        if limit <= 0:
            return []
        res = (
            self.db.table("store_products")
            .select(
                "id, title, brand, images, want_count, favorite_count, like_count,"
                " comment_count, view_count, status, price_cents, currency"
            )
            .eq("store_id", store_id)
            .eq("status", "PUBLISHED")
            .order("want_count", desc=True)
            .order("favorite_count", desc=True)
            .order("like_count", desc=True)
            .limit(limit)
            .execute()
        )

        items: List[dict] = []
        for row in res.data or []:
            images = row.get("images") or []
            items.append({
                "id": int(row["id"]),
                "title": row.get("title") or "",
                "brand": row.get("brand"),
                "coverImage": images[0] if images else None,
                "wantCount": int(row.get("want_count") or 0),
                "favoriteCount": int(row.get("favorite_count") or 0),
                "likeCount": int(row.get("like_count") or 0),
                "commentCount": int(row.get("comment_count") or 0),
                "viewCount": int(row.get("view_count") or 0),
                "priceCents": int(row.get("price_cents") or 0),
                "currency": row.get("currency") or "CNY",
                "status": row.get("status") or "PUBLISHED",
            })
        return items


store_insights_service = StoreInsightsService()
