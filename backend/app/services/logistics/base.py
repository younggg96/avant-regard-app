"""
物流 provider 协议层。各实现仅需满足 LogisticsProvider 协议。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol

from app.schemas.tracking import TrackingStatus


@dataclass
class NormalizedEvent:
    """provider 归一化后的轨迹事件。

    各 provider 拿到原始 payload 后转成这个结构，tracking_service 统一处理。
    """
    occurred_at: str                          # ISO8601
    status_code: TrackingStatus               # 归一化状态码
    description: Optional[str] = None         # 原文："已到达上海转运中心"
    location:    Optional[str] = None         # "上海·徐汇"
    raw:         Dict[str, Any] = field(default_factory=dict)


class LogisticsProvider(Protocol):
    """物流数据源协议。

    各 provider 通常实现以下三个方法之一或全部：
      - `subscribe`: 发货时调用，把运单注册到 provider，让其推送回调。
                     无 push 能力的 provider 可空实现。
      - `query`:     主动拉取（兜底 / 首次发货立即同步一份初始事件）。
      - `parse_webhook`: 处理 provider 推过来的 webhook payload，返回归一化事件。

    `name` 用于：
      - 写入 tracking_events.source / order_shipments.provider_source 字段
      - factory 路由
    """
    name: str

    def subscribe(
        self,
        *,
        carrier: str,
        tracking_no: str,
        shipment_id: int,
    ) -> None:
        """注册推送（如 webhook 订阅）。

        失败应当 raise，让 tracking_service 决定是否回退到 query 模式。
        """
        ...

    def query(
        self,
        *,
        carrier: str,
        tracking_no: str,
    ) -> List[NormalizedEvent]:
        """主动查询轨迹事件。返回按时间正序的归一化事件列表。"""
        ...

    def parse_webhook(
        self,
        *,
        body: Dict[str, Any],
        headers: Optional[Dict[str, str]] = None,
    ) -> List[tuple[str, str, List[NormalizedEvent]]]:
        """解析 webhook payload。

        返回 List of `(carrier, tracking_no, events)` 元组 —
        一次 webhook 可能涉及多个运单（AfterShip 批量推送时会出现）。
        """
        ...
