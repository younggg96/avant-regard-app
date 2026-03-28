"""
评论相关的数据模型
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List


class CommentReply(BaseModel):
    """评论回复"""
    id: int
    postId: int
    parentId: int
    userId: int
    username: str
    userAvatar: Optional[str] = None
    replyToUserId: Optional[int] = None
    replyToUsername: Optional[str] = None
    content: str
    likeCount: int = 0
    isLiked: bool = False
    createdAt: str
    updatedAt: str


class PostComment(BaseModel):
    """帖子评论"""
    id: int
    postId: int
    userId: int
    username: str
    userAvatar: Optional[str] = None
    content: str
    likeCount: int = 0
    isLiked: bool = False
    replyCount: int = 0
    replies: List[CommentReply] = []
    createdAt: str
    updatedAt: str


class CreateCommentRequest(BaseModel):
    """创建评论请求"""
    userId: int
    content: str = Field(..., min_length=1, max_length=1000)
    parentId: Optional[int] = None  # 父评论ID，为空表示顶级评论
    replyToUserId: Optional[int] = None  # 回复的用户ID


class ImageReview(BaseModel):
    """秀场图片评论"""
    id: int
    userId: int
    username: str
    imageId: int
    rating: float
    content: str
    createdAt: str
    updatedAt: str


class CreateImageReviewRequest(BaseModel):
    """创建秀场图片评论请求"""
    userId: int
    rating: float = Field(..., ge=0.5, le=5)
    content: str = Field(..., min_length=1, max_length=1000)

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: float) -> float:
        if (v * 2) % 1 != 0:
            raise ValueError("Rating must be in 0.5 increments (e.g. 0.5, 1, 1.5, ..., 5)")
        return v
