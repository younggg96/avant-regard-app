"""
买手店服务
"""

import math
from typing import Optional, List, Tuple
from app.db.supabase import get_supabase, get_supabase_admin
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

    def _format_store(self, store: dict) -> BuyerStore:
        """格式化买手店数据"""
        return BuyerStore(
            id=store["id"],
            name=store["name"],
            address=store["address"],
            city=store["city"],
            country=store["country"],
            coordinates={
                "latitude": float(store["latitude"]),
                "longitude": float(store["longitude"]),
            },
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
        """获取买手店列表"""
        query = self.db.table("buyer_stores").select("*", count="exact")

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

        result = query.execute()
        total = result.count or 0
        stores = [self._format_store(s) for s in result.data]

        return stores, total

    def get_store_by_id(self, store_id: str) -> Optional[BuyerStore]:
        """通过 ID 获取买手店"""
        result = (
            self.db.table("buyer_stores").select("*").eq("id", store_id).execute()
        )

        if not result.data:
            return None

        return self._format_store(result.data[0])

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
        result = self.db.table("buyer_stores").select("country").execute()

        countries = set(s["country"] for s in result.data if s.get("country"))
        return sorted(list(countries))

    def get_all_cities(self, country: Optional[str] = None) -> List[str]:
        """获取所有城市列表"""
        query = self.db.table("buyer_stores").select("city")

        if country:
            query = query.eq("country", country)

        result = query.execute()

        cities = set(s["city"] for s in result.data if s.get("city"))
        return sorted(list(cities))

    def get_all_styles(self) -> List[str]:
        """获取所有风格列表"""
        result = self.db.table("buyer_stores").select("style").execute()

        styles = set()
        for s in result.data:
            if s.get("style"):
                for style in s["style"]:
                    styles.add(style)

        return sorted(list(styles))

    def get_stores_by_brand(self, brand: str) -> List[BuyerStore]:
        """根据品牌获取买手店"""
        # 使用 ilike 进行模糊匹配
        result = (
            self.db.table("buyer_stores")
            .select("*")
            .execute()
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

    def get_nearby_stores(
        self,
        latitude: float,
        longitude: float,
        radius: float = 50.0,
    ) -> List[dict]:
        """获取附近的买手店"""
        result = self.db.table("buyer_stores").select("*").execute()

        stores_with_distance = []
        for s in result.data:
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
        result = (
            self.db.table("buyer_stores")
            .select("*")
            .or_(
                f"name.ilike.%{keyword}%,"
                f"city.ilike.%{keyword}%,"
                f"address.ilike.%{keyword}%"
            )
            .limit(limit)
            .execute()
        )

        return [self._format_store(s) for s in result.data]


# 创建单例
buyer_store_service = BuyerStoreService()
