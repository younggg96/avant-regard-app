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


class ThemePreference(str, Enum):
    SYSTEM = "system"
    LIGHT = "light"
    DARK = "dark"


class CurrencyPreference(str, Enum):
    """用户展示币种偏好。

    后端只透传字符串值；具体符号 / 千分位 / 是否走汇率换算由前端决定。
    数据库 NULL 表示「未显式选择」—— 前端会按 locale 自动决定默认值
    （zh* → CNY，其余 → USD）。
    """

    CNY = "CNY"
    USD = "USD"


class UserInfo(BaseModel):
    """用户信息"""
    userId: int
    infoId: int
    username: str
    bio: str = ""
    location: str = ""
    avatarUrl: str = ""
    coverUrl: str = ""
    primaryTitle: Optional[str] = None
    preferredLanguage: Optional[str] = None
    preferredTheme: ThemePreference = ThemePreference.SYSTEM
    preferredCurrency: Optional[CurrencyPreference] = None


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
    followedBrandIds: List[int] = []
    profileCompleted: bool = False
    userType: str = "USER"


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
    followedBrandIds: Optional[List[int]] = None
    profileCompleted: Optional[bool] = None


class UserPrivacySettings(BaseModel):
    """用户隐私设置"""
    userId: int
    hideFollowing: bool = True
    hideFollowers: bool = True
    hideLikes: bool = True
    hideWishlist: bool = False
    hideSales: bool = False


class UpdatePrivacySettingsRequest(BaseModel):
    """更新隐私设置请求"""
    hideFollowing: Optional[bool] = None
    hideFollowers: Optional[bool] = None
    hideLikes: Optional[bool] = None
    hideWishlist: Optional[bool] = None
    hideSales: Optional[bool] = None


class UpdateLanguageRequest(BaseModel):
    """更新语言偏好请求"""
    language: str = Field(..., pattern="^(zh|en)$")


class UpdateThemeRequest(BaseModel):
    """更新主题偏好请求"""
    theme: ThemePreference


class UpdateCurrencyRequest(BaseModel):
    """更新展示币种偏好请求"""
    currency: CurrencyPreference