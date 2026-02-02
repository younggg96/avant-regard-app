"""
用户服务
"""
from typing import Optional, List
from app.db.supabase import get_supabase
from app.schemas.user import UserInfo, UserProfileInfo, UserPrivacySettings


class UserService:
    def __init__(self):
        self.db = get_supabase()

    def get_user_info(self, user_id: int) -> Optional[UserInfo]:
        """获取用户信息"""
        # 获取用户基本信息
        user_result = self.db.table("users").select("id, username").eq("id", user_id).execute()
        if not user_result.data:
            return None
        user = user_result.data[0]
        
        # 获取用户详细信息
        info_result = self.db.table("user_info").select("*").eq("user_id", user_id).execute()
        if not info_result.data:
            return None
        info = info_result.data[0]
        
        return UserInfo(
            userId=user["id"],
            infoId=info["id"],
            username=user["username"],
            bio=info.get("bio", ""),
            location=info.get("location", ""),
            avatarUrl=info.get("avatar_url", ""),
            coverUrl=info.get("cover_url", "")
        )

    def update_user_info(self, user_id: int, **kwargs) -> Optional[UserInfo]:
        """更新用户信息"""
        update_data = {}
        user_update = {}
        
        # 分离用户表和用户信息表的字段
        if "username" in kwargs and kwargs["username"]:
            user_update["username"] = kwargs["username"]
        if "bio" in kwargs and kwargs["bio"] is not None:
            update_data["bio"] = kwargs["bio"]
        if "location" in kwargs and kwargs["location"] is not None:
            update_data["location"] = kwargs["location"]
        if "avatarUrl" in kwargs and kwargs["avatarUrl"] is not None:
            update_data["avatar_url"] = kwargs["avatarUrl"]
        if "coverUrl" in kwargs and kwargs["coverUrl"] is not None:
            update_data["cover_url"] = kwargs["coverUrl"]
        
        # 更新用户表
        if user_update:
            self.db.table("users").update(user_update).eq("id", user_id).execute()
        
        # 更新用户信息表
        if update_data:
            self.db.table("user_info").update(update_data).eq("user_id", user_id).execute()
        
        return self.get_user_info(user_id)

    def get_user_profile(self, user_id: int) -> Optional[UserProfileInfo]:
        """获取用户完整资料"""
        # 获取用户基本信息
        user_result = self.db.table("users").select("id, username").eq("id", user_id).execute()
        if not user_result.data:
            return None
        user = user_result.data[0]
        
        # 获取用户详细信息
        info_result = self.db.table("user_info").select("*").eq("user_id", user_id).execute()
        if not info_result.data:
            return None
        info = info_result.data[0]
        
        # 获取用户喜欢的品牌
        favorite_brands_result = (
            self.db.table("user_favorite_brands")
            .select("brand_id")
            .eq("user_id", user_id)
            .execute()
        )
        favorite_brand_ids = [item["brand_id"] for item in favorite_brands_result.data] if favorite_brands_result.data else []
        
        return UserProfileInfo(
            userId=user["id"],
            infoId=info["id"],
            username=user["username"],
            bio=info.get("bio", ""),
            location=info.get("location", ""),
            avatarUrl=info.get("avatar_url", ""),
            coverUrl=info.get("cover_url", ""),
            gender=info.get("gender", "OTHER"),
            age=info.get("age", 0),
            preference=info.get("preference", ""),
            favoriteBrandIds=favorite_brand_ids
        )

    def update_user_profile(self, user_id: int, **kwargs) -> Optional[UserProfileInfo]:
        """更新用户资料"""
        update_data = {}
        user_update = {}
        
        # 分离用户表和用户信息表的字段
        if "username" in kwargs and kwargs["username"]:
            user_update["username"] = kwargs["username"]
        if "bio" in kwargs and kwargs["bio"] is not None:
            update_data["bio"] = kwargs["bio"]
        if "location" in kwargs and kwargs["location"] is not None:
            update_data["location"] = kwargs["location"]
        if "avatarUrl" in kwargs and kwargs["avatarUrl"] is not None:
            update_data["avatar_url"] = kwargs["avatarUrl"]
        if "coverUrl" in kwargs and kwargs["coverUrl"] is not None:
            update_data["cover_url"] = kwargs["coverUrl"]
        if "gender" in kwargs and kwargs["gender"] is not None:
            update_data["gender"] = kwargs["gender"]
        if "age" in kwargs and kwargs["age"] is not None:
            update_data["age"] = kwargs["age"]
        if "preference" in kwargs and kwargs["preference"] is not None:
            update_data["preference"] = kwargs["preference"]
        
        # 更新用户表
        if user_update:
            self.db.table("users").update(user_update).eq("id", user_id).execute()
        
        # 更新用户信息表
        if update_data:
            self.db.table("user_info").update(update_data).eq("user_id", user_id).execute()
        
        # 更新喜欢的品牌（如果提供）
        if "favoriteBrandIds" in kwargs and kwargs["favoriteBrandIds"] is not None:
            favorite_brand_ids = kwargs["favoriteBrandIds"]
            
            # 先删除现有的品牌偏好
            self.db.table("user_favorite_brands").delete().eq("user_id", user_id).execute()
            
            # 插入新的品牌偏好（最多5个）
            if favorite_brand_ids:
                brand_ids_to_insert = favorite_brand_ids[:5]  # 限制最多5个
                for brand_id in brand_ids_to_insert:
                    self.db.table("user_favorite_brands").insert({
                        "user_id": user_id,
                        "brand_id": brand_id
                    }).execute()
        
        return self.get_user_profile(user_id)

    def upload_avatar(self, user_id: int, avatar_url: str) -> Optional[UserInfo]:
        """更新用户头像"""
        self.db.table("user_info").update({"avatar_url": avatar_url}).eq("user_id", user_id).execute()
        return self.get_user_info(user_id)

    def upload_cover(self, user_id: int, cover_url: str) -> Optional[UserInfo]:
        """更新用户封面图片"""
        self.db.table("user_info").update({"cover_url": cover_url}).eq("user_id", user_id).execute()
        return self.get_user_info(user_id)

    def search_users(self, keyword: str, limit: int = 20) -> List[UserInfo]:
        """
        搜索用户（支持用户名模糊搜索和用户ID精确搜索）
        """
        import re
        
        results = []
        
        # 清理搜索关键词，移除可能导致查询问题的特殊字符
        clean_keyword = re.sub(r'[%_\\]', '', keyword.strip())
        if not clean_keyword:
            return results
        
        try:
            # 尝试按用户ID精确搜索
            if clean_keyword.isdigit():
                user_id = int(clean_keyword)
                user_info = self.get_user_info(user_id)
                if user_info:
                    results.append(user_info)
            
            # 按用户名模糊搜索
            user_result = (
                self.db.table("users")
                .select("id, username")
                .ilike("username", f"%{clean_keyword}%")
                .limit(limit)
                .execute()
            )
            
            if user_result.data:
                # 批量获取用户详细信息以减少请求次数
                user_ids = [user["id"] for user in user_result.data 
                           if not any(r.userId == user["id"] for r in results)]
                
                if user_ids:
                    info_result = (
                        self.db.table("user_info")
                        .select("*")
                        .in_("user_id", user_ids)
                        .execute()
                    )
                    
                    # 创建 user_id 到 info 的映射
                    info_map = {info["user_id"]: info for info in info_result.data} if info_result.data else {}
                    
                    for user in user_result.data:
                        # 跳过已添加的用户（如果通过ID搜索到的话）
                        if any(r.userId == user["id"] for r in results):
                            continue
                        
                        info = info_map.get(user["id"])
                        if info:
                            results.append(UserInfo(
                                userId=user["id"],
                                infoId=info["id"],
                                username=user["username"],
                                bio=info.get("bio", ""),
                                location=info.get("location", ""),
                                avatarUrl=info.get("avatar_url", ""),
                                coverUrl=info.get("cover_url", "")
                            ))
        except Exception as e:
            print(f"[UserService] search_users error: {e}")
            # 如果搜索失败，返回空列表而不是抛出异常
            return []
        
        return results[:limit]

    def get_privacy_settings(self, user_id: int) -> Optional[UserPrivacySettings]:
        """获取用户隐私设置"""
        info_result = self.db.table("user_info").select("hide_following, hide_followers, hide_likes").eq("user_id", user_id).execute()
        if not info_result.data:
            return None
        info = info_result.data[0]
        
        return UserPrivacySettings(
            userId=user_id,
            hideFollowing=info.get("hide_following", True),
            hideFollowers=info.get("hide_followers", True),
            hideLikes=info.get("hide_likes", True)
        )

    def update_privacy_settings(self, user_id: int, **kwargs) -> Optional[UserPrivacySettings]:
        """更新用户隐私设置"""
        update_data = {}
        
        if "hideFollowing" in kwargs and kwargs["hideFollowing"] is not None:
            update_data["hide_following"] = kwargs["hideFollowing"]
        if "hideFollowers" in kwargs and kwargs["hideFollowers"] is not None:
            update_data["hide_followers"] = kwargs["hideFollowers"]
        if "hideLikes" in kwargs and kwargs["hideLikes"] is not None:
            update_data["hide_likes"] = kwargs["hideLikes"]
        
        if update_data:
            self.db.table("user_info").update(update_data).eq("user_id", user_id).execute()
        
        return self.get_privacy_settings(user_id)


# 单例
user_service = UserService()
