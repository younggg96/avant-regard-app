"""
买手店服务
"""

import math
from typing import Optional, List, Tuple
from app.db.supabase import (
    get_supabase,
    get_supabase_admin,
    execute_with_retry,
)
from app.schemas.buyer_store import (
    BuyerStore,
    BuyerStoreCreate,
    BuyerStoreUpdate,
    BrandRecommendation,
)


class BuyerStoreService:
    """买手店服务类"""

    def __init__(self):
        self.db = get_supabase()
        self.db_admin = get_supabase_admin()

    def _sanitize_search_keyword(self, keyword: str) -> str:
        """清理搜索关键词，转义可能导致查询失败的特殊字符"""
        sanitized = keyword.replace("\\", "\\\\")
        sanitized = sanitized.replace("%", "\\%")
        sanitized = sanitized.replace("_", "\\_")
        sanitized = sanitized.replace(",", " ")
        sanitized = sanitized.replace(".", " ")
        return sanitized.strip()

    def _format_store(self, store: dict) -> BuyerStore:
        """格式化买手店数据"""
        lat = store.get("latitude")
        lng = store.get("longitude")
        has_coords = lat is not None and lng is not None
        return BuyerStore(
            id=store["id"],
            name=store["name"],
            address=store["address"],
            city=store["city"],
            country=store["country"],
            coordinates={
                "latitude": float(lat),
                "longitude": float(lng),
            } if has_coords else None,
            brands=store.get("brands") or [],
            style=store.get("style") or [],
            isOpen=store.get("is_open", True),
            phone=store.get("phone"),
            hours=store.get("hours"),
            rating=float(store["rating"]) if store.get("rating") else None,
            description=store.get("description"),
            images=store.get("images"),
            rest=store.get("rest"),
            createdAt=store.get("created_at"),
            updatedAt=store.get("updated_at"),
        )

    def _to_db_format(self, store: BuyerStoreCreate | BuyerStoreUpdate) -> dict:
        """将 schema 转换为数据库格式"""
        data = {}
        store_dict = store.model_dump(exclude_unset=True)

        # 字段映射
        field_map = {
            "isOpen": "is_open",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }

        for key, value in store_dict.items():
            if key == "coordinates" and value:
                data["latitude"] = value["latitude"]
                data["longitude"] = value["longitude"]
            elif key in field_map:
                data[field_map[key]] = value
            else:
                data[key] = value

        return data

    def get_all_stores(
        self,
        country: Optional[str] = None,
        city: Optional[str] = None,
        brand: Optional[str] = None,
        style: Optional[str] = None,
        open_only: Optional[bool] = None,
        search_query: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[BuyerStore], int]:
        """获取买手店列表。

        优化：只在第 1 页请求 `count`，而且用 `planned`（PostgREST/PG planner 估算）
        而非 `exact`（全表扫描）。这样：
        - 列表首屏依旧能给前端一个 total 用于展示；
        - 后续翻页不再附带 count 开销（前端用 `len(stores) < page_size` 作为
          终止条件本就足够）；
        - 大表下 Supabase 网关更不容易因为 count 超时触发 502/504。
        """
        # 仅在 page==1 时请求 count；改用 planned 避免 exact 全表扫描
        if page == 1:
            query = self.db.table("buyer_stores").select("*", count="planned")
        else:
            query = self.db.table("buyer_stores").select("*")

        # 国家筛选
        if country:
            query = query.eq("country", country)

        # 城市筛选
        if city:
            query = query.eq("city", city)

        # 营业状态筛选
        if open_only:
            query = query.eq("is_open", True)

        # 品牌筛选（使用 contains 数组查询）
        if brand:
            query = query.contains("brands", [brand])

        # 风格筛选
        if style:
            query = query.contains("style", [style])

        # 搜索查询
        if search_query:
            query = query.or_(
                f"name.ilike.%{search_query}%,"
                f"city.ilike.%{search_query}%,"
                f"address.ilike.%{search_query}%"
            )

        # 排序
        query = query.order("city").order("name")

        # 分页
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)

        result = execute_with_retry(
            lambda: query.execute(),
            label="buyer_stores.get_all_stores",
        )
        total = result.count or 0
        stores = [self._format_store(s) for s in result.data]

        return stores, total

    # ------------------------------------------------------------------
    # 入驻商家优先排序（买手店 Tab 顶部选择条 & "查看全部"页）
    # ------------------------------------------------------------------

    def _list_approved_merchant_store_ids(self) -> List[str]:
        """一次性读出所有 APPROVED 商家关联的 store_id 列表。

        数量一般是百量级（商家总数 << 店铺总数），一次查询即可全量载入，
        避免对每条店铺都去 join 一次。
        """
        try:
            result = (
                self.db.table("store_merchants")
                .select("store_id")
                .eq("status", "APPROVED")
                .execute()
            )
        except Exception as e:
            # 失败时降级：视为无商家入驻，保持普通排序，不阻塞用户浏览。
            print(f"[buyer_stores] list approved merchants failed: {e}")
            return []
        seen: set[str] = set()
        ordered: List[str] = []
        for row in result.data or []:
            sid = row.get("store_id")
            if sid and sid not in seen:
                seen.add(sid)
                ordered.append(sid)
        return ordered

    def _enrich_with_merchant_flag(
        self, stores: List[BuyerStore], merchant_store_ids: set[str]
    ) -> List[dict]:
        """把 store 列表转成 dict 并附加 hasMerchant 标记。"""
        out: List[dict] = []
        for store in stores:
            d = store.model_dump() if hasattr(store, "model_dump") else store
            d["hasMerchant"] = d.get("id") in merchant_store_ids
            out.append(d)
        return out

    def get_stores_with_merchant_priority(
        self,
        *,
        country: Optional[str] = None,
        city: Optional[str] = None,
        brand: Optional[str] = None,
        style: Optional[str] = None,
        open_only: Optional[bool] = None,
        search_query: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[dict], int, set[str]]:
        """入驻商家优先 + 内部仍用 favoriteCount 排序后备的分页方法。

        策略：
          - Step A: 一次拿 APPROVED 商家的 store_ids（小集合 M）
          - Step B: 分两段查 buyer_stores：
              · Group A = 命中 M 的店铺（按 name 排序；当前 schema 没有 favorite
                列，favorite_count 由应用层合成，不能直接 ORDER BY）
              · Group B = 未命中 M 的店铺
          - Step C: 按全局偏移量从 Group A/B 的有序序列取 page_size 条

        返回 (dict 列表（带 hasMerchant）, total, merchant_store_ids 集合)
        —— 调用方可以用 set 给别的字段做进一步批量标注。
        """
        merchant_ids = self._list_approved_merchant_store_ids()
        merchant_set = set(merchant_ids)
        offset = (page - 1) * page_size

        # --- Group A: 入驻商家店铺 ---
        group_a_stores: List[BuyerStore] = []
        group_a_total = 0
        if merchant_ids:
            q_a = self.db.table("buyer_stores").select("*", count="planned")
            q_a = q_a.in_("id", merchant_ids)
            q_a = self._apply_filters(
                q_a, country=country, city=city, brand=brand, style=style,
                open_only=open_only, search_query=search_query,
            )
            q_a = q_a.order("name").range(0, 999)  # 入驻集小，整体拉回内存即可
            res_a = execute_with_retry(
                lambda: q_a.execute(), label="buyer_stores.priority.group_a"
            )
            group_a_total = res_a.count or 0
            group_a_stores = [self._format_store(s) for s in (res_a.data or [])]

        # --- Group B: 非入驻商家店铺 ---
        q_b = self.db.table("buyer_stores").select("*", count="planned")
        if merchant_ids:
            # 不能用 `.not_.in_(...)` 因为 Supabase Python SDK 对 not_.in_
            # 某些版本表现不稳定；统一使用 PostgREST 操作符
            quoted_ids = ",".join([f'"{sid}"' for sid in merchant_ids])
            q_b = q_b.filter("id", "not.in", f"({quoted_ids})")
        q_b = self._apply_filters(
            q_b, country=country, city=city, brand=brand, style=style,
            open_only=open_only, search_query=search_query,
        )
        q_b = q_b.order("city").order("name")
        # 偏移量是"跨 Group A/B 全局"的；Group B 的起始偏移 = 全局 offset - 已全部
        # 塞进 Group A 的条数。最多再拉 page_size 条就够合并。
        group_b_offset_in_page = max(0, offset - group_a_total)
        q_b = q_b.range(
            group_b_offset_in_page,
            group_b_offset_in_page + page_size - 1,
        )
        res_b = execute_with_retry(
            lambda: q_b.execute(), label="buyer_stores.priority.group_b"
        )
        group_b_total = res_b.count or 0
        group_b_stores = [self._format_store(s) for s in (res_b.data or [])]

        # --- 按全局偏移量合成本页 ---
        # Group A 的全局区间 [0, group_a_total)；offset 落在哪里决定从哪开始拿。
        # （不要命名成 `page`，会和函数参数同名遮蔽。）
        combined: List[BuyerStore] = []
        a_start = min(offset, group_a_total)
        a_end = min(offset + page_size, group_a_total)
        if a_start < a_end:
            combined.extend(group_a_stores[a_start:a_end])
        need = page_size - len(combined)
        if need > 0 and group_b_stores:
            combined.extend(group_b_stores[:need])

        total = group_a_total + group_b_total
        enriched = self._enrich_with_merchant_flag(combined, merchant_set)
        return enriched, total, merchant_set

    def _apply_filters(
        self,
        query,
        *,
        country: Optional[str] = None,
        city: Optional[str] = None,
        brand: Optional[str] = None,
        style: Optional[str] = None,
        open_only: Optional[bool] = None,
        search_query: Optional[str] = None,
    ):
        """把通用过滤条件集中应用一次，避免在多个分支重复写。"""
        if country:
            query = query.eq("country", country)
        if city:
            query = query.eq("city", city)
        if open_only:
            query = query.eq("is_open", True)
        if brand:
            query = query.contains("brands", [brand])
        if style:
            query = query.contains("style", [style])
        if search_query:
            query = query.or_(
                f"name.ilike.%{search_query}%,"
                f"city.ilike.%{search_query}%,"
                f"address.ilike.%{search_query}%"
            )
        return query

    def get_store_by_id(self, store_id: str) -> Optional[BuyerStore]:
        """通过 ID 获取买手店"""
        result = execute_with_retry(
            lambda: self.db.table("buyer_stores")
            .select("*")
            .eq("id", store_id)
            .execute(),
            label="buyer_stores.get_store_by_id",
        )

        if not result.data:
            return None

        return self._format_store(result.data[0])

    def has_approved_merchant(self, store_id: str) -> bool:
        """判断该 store 是否已有认证商家入驻。

        用于详情页 / 返回单条 store 时回填 `hasMerchant` 字段；比起拉全量
        APPROVED 列表，这里针对单 store 只查一条 row，更省.
        """
        try:
            result = (
                self.db.table("store_merchants")
                .select("id")
                .eq("store_id", store_id)
                .eq("status", "APPROVED")
                .limit(1)
                .execute()
            )
            return bool(result.data)
        except Exception as e:
            # 失败时降级为 False —— 不影响用户查看店铺，仅 UI 少一个"已入驻"徽章.
            print(f"[buyer_stores] has_approved_merchant({store_id}) failed: {e}")
            return False

    def create_store(self, store: BuyerStoreCreate) -> BuyerStore:
        """创建买手店"""
        data = self._to_db_format(store)

        result = self.db_admin.table("buyer_stores").insert(data).execute()

        return self._format_store(result.data[0])

    def update_store(
        self, store_id: str, store: BuyerStoreUpdate
    ) -> Optional[BuyerStore]:
        """更新买手店"""
        data = self._to_db_format(store)

        if not data:
            return self.get_store_by_id(store_id)

        result = (
            self.db_admin.table("buyer_stores")
            .update(data)
            .eq("id", store_id)
            .execute()
        )

        if not result.data:
            return None

        return self._format_store(result.data[0])

    def delete_store(self, store_id: str) -> bool:
        """删除买手店"""
        result = (
            self.db_admin.table("buyer_stores").delete().eq("id", store_id).execute()
        )

        return len(result.data) > 0

    def batch_create_stores(self, stores: List[BuyerStoreCreate]) -> int:
        """批量创建买手店"""
        data_list = [self._to_db_format(s) for s in stores]

        result = self.db_admin.table("buyer_stores").insert(data_list).execute()

        return len(result.data)

    def get_all_countries(self) -> List[str]:
        """获取所有国家列表"""
        result = execute_with_retry(
            lambda: self.db.table("buyer_stores").select("country").execute(),
            label="buyer_stores.get_all_countries",
        )

        countries = set(s["country"] for s in result.data if s.get("country"))
        return sorted(list(countries))

    def get_all_cities(self, country: Optional[str] = None) -> List[str]:
        """获取所有城市列表"""
        query = self.db.table("buyer_stores").select("city")

        if country:
            query = query.eq("country", country)

        result = execute_with_retry(
            lambda: query.execute(),
            label="buyer_stores.get_all_cities",
        )

        cities = set(s["city"] for s in result.data if s.get("city"))
        return sorted(list(cities))

    def get_all_styles(self) -> List[str]:
        """获取所有风格列表"""
        result = execute_with_retry(
            lambda: self.db.table("buyer_stores").select("style").execute(),
            label="buyer_stores.get_all_styles",
        )

        styles = set()
        for s in result.data:
            if s.get("style"):
                for style in s["style"]:
                    styles.add(style)

        return sorted(list(styles))

    def get_stores_by_brand(self, brand: str) -> List[BuyerStore]:
        """根据品牌获取买手店"""
        # 使用 ilike 进行模糊匹配
        result = execute_with_retry(
            lambda: self.db.table("buyer_stores").select("*").execute(),
            label="buyer_stores.get_stores_by_brand",
        )

        # 在应用层进行品牌过滤（因为 Supabase 数组模糊匹配有限制）
        brand_lower = brand.lower()
        filtered = [
            self._format_store(s)
            for s in result.data
            if any(brand_lower in b.lower() for b in (s.get("brands") or []))
        ]

        return filtered

    def get_brand_recommendations(self, brand: str) -> BrandRecommendation:
        """获取品牌推荐"""
        stores = self.get_stores_by_brand(brand)

        # 获取相关品牌
        related_brands = set()
        for store in stores:
            for b in store.brands:
                if b.lower() != brand.lower():
                    related_brands.add(b)

        return BrandRecommendation(
            stores=stores,
            relatedBrands=sorted(list(related_brands)),
        )

    def get_stores_in_viewport(
        self,
        ne_lat: float,
        ne_lng: float,
        sw_lat: float,
        sw_lng: float,
        country: Optional[str] = None,
        city: Optional[str] = None,
        brand: Optional[str] = None,
        style: Optional[str] = None,
        styles: Optional[List[str]] = None,
        open_only: Optional[bool] = None,
        has_phone: Optional[bool] = None,
        search_query: Optional[str] = None,
    ) -> List[BuyerStore]:
        """获取地图视口范围内的买手店"""
        query = self.db.table("buyer_stores").select("*")

        # 视口范围筛选（经纬度边界框）
        query = query.gte("latitude", sw_lat).lte("latitude", ne_lat)
        query = query.gte("longitude", sw_lng).lte("longitude", ne_lng)

        # 国家筛选
        if country:
            query = query.eq("country", country)

        # 城市筛选
        if city:
            query = query.eq("city", city)

        # 营业状态筛选
        if open_only:
            query = query.eq("is_open", True)

        # 品牌筛选
        if brand:
            query = query.contains("brands", [brand])

        # 单风格筛选
        if style:
            query = query.contains("style", [style])

        # 搜索查询
        if search_query:
            query = query.or_(
                f"name.ilike.%{search_query}%,"
                f"city.ilike.%{search_query}%,"
                f"address.ilike.%{search_query}%"
            )

        query = query.order("city").order("name")
        result = execute_with_retry(
            lambda: query.execute(),
            label="buyer_stores.get_stores_in_viewport",
        )

        stores = [self._format_store(s) for s in result.data]

        # 多风格筛选（应用层过滤，因为 Supabase 不支持多个 contains OR）
        if styles and len(styles) > 0:
            stores = [
                store for store in stores
                if any(
                    any(st.lower() in s.lower() for s in store.style)
                    for st in styles
                )
            ]

        # 有联系方式筛选
        if has_phone:
            stores = [
                store for store in stores
                if store.phone and len(store.phone) > 0
            ]

        return stores

    def get_nearby_stores(
        self,
        latitude: float,
        longitude: float,
        radius: float = 50.0,
    ) -> List[dict]:
        """获取附近的买手店"""
        result = execute_with_retry(
            lambda: self.db.table("buyer_stores").select("*").execute(),
            label="buyer_stores.get_nearby_stores",
        )

        stores_with_distance = []
        for s in result.data:
            if s.get("latitude") is None or s.get("longitude") is None:
                continue
            distance = self._calculate_distance(
                latitude, longitude, float(s["latitude"]), float(s["longitude"])
            )
            if distance <= radius:
                store = self._format_store(s)
                stores_with_distance.append(
                    {"store": store, "distance": round(distance, 2)}
                )

        # 按距离排序
        stores_with_distance.sort(key=lambda x: x["distance"])

        return stores_with_distance

    def _calculate_distance(
        self, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        """计算两点之间的距离（公里）"""
        R = 6371  # 地球半径（公里）

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c

    def search_stores(
        self, keyword: str, limit: int = 20
    ) -> List[BuyerStore]:
        """搜索买手店"""
        safe_keyword = self._sanitize_search_keyword(keyword)
        if not safe_keyword:
            return []

        try:
            result = execute_with_retry(
                lambda: self.db.table("buyer_stores")
                .select("*")
                .or_(
                    f"name.ilike.*{safe_keyword}*,"
                    f"city.ilike.*{safe_keyword}*,"
                    f"address.ilike.*{safe_keyword}*"
                )
                .limit(limit)
                .execute(),
                label="buyer_stores.search_stores",
            )
            return [self._format_store(s) for s in result.data]
        except Exception as e:
            print(f"Search stores error: {e}")
            return []


# 创建单例
buyer_store_service = BuyerStoreService()
