"""
数字护照 · AI 三视图生成。

用户上传一张单品照(常常是上身照 / 随手拍),调 OpenAI images.edit 生成
正 / 侧 / 背三张统一风格的棚拍平铺图,作为护照的标准影像。

设计要点:
  - **不建 3D**。三张图是三次独立的 2D 生成,每次都以用户原图为锚,
    而不是先重建模型再渲染。侧背面属于模型的合理推测,不是实测,
    所以对外文案必须写「AI 生成」,不能当成实物照片使用。
  - **三次调用并发**。单张实测 ~20s,串行要一分钟,前端等不起。
    共用同一段 _SHARED_STYLE 前缀让三张图风格一致。
  - **先压源图**。原图常见 2560px / 8MB,先压到长边 1536 再上行,
    省几秒延迟;模型内部本来也会缩。
  - **配额先扣后用**。生成失败不退还,避免拿坏图反复重试刷预算。
  - **部分失败不整单失败**。三张里挂了一张仍然返回另外两张,
    前端按 view.error 标出重试入口,不让用户白等一轮。
"""

from __future__ import annotations

import base64
import io
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import List, Optional

import httpx
from openai import OpenAI
from PIL import Image

from app.core.config import settings
from app.services.ai.image_source import is_allowed_source
from app.services.ai.quota_service import quota_service
from app.services.file_service import file_service

logger = logging.getLogger(__name__)


class ThreeViewError(RuntimeError):
    """整单失败(配额/源图/全部视图都挂)。code 供路由层翻译成 HTTP 状态。"""

    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.code = code


# 三张图共用的风格前缀。必须逐字相同,否则三张图的背景、光位、成像风格
# 会漂移,拼在一起不像同一组。
#
# 两条是踩坑换来的:
#   - 配饰要逐类点名。只说 "remove props" 时模型会把手镯、首饰当成单品的
#     一部分留着,而且三张图留得还不一致(正面留了、背面没留)。
#   - 用 ghost mannequin 而不是 "flat"。要求平铺时模型照样输出无影人台效果,
#     不如顺着它;人台还能撑出版型,对护照影像比平铺更有信息量。
_SHARED_STYLE = (
    "Studio e-commerce product photograph of ONLY the garment from the reference image. "
    "Remove the person, the background scenery and every prop. "
    "Remove all jewellery, watches, bracelets, bags, belts, hats, shoes and gloves "
    "that are not part of the garment itself. "
    "Plain pure-white seamless background, soft even lighting, no harsh shadows. "
    "Present the garment on an invisible ghost mannequin so it holds its natural worn "
    "shape, centered and fully visible within the frame. "
    "Preserve the exact colour, fabric texture, print, hardware, stitching and proportions "
    "of the reference garment."
)

# 侧 / 背面在原图里通常看不到,必须明确要求「合理推测」而不是凭空改设计,
# 否则模型容易自由发挥出原件没有的口袋、拉链、印花。
_INFER_HINT = (
    "This angle is not visible in the reference image: infer it plausibly from the "
    "garment's construction and symmetry. Do not invent details, closures or graphics "
    "that the reference does not imply."
)


@dataclass(frozen=True)
class ViewSpec:
    slug: str
    label: str
    prompt: str


VIEW_SPECS: tuple[ViewSpec, ...] = (
    ViewSpec(
        slug="front",
        label="正视图",
        prompt=f"{_SHARED_STYLE} Front view, seen straight on from directly in front.",
    ),
    ViewSpec(
        slug="side",
        label="侧视图",
        prompt=(
            f"{_SHARED_STYLE} Side view, a true 90-degree profile seen from the "
            f"garment's left side. {_INFER_HINT}"
        ),
    ),
    ViewSpec(
        slug="back",
        label="背视图",
        prompt=f"{_SHARED_STYLE} Back view, seen straight on from directly behind. {_INFER_HINT}",
    ),
)


@dataclass
class GeneratedView:
    slug: str
    label: str
    url: Optional[str] = None
    error: Optional[str] = None
    tokens_used: int = 0


@dataclass
class ThreeViewResult:
    source_url: str
    views: List[GeneratedView] = field(default_factory=list)
    model: str = ""
    tokens_used: int = 0
    quota_used: int = 0
    quota_limit: int = 0


_MAX_SOURCE_BYTES = 25 * 1024 * 1024
_FETCH_TIMEOUT_S = 20.0


