"""
用户相关的数据模型
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class Gender(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class UserInfo(BaseModel):
    """用户信息"""
    userId: int
    infoId: int
    username: str
    bio: str = ""
    location: str = ""
    avatarUrl: str = ""
    coverUrl: str = ""


class UserProfileInfo(BaseModel):
    """用户完整资料"""
    userId: int
    infoId: int
    username: str
    bio: str = ""
    location: str = ""
    avatarUrl: str = ""
    coverUrl: str = ""
    gender: Gender = Gender.OTHER
    age: int = 0
    preference: str = ""
    favoriteBrandIds: List[int] = []
    profileCompleted: bool = False  # 是否已完善资料


class UpdateUserInfoRequest(BaseModel):
    """更新用户信息请求"""
    username: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    avatarUrl: Optional[str] = None
    coverUrl: Optional[str] = None


class UpdateUserProfileRequest(BaseModel):
    """更新用户资料请求"""
    username: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    avatarUrl: Optional[str] = None
    coverUrl: Optional[str] = None
    gender: Optional[Gender] = None
    age: Optional[int] = None
    preference: Optional[str] = None
    favoriteBrandIds: Optional[List[int]] = None
    profileCompleted: Optional[bool] = None  # 是否已完善资料


class UserPrivacySettings(BaseModel):
    """用户隐私设置"""
    userId: int
    hideFollowing: bool = True
    hideFollowers: bool = True
    hideLikes: bool = True


class UpdatePrivacySettingsRequest(BaseModel):
    """更新隐私设置请求"""
    hideFollowing: Optional[bool] = None
    hideFollowers: Optional[bool] = None
    hideLikes: Optional[bool] = None