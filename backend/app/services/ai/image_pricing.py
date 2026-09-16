"""
三视图生成的计价。

两家的计费模型没有共同点，所以这里不存在一个统一的「每张多少钱」：

  万相    按张定价，与分辨率、提示词长度都无关，价随模型档位走
  OpenAI  按 token 计，且输入图 / 输入文本 / 输出图三档单价不同
          ($8 / $5 / $30 每 1M token)，同一张图的成本随提示词长短浮动

统一折算成 micros(货币单位的百万分之一)落库，并带上币种：万相计人民币、
OpenAI 计美元，混进一列求和会得到一个没有意义的数。

价格是会变的。这里写死的是查证过的公开价目，真实账单以控制台为准 ——
这些数字用于后台的用量估算，不作为对账依据。
"""

from __future__ import annotations

import logging
from typing import Any, Optional, Tuple

logger = logging.getLogger(__name__)

MICROS = 1_000_000

# 阿里云百炼官方价目(华北2 · 北京)，元/张 → micros。
# 换 WAN_IMAGE_MODEL 时这里要同步补上，否则该模型的成本记为 NULL 并告警。
WAN_PRICE_MICROS = {
    "wan2.7-image-pro": 500_000,  # ¥0.50 / 张
    "wan2.7-image": 200_000,  # ¥0.20 / 张
}

# gpt-image-2 公开价，美元 / 1M token。
OPENAI_USD_PER_MTOK = {
    "text_input": 5.0,
    "image_input": 8.0,
    "output": 30.0,
}


def wan_cost(model: str) -> Optional[int]:
    """万相单张成本(micros, CNY)。模型不在价表里返回 None。"""
    price = WAN_PRICE_MICROS.get(model)
    if price is None:
        logger.warning(
            "[pricing] 万相模型 %s 不在价表里，本次成本记为未知；"
            "请在 image_pricing.WAN_PRICE_MICROS 补上单价",
            model,
        )
    return price


def _as_int(source: Any, key: str) -> int:
    """usage 有时是 dict 有时是 pydantic 对象，两种都要能取。"""
    if source is None:
        return 0
    value = source.get(key) if isinstance(source, dict) else getattr(source, key, None)
    return int(value or 0)


def openai_cost(usage: Any) -> Optional[int]:
    """
    gpt-image 单张成本(micros, USD)。

    按三档分别计价，而不是拿 total_tokens 乘一个平均价 —— 编辑请求里输入图
    的 token 量很大，用输出价去乘会把成本高估好几倍。

    拿不到用量明细时返回 None(记为未知)，不猜。
    """
    if usage is None:
        return None

    output = _as_int(usage, "output_tokens")
    details = (
        usage.get("input_tokens_details")
        if isinstance(usage, dict)
        else getattr(usage, "input_tokens_details", None)
    )
    text_in = _as_int(details, "text_tokens")
    image_in = _as_int(details, "image_tokens")

    if not details:
        # 只有汇总没有明细：分不清输入输出，按最贵的输出价算会严重高估。
        # 宁可记未知，也不要往看板里塞一个偏出几倍的数。
        logger.warning("[pricing] OpenAI 未返回 input_tokens_details，成本记为未知")
        return None

    usd = (
        text_in * OPENAI_USD_PER_MTOK["text_input"]
        + image_in * OPENAI_USD_PER_MTOK["image_input"]
        + output * OPENAI_USD_PER_MTOK["output"]
    ) / 1_000_000
    return round(usd * MICROS)


def format_micros(micros: int, currency: str) -> str:
    """给日志和后台用的可读金额，如 500000/CNY -> ¥0.50。"""
    symbol = {"CNY": "¥", "USD": "$"}.get(currency, f"{currency} ")
    return f"{symbol}{micros / MICROS:.4f}".rstrip("0").rstrip(".")


def provider_currency(provider: str) -> Tuple[str, str]:
    """(币种, 人类可读的计费方式) —— 后台展示用。"""
    if provider == "openai":
        return "USD", "按 token"
    return "CNY", "按张"
