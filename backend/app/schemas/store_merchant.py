"""
商家入驻系统相关的数据模型
包含：商家认证、公告、活动、折扣、Banner
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ==================== 枚举类型 ====================

class MerchantStatus(str, Enum):
    """商家认证状态"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"


class MerchantLevel(str, Enum):
    """商家等级"""
    BASIC = "BASIC"
    PREMIUM = "PREMIUM"
    VIP = "VIP"


class ContentStatus(str, Enum):
    """内容状态"""
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    HIDDEN = "HIDDEN"
    ENDED = "ENDED"


class ActivityType(str, Enum):
    """活动类型"""
    TRUNK_SHOW = "TRUNK_SHOW"
    POP_UP = "POP_UP"
    SALE = "SALE"
    EVENT = "EVENT"
    OTHER = "OTHER"


class DiscountType(str, Enum):
    """折扣类型"""
    PERCENTAGE = "PERCENTAGE"
    FIXED = "FIXED"
    SPECIAL = "SPECIAL"


class LinkType(str, Enum):
    """链接类型"""
    INTERNAL = "INTERNAL"
    EXTERNAL = "EXTERNAL"
    NONE = "NONE"


# ==================== 商家认证相关 ====================

class StoreMerchantCreate(BaseModel):
    """商家入驻申请"""
    storeId: str = Field(..., description="关联的买手店ID")
    contactName: Optional[str] = Field(None, max_length=100, description="联系人姓名")
    contactPhone: Optional[str] = Field(None, max_length=50, description="联系电话")
    contactEmail: Optional[str] = Field(None, max_length=200, description="联系邮箱")
    businessLicense: Optional[str] = Field(None, description="营业执照图片URL")


class StoreMerchantUpdate(BaseModel):
    """更新商家信息"""
    contactName: Optional[str] = Field(None, max_length=100)
    contactPhone: Optional[str] = Field(None, max_length=50)
    contactEmail: Optional[str] = Field(None, max_length=200)
    businessLicense: Optional[str] = None


class StoreMerchantReview(BaseModel):
    """审核商家申请"""
    status: MerchantStatus = Field(..., description="审核状态")
    rejectReason: Optional[str] = Field(None, description="拒绝原因")


class StoreMerchantAdminUpdate(BaseModel):
    """管理员更新商家信息"""
    status: Optional[MerchantStatus] = Field(None, description="商家状态")
    merchantLevel: Optional[MerchantLevel] = Field(None, description="商家等级")
    canPostBanner: Optional[bool] = Field(None, description="发布Banner权限")
    canPostAnnouncement: Optional[bool] = Field(None, description="发布公告权限")
    canPostActivity: Optional[bool] = Field(None, description="发布活动权限")
    canPostDiscount: Optional[bool] = Field(None, description="发布折扣权限")


class BuyerStoreUpdate(BaseModel):
    """商家更新店铺信息"""
    name: Optional[str] = Field(None, max_length=200, description="店铺名称")
    address: Optional[str] = Field(None, description="详细地址")
    phone: Optional[List[str]] = Field(None, description="联系电话列表")
    hours: Optional[str] = Field(None, max_length=100, description="营业时间")
    description: Optional[str] = Field(None, description="店铺描述")
    images: Optional[List[str]] = Field(None, description="店铺图片列表")
    rest: Optional[str] = Field(None, max_length=100, description="休息日信息")
    brands: Optional[List[str]] = Field(None, description="销售品牌列表")
    style: Optional[List[str]] = Field(None, description="风格标签列表")


class BuyerStore(BaseModel):
    """店铺信息"""
    id: str
    name: str
    address: str
    city: str
    country: str
    latitude: float
    longitude: float
    brands: List[str] = []
    style: List[str] = []
    isOpen: bool = True
    phone: List[str] = []
    hours: Optional[str] = None
    rating: Optional[float] = None
    description: Optional[str] = None
    images: List[str] = []
    rest: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class StoreMerchant(BaseModel):
    """商家信息"""
    id: int
    storeId: str
    userId: int
    contactName: Optional[str] = None
    contactPhone: Optional[str] = None
    contactEmail: Optional[str] = None
    businessLicense: Optional[str] = None
    status: str
    rejectReason: Optional[str] = None
    reviewedBy: Optional[int] = None
    reviewedAt: Optional[str] = None
    merchantLevel: str = "BASIC"
    canPostBanner: bool = True
    canPostAnnouncement: bool = True
    canPostActivity: bool = True
    canPostDiscount: bool = True
    createdAt: str
    updatedAt: str


