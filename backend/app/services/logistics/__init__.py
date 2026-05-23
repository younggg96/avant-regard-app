"""
物流轨迹聚合层。

抽象目标：业务层不关心承运商，只调用 `tracking_service.ingest_event(...)` /
`tracking_service.on_shipment_created(...)`，后台聚合 provider 负责接顺丰 /
AfterShip 等真实数据源。

各 provider 仅需实现 `LogisticsProvider` 协议；新增 provider 时只需在
`factory.py` 里注册一行，业务侧无感知。
"""
from .base import (
    LogisticsProvider,
    NormalizedEvent,
)
from .factory import (
    get_provider_for_carrier,
    get_provider_by_name,
)
from .service import tracking_service

__all__ = [
    "LogisticsProvider",
    "NormalizedEvent",
    "get_provider_for_carrier",
    "get_provider_by_name",
    "tracking_service",
]
