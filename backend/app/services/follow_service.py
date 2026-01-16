"""
关注服务
"""
from typing import List
from app.db.supabase import get_supabase
from app.schemas.follow import FollowingUser


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

    def get_followers(self, user_id: int) -> List[FollowingUser]:
        """获取用户的粉丝列表"""
        result = self.db.table("user_follows").select(
            "follower_id, users!user_follows_follower_id_fkey(id, username, user_info(bio, location, avatar_url))"
        ).eq("following_id", user_id).execute()
        
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


# 单例
follow_service = FollowService()
