"""
物流轨迹事件 schemas。

详见 backend/app/db/migrations/070_tracking_events.sql 和
backend/app/services/logistics/。
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TrackingStatus(str, Enum):
    """归一化后的物流状态码。

    各 provider 原始状态码 → 这套统一码，前端 UI / 推送规则只看这套。
    """
    PICKED_UP        = "picked_up"          # 已揽件
    IN_TRANSIT       = "in_transit"         # 运输中（含跨站点流转）
    OUT_FOR_DELIVERY = "out_for_delivery"   # 派送中
    DELIVERED        = "delivered"          # 已签收
    EXCEPTION        = "exception"          # 异常（破损/退件/无人收件）
    RETURNED         = "returned"           # 已退回卖家


# ----------------- Request / response objects -----------------


class TrackingEventCreate(BaseModel):
    """Admin / Mock provider 注入事件用（dev 联调入口）。"""
    occurredAt:  str = Field(..., description="ISO8601, 如 2026-05-23T07:32:00Z")
    statusCode:  TrackingStatus
    description: Optional[str] = Field(None, max_length=500)
    location:    Optional[str] = Field(None, max_length=128)
    source:      Optional[str] = Field("manual", description="kdniao/aftership/mock/manual")
    rawPayload:  Optional[Dict[str, Any]] = None


class TrackingEvent(BaseModel):
    """对外返回的轨迹事件。"""
    id:          int
    shipmentId:  int
    orderId:     int
    occurredAt:  str
    statusCode:  str
    description: Optional[str] = None
    location:    Optional[str] = None
    source:      str = "mock"
    createdAt:   Optional[str] = None


class TrackingFeed(BaseModel):
    """订单详情时间轴一次拿到的所有事件 + 最新摘要。"""
    items:              List[TrackingEvent]
    latestStatusCode:   Optional[str] = None
    latestDescription:  Optional[str] = None
    latestLocation:     Optional[str] = None
    latestEventAt:      Optional[str] = None
    providerSource:     Optional[str] = None
