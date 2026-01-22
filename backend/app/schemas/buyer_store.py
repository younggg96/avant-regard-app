"""
买手店相关的数据模型
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class Coordinates(BaseModel):
    """坐标"""
    latitude: float
    longitude: float


class BuyerStoreBase(BaseModel):
    """买手店基础模型"""
    name: str = Field(..., description="店铺名称")
    address: str = Field(..., description="详细地址")
    city: str = Field(..., description="所在城市")
    country: str = Field(..., description="所在国家")
    coordinates: Coordinates = Field(..., description="坐标")
    brands: List[str] = Field(default=[], description="销售品牌列表")
    style: List[str] = Field(default=[], description="风格标签列表")
    isOpen: bool = Field(default=True, description="是否营业")
    phone: Optional[List[str]] = Field(default=None, description="联系电话")
    hours: Optional[str] = Field(default=None, description="营业时间")
    rating: Optional[float] = Field(default=None, description="评分")
    description: Optional[str] = Field(default=None, description="店铺描述")
    images: Optional[List[str]] = Field(default=None, description="店铺图片")
    rest: Optional[str] = Field(default=None, description="休息日信息")


class BuyerStoreCreate(BuyerStoreBase):
    """创建买手店请求"""
    id: str = Field(..., description="店铺ID，格式：城市缩写-序号")


class BuyerStoreUpdate(BaseModel):
    """更新买手店请求"""
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    coordinates: Optional[Coordinates] = None
    brands: Optional[List[str]] = None
    style: Optional[List[str]] = None
    isOpen: Optional[bool] = None
    phone: Optional[List[str]] = None
    hours: Optional[str] = None
    rating: Optional[float] = None
    description: Optional[str] = None
    images: Optional[List[str]] = None
    rest: Optional[str] = None


class BuyerStore(BuyerStoreBase):
    """买手店响应"""
    id: str
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class BuyerStoreListResponse(BaseModel):
    """买手店列表响应"""
    stores: List[BuyerStore]
    total: int
    page: int
    pageSize: int


class BuyerStoreFilterParams(BaseModel):
    """买手店筛选参数"""
    country: Optional[str] = None
    city: Optional[str] = None
    brand: Optional[str] = None
    style: Optional[str] = None
    openOnly: Optional[bool] = None
    searchQuery: Optional[str] = None
    page: int = 1
    pageSize: int = 50


class NearbyStoreParams(BaseModel):
    """附近店铺查询参数"""
    latitude: float
    longitude: float
    radius: float = Field(default=50.0, description="搜索半径（公里）")


class BrandRecommendation(BaseModel):
    """品牌推荐响应"""
    stores: List[BuyerStore]
    relatedBrands: List[str]


# ==================== 用户提交买手店相关 ====================


class UserSubmittedStoreCreate(BaseModel):
    """用户提交买手店请求"""
    name: str = Field(..., min_length=1, max_length=200, description="店铺名称")
    address: str = Field(..., min_length=1, description="详细地址")
    city: str = Field(..., min_length=1, max_length=100, description="所在城市")
    country: str = Field(..., min_length=1, max_length=100, description="所在国家")
    latitude: Optional[float] = Field(None, description="纬度")
    longitude: Optional[float] = Field(None, description="经度")
    brands: List[str] = Field(default=[], description="销售品牌列表")
    style: List[str] = Field(default=[], description="风格标签列表")
    phone: List[str] = Field(default=[], description="联系电话")
    hours: Optional[str] = Field(None, max_length=200, description="营业时间")
    description: Optional[str] = Field(None, description="店铺描述")
    images: List[str] = Field(default=[], description="店铺图片URL列表")


class UserSubmittedStore(BaseModel):
    """用户提交的买手店"""
    id: int
    userId: int
    username: str
    userAvatar: Optional[str] = None
    name: str
    address: str
    city: str
    country: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    brands: List[str] = []
    style: List[str] = []
    phone: List[str] = []
    hours: Optional[str] = None
    description: Optional[str] = None
    images: List[str] = []
    status: str  # PENDING, APPROVED, REJECTED
    rejectReason: Optional[str] = None
    reviewedBy: Optional[int] = None
    reviewedAt: Optional[str] = None
    approvedStoreId: Optional[str] = None
    createdAt: str
    updatedAt: str


class ReviewSubmissionRequest(BaseModel):
    """审核用户提交的买手店请求"""
    status: str = Field(..., description="审核状态: APPROVED 或 REJECTED")
    rejectReason: Optional[str] = Field(None, description="拒绝原因（拒绝时必填）")
    storeId: Optional[str] = Field(None, description="通过时分配的店铺ID")


# ==================== 买手店评论相关 ====================


class BuyerStoreCommentCreate(BaseModel):
    """创建买手店评论请求"""
    userId: int
    content: str = Field(..., min_length=1, max_length=1000, description="评论内容")
    parentId: Optional[int] = Field(None, description="父评论ID，为空表示顶级评论")
    replyToUserId: Optional[int] = Field(None, description="回复的用户ID")


class BuyerStoreCommentReply(BaseModel):
    """买手店评论回复"""
    id: int
    storeId: str
    parentId: int
    userId: int
    username: str
    userAvatar: Optional[str] = None
    replyToUserId: Optional[int] = None
    replyToUsername: Optional[str] = None
    content: str
    likeCount: int = 0
    createdAt: str
    updatedAt: str


class BuyerStoreComment(BaseModel):
    """买手店评论"""
    id: int
    storeId: str
    userId: int
    username: str
    userAvatar: Optional[str] = None
    content: str
    likeCount: int = 0
    replyCount: int = 0
    replies: List[BuyerStoreCommentReply] = []
    createdAt: str
    updatedAt: str


# ==================== 买手店评分相关 ====================


class BuyerStoreRatingCreate(BaseModel):
    """创建/更新买手店评分请求"""
    userId: int
    rating: int = Field(..., ge=1, le=5, description="评分 1-5 星")


class BuyerStoreRating(BaseModel):
    """买手店评分"""
    id: int
    storeId: str
    userId: int
    username: str
    userAvatar: Optional[str] = None
    rating: int
    createdAt: str
    updatedAt: str


class BuyerStoreRatingStats(BaseModel):
    """买手店评分统计"""
    storeId: str
    averageRating: float
    ratingCount: int
    fiveStarCount: int = 0
    fourStarCount: int = 0
    threeStarCount: int = 0
    twoStarCount: int = 0
    oneStarCount: int = 0


# ==================== 买手店扩展信息 ====================


class BuyerStoreDetail(BuyerStore):
    """买手店详情（含社区数据）"""
    averageRating: Optional[float] = None
    ratingCount: int = 0
    commentCount: int = 0
    favoriteCount: int = 0
    isFavorited: bool = False
    userRating: Optional[int] = None


# ==================== 评论提示建议 ====================


COMMENT_SUGGESTIONS = [
    "这家店最近在打折，折扣力度很大，值得一去！",
    "这家店最近暂时关门/装修中，去之前建议先确认营业时间",
    "店员服务态度很好，会耐心推荐适合的款式",
    "店内货品已经换新了，有很多新到的单品值得看看",
    "这家店的 XX 品牌货最全/价格最实惠",
]
