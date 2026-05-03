"""
图片内容安全 — 阿里云内容审核 (Green-CIP / ImageAudit) 同步检测。

API: POST /green/image/scan
SDK: alibabacloud_imageaudit20191230 (官方 v2 SDK, OpenAPI 风格)

设计要点 (V3 #25 安全条款):
  - AI 发帖助手「图片+简述模式」必须先过审核才能喂给 Qwen-VL,避免:
      1) 违规图片浪费 LLM 配额
      2) AI 生成的帖子配着违规图发出去 → App Store 4.3 / 5.1.1 拒因
  - 同步接口最多 6s/张, 9 张并行可能 ~7s, 加上 LLM 3-5s 总耗时贴近前端 10s
    超时阈值。后续考虑改成异步,接口先返回 task_id, 前端轮询。
  - 任一图片被命中 (suggestion = 'block') → 整次 generate 拒绝,前端显示
    哪几张被拦截。'review' 默认放行 (运营人工兜底),阈值通过 env 调整。
  - SDK 缺失或 AK/SK 未配置时:
      IMAGE_MODERATION_ENABLED=True  → 抛 ImageModerationConfigError, 上层 503
      IMAGE_MODERATION_ENABLED=False → 直接 pass-through (仅本地/dev 用)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class ImageModerationConfigError(RuntimeError):
    """SDK 或 AK/SK 缺失。"""


@dataclass
class ImageModerationResult:
    """单张图片审核结果。"""
    url: str
    blocked: bool                                  # 命中阻断 → True
    suggestion: str = "pass"                       # pass / review / block
    hit_scenes: List[str] = field(default_factory=list)  # 命中场景 (porn / ad / ...)
    raw: Optional[Dict[str, Any]] = None


@dataclass
class BatchModerationOutcome:
    results: List[ImageModerationResult]
    blocked_indices: List[int]                     # blocked=True 的 image_urls 下标
    has_blocked: bool


class ImageModerationService:
    def __init__(self):
        self._client = None
        self._client_inited = False

    # -----------------------------------------------------------------
    # SDK 懒加载,避免 import 时副作用
    # -----------------------------------------------------------------
    def _get_client(self):
        if self._client_inited:
            return self._client
        self._client_inited = True

        if not settings.IMAGE_MODERATION_ENABLED:
            self._client = None
            return None
        if not settings.ALIYUN_GREEN_ACCESS_KEY_ID or not settings.ALIYUN_GREEN_ACCESS_KEY_SECRET:
            raise ImageModerationConfigError("阿里云绿网 AK/SK 未配置")

        try:
            from alibabacloud_imageaudit20191230.client import Client as ImageauditClient
            from alibabacloud_tea_openapi import models as open_api_models
        except ImportError as e:
            raise ImageModerationConfigError(
                "未安装 alibabacloud_imageaudit20191230, 请 pip install"
            ) from e

        endpoint = f"imageaudit.{settings.ALIYUN_GREEN_REGION}.aliyuncs.com"
        config = open_api_models.Config(
            access_key_id=settings.ALIYUN_GREEN_ACCESS_KEY_ID,
            access_key_secret=settings.ALIYUN_GREEN_ACCESS_KEY_SECRET,
            endpoint=endpoint,
        )
        self._client = ImageauditClient(config)
        return self._client

    # -----------------------------------------------------------------
    # 同步检测一组图片
    # -----------------------------------------------------------------
    def scan(self, image_urls: List[str]) -> BatchModerationOutcome:
        """
        同步审核。失败时:
          - SDK/AK 配置错误 → 直接抛 ImageModerationConfigError
          - 网络/上游错误 → 抛 RuntimeError
          - 单张图本身过大/格式错 → 该图标记 blocked=True, 不影响其他图
        """
        if not image_urls:
            return BatchModerationOutcome(results=[], blocked_indices=[], has_blocked=False)

        if not settings.IMAGE_MODERATION_ENABLED:
            # dev 兜底: 全部放行,但 log 大字提示。
            logger.warning("[image_moderation] DISABLED (dev mode), %d images bypass", len(image_urls))
            return BatchModerationOutcome(
                results=[ImageModerationResult(url=u, blocked=False) for u in image_urls],
                blocked_indices=[],
                has_blocked=False,
            )

        client = self._get_client()
        if client is None:
            # 不应到这里 (上面已抛),保险兜底
            raise ImageModerationConfigError("图片审核客户端未初始化")

        from alibabacloud_imageaudit20191230 import models as audit_models

        scenes = settings.aliyun_green_image_scenes_list or ["porn", "terrorism", "ad"]
        request = audit_models.ScanImageRequest(
            scene=scenes,
            task=[audit_models.ScanImageRequestTask(image_url=u) for u in image_urls],
        )
        try:
            resp = client.scan_image(request)
        except Exception as e:
            logger.error("[image_moderation] scan_image failed: %s", e)
            raise RuntimeError(f"图片审核接口失败: {e!s}") from e

        # 解析: resp.body.data.results 是按 task 顺序的列表
        results: List[ImageModerationResult] = []
        blocked_indices: List[int] = []
        body = getattr(resp, "body", None)
        data = getattr(body, "data", None)
        scan_results = getattr(data, "results", None) or []

        # 顺序与 image_urls 一一对应。如果 SDK 返回长度不一致,
        # 缺失的图按 blocked=True 兜底,避免漏审。
        for idx, url in enumerate(image_urls):
            if idx >= len(scan_results):
                results.append(ImageModerationResult(url=url, blocked=True, suggestion="block",
                                                    hit_scenes=["unknown"]))
                blocked_indices.append(idx)
                continue

            r = scan_results[idx]
            sub_results = getattr(r, "sub_results", None) or []
            hit_scenes: List[str] = []
            worst_suggestion = "pass"
            for sr in sub_results:
                s_suggestion = getattr(sr, "suggestion", "pass")
                s_scene = getattr(sr, "scene", "")
                # block > review > pass
                if s_suggestion == "block":
                    worst_suggestion = "block"
                    hit_scenes.append(s_scene)
                elif s_suggestion == "review" and worst_suggestion != "block":
                    worst_suggestion = "review"

            blocked = worst_suggestion == "block"
            if blocked:
                blocked_indices.append(idx)
            results.append(
                ImageModerationResult(
                    url=url,
                    blocked=blocked,
                    suggestion=worst_suggestion,
                    hit_scenes=hit_scenes,
                    raw=None,  # 完整返回不存,只看 sub_results 即可
                )
            )

        return BatchModerationOutcome(
            results=results,
            blocked_indices=blocked_indices,
            has_blocked=bool(blocked_indices),
        )


image_moderation_service = ImageModerationService()
