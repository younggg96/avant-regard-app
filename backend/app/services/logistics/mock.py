"""
Mock 物流 provider —— 开发联调 / 真物流方接入前的占位实现。

行为：
  - subscribe / query / parse_webhook 都不外发请求；
  - 业务层只能通过 Admin 入口 (`POST /admin/orders/:id/tracking-events`) 注事件。
  - query() 返回空，触发兜底 cron 时跳过。
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .base import LogisticsProvider, NormalizedEvent


class MockLogisticsProvider:
    name: str = "mock"

    def subscribe(
        self, *, carrier: str, tracking_no: str, shipment_id: int
    ) -> None:
        # 真 provider 此处会调 API 注册 webhook；Mock 直接返回。
        print(
            f"[logistics.mock] subscribe carrier={carrier} tracking_no={tracking_no} "
            f"shipment_id={shipment_id}"
        )

    def query(
        self, *, carrier: str, tracking_no: str
    ) -> List[NormalizedEvent]:
        # 真 provider 会调 API 拉轨迹；Mock 不产事件。
        return []

    def parse_webhook(
        self,
        *,
        body: Dict[str, Any],
        headers: Optional[Dict[str, str]] = None,
    ) -> List[tuple[str, str, List[NormalizedEvent]]]:
        # Mock provider 不接收 webhook —— 真接入后这里需要解析特定格式。
        return []


# typing 满足 Protocol
_: LogisticsProvider = MockLogisticsProvider()  # noqa: F841
