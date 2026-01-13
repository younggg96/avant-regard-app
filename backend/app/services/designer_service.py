"""
设计师服务
"""
from typing import Optional, List
from app.db.supabase import get_supabase
from app.schemas.designer import (
    DesignerDetailDto,
    DesignerShowSummary,
    DesignerImageSummary,
    DesignerShowAndImageDetailDto,
    SingleShowDto,
    SingleShowImage,
    DesignerOption
)
from app.services.follow_service import follow_service


class DesignerService:
    def __init__(self):
        self.db = get_supabase()

    def get_all_designer_details(self, current_user_id: Optional[int] = None) -> List[DesignerDetailDto]:
        """获取所有设计师的简要信息列表"""
        result = self.db.table("designers").select("*").order("name").execute()
        
        designers = []
        for d in result.data or []:
            # 获取统计信息
            stats = self._get_designer_stats(d["id"])
            
            # 检查当前用户是否关注
            following = False
            if current_user_id:
                following = follow_service.is_following_designer(current_user_id, d["id"])
            
            designers.append(DesignerDetailDto(
                id=d["id"],
                name=d["name"],
                slug=d["slug"],
                designerUrl=d.get("designer_url", ""),
                showCount=stats["show_count"],
                totalImages=stats["total_images"],
                latestSeason=stats["latest_season"],
                followerCount=stats["follower_count"],
                following=following
            ))
        return designers

    def get_designer_show_and_images(self, designer_id: int, current_user_id: Optional[int] = None) -> Optional[DesignerShowAndImageDetailDto]:
        """获取单个设计师 + 所有 Show + 所有造型图详情"""
        # 获取设计师信息
        designer_result = self.db.table("designers").select("*").eq("id", designer_id).execute()
        if not designer_result.data:
            return None
        d = designer_result.data[0]
        
        # 获取统计信息
        stats = self._get_designer_stats(designer_id)
        
        # 检查当前用户是否关注
        following = False
        if current_user_id:
            following = follow_service.is_following_designer(current_user_id, designer_id)
        
        # 获取所有秀场
        shows = self._get_designer_shows(designer_id)
        
        # 获取所有图片
        images = self._get_designer_images(designer_id, current_user_id)
        
        return DesignerShowAndImageDetailDto(
            id=d["id"],
            name=d["name"],
            slug=d["slug"],
            designerUrl=d.get("designer_url", ""),
            showCount=stats["show_count"],
            totalImages=stats["total_images"],
            followerCount=stats["follower_count"],
            following=following,
            shows=shows,
            images=images
        )

    def get_single_show(self, show_id: int) -> Optional[SingleShowDto]:
        """获取单场 show 详情"""
        result = self.db.table("shows").select("*").eq("id", show_id).execute()
        if not result.data:
            return None
        show = result.data[0]
        
        # 获取秀场图片
        images_result = self.db.table("show_images").select("*").eq("show_id", show_id).order("sort_order").execute()
        images = [
            SingleShowImage(
                id=img["id"],
                imageUrl=img["image_url"],
                imageType=img.get("image_type", "LOOK"),
                sortOrder=img.get("sort_order", 0)
            )
            for img in images_result.data or []
        ]
        
        return SingleShowDto(
            id=show["id"],
            showUrl=show.get("show_url", ""),
            season=show["season"],
            category=show.get("category", ""),
            city=show.get("city"),
            collectionTs=show.get("collection_ts", ""),
            originalOffset=show.get("original_offset"),
            reviewTitle=show.get("review_title"),
            reviewAuthor=show.get("review_author"),
            reviewText=show.get("review_text"),
            images=images
        )

    def get_designer_options(self) -> List[DesignerOption]:
        """获取设计师选项列表（用于用户补全资料）"""
        result = self.db.table("designers").select("id, name, slug, designer_url").order("name").execute()
        return [
            DesignerOption(
                id=d["id"],
                name=d["name"],
                slug=d["slug"],
                designerUrl=d.get("designer_url", "")
            )
            for d in result.data or []
        ]

    def _get_designer_stats(self, designer_id: int) -> dict:
        """获取设计师统计信息"""
        # 获取秀场数量和最新季度
        shows_result = self.db.table("shows").select("id, season", count="exact").eq("designer_id", designer_id).order("collection_ts", desc=True).execute()
        show_count = shows_result.count or 0
        latest_season = shows_result.data[0]["season"] if shows_result.data else ""
        
        # 获取图片总数
        show_ids = [s["id"] for s in shows_result.data or []]
        total_images = 0
        if show_ids:
            images_result = self.db.table("show_images").select("id", count="exact").in_("show_id", show_ids).execute()
            total_images = images_result.count or 0
        
        # 获取粉丝数
        follower_count = follow_service.get_designer_followers_count(designer_id)
        
        return {
            "show_count": show_count,
            "total_images": total_images,
            "latest_season": latest_season,
            "follower_count": follower_count
        }

    def _get_designer_shows(self, designer_id: int) -> List[DesignerShowSummary]:
        """获取设计师的所有秀场"""
        result = self.db.table("shows").select("*").eq("designer_id", designer_id).order("collection_ts", desc=True).execute()
        
        shows = []
        for show in result.data or []:
            # 获取图片数量
            images_result = self.db.table("show_images").select("id", count="exact").eq("show_id", show["id"]).execute()
            image_count = images_result.count or 0
            
            shows.append(DesignerShowSummary(
                id=show["id"],
                category=show.get("category", ""),
                season=show["season"],
                imageCount=image_count,
                reviewAuthor=show.get("review_author"),
                reviewText=show.get("review_text")
            ))
        return shows

    def _get_designer_images(self, designer_id: int, current_user_id: Optional[int] = None) -> List[DesignerImageSummary]:
        """获取设计师的所有图片"""
        # 获取设计师的所有秀场
        shows_result = self.db.table("shows").select("id").eq("designer_id", designer_id).execute()
        show_ids = [s["id"] for s in shows_result.data or []]
        
        if not show_ids:
            return []
        
        # 获取所有图片
        images_result = self.db.table("show_images").select("*").in_("show_id", show_ids).order("sort_order").limit(50).execute()
        
        images = []
        for img in images_result.data or []:
            # 检查当前用户是否点赞
            liked_by_me = False
            if current_user_id:
                like_result = self.db.table("show_image_likes").select("id").eq("image_id", img["id"]).eq("user_id", current_user_id).execute()
                liked_by_me = bool(like_result.data)
            
            images.append(DesignerImageSummary(
                id=img["id"],
                imageUrl=img["image_url"],
                likeCount=img.get("like_count", 0),
                likedByMe=liked_by_me
            ))
        return images


# 单例
designer_service = DesignerService()
