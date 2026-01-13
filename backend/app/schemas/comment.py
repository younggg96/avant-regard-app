"""
评论相关的数据模型
"""
from pydantic import BaseModel, Field
from typing import Optional


class PostComment(BaseModel):
    """帖子评论"""
    id: int
    postId: int
    userId: int
    username: str
    content: str
    likeCount: int = 0
    createdAt: str
    updatedAt: str


class CreateCommentRequest(BaseModel):
    """创建评论请求"""
    userId: int
    content: str = Field(..., min_length=1, max_length=1000)


class ImageReview(BaseModel):
    """秀场图片评论"""
    id: int
    userId: int
    username: str
    imageId: int
    rating: int
    content: str
    createdAt: str
    updatedAt: str


class CreateImageReviewRequest(BaseModel):
    """创建秀场图片评论请求"""
    userId: int
    rating: int = Field(..., ge=1, le=5)
    content: str = Field(..., min_length=1, max_length=1000)
