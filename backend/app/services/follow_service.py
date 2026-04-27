"""
关注服务
"""

from typing import List
from app.db.supabase import get_supabase
from app.schemas.follow import FollowingUser, FollowingBrand
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

            # 等级规则引擎: user_followed 计数器 +1
            from app.services.level_service import level_service
            from app.schemas.level import LevelAction
            level_service.record_action(follower_id, LevelAction.USER_FOLLOWED)

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

    def get_mutual_follows(self, user_id: int) -> List[FollowingUser]:
        """获取互相关注的用户列表 (A follows B AND B follows A)"""
        try:
            following_result = (
                self.db.table("user_follows")
                .select("following_id")
                .eq("follower_id", user_id)
                .execute()
            )
            following_ids = {item["following_id"] for item in (following_result.data or [])}
            if not following_ids:
                return []

            followers_result = (
                self.db.table("user_follows")
                .select("follower_id")
                .eq("following_id", user_id)
                .in_("follower_id", list(following_ids))
                .execute()
            )
            mutual_ids = [item["follower_id"] for item in (followers_result.data or [])]
            if not mutual_ids:
                return []

            users_result = (
                self.db.table("users")
                .select("id, username, user_info(bio, location, avatar_url)")
                .in_("id", mutual_ids)
                .execute()
            )

            users = []
            for user in users_result.data or []:
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
            print(f"Error in get_mutual_follows for user {user_id}: {e}")
            raise

    def get_mutual_follows_count(self, user_id: int) -> int:
        """获取互相关注的用户数量"""
        try:
            following_result = (
                self.db.table("user_follows")
                .select("following_id")
                .eq("follower_id", user_id)
                .execute()
            )
            following_ids = {item["following_id"] for item in (following_result.data or [])}
            if not following_ids:
                return 0

            followers_result = (
                self.db.table("user_follows")
                .select("follower_id")
                .eq("following_id", user_id)
                .in_("follower_id", list(following_ids))
                .execute()
            )
            return len(followers_result.data or [])
        except Exception as e:
            print(f"Error in get_mutual_follows_count for user {user_id}: {e}")
            return 0

    def is_mutual_follow(self, user_id: int, target_user_id: int) -> bool:
        """检查两个用户是否互相关注"""
        a_follows_b = self.is_following_user(user_id, target_user_id)
        if not a_follows_b:
            return False
        return self.is_following_user(target_user_id, user_id)

    # ==================== 品牌关注 ====================

    def follow_brand(self, user_id: int, brand_id: int) -> bool:
        """关注品牌"""
        try:
            self.db.table("brand_follows").insert(
                {"user_id": user_id, "brand_id": brand_id}
            ).execute()
            return True
        except:
            return False

    def unfollow_brand(self, user_id: int, brand_id: int) -> bool:
        """取消关注品牌"""
        result = (
            self.db.table("brand_follows")
            .delete()
            .eq("user_id", user_id)
            .eq("brand_id", brand_id)
            .execute()
        )
        return bool(result.data)

    def batch_follow_brands(self, user_id: int, brand_ids: List[int]) -> int:
        """批量关注品牌，返回成功关注的数量"""
        count = 0
        for brand_id in brand_ids:
            try:
                self.db.table("brand_follows").upsert(
                    {"user_id": user_id, "brand_id": brand_id},
                    on_conflict="user_id,brand_id"
                ).execute()
                count += 1
            except Exception as e:
                print(f"Failed to follow brand {brand_id}: {e}")
        return count

    def get_following_brands(self, user_id: int) -> List[FollowingBrand]:
        """获取用户关注的品牌列表"""
        try:
            result = (
                self.db.table("brand_follows")
                .select("brand_id, brands(id, name, category, country)")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .execute()
            )

            brand_ids = []
            brand_map = {}
            for item in result.data or []:
                brand = item.get("brands")
                if brand:
                    brand_ids.append(brand["id"])
                    brand_map[brand["id"]] = brand

            # 批量获取品牌图片（优先 is_selected，否则取第一张 APPROVED）
            image_map: dict[int, str] = {}
            if brand_ids:
                img_result = (
                    self.db.table("brand_images")
                    .select("brand_id, image_url, is_selected")
                    .in_("brand_id", brand_ids)
                    .eq("status", "APPROVED")
                    .order("is_selected", desc=True)
                    .order("sort_order")
                    .execute()
                )
                for img in img_result.data or []:
                    bid = img["brand_id"]
                    if bid not in image_map:
                        image_map[bid] = img["image_url"]

            # 批量获取关注者数量
            count_result = (
                self.db.table("brand_follows")
                .select("brand_id", count="exact")
                .in_("brand_id", brand_ids)
                .execute()
            )
            count_map: dict[int, int] = {}
            if count_result.data:
                for row in count_result.data:
                    bid = row["brand_id"]
                    count_map[bid] = count_map.get(bid, 0) + 1

            brands = []
            for bid in brand_ids:
                brand = brand_map.get(bid)
                if brand:
                    brands.append(
                        FollowingBrand(
                            brandId=brand["id"],
                            name=brand["name"],
                            category=brand.get("category") or "",
                            coverImage=image_map.get(bid, ""),
                            country=brand.get("country") or "",
                            followersCount=count_map.get(bid, 0),
                        )
                    )
            return brands
        except Exception as e:
            print(f"Error in get_following_brands for user {user_id}: {e}")
            raise

    def get_brand_followers(self, brand_id: int) -> List[FollowingUser]:
        """获取品牌的关注者列表"""
        try:
            result = (
                self.db.table("brand_follows")
                .select(
                    "user_id, users!brand_follows_user_id_fkey(id, username, user_info(bio, location, avatar_url))"
                )
                .eq("brand_id", brand_id)
                .order("created_at", desc=True)
                .execute()
            )

            users = []
            for item in result.data or []:
                user = item.get("users")
                if user:
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
            print(f"Error in get_brand_followers for brand {brand_id}: {e}")
            raise

    def get_brand_followers_count(self, brand_id: int) -> int:
        """获取品牌的关注者数量"""
        result = (
            self.db.table("brand_follows")
            .select("id", count="exact")
            .eq("brand_id", brand_id)
            .execute()
        )
        return result.count or 0

    def is_following_brand(self, user_id: int, brand_id: int) -> bool:
        """检查用户是否关注了某个品牌"""
        result = (
            self.db.table("brand_follows")
            .select("id")
            .eq("user_id", user_id)
            .eq("brand_id", brand_id)
            .execute()
        )
        return bool(result.data)

    def get_following_brand_ids(self, user_id: int) -> List[int]:
        """获取用户关注的品牌 ID 列表"""
        result = (
            self.db.table("brand_follows")
            .select("brand_id")
            .eq("user_id", user_id)
            .execute()
        )
        return [item["brand_id"] for item in (result.data or [])]


# 单例
follow_service = FollowService()