# ==================== 公告相关 ====================

class StoreAnnouncementCreate(BaseModel):
    """创建公告"""
    title: str = Field(..., min_length=1, max_length=200, description="公告标题")
    content: str = Field(..., min_length=1, description="公告内容")
    isPinned: bool = Field(default=False, description="是否置顶")
    status: ContentStatus = Field(default=ContentStatus.PUBLISHED, description="发布状态")
    startTime: Optional[str] = Field(None, description="开始时间")
    endTime: Optional[str] = Field(None, description="结束时间")


class StoreAnnouncementUpdate(BaseModel):
    """更新公告"""
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = None
    isPinned: Optional[bool] = None
    status: Optional[ContentStatus] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None


class StoreAnnouncement(BaseModel):
    """公告"""
    id: int
    storeId: str
    merchantId: int
    title: str
    content: str
    isPinned: bool = False
    status: str
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    createdAt: str
    updatedAt: str


# ==================== Banner 相关 ====================

class StoreBannerCreate(BaseModel):
    """创建 Banner"""
    title: Optional[str] = Field(None, max_length=200, description="Banner标题")
    imageUrl: str = Field(..., description="图片URL")
    linkUrl: Optional[str] = Field(None, description="点击跳转链接")
    linkType: LinkType = Field(default=LinkType.NONE, description="链接类型")
    sortOrder: int = Field(default=0, description="排序")
    status: ContentStatus = Field(default=ContentStatus.PUBLISHED, description="发布状态")
    startTime: Optional[str] = Field(None, description="开始时间")
    endTime: Optional[str] = Field(None, description="结束时间")


class StoreBannerUpdate(BaseModel):
    """更新 Banner"""
    title: Optional[str] = Field(None, max_length=200)
    imageUrl: Optional[str] = None
    linkUrl: Optional[str] = None
    linkType: Optional[LinkType] = None
    sortOrder: Optional[int] = None
    status: Optional[ContentStatus] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None


class StoreBanner(BaseModel):
    """Banner"""
    id: int
    storeId: str
    merchantId: int
    title: Optional[str] = None
    imageUrl: str
    linkUrl: Optional[str] = None
    linkType: str = "NONE"
    sortOrder: int = 0
    status: str
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    clickCount: int = 0
    viewCount: int = 0
    createdAt: str
    updatedAt: str


# ==================== 活动相关 ====================

class StoreActivityCreate(BaseModel):
    """创建活动"""
    title: str = Field(..., min_length=1, max_length=200, description="活动标题")
    description: Optional[str] = Field(None, description="活动描述")
    coverImage: Optional[str] = Field(None, description="封面图片")
    images: List[str] = Field(default=[], description="活动图片列表")
    activityStartTime: str = Field(..., description="活动开始时间")
    activityEndTime: str = Field(..., description="活动结束时间")
    location: Optional[str] = Field(None, max_length=500, description="活动地点")
    activityType: ActivityType = Field(default=ActivityType.EVENT, description="活动类型")
    status: ContentStatus = Field(default=ContentStatus.PUBLISHED, description="发布状态")
    needRegistration: bool = Field(default=False, description="是否需要报名")
    registrationLimit: Optional[int] = Field(None, description="报名人数限制")


class StoreActivityUpdate(BaseModel):
    """更新活动"""
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    coverImage: Optional[str] = None
    images: Optional[List[str]] = None
    activityStartTime: Optional[str] = None
    activityEndTime: Optional[str] = None
    location: Optional[str] = Field(None, max_length=500)
    activityType: Optional[ActivityType] = None
    status: Optional[ContentStatus] = None
    needRegistration: Optional[bool] = None
    registrationLimit: Optional[int] = None


