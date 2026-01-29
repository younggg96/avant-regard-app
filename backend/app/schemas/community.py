"""
社区相关的数据模型
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import datetime


class CommunityCategory(str, Enum):
    """社区分类"""
    GENERAL = "GENERAL"
    FASHION = "FASHION"
    LIFESTYLE = "LIFESTYLE"
    BEAUTY = "BEAUTY"
    CULTURE = "CULTURE"


class Community(BaseModel):
    """社区响应"""
    id: int
    name: str
    slug: str
    description: str = ""
    iconUrl: str = ""
    coverUrl: str = ""
    category: CommunityCategory = CommunityCategory.GENERAL
    isOfficial: bool = False
    isActive: bool = True
    memberCount: int = 0
    postCount: int = 0
    sortOrder: int = 0
    createdAt: str
    updatedAt: str
    # 当前用户是否关注
    isFollowing: Optional[bool] = None


class CommunityListResponse(BaseModel):
    """社区列表响应"""
    popular: List[Community]  # 热门社区（按成员数/帖子数排序）
    following: List[Community]  # 我关注的社区
    all: List[Community]  # 所有社区


class CreateCommunityRequest(BaseModel):
    """创建社区请求（管理员）"""
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r'^[a-z0-9-]+$')
    description: str = ""
    iconUrl: str = ""
    coverUrl: str = ""
    category: CommunityCategory = CommunityCategory.GENERAL
    isOfficial: bool = False
    sortOrder: int = 0


class UpdateCommunityRequest(BaseModel):
    """更新社区请求（管理员）"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    iconUrl: Optional[str] = None
    coverUrl: Optional[str] = None
    category: Optional[CommunityCategory] = None
    isOfficial: Optional[bool] = None
    isActive: Optional[bool] = None
    sortOrder: Optional[int] = None


class CommunityStats(BaseModel):
    """社区统计信息"""
    memberCount: int
    postCount: int
    todayPostCount: int = 0
    weekPostCount: int = 0
