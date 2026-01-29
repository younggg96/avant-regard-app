"""
Banner 数据模型
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class BannerBase(BaseModel):
    """Banner 基础模型"""
    title: str = Field(..., max_length=200, description="Banner 标题")
    subtitle: Optional[str] = Field(None, max_length=500, description="副标题/描述")
    image_url: str = Field(..., description="图片 URL")
    link_type: str = Field("NONE", description="链接类型: NONE, POST, BRAND, EXTERNAL, SHOW")
    link_value: Optional[str] = Field(None, description="链接值")
    sort_order: int = Field(0, description="排序顺序")
    is_active: bool = Field(True, description="是否启用")
    start_time: Optional[datetime] = Field(None, description="开始展示时间")
    end_time: Optional[datetime] = Field(None, description="结束展示时间")


class BannerCreate(BannerBase):
    """创建 Banner 请求模型"""
    pass


class BannerUpdate(BaseModel):
    """更新 Banner 请求模型"""
    title: Optional[str] = Field(None, max_length=200)
    subtitle: Optional[str] = Field(None, max_length=500)
    image_url: Optional[str] = None
    link_type: Optional[str] = None
    link_value: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class Banner(BannerBase):
    """Banner 响应模型"""
    id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BannerResponse(BaseModel):
    """前端 Banner 响应模型（驼峰命名）"""
    id: int
    title: str
    subtitle: Optional[str]
    imageUrl: str
    linkType: str
    linkValue: Optional[str]
    sortOrder: int
    isActive: bool
    startTime: Optional[str]
    endTime: Optional[str]
    createdBy: Optional[int]
    createdAt: str
    updatedAt: str