class ThreeViewService:
    def _record(
        self, user_id: int, source_url: str, views: List[GeneratedView]
    ) -> None:
        """
        每张生成图落一行。

        image_url 这一列同时承担「这张图是 AI 生成的」的权威依据 ——
        入库时服务端拿 photos 来这里反查，客户端无法谎称 AI 图是实拍。
        """
        from app.db.supabase import get_supabase_admin

        rows = [
            {
                "user_id": user_id,
                "source_image_url": source_url,
                "view_slug": v.slug,
                "image_url": v.url,
                "model": settings.OPENAI_IMAGE_MODEL,
                "image_size": settings.OPENAI_IMAGE_SIZE,
                "tokens_used": v.tokens_used,
                "status": "success" if v.url else "failed",
                "error_message": v.error,
            }
            for v in views
        ]
        get_supabase_admin().table("passport_three_views").insert(rows).execute()

    def _client(self) -> OpenAI:
        if not settings.OPENAI_API_KEY:
            raise ThreeViewError("OPENAI_API_KEY 未配置", "NOT_CONFIGURED")
        return OpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL,
            timeout=settings.OPENAI_IMAGE_TIMEOUT,
            max_retries=0,
        )

    def _fetch_source_png(self, url: str) -> bytes:
        """回源 + 压到长边上限 + 统一转 PNG(images.edit 对 PNG 最稳)。"""
        if not is_allowed_source(url):
            raise ThreeViewError("图片 URL 不在允许的源站白名单", "BAD_SOURCE")

        try:
            resp = httpx.get(url, timeout=_FETCH_TIMEOUT_S, follow_redirects=True)
        except httpx.HTTPError as e:
            raise ThreeViewError(f"源图下载失败: {e}", "BAD_SOURCE") from e
        if resp.status_code != 200:
            raise ThreeViewError(f"源图返回 {resp.status_code}", "BAD_SOURCE")
        if len(resp.content) > _MAX_SOURCE_BYTES:
            raise ThreeViewError("源图体积超限", "BAD_SOURCE")

        try:
            im = Image.open(io.BytesIO(resp.content))
            im.load()
        except Exception as e:
            raise ThreeViewError(f"源图无法解码: {e}", "BAD_SOURCE") from e

        im = im.convert("RGB")
        max_edge = settings.THREE_VIEW_SOURCE_MAX_EDGE
        if max(im.size) > max_edge:
            im.thumbnail((max_edge, max_edge), Image.LANCZOS)

        buf = io.BytesIO()
        im.save(buf, format="PNG", optimize=True)
        return buf.getvalue()

    def _generate_one(self, client: OpenAI, png: bytes, spec: ViewSpec) -> GeneratedView:
        try:
            resp = client.images.edit(
                model=settings.OPENAI_IMAGE_MODEL,
                image=("item.png", png, "image/png"),
                prompt=spec.prompt,
                n=1,
                size=settings.OPENAI_IMAGE_SIZE,
            )
        except Exception as e:
            return GeneratedView(slug=spec.slug, label=spec.label, error=f"生成失败: {e}")

        data = resp.data[0] if resp.data else None
        b64 = getattr(data, "b64_json", None) if data else None
        if not b64:
            return GeneratedView(slug=spec.slug, label=spec.label, error="模型未返回图片")

        usage = getattr(resp, "usage", None)
        tokens = 0
        if usage is not None:
            tokens = (usage.get("total_tokens", 0) if isinstance(usage, dict)
                      else getattr(usage, "total_tokens", 0) or 0)

        url = file_service.upload_image(
            base64.b64decode(b64), f"three-view-{spec.slug}.png", "image/png"
        )
        if not url:
            return GeneratedView(
                slug=spec.slug, label=spec.label, error="生成成功但上传失败", tokens_used=tokens
            )

        return GeneratedView(slug=spec.slug, label=spec.label, url=url, tokens_used=tokens)

    def generate(self, user_id: int, source_image_url: str) -> ThreeViewResult:
        try:
            check = quota_service.check_and_consume_three_view(user_id)
        except Exception as e:
            # 最常见的原因是 migration 085 还没应用,ai_post_quota 上没有
            # daily_three_view_count 列。不兜底放行:少了配额这层,一个账号
            # 就能刷掉一天的图片预算。
            raise ThreeViewError(
                f"配额检查失败(是否未应用 migration 085?): {e}", "NOT_CONFIGURED"
            ) from e

        if not check.allowed:
            raise ThreeViewError(
                f"今日三视图生成次数已用完 ({check.info.used}/{check.info.limit})",
                "QUOTA_EXCEEDED",
            )

        client = self._client()
        png = self._fetch_source_png(source_image_url)

        # 三张互不依赖,并发跑。OpenAI SDK 的 client 是线程安全的。
        with ThreadPoolExecutor(max_workers=len(VIEW_SPECS)) as pool:
            views = list(
                pool.map(lambda spec: self._generate_one(client, png, spec), VIEW_SPECS)
            )

        # 先落表再判成败:失败的那几张同样要留记录,否则「为什么这次只出了
        # 两张」事后查不出来。落表失败不影响用户拿到图。
        try:
            self._record(user_id, source_image_url, views)
        except Exception as e:  # noqa: BLE001
            logger.warning("[three_view] record failed: %s", e)

        if all(v.url is None for v in views):
            raise ThreeViewError(
                views[0].error or "三视图全部生成失败", "GENERATION_FAILED"
            )

        return ThreeViewResult(
            source_url=source_image_url,
            views=views,
            model=settings.OPENAI_IMAGE_MODEL,
            tokens_used=sum(v.tokens_used for v in views),
            quota_used=check.info.used,
            quota_limit=check.info.limit,
        )


three_view_service = ThreeViewService()
