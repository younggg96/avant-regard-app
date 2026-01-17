"""
品牌服务
"""

from typing import Optional, List, Tuple
from app.db.supabase import get_supabase_client
from app.schemas.brand import Brand


class BrandService:
    """品牌服务类"""

    def __init__(self):
        self.db = get_supabase_client()

    def _format_brand(self, brand: dict) -> Brand:
        """格式化品牌数据"""
        return Brand(
            id=brand["id"],
            name=brand["name"],
            category=brand.get("category"),
            foundedYear=brand.get("founded_year"),
            founder=brand.get("founder"),
            country=brand.get("country"),
            website=brand.get("website"),
            coverImage=brand.get("cover_image"),
            latestSeason=brand.get("latest_season"),
            vogueSlug=brand.get("vogue_slug"),
            vogueUrl=brand.get("vogue_url"),
            createdAt=brand.get("created_at"),
            updatedAt=brand.get("updated_at"),
        )

    def get_all_brands(
        self,
        keyword: Optional[str] = None,
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[Brand], int]:
        """获取品牌列表"""
        query = self.db.table("brands").select("*", count="exact")

        # 关键词搜索（品牌名、创始人、国家）
        if keyword:
            query = query.or_(
                f"name.ilike.%{keyword}%,founder.ilike.%{keyword}%,country.ilike.%{keyword}%"
            )

        # 分类筛选
        if category and category != "all":
            query = query.ilike("category", f"%{category}%")

        # 排序
        query = query.order("name")

        # 分页
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)

        result = query.execute()
        total = result.count or 0
        brands = [self._format_brand(b) for b in result.data]

        return brands, total

    def get_brand_by_id(self, brand_id: int) -> Optional[Brand]:
        """通过 ID 获取品牌"""
        result = (
            self.db.table("brands").select("*").eq("id", brand_id).execute()
        )

        if not result.data:
            return None

        return self._format_brand(result.data[0])

    def get_brand_by_name(self, name: str) -> Optional[Brand]:
        """通过名称获取品牌"""
        result = (
            self.db.table("brands").select("*").ilike("name", name).execute()
        )

        if not result.data:
            return None

        return self._format_brand(result.data[0])

    def search_brands(self, keyword: str, limit: int = 20) -> List[Brand]:
        """搜索品牌"""
        result = (
            self.db.table("brands")
            .select("*")
            .or_(f"name.ilike.%{keyword}%,founder.ilike.%{keyword}%")
            .order("name")
            .limit(limit)
            .execute()
        )

        return [self._format_brand(b) for b in result.data]

    def get_brand_categories(self) -> List[str]:
        """获取所有品牌分类"""
        result = (
            self.db.table("brands")
            .select("category")
            .not_.is_("category", "null")
            .execute()
        )

        categories = set()
        for b in result.data:
            if b.get("category"):
                # 处理可能的多个分类（用 / 分隔）
                for cat in b["category"].split("/"):
                    categories.add(cat.strip())

        return sorted(list(categories))


# 创建单例
brand_service = BrandService()
