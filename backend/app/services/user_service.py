"""
用户服务
"""
from typing import Optional, List
from app.db.supabase import get_supabase
from app.schemas.user import UserInfo, UserProfileInfo


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
            avatarUrl=info.get("avatar_url", "")
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
        
        return UserProfileInfo(
            userId=user["id"],
            infoId=info["id"],
            username=user["username"],
            bio=info.get("bio", ""),
            location=info.get("location", ""),
            avatarUrl=info.get("avatar_url", ""),
            gender=info.get("gender", "OTHER"),
            age=info.get("age", 0),
            preference=info.get("preference", "")
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
        
        return self.get_user_profile(user_id)

    def upload_avatar(self, user_id: int, avatar_url: str) -> Optional[UserInfo]:
        """更新用户头像"""
        self.db.table("user_info").update({"avatar_url": avatar_url}).eq("user_id", user_id).execute()
        return self.get_user_info(user_id)

    def search_users(self, keyword: str, limit: int = 20) -> List[UserInfo]:
        """
        搜索用户（支持用户名模糊搜索和用户ID精确搜索）
        """
        results = []
        
        # 尝试按用户ID精确搜索
        if keyword.isdigit():
            user_id = int(keyword)
            user_info = self.get_user_info(user_id)
            if user_info:
                results.append(user_info)
        
        # 按用户名模糊搜索
        user_result = (
            self.db.table("users")
            .select("id, username")
            .ilike("username", f"%{keyword}%")
            .limit(limit)
            .execute()
        )
        
        if user_result.data:
            for user in user_result.data:
                # 跳过已添加的用户（如果通过ID搜索到的话）
                if any(r.userId == user["id"] for r in results):
                    continue
                    
                # 获取用户详细信息
                info_result = (
                    self.db.table("user_info")
                    .select("*")
                    .eq("user_id", user["id"])
                    .execute()
                )
                
                if info_result.data:
                    info = info_result.data[0]
                    results.append(UserInfo(
                        userId=user["id"],
                        infoId=info["id"],
                        username=user["username"],
                        bio=info.get("bio", ""),
                        location=info.get("location", ""),
                        avatarUrl=info.get("avatar_url", "")
                    ))
        
        return results[:limit]


# 单例
user_service = UserService()
