"""
秀场服务
"""

import time
from typing import Optional, List, Tuple
from app.db.supabase import get_supabase
from app.schemas.show import Show, CreateShowRequest


class ShowService:
    """秀场服务类"""

    def __init__(self):
        self.db = get_supabase()

    def _sanitize_search_keyword(self, keyword: str) -> str:
        """清理搜索关键词，转义可能导致查询失败的特殊字符"""
        sanitized = keyword.replace("\\", "\\\\")
        sanitized = sanitized.replace("%", "\\%")
        sanitized = sanitized.replace("_", "\\_")
        sanitized = sanitized.replace(",", " ")
        sanitized = sanitized.replace(".", " ")
        return sanitized.strip()

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
            description=show.get("description"),
            designer=show.get("designer"),
            createdBy=show.get("created_by"),
            status=show.get("status") or "APPROVED",
            rejectReason=show.get("reject_reason"),
            createdAt=show.get("created_at"),
            updatedAt=show.get("updated_at"),
        )

    def create_show(self, data: CreateShowRequest, user_id: int) -> Show:
        """创建秀场（状态为 PENDING，等待管理员审核）"""
        brand_slug = data.brand.replace(" ", "_").lower()
        show_id = f"{brand_slug}_{data.year}_{int(time.time())}"

        row = {
            "id": show_id,
            "brand_name": data.brand,
            "title": data.title,
            "year": data.year,
            "season": data.season,
            "category": data.category,
            "designer": data.designer,
            "description": data.description,
            "cover_image": data.coverImage,
            "created_by": user_id,
            "status": "PENDING",
        }

        result = self.db.table("shows").insert(row).execute()

        if not result.data:
            raise Exception("创建秀场失败")

        return self._format_show(result.data[0])

    def get_pending_shows(self) -> List[Show]:
        """获取待审核秀场列表"""
        result = (
            self.db.table("shows")
            .select("*")
            .eq("status", "PENDING")
            .order("created_at", desc=True)
            .execute()
        )
        return [self._format_show(s) for s in result.data]

    def approve_show(self, show_id: str) -> Show:
        """审核通过秀场"""
        result = (
            self.db.table("shows")
            .update({"status": "APPROVED", "reject_reason": None})
            .eq("id", show_id)
            .execute()
        )
        if not result.data:
            raise Exception("秀场不存在")
        return self._format_show(result.data[0])

    def reject_show(self, show_id: str, reason: Optional[str] = None) -> Show:
        """拒绝秀场"""
        result = (
            self.db.table("shows")
            .update({"status": "REJECTED", "reject_reason": reason})
            .eq("id", show_id)
            .execute()
        )
        if not result.data:
            raise Exception("秀场不存在")
        return self._format_show(result.data[0])

    def get_all_shows(
        self,
        keyword: Optional[str] = None,
        brand: Optional[str] = None,
        year: Optional[int] = None,
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[Show], int]:
        """获取秀场列表（仅已审核通过的）"""
        query = self.db.table("shows").select("*", count="exact")

        # 只返回已审核通过的（含旧数据 NULL status）
        query = query.or_("status.eq.APPROVED,status.is.null")

        if keyword:
            query = query.or_(
                f"brand_name.ilike.%{keyword}%,season.ilike.%{keyword}%,category.ilike.%{keyword}%"
            )

        if brand:
            query = query.ilike("brand_name", f"%{brand}%")

        if year:
            query = query.eq("year", year)

        if category:
            query = query.ilike("category", f"%{category}%")

        query = query.order("year", desc=True).order("brand_name")

        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)

        result = query.execute()
        total = result.count or 0
        shows = [self._format_show(s) for s in result.data]

        return shows, total

    def get_show_by_id(self, show_id) -> Optional[Show]:
        """通过 ID 获取秀场"""
        result = (
            self.db.table("shows").select("*").eq("id", str(show_id)).execute()
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
        """获取某品牌的所有已审核通过的秀场"""
        result = (
            self.db.table("shows")
            .select("*")
            .ilike("brand_name", brand_name)
            .or_("status.eq.APPROVED,status.is.null")
            .order("year", desc=True)
            .execute()
        )

        return [self._format_show(s) for s in result.data]

    def search_shows(self, keyword: str, limit: int = 50) -> List[Show]:
        """搜索秀场"""
        safe_keyword = self._sanitize_search_keyword(keyword)
        if not safe_keyword:
            return []
        
        try:
            result = (
                self.db.table("shows")
                .select("*")
                .or_(
                    f"brand_name.ilike.*{safe_keyword}*,season.ilike.*{safe_keyword}*,category.ilike.*{safe_keyword}*"
                )
                .order("year", desc=True)
                .limit(limit)
                .execute()
            )
            return [self._format_show(s) for s in result.data]
        except Exception as e:
            print(f"Search shows error: {e}")
            return []

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
