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
