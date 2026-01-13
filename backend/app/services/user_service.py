"""
用户服务
"""
from typing import Optional, List
from app.db.supabase import get_supabase
from app.schemas.user import UserInfo, UserProfileInfo, DesignerInfo


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
        
        # 获取用户偏好的设计师
        designers = self._get_user_preferred_designers(user_id)
        
        return UserProfileInfo(
            userId=user["id"],
            infoId=info["id"],
            username=user["username"],
            bio=info.get("bio", ""),
            location=info.get("location", ""),
            avatarUrl=info.get("avatar_url", ""),
            gender=info.get("gender", "OTHER"),
            age=info.get("age", 0),
            preference=info.get("preference", ""),
            possibleDesigners=designers
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
        
        # 更新偏好设计师
        if "possibleDesignerIds" in kwargs and kwargs["possibleDesignerIds"] is not None:
            self._update_user_preferred_designers(user_id, kwargs["possibleDesignerIds"])
        
        return self.get_user_profile(user_id)

    def _get_user_preferred_designers(self, user_id: int) -> List[DesignerInfo]:
        """获取用户偏好的设计师列表"""
        result = self.db.table("user_preferred_designers").select(
            "designer_id, designers(id, name, slug, designer_url)"
        ).eq("user_id", user_id).execute()
        
        designers = []
        for item in result.data or []:
            d = item.get("designers")
            if d:
                designers.append(DesignerInfo(
                    id=d["id"],
                    name=d["name"],
                    slug=d["slug"],
                    designerUrl=d.get("designer_url", "")
                ))
        return designers

    def _update_user_preferred_designers(self, user_id: int, designer_ids: List[int]):
        """更新用户偏好的设计师"""
        # 删除旧的偏好
        self.db.table("user_preferred_designers").delete().eq("user_id", user_id).execute()
        
        # 插入新的偏好
        if designer_ids:
            records = [{"user_id": user_id, "designer_id": did} for did in designer_ids]
            self.db.table("user_preferred_designers").insert(records).execute()

    def upload_avatar(self, user_id: int, avatar_url: str) -> Optional[UserInfo]:
        """更新用户头像"""
        self.db.table("user_info").update({"avatar_url": avatar_url}).eq("user_id", user_id).execute()
        return self.get_user_info(user_id)


# 单例
user_service = UserService()
