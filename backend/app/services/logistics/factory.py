"""
物流 provider 工厂。

设计思路与 backend/app/services/payment/factory.py 一致：
  - 业务层只调 `get_provider_for_carrier(carrier)`，按运单承运商自动路由
  - 单例缓存避免每次都 new SDK 客户端
  - 默认 fallback 到 MockLogisticsProvider，dev 环境完全可跑

接入真 provider 时（如快递鸟）：
  1. 新增 backend/app/services/logistics/kdniao.py 实现 LogisticsProvider 协议
  2. 在本文件 _PROVIDER_CLASSES 加一行 'kdniao': KdniaoProvider
  3. 在 _select_provider_name() 把国内承运商映射到 'kdniao'
  其余代码无需改动。
"""
from __future__ import annotations

import os
from typing import Dict, Type

from .base import LogisticsProvider
from .carrier_codes import is_domestic_cn, normalize_carrier
from .mock import MockLogisticsProvider


# 真 provider 接入后在这里追加：'kdniao': KdniaoProvider 等
_PROVIDER_CLASSES: Dict[str, Type[LogisticsProvider]] = {
    "mock":      MockLogisticsProvider,
    # "kdniao":  KdniaoProvider,
    # "aftership": AfterShipProvider,
}


_PROVIDER_CACHE: Dict[str, LogisticsProvider] = {}


def get_provider_by_name(name: str) -> LogisticsProvider:
    """按 provider 名拿一个单例。未知 → mock。"""
    key = (name or "mock").lower()
    if key not in _PROVIDER_CACHE:
        cls = _PROVIDER_CLASSES.get(key, MockLogisticsProvider)
        _PROVIDER_CACHE[key] = cls()
    return _PROVIDER_CACHE[key]


def _select_provider_name(carrier_code: str) -> str:
    """根据承运商决定走哪个聚合服务。

    - 环境变量 LOGISTICS_PROVIDER 强制指定（开发联调用 mock）
    - 国内承运商 → kdniao（接入后），否则 aftership（接入后）
    - 都没接 → mock
    """
    env_override = (os.getenv("LOGISTICS_PROVIDER") or "").lower()
    if env_override and env_override in _PROVIDER_CLASSES:
        return env_override

    if is_domestic_cn(carrier_code) and "kdniao" in _PROVIDER_CLASSES:
        return "kdniao"
    if "aftership" in _PROVIDER_CLASSES:
        return "aftership"
    return "mock"


def get_provider_for_carrier(carrier_raw: str) -> tuple[LogisticsProvider, str]:
    """业务调用入口：传卖家填的 carrier 文本，返回 (provider 实例, 归一化 code)。

    归一化 code 会作为 source 字段写入 tracking_events，方便后续运维统计。
    """
    code = normalize_carrier(carrier_raw)
    provider = get_provider_by_name(_select_provider_name(code))
    return provider, code
