"""
关注相关的数据模型
"""
from pydantic import BaseModel
from typing import Optional, List


class FollowUserRequest(BaseModel):
    """关注用户请求"""
    followerId: int
    targetUserId: int


class FollowBrandRequest(BaseModel):
    """关注品牌请求"""
    userId: int
    brandId: int


class BatchFollowBrandsRequest(BaseModel):
    """批量关注品牌请求"""
    userId: int
    brandIds: List[int]


class FollowingUser(BaseModel):
    """关注的用户信息"""
    userId: int
    username: str
    avatar: str = ""
    bio: str = ""
    location: str = ""


class FollowingBrand(BaseModel):
    """关注的品牌信息"""
    brandId: int
    name: str
    category: str = ""
    coverImage: str = ""
    country: str = ""
    followersCount: int = 0
