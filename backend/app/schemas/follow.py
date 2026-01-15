"""
关注相关的数据模型
"""
from pydantic import BaseModel
from typing import Optional


class FollowUserRequest(BaseModel):
    """关注用户请求"""
    followerId: int
    targetUserId: int


class FollowingUser(BaseModel):
    """关注的用户信息"""
    userId: int
    username: str
    avatar: str = ""
    bio: str = ""
    location: str = ""
