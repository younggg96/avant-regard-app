"""
品牌服务
"""

from typing import Optional, List, Tuple
from app.db.supabase import get_supabase
from app.schemas.brand import Brand, BrandSubmission, BrandImage


class BrandService:
    """品牌服务类"""

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

    def _get_brand_cover_images(self, brand_id: int) -> List[str]:
        """获取品牌被选中展示的图片 URL 列表，无选中图片时回退到所有已审核图片"""
        try:
            result = (
                self.db.table("brand_images")
                .select("image_url")
                .eq("brand_id", brand_id)
                .eq("status", "APPROVED")
                .eq("is_selected", True)
                .order("sort_order")
                .order("created_at")
                .execute()
            )
            urls = [r["image_url"] for r in result.data if r.get("image_url")]
            if urls:
                return urls
        except Exception:
            pass

        result = (
            self.db.table("brand_images")
            .select("image_url")
            .eq("brand_id", brand_id)
            .eq("status", "APPROVED")
            .order("sort_order")
            .order("created_at")
            .execute()
        )
        return [r["image_url"] for r in result.data if r.get("image_url")]

    def _format_brand(self, brand: dict, include_images: bool = False) -> Brand:
        """格式化品牌数据"""
        cover_images = None
        if include_images:
            cover_images = self._get_brand_cover_images(brand["id"])

        return Brand(
            id=brand["id"],
            name=brand["name"],
            category=brand.get("category"),
            foundedYear=brand.get("founded_year"),
            founder=brand.get("founder"),
            country=brand.get("country"),
            website=brand.get("website"),
            coverImage=brand.get("cover_image"),
            coverImages=cover_images,
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
            safe_keyword = self._sanitize_search_keyword(keyword)
            if safe_keyword:
                query = query.or_(
                    f"name.ilike.*{safe_keyword}*,founder.ilike.*{safe_keyword}*,country.ilike.*{safe_keyword}*"
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
        """通过 ID 获取品牌（含图片列表）"""
        result = (
            self.db.table("brands").select("*").eq("id", brand_id).execute()
        )

        if not result.data:
            return None

        return self._format_brand(result.data[0], include_images=True)

    def get_brand_by_name(self, name: str) -> Optional[Brand]:
        """通过名称获取品牌（含图片列表）"""
        result = (
            self.db.table("brands").select("*").ilike("name", name).execute()
        )

        if not result.data:
            return None

        return self._format_brand(result.data[0], include_images=True)

    def search_brands(self, keyword: str, limit: int = 20) -> List[Brand]:
        """搜索品牌"""
        safe_keyword = self._sanitize_search_keyword(keyword)
        if not safe_keyword:
            return []
        
        try:
            result = (
                self.db.table("brands")
                .select("*")
                .or_(f"name.ilike.*{safe_keyword}*,founder.ilike.*{safe_keyword}*")
                .order("name")
                .limit(limit)
                .execute()
            )
            return [self._format_brand(b) for b in result.data]
        except Exception as e:
            print(f"Search brands error: {e}")
            return []

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


    def _format_submission(self, data: dict) -> BrandSubmission:
        """格式化品牌提交记录"""
        return BrandSubmission(
            id=data["id"],
            userId=data["user_id"],
            name=data["name"],
            category=data.get("category"),
            foundedYear=data.get("founded_year"),
            founder=data.get("founder"),
            country=data.get("country"),
            website=data.get("website"),
            coverImage=data.get("cover_image"),
            status=data.get("status", "PENDING"),
            rejectReason=data.get("reject_reason"),
            reviewedAt=data.get("reviewed_at"),
            createdAt=data.get("created_at"),
            updatedAt=data.get("updated_at"),
        )

    def submit_brand(
        self,
        user_id: int,
        name: str,
        category: Optional[str] = None,
        founded_year: Optional[str] = None,
        founder: Optional[str] = None,
        country: Optional[str] = None,
        website: Optional[str] = None,
        cover_image: Optional[str] = None,
    ) -> BrandSubmission:
        """用户提交品牌"""
        insert_data = {
            "user_id": user_id,
            "name": name.strip(),
            "category": category,
            "founded_year": founded_year,
            "founder": founder,
            "country": country,
            "website": website,
            "cover_image": cover_image,
            "status": "PENDING",
        }
        result = self.db.table("brand_submissions").insert(insert_data).execute()
        if not result.data:
            raise Exception("提交品牌失败")
        return self._format_submission(result.data[0])

    def get_user_submissions(self, user_id: int) -> List[BrandSubmission]:
        """获取用户自己的品牌提交记录"""
        result = (
            self.db.table("brand_submissions")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [self._format_submission(s) for s in result.data or []]

    def add_brand_image(self, brand_id: int, image_url: str, user_id: int) -> BrandImage:
        """用户上传品牌图片（PENDING 状态，等待审核）"""
        result = self.db.table("brand_images").insert({
            "brand_id": brand_id,
            "image_url": image_url,
            "status": "PENDING",
            "uploaded_by": user_id,
        }).execute()
        if not result.data:
            raise Exception("上传图片失败")
        row = result.data[0]
        return BrandImage(
            id=row["id"],
            brandId=row["brand_id"],
            imageUrl=row["image_url"],
            sortOrder=row.get("sort_order", 0),
            status=row["status"],
            uploadedBy=row.get("uploaded_by"),
            createdAt=row.get("created_at"),
        )


# 创建单例
brand_service = BrandService()
