"""
AI 链路的图片来源白名单。

护照的两条链路都会把用户给的图片 URL 交出去:
  - 三视图:后端自己回源下载(SSRF 面)
  - 归因:URL 直接交给 DashScope 去拉(被当免费图片代理 / 拿我们的额度
    去访问任意站点)

两种都只应该接受自家 Storage 的公开地址(客户端先走
`/api/files/upload-image`),外加已知的秀场图床。口径与
`api/routes/files.py` 的图片代理保持一致。
"""

from __future__ import annotations

from typing import Sequence
from urllib.parse import urlparse

from app.core.config import settings

_STORAGE_HOST = urlparse(settings.SUPABASE_URL).hostname or ""
_EXTERNAL_IMAGE_HOSTS = {"assets.vogue.com", "images.vogue.com"}
ALLOWED_IMAGE_HOSTS = ({_STORAGE_HOST} | _EXTERNAL_IMAGE_HOSTS) - {""}


def is_allowed_source(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in ("https", "http"):
        return False
    return parsed.hostname in ALLOWED_IMAGE_HOSTS


def all_allowed(urls: Sequence[str]) -> bool:
    return bool(urls) and all(is_allowed_source(u) for u in urls)
