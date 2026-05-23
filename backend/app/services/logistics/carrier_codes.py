"""
承运商名称归一化。

卖家发货表单是自由文本（"顺丰"/"顺丰速运"/"SF Express"/"sf-express" 都可能），
但调聚合 API 时需要传 provider 各自规定的 carrier code（顺丰 = 'SF' 或 'shunfeng'）。

这里集中维护，让 factory.py 和各 provider 都从同一份表读取。

新增 carrier：在 _ALIASES 里加一行即可；测试时 unknown carrier 走默认 fallback。
"""
from __future__ import annotations

from typing import Dict, Optional


# normalized code → list of aliases (lowercased, trimmed)
_CARRIERS: Dict[str, list[str]] = {
    # ---- 国内 ----
    "SF":      ["sf", "顺丰", "顺丰速运", "sf express", "shunfeng"],
    "JD":      ["jd", "京东", "京东物流", "jd logistics"],
    "JT":      ["jt", "极兔", "极兔速递", "j&t express", "jtexpress"],
    "ZTO":     ["zto", "中通", "中通快递"],
    "YTO":     ["yto", "圆通", "圆通速递"],
    "STO":     ["sto", "申通", "申通快递"],
    "YUNDA":   ["yunda", "韵达", "韵达快递"],
    "EMS":     ["ems", "邮政", "中国邮政", "ems china"],
    "DEPPON":  ["deppon", "德邦", "德邦快递"],
    # ---- 跨境 ----
    "FEDEX":   ["fedex", "federal express"],
    "UPS":     ["ups", "united parcel"],
    "DHL":     ["dhl", "dhl express"],
    "USPS":    ["usps", "us postal", "us mail"],
    "TNT":     ["tnt", "tnt express"],
    # ---- 测试 ----
    "MOCK":    ["mock", "test", "dev"],
}


# 反向索引：alias → normalized code
_REVERSE: Dict[str, str] = {
    alias.lower().strip(): code
    for code, aliases in _CARRIERS.items()
    for alias in aliases
}


def normalize_carrier(raw: Optional[str]) -> str:
    """把任意 carrier 文本归一到大写 code（'SF' / 'FEDEX' / 'MOCK' 等）。

    匹配不上时回退到原文（大写、去空格），让上层 provider 自己决定怎么处理。
    """
    if not raw:
        return "UNKNOWN"
    key = raw.lower().strip()
    if key in _REVERSE:
        return _REVERSE[key]
    return raw.upper().strip().replace(" ", "_")


# 国内承运商 code 集合 —— factory.py 用它判断走快递鸟还是 AfterShip。
DOMESTIC_CN_CARRIERS = {
    "SF", "JD", "JT", "ZTO", "YTO", "STO", "YUNDA", "EMS", "DEPPON",
}


def is_domestic_cn(carrier_code: str) -> bool:
    return carrier_code in DOMESTIC_CN_CARRIERS
