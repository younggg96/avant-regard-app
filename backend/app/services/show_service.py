"""
秀场服务
"""

from typing import Optional, List, Tuple
from app.db.supabase import get_supabase_client
from app.schemas.show import Show


class ShowService:
    """秀场服务类"""

    def __init__(self):
        self.db = get_supabase_client()

    def _format_show(self, show: dict) -> Show:
        """格式化秀场数据"""
        return Show(
            id=show["id"],
            brand=show.get("brand_name") or "",
            season=show.get("season") or "",
            title=show.get("title"),
            coverImage=show.get("cover_image"),
            showUrl=show.get("show_url"),
            year=show.get("year"),
            category=show.get("category"),
            createdAt=show.get("created_at"),
            updatedAt=show.get("updated_at"),
        )

    def get_all_shows(
        self,
        keyword: Optional[str] = None,
        brand: Optional[str] = None,
        year: Optional[int] = None,
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[Show], int]:
        """获取秀场列表"""
        query = self.db.table("shows").select("*", count="exact")

        # 关键词搜索（品牌、季度、类别）
        if keyword:
            query = query.or_(
                f"brand_name.ilike.%{keyword}%,season.ilike.%{keyword}%,category.ilike.%{keyword}%"
            )

        # 品牌筛选
        if brand:
            query = query.ilike("brand_name", f"%{brand}%")

        # 年份筛选
        if year:
            query = query.eq("year", year)

        # 分类筛选
        if category:
            query = query.ilike("category", f"%{category}%")

        # 排序：按年份降序，然后按品牌名升序
        query = query.order("year", desc=True).order("brand_name")

        # 分页
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)

        result = query.execute()
        total = result.count or 0
        shows = [self._format_show(s) for s in result.data]

        return shows, total

    def get_show_by_id(self, show_id: int) -> Optional[Show]:
        """通过 ID 获取秀场"""
        result = (
            self.db.table("shows").select("*").eq("id", show_id).execute()
        )

        if not result.data:
            return None

        return self._format_show(result.data[0])

    def get_show_by_url(self, show_url: str) -> Optional[Show]:
        """通过 URL 获取秀场"""
        result = (
            self.db.table("shows").select("*").eq("show_url", show_url).execute()
        )

        if not result.data:
            return None

        return self._format_show(result.data[0])

    def get_shows_by_brand(self, brand_name: str) -> List[Show]:
        """获取某品牌的所有秀场"""
        result = (
            self.db.table("shows")
            .select("*")
            .ilike("brand_name", brand_name)
            .order("year", desc=True)
            .execute()
        )

        return [self._format_show(s) for s in result.data]

    def search_shows(self, keyword: str, limit: int = 50) -> List[Show]:
        """搜索秀场"""
        result = (
            self.db.table("shows")
            .select("*")
            .or_(
                f"brand_name.ilike.%{keyword}%,season.ilike.%{keyword}%,category.ilike.%{keyword}%"
            )
            .order("year", desc=True)
            .limit(limit)
            .execute()
        )

        return [self._format_show(s) for s in result.data]

    def get_show_years(self) -> List[int]:
        """获取所有年份"""
        result = (
            self.db.table("shows")
            .select("year")
            .not_.is_("year", "null")
            .execute()
        )

        years = set()
        for s in result.data:
            if s.get("year"):
                years.add(s["year"])

        return sorted(list(years), reverse=True)

    def get_show_categories(self) -> List[str]:
        """获取所有秀场类别"""
        result = (
            self.db.table("shows")
            .select("category")
            .not_.is_("category", "null")
            .execute()
        )

        categories = set()
        for s in result.data:
            if s.get("category"):
                categories.add(s["category"])

        return sorted(list(categories))


# 创建单例
show_service = ShowService()
