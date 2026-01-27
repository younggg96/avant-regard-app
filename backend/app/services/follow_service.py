"""
关注服务
"""

from typing import List
from app.db.supabase import get_supabase
from app.schemas.follow import FollowingUser
from app.services.notification_service import notification_service


class FollowService:
    def __init__(self):
        self.db = get_supabase()

    # ==================== 用户关注 ====================

    def follow_user(self, follower_id: int, target_user_id: int) -> bool:
        """关注用户"""
        if follower_id == target_user_id:
            return False
        try:
            self.db.table("user_follows").insert(
                {"follower_id": follower_id, "following_id": target_user_id}
            ).execute()
            
            # 发送关注通知
            self._send_follow_notification(follower_id, target_user_id)
            
            return True
        except:
            return False
    
    def _send_follow_notification(self, follower_id: int, target_user_id: int):
        """发送关注通知"""
        try:
            # 获取关注者信息
            follower_result = self.db.table("users").select("username").eq("id", follower_id).execute()
            follower_name = follower_result.data[0]["username"] if follower_result.data else "用户"
            
            # 获取关注者头像
            follower_avatar_result = self.db.table("user_info").select("avatar_url").eq("user_id", follower_id).execute()
            follower_avatar = follower_avatar_result.data[0]["avatar_url"] if follower_avatar_result.data else None
            
            notification_service.notify_user_followed(
                followed_user_id=target_user_id,
                follower_id=follower_id,
                follower_name=follower_name,
                follower_avatar=follower_avatar
            )
        except Exception as e:
            print(f"Failed to send follow notification: {e}")

    def unfollow_user(self, follower_id: int, target_user_id: int) -> bool:
        """取消关注用户"""
        result = (
            self.db.table("user_follows")
            .delete()
            .eq("follower_id", follower_id)
            .eq("following_id", target_user_id)
            .execute()
        )
        return bool(result.data)

    def _extract_user_info(self, user_info_data) -> dict:
        """从 user_info 数据中提取信息，处理列表或字典格式"""
        if not user_info_data:
            return {}
        # 如果是列表，取第一个元素
        if isinstance(user_info_data, list):
            return user_info_data[0] if user_info_data else {}
        # 如果是字典，直接返回
        if isinstance(user_info_data, dict):
            return user_info_data
        return {}

    def get_following_users(self, user_id: int) -> List[FollowingUser]:
        """获取用户关注的用户列表"""
        try:
            result = (
                self.db.table("user_follows")
                .select(
                    "following_id, users!user_follows_following_id_fkey(id, username, user_info(bio, location, avatar_url))"
                )
                .eq("follower_id", user_id)
                .execute()
            )

            print(f"get_following_users result for user {user_id}: {result.data}")

            users = []
            for item in result.data or []:
                user = item.get("users")
                if user:
                    # user_info can be a list or dict depending on Supabase relationship
                    info = self._extract_user_info(user.get("user_info"))
                    users.append(
                        FollowingUser(
                            userId=user["id"],
                            username=user["username"],
                            avatar=info.get("avatar_url", ""),
                            bio=info.get("bio", ""),
                            location=info.get("location", ""),
                        )
                    )
            return users
        except Exception as e:
            print(f"Error in get_following_users for user {user_id}: {e}")
            raise

    def get_followers(self, user_id: int) -> List[FollowingUser]:
        """获取用户的粉丝列表"""
        try:
            result = (
                self.db.table("user_follows")
                .select(
                    "follower_id, users!user_follows_follower_id_fkey(id, username, user_info(bio, location, avatar_url))"
                )
                .eq("following_id", user_id)
                .execute()
            )

            print(f"get_followers result for user {user_id}: {result.data}")

            users = []
            for item in result.data or []:
                user = item.get("users")
                if user:
                    # user_info can be a list or dict depending on Supabase relationship
                    info = self._extract_user_info(user.get("user_info"))
                    users.append(
                        FollowingUser(
                            userId=user["id"],
                            username=user["username"],
                            avatar=info.get("avatar_url", ""),
                            bio=info.get("bio", ""),
                            location=info.get("location", ""),
                        )
                    )
            return users
        except Exception as e:
            print(f"Error in get_followers for user {user_id}: {e}")
            raise

    def get_following_count(self, user_id: int) -> int:
        """获取用户关注的用户数量"""
        result = (
            self.db.table("user_follows")
            .select("id", count="exact")
            .eq("follower_id", user_id)
            .execute()
        )
        return result.count or 0

    def get_followers_count(self, user_id: int) -> int:
        """获取用户的粉丝数量"""
        result = (
            self.db.table("user_follows")
            .select("id", count="exact")
            .eq("following_id", user_id)
            .execute()
        )
        return result.count or 0

    def is_following_user(self, follower_id: int, target_user_id: int) -> bool:
        """检查是否关注了某个用户"""
        result = (
            self.db.table("user_follows")
            .select("id")
            .eq("follower_id", follower_id)
            .eq("following_id", target_user_id)
            .execute()
        )
        return bool(result.data)


# 单例
follow_service = FollowService()