class StoreActivity(BaseModel):
    """活动"""
    id: int
    storeId: str
    merchantId: int
    title: str
    description: Optional[str] = None
    coverImage: Optional[str] = None
    images: List[str] = []
    activityStartTime: str
    activityEndTime: str
    location: Optional[str] = None
    activityType: str = "EVENT"
    status: str
    needRegistration: bool = False
    registrationLimit: Optional[int] = None
    registrationCount: int = 0
    createdAt: str
    updatedAt: str


# ==================== 折扣相关 ====================

class StoreDiscountCreate(BaseModel):
    """创建折扣"""
    title: str = Field(..., min_length=1, max_length=200, description="折扣标题")
    description: Optional[str] = Field(None, description="折扣描述")
    coverImage: Optional[str] = Field(None, description="封面图片")
    discountType: DiscountType = Field(..., description="折扣类型")
    discountValue: Optional[str] = Field(None, max_length=100, description="折扣值")
    applicableBrands: List[str] = Field(default=[], description="适用品牌")
    applicableCategories: List[str] = Field(default=[], description="适用品类")
    discountStartTime: str = Field(..., description="折扣开始时间")
    discountEndTime: str = Field(..., description="折扣结束时间")
    minPurchaseAmount: Optional[float] = Field(None, description="最低消费金额")
    termsAndConditions: Optional[str] = Field(None, description="使用条款")
    status: ContentStatus = Field(default=ContentStatus.PUBLISHED, description="发布状态")
    needCode: bool = Field(default=False, description="是否需要优惠码")
    discountCode: Optional[str] = Field(None, max_length=50, description="优惠码")


class StoreDiscountUpdate(BaseModel):
    """更新折扣"""
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    coverImage: Optional[str] = None
    discountType: Optional[DiscountType] = None
    discountValue: Optional[str] = Field(None, max_length=100)
    applicableBrands: Optional[List[str]] = None
    applicableCategories: Optional[List[str]] = None
    discountStartTime: Optional[str] = None
    discountEndTime: Optional[str] = None
    minPurchaseAmount: Optional[float] = None
    termsAndConditions: Optional[str] = None
    status: Optional[ContentStatus] = None
    needCode: Optional[bool] = None
    discountCode: Optional[str] = Field(None, max_length=50)


class StoreDiscount(BaseModel):
    """折扣"""
    id: int
    storeId: str
    merchantId: int
    title: str
    description: Optional[str] = None
    coverImage: Optional[str] = None
    discountType: str
    discountValue: Optional[str] = None
    applicableBrands: List[str] = []
    applicableCategories: List[str] = []
    discountStartTime: str
    discountEndTime: str
    minPurchaseAmount: Optional[float] = None
    termsAndConditions: Optional[str] = None
    status: str
    needCode: bool = False
    discountCode: Optional[str] = None
    createdAt: str
    updatedAt: str


# ==================== 活动报名相关 ====================

class ActivityRegistrationCreate(BaseModel):
    """活动报名"""
    contactName: Optional[str] = Field(None, max_length=100, description="联系人姓名")
    contactPhone: Optional[str] = Field(None, max_length=50, description="联系电话")
    note: Optional[str] = Field(None, description="备注")


class ActivityRegistration(BaseModel):
    """活动报名信息"""
    id: int
    activityId: int
    userId: int
    username: Optional[str] = None
    userAvatar: Optional[str] = None
    contactName: Optional[str] = None
    contactPhone: Optional[str] = None
    note: Optional[str] = None
    status: str
    createdAt: str
    updatedAt: str


# ==================== 店铺商家信息汇总 ====================

class StoreMerchantContent(BaseModel):
    """店铺商家发布的所有内容汇总"""
    isMerchant: bool = False  # 该店铺是否有认证商家
    merchantInfo: Optional[StoreMerchant] = None
    banners: List[StoreBanner] = []
    announcements: List[StoreAnnouncement] = []
    activities: List[StoreActivity] = []
    discounts: List[StoreDiscount] = []
