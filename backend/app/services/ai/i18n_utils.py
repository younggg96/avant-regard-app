"""
档案表多语言字段读取辅助 (V3 #25.1)。

约定:
  - DB 多语言字段统一用 JSONB 列 + `_i18n` 后缀, 形如:
      name_i18n        = {"en": "Avant-garde", "zh": "先锋"}
      description_i18n = {"en": "...",          "zh": "..."}
  - 取值回退链: user_locale → 'en' → 字典里第一个非空 key → ""

把回退集中在这里, services 层只调 `pick_locale(field, locale)` 即可,
避免每个查询都写一遍 if/else,也方便未来加新 locale 时扩展。

注意:
  - 不在这层猜 locale, locale 必须由 caller 显式传入 (来自 Accept-Language
    header / 用户 settings / 默认 'en')。这样测试和脚本都能稳定复现。
"""

from __future__ import annotations

from typing import Any, Mapping, Optional


def pick_locale(field: Optional[Mapping[str, Any]], locale: str = "en") -> str:
    """从 _i18n JSONB 字段里按 locale 取值, 带 en + 任意 fallback。

    >>> pick_locale({"en": "Avant-garde", "zh": "先锋"}, "zh")
    '先锋'
    >>> pick_locale({"en": "Avant-garde", "zh": "先锋"}, "ja")
    'Avant-garde'
    >>> pick_locale({"zh": "先锋"}, "en")
    '先锋'
    >>> pick_locale(None, "en")
    ''
    """
    if not field:
        return ""
    if locale in field and field[locale]:
        return str(field[locale])
    if "en" in field and field["en"]:
        return str(field["en"])
    for v in field.values():
        if v:
            return str(v)
    return ""


def normalize_locale(raw: Optional[str]) -> str:
    """把 'zh-CN' / 'zh_CN' / 'ZH' 之类归一到底层 i18n key。

    本期约定 i18n JSONB 顶层 key 用纯 2 位 code (zh / en / ja ...),
    后续若要支持区域变体 (zh-Hant) 再扩展这里 + 数据迁移。
    """
    if not raw:
        return "en"
    code = raw.lower().split("-")[0].split("_")[0]
    return code or "en"
