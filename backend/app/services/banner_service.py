"""
Banner 服务
"""
from typing import List, Optional
from datetime import datetime
from app.db.supabase import get_supabase
from app.schemas.banner import BannerCreate, BannerUpdate, BannerResponse


class BannerService:
    def __init__(self):
        self.db = get_supabase()

    def _format_banner(self, banner_data: dict) -> BannerResponse:
        """格式化 Banner 数据为前端格式"""
        return BannerResponse(
            id=banner_data["id"],
            title=banner_data["title"],
            subtitle=banner_data.get("subtitle"),
            imageUrl=banner_data["image_url"],
            linkType=banner_data.get("link_type", "NONE"),
            linkValue=banner_data.get("link_value"),
            sortOrder=banner_data.get("sort_order", 0),
            isActive=banner_data.get("is_active", True),
            startTime=banner_data.get("start_time"),
            endTime=banner_data.get("end_time"),
            createdBy=banner_data.get("created_by"),
            createdAt=banner_data["created_at"],
            updatedAt=banner_data["updated_at"]
        )

    def get_active_banners(self) -> List[BannerResponse]:
        """获取当前有效的 Banner 列表（前端展示用）"""
        now = datetime.utcnow().isoformat()
        
        # 查询启用且在有效时间范围内的 Banner
        result = self.db.table("banners") \
            .select("*") \
            .eq("is_active", True) \
            .order("sort_order", desc=False) \
            .execute()
        
        banners = []
        for b in result.data or []:
            # 检查时间范围
            start_time = b.get("start_time")
            end_time = b.get("end_time")
            
            # 如果设置了开始时间，检查是否已到开始时间
            if start_time and start_time > now:
                continue
            
            # 如果设置了结束时间，检查是否已过期
            if end_time and end_time < now:
                continue
            
            banners.append(self._format_banner(b))
        
        return banners

    def get_all_banners(self) -> List[BannerResponse]:
        """获取所有 Banner 列表（管理员用）"""
        result = self.db.table("banners") \
            .select("*") \
            .order("sort_order", desc=False) \
            .execute()
        
        return [self._format_banner(b) for b in result.data or []]

    def get_banner_by_id(self, banner_id: int) -> Optional[BannerResponse]:
        """根据 ID 获取 Banner"""
        result = self.db.table("banners") \
            .select("*") \
            .eq("id", banner_id) \
            .execute()
        
        if result.data:
            return self._format_banner(result.data[0])
        return None

    def create_banner(self, data: BannerCreate, created_by: int) -> BannerResponse:
        """创建 Banner"""
        insert_data = {
            "title": data.title,
            "subtitle": data.subtitle,
            "image_url": data.image_url,
            "link_type": data.link_type,
            "link_value": data.link_value,
            "sort_order": data.sort_order,
            "is_active": data.is_active,
            "start_time": data.start_time.isoformat() if data.start_time else None,
            "end_time": data.end_time.isoformat() if data.end_time else None,
            "created_by": created_by
        }
        
        result = self.db.table("banners").insert(insert_data).execute()
        
        if result.data:
            return self._format_banner(result.data[0])
        raise Exception("创建 Banner 失败")

    def update_banner(self, banner_id: int, data: BannerUpdate) -> Optional[BannerResponse]:
        """更新 Banner"""
        update_data = {}
        
        if data.title is not None:
            update_data["title"] = data.title
        if data.subtitle is not None:
            update_data["subtitle"] = data.subtitle
        if data.image_url is not None:
            update_data["image_url"] = data.image_url
        if data.link_type is not None:
            update_data["link_type"] = data.link_type
        if data.link_value is not None:
            update_data["link_value"] = data.link_value
        if data.sort_order is not None:
            update_data["sort_order"] = data.sort_order
        if data.is_active is not None:
            update_data["is_active"] = data.is_active
        if data.start_time is not None:
            update_data["start_time"] = data.start_time.isoformat()
        if data.end_time is not None:
            update_data["end_time"] = data.end_time.isoformat()
        
        if not update_data:
            return self.get_banner_by_id(banner_id)
        
        result = self.db.table("banners") \
            .update(update_data) \
            .eq("id", banner_id) \
            .execute()
        
        if result.data:
            return self._format_banner(result.data[0])
        return None

    def delete_banner(self, banner_id: int) -> bool:
        """删除 Banner"""
        result = self.db.table("banners") \
            .delete() \
            .eq("id", banner_id) \
            .execute()
        
        return bool(result.data)

    def toggle_banner_status(self, banner_id: int) -> Optional[BannerResponse]:
        """切换 Banner 启用状态"""
        # 先获取当前状态
        banner = self.get_banner_by_id(banner_id)
        if not banner:
            return None
        
        # 切换状态
        new_status = not banner.isActive
        result = self.db.table("banners") \
            .update({"is_active": new_status}) \
            .eq("id", banner_id) \
            .execute()
        
        if result.data:
            return self._format_banner(result.data[0])
        return None

    def reorder_banners(self, banner_ids: List[int]) -> bool:
        """重新排序 Banner"""
        try:
            for index, banner_id in enumerate(banner_ids):
                self.db.table("banners") \
                    .update({"sort_order": index}) \
                    .eq("id", banner_id) \
                    .execute()
            return True
        except Exception:
            return False


# 单例
banner_service = BannerService()
