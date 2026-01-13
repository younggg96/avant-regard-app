"""
关注服务
"""
from typing import List
from app.db.supabase import get_supabase
from app.schemas.follow import FollowingUser, FollowingDesigner


class FollowService:
    def __init__(self):
        self.db = get_supabase()

    # ==================== 用户关注 ====================

    def follow_user(self, follower_id: int, target_user_id: int) -> bool:
        """关注用户"""
        if follower_id == target_user_id:
            return False
        try:
            self.db.table("user_follows").insert({
                "follower_id": follower_id,
                "following_id": target_user_id
            }).execute()
            return True
        except:
            return False

    def unfollow_user(self, follower_id: int, target_user_id: int) -> bool:
        """取消关注用户"""
        result = self.db.table("user_follows").delete().eq("follower_id", follower_id).eq("following_id", target_user_id).execute()
        return bool(result.data)

    def get_following_users(self, user_id: int) -> List[FollowingUser]:
        """获取用户关注的用户列表"""
        result = self.db.table("user_follows").select(
            "following_id, users!user_follows_following_id_fkey(id, username, user_info(bio, location, avatar_url))"
        ).eq("follower_id", user_id).execute()
        
        users = []
        for item in result.data or []:
            user = item.get("users")
            if user:
                # user_info is nested inside users
                info_list = user.get("user_info", [])
                info = info_list[0] if info_list else {}
                users.append(FollowingUser(
                    userId=user["id"],
                    username=user["username"],
                    avatar=info.get("avatar_url", ""),
                    bio=info.get("bio", ""),
                    location=info.get("location", "")
                ))
        return users

    def get_following_count(self, user_id: int) -> int:
        """获取用户关注的用户数量"""
        result = self.db.table("user_follows").select("id", count="exact").eq("follower_id", user_id).execute()
        return result.count or 0

    def get_followers_count(self, user_id: int) -> int:
        """获取用户的粉丝数量"""
        result = self.db.table("user_follows").select("id", count="exact").eq("following_id", user_id).execute()
        return result.count or 0

    def is_following_user(self, follower_id: int, target_user_id: int) -> bool:
        """检查是否关注了某个用户"""
        result = self.db.table("user_follows").select("id").eq("follower_id", follower_id).eq("following_id", target_user_id).execute()
        return bool(result.data)

    # ==================== 设计师关注 ====================

    def follow_designer(self, user_id: int, designer_id: int) -> bool:
        """关注设计师"""
        try:
            self.db.table("designer_follows").insert({
                "user_id": user_id,
                "designer_id": designer_id
            }).execute()
            return True
        except:
            return False

    def unfollow_designer(self, user_id: int, designer_id: int) -> bool:
        """取消关注设计师"""
        result = self.db.table("designer_follows").delete().eq("user_id", user_id).eq("designer_id", designer_id).execute()
        return bool(result.data)

    def get_following_designers(self, user_id: int) -> List[FollowingDesigner]:
        """获取用户关注的设计师列表"""
        result = self.db.table("designer_follows").select(
            "designer_id, designers(id, name, slug, designer_url)"
        ).eq("user_id", user_id).execute()
        
        designers = []
        for item in result.data or []:
            d = item.get("designers")
            if d:
                # 获取设计师的秀场和图片统计
                stats = self._get_designer_stats(d["id"])
                designers.append(FollowingDesigner(
                    id=d["id"],
                    name=d["name"],
                    slug=d["slug"],
                    designerUrl=d.get("designer_url", ""),
                    showCount=stats["show_count"],
                    totalImages=stats["total_images"],
                    latestSeason=stats["latest_season"],
                    followerCount=stats["follower_count"]
                ))
        return designers

    def get_following_designers_count(self, user_id: int) -> int:
        """获取用户关注的设计师数量"""
        result = self.db.table("designer_follows").select("id", count="exact").eq("user_id", user_id).execute()
        return result.count or 0

    def is_following_designer(self, user_id: int, designer_id: int) -> bool:
        """检查是否关注了某个设计师"""
        result = self.db.table("designer_follows").select("id").eq("user_id", user_id).eq("designer_id", designer_id).execute()
        return bool(result.data)

    def get_designer_followers_count(self, designer_id: int) -> int:
        """获取设计师的粉丝数量"""
        result = self.db.table("designer_follows").select("id", count="exact").eq("designer_id", designer_id).execute()
        return result.count or 0

    def _get_designer_stats(self, designer_id: int) -> dict:
        """获取设计师统计信息"""
        # 获取秀场数量
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
        follower_count = self.get_designer_followers_count(designer_id)
        
        return {
            "show_count": show_count,
            "total_images": total_images,
            "latest_season": latest_season,
            "follower_count": follower_count
        }


# 单例
follow_service = FollowService()
