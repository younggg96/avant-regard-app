"""
品牌相关的数据模型
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class Brand(BaseModel):
    """品牌响应"""
    id: int
    name: str
    category: Optional[str] = None
    foundedYear: Optional[str] = None
    founder: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    coverImage: Optional[str] = None
    coverImages: Optional[List[str]] = None
    latestSeason: Optional[str] = None
    vogueSlug: Optional[str] = None
    vogueUrl: Optional[str] = None
    contributorName: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class BrandImage(BaseModel):
    """品牌图片"""
    id: int
    brandId: int
    brandName: Optional[str] = None
    imageUrl: str
    sortOrder: int = 0
    status: str = "PENDING"
    isSelected: bool = False
    uploadedBy: Optional[int] = None
    createdAt: Optional[str] = None


class BrandListResponse(BaseModel):
    """品牌列表响应"""
    brands: List[Brand]
    total: int
    page: int
    pageSize: int


class BrandSearchParams(BaseModel):
    """品牌搜索参数"""
    keyword: Optional[str] = None
    category: Optional[str] = None
    page: int = 1
    pageSize: int = 50


class BrandSubmitRequest(BaseModel):
    """用户提交品牌请求"""
    name: str
    category: Optional[str] = None
    foundedYear: Optional[str] = None
    founder: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    coverImage: Optional[str] = None


class BrandSubmission(BaseModel):
    """品牌提交记录响应"""
    id: int
    userId: int
    name: str
    category: Optional[str] = None
    foundedYear: Optional[str] = None
    founder: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    coverImage: Optional[str] = None
    status: str = "PENDING"
    rejectReason: Optional[str] = None
    reviewedAt: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
