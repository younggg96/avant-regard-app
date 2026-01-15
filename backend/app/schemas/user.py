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


class UserProfileInfo(BaseModel):
    """用户完整资料"""
    userId: int
    infoId: int
    username: str
    bio: str = ""
    location: str = ""
    avatarUrl: str = ""
    gender: Gender = Gender.OTHER
    age: int = 0
    preference: str = ""


class UpdateUserInfoRequest(BaseModel):
    """更新用户信息请求"""
    username: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    avatarUrl: Optional[str] = None


class UpdateUserProfileRequest(BaseModel):
    """更新用户资料请求"""
    username: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    avatarUrl: Optional[str] = None
    gender: Optional[Gender] = None
    age: Optional[int] = None
    preference: Optional[str] = None
