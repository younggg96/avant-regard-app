"""
PRD 模块四 · 用户常用地址簿 schemas。

`full_text` 是地址簿与订单解耦的"瞬时快照"字段:
下单时直接写到 orders.shipping_address_json 后,用户之后修改/删除地址簿条目
不会影响已下单的订单。
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class UserAddress(BaseModel):
    id: int
    receiverName: str
    phone: str
    country: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    detail: Optional[str] = None
    fullText: str
    postalCode: Optional[str] = None
    label: Optional[str] = None
    isDefault: bool = False
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class UserAddressCreate(BaseModel):
    receiverName: str = Field(..., min_length=1, max_length=40)
    phone: str = Field(..., min_length=5, max_length=24)
    country: Optional[str] = Field(None, max_length=40)
    province: Optional[str] = Field(None, max_length=40)
    city: Optional[str] = Field(None, max_length=40)
    district: Optional[str] = Field(None, max_length=40)
    detail: Optional[str] = Field(None, max_length=200)
    fullText: Optional[str] = Field(
        None,
        max_length=400,
        description="地址纯文本。前端可拼接 province+city+district+detail 后传入,后端缺省时按此规则拼。",
    )
    postalCode: Optional[str] = Field(None, max_length=20)
    label: Optional[str] = Field(None, max_length=20)
    isDefault: bool = False


class UserAddressUpdate(BaseModel):
    receiverName: Optional[str] = Field(None, min_length=1, max_length=40)
    phone: Optional[str] = Field(None, min_length=5, max_length=24)
    country: Optional[str] = Field(None, max_length=40)
    province: Optional[str] = Field(None, max_length=40)
    city: Optional[str] = Field(None, max_length=40)
    district: Optional[str] = Field(None, max_length=40)
    detail: Optional[str] = Field(None, max_length=200)
    fullText: Optional[str] = Field(None, max_length=400)
    postalCode: Optional[str] = Field(None, max_length=20)
    label: Optional[str] = Field(None, max_length=20)
    isDefault: Optional[bool] = None
