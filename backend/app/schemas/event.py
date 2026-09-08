"""
活动日历 Schemas (PRD 论坛改造 M1)
"""
from enum import Enum
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class EventType(str, Enum):
    MARKET = "MARKET"          # 市集
    SALE = "SALE"              # 特卖会
    EXHIBITION = "EXHIBITION"  # 展览
    POPUP = "POPUP"            # 快闪
    ONLINE = "ONLINE"          # 线上


class EventStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ENDED = "ENDED"      # 活动回顾
    HIDDEN = "HIDDEN"


# ---------------------------------------------------------------------------
# 输入
# ---------------------------------------------------------------------------
class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = ""
    coverImage: Optional[str] = None
    images: List[str] = []
    eventType: EventType = EventType.MARKET
    startAt: datetime
    endAt: datetime
    isOnline: bool = False
    locationName: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    storeId: Optional[str] = None
    organizer: Optional[str] = None
    linkUrl: Optional[str] = None
    brandIds: List[int] = []
    status: EventStatus = EventStatus.PUBLISHED


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    coverImage: Optional[str] = None
    images: Optional[List[str]] = None
    eventType: Optional[EventType] = None
    startAt: Optional[datetime] = None
    endAt: Optional[datetime] = None
    isOnline: Optional[bool] = None
    locationName: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    storeId: Optional[str] = None
    organizer: Optional[str] = None
    linkUrl: Optional[str] = None
    brandIds: Optional[List[int]] = None
    status: Optional[EventStatus] = None


class EventCommentCreate(BaseModel):
    content: str = Field("", max_length=2000)
    rating: Optional[int] = Field(None, ge=1, le=5)
    images: List[str] = []
    archiveItemId: Optional[int] = None


# ---------------------------------------------------------------------------
# 输出
# ---------------------------------------------------------------------------
class EventSummary(BaseModel):
    """列表 / 日历弹层用的精简卡片"""
    id: int
    title: str
    coverImage: Optional[str] = None
    eventType: EventType
    startAt: datetime
    endAt: datetime
    isOnline: bool = False
    locationName: Optional[str] = None
    city: Optional[str] = None
    organizer: Optional[str] = None
    status: EventStatus
    favoriteCount: int = 0
    reservationCount: int = 0
    commentCount: int = 0
    isFavorited: bool = False
    isReserved: bool = False


class EventStoreBrief(BaseModel):
    id: str
    name: str
    city: Optional[str] = None
    address: Optional[str] = None


class EventDetail(EventSummary):
    description: str = ""
    images: List[str] = []
    address: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    storeId: Optional[str] = None
    store: Optional[EventStoreBrief] = None
    linkUrl: Optional[str] = None
    brandIds: List[int] = []
    organizerUserId: Optional[int] = None
    createdBy: Optional[int] = None
    createdAt: datetime
    updatedAt: datetime


class EventCalendarDay(BaseModel):
    """日历一格：某天有哪些类型的活动、是否有收藏"""
    date: str                      # YYYY-MM-DD
    eventTypes: List[EventType]    # 去重后的类型（用于分色圆圈，最多两色）
    eventIds: List[int]
    hasFavorite: bool = False
    hasReserved: bool = False


class EventCalendarResponse(BaseModel):
    month: str                     # YYYY-MM
    days: List[EventCalendarDay]
    events: List[EventSummary]     # 当月所有活动（前端点日期时本地过滤）


class EventCommentUser(BaseModel):
    id: int
    username: str
    avatarUrl: Optional[str] = None


class EventCommentArchiveBrief(BaseModel):
    id: int
    title: Optional[str] = None
    brandName: Optional[str] = None
    photo: Optional[str] = None


class EventComment(BaseModel):
    id: int
    eventId: int
    user: EventCommentUser
    content: str
    rating: Optional[int] = None
    images: List[str] = []
    archiveItem: Optional[EventCommentArchiveBrief] = None
    createdAt: datetime
