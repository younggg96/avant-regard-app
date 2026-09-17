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
from typing import Any, Dict, List, Optional

import httpx
from openai import (
    APIConnectionError,
    AuthenticationError,
    OpenAI,
    PermissionDeniedError,
)
from PIL import Image

from app.core.config import settings
from app.services.ai import image_pricing
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
    # 「invisible ghost mannequin」对 gpt-image 够用,但万相会把胸模颈托和
    # 底座支架画出来 —— 尤其是侧视图。逐个点名比形容词管用,同一个教训:
    # 上面的配饰也是点名之后才干净的。
    "The mannequin itself must be completely invisible: no dress form, no mannequin "
    "neck or collar block, no support pole, no stand or base of any kind in the image. "
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
    # 请求根本没发出去(连不上上游),区别于"模型跑了但没成"。
    # 前者没产生费用，配额要退。
    unreachable: bool = False
    # 上游拒绝鉴权(key 无效 / 没开通该模型)。同样没花钱，但和"连不上"
    # 的处置完全不同：重试永远不会好，得去改配置。
    auth_failed: bool = False
    # 本次花费(micros，币种由 provider 决定)。三个值含义不同，别合并：
    #   0     确认没花钱 —— 请求没发出去，或上游直接拒了
    #   >0    算得出来的花费
    #   None  花了钱但定不出价 —— 模型不在价表里，或上游没给用量明细
    #
    # 关键在于「出了图但我们没存下来」也要计费：模型已经跑完并扣了钱，
    # 后面下载或上传失败是我们自己的问题，不记就会低估成本。
    cost_micros: Optional[int] = 0


@dataclass
class ThreeViewResult:
    source_url: str
    views: List[GeneratedView] = field(default_factory=list)
    model: str = ""
    tokens_used: int = 0
    cost_micros: int = 0
    cost_currency: str = ""
    quota_used: int = 0
    quota_limit: int = 0


_MAX_SOURCE_BYTES = 25 * 1024 * 1024
_FETCH_TIMEOUT_S = 20.0


class ThreeViewService:
    def history(
        self, user_id: int, *, page: int = 1, page_size: int = 20
    ) -> Dict[str, Any]:
        """
        用户自己的三视图生成记录，成功和失败都给。

        失败的尤其要给：那才是用户需要解释的地方 —— 「我点了一次，图没出来，
        次数是不是白扣了」。把失败原因和当时的源图摆出来，比任何客服话术都
        管用。

        按「批次」返回而不是按张。一次生成 = 一条 insert = 3 行，它们共享同一
        个 created_at（NOW() 在单条语句内是同一个值），所以可以直接拿
        (created_at, source_image_url) 把它们归拢回去，不用额外加 batch 列。

        分页按行做（每批固定 3 行，边界正好对齐），page_size 是批数。
        """
        from app.db.supabase import get_supabase_admin

        db = get_supabase_admin()
        per_batch = len(VIEW_SPECS)
        offset = (page - 1) * page_size * per_batch

        res = (
            db.table("passport_three_views")
            .select("*", count="exact")
            # 走的是 admin client（绕过 RLS），user_id 这层过滤就是唯一的
            # 边界 —— 漏了它等于把所有人的生成记录开放给任何登录用户。
            .eq("user_id", user_id)
            # 按 id 排而不是 created_at：同批三行的 created_at 完全相同，
            # 只靠它排序批与批之间会交错，分页边界就切坏了。
            .order("id", desc=True)
            .range(offset, offset + page_size * per_batch - 1)
            .execute()
        )
        rows = res.data or []

        batches: List[Dict[str, Any]] = []
        index: Dict[tuple, Dict[str, Any]] = {}
        for r in rows:
            key = (r.get("created_at"), r.get("source_image_url"))
            batch = index.get(key)
            if batch is None:
                batch = {
                    "createdAt": r.get("created_at"),
                    "sourceImageUrl": r.get("source_image_url"),
                    "model": r.get("model"),
                    "imageSize": r.get("image_size"),
                    "archiveItemId": r.get("archive_item_id"),
                    "views": [],
                }
                index[key] = batch
                batches.append(batch)
            batch["views"].append(
                {
                    "id": r["id"],
                    "slug": r.get("view_slug"),
                    "url": r.get("image_url"),
                    "status": r.get("status"),
                    "errorMessage": r.get("error_message"),
                }
            )

        for batch in batches:
            # 视角顺序按 VIEW_SPECS 排，不按 id —— 并发生成的落表顺序是乱的，
            # 历史里每批都是「正侧背」才看得舒服。
            order = {spec.slug: i for i, spec in enumerate(VIEW_SPECS)}
            batch["views"].sort(key=lambda v: order.get(v["slug"], 99))
            ok = sum(1 for v in batch["views"] if v["status"] == "success")
            batch["okCount"] = ok
            batch["totalCount"] = len(batch["views"])
            batch["status"] = (
                "success" if ok == len(batch["views"]) else "failed" if ok == 0
                else "partial"
            )

        total_rows = res.count or 0
        return {
            "items": batches,
            "total": (total_rows + per_batch - 1) // per_batch,
        }

    @staticmethod
    def _active_model() -> tuple[str, str]:
        """(模型名, 出图尺寸) —— 取决于当前 provider，落表和响应都要如实反映。"""
        if settings.THREE_VIEW_PROVIDER == "openai":
            return settings.OPENAI_IMAGE_MODEL, settings.OPENAI_IMAGE_SIZE
        return settings.WAN_IMAGE_MODEL, settings.WAN_IMAGE_SIZE

    @staticmethod
    def _active_currency() -> str:
        return image_pricing.provider_currency(settings.THREE_VIEW_PROVIDER)[0]

    def _record(
        self, user_id: int, source_url: str, views: List[GeneratedView]
    ) -> None:
        """
        每张生成图落一行。

        image_url 这一列同时承担「这张图是 AI 生成的」的权威依据 ——
        入库时服务端拿 photos 来这里反查，客户端无法谎称 AI 图是实拍。
        """
        from app.db.supabase import get_supabase_admin

        model, image_size = self._active_model()
        currency = self._active_currency()
        rows = [
            {
                "user_id": user_id,
                "source_image_url": source_url,
                "view_slug": v.slug,
                "image_url": v.url,
                "model": model,
                "image_size": image_size,
                "tokens_used": v.tokens_used,
                "cost_micros": v.cost_micros,
                # 没花钱的行不占币种，免得按币种分组时混进一堆 0
                "cost_currency": currency if v.cost_micros != 0 else None,
                "status": "success" if v.url else "failed",
                "error_message": v.error,
            }
            for v in views
        ]
        table = get_supabase_admin().table("passport_three_views")
        try:
            table.insert(rows).execute()
        except Exception:
            # 089 还没应用时，带 cost_* 的整行插入会被拒。这里不能就这么放弃：
            # 没有这几行，_detect_ai_photos 就标不出哪些是 AI 图，公开页会把
            # 模型猜的侧背面当实拍展示 —— 那正是 088 建这张表要防的事。
            # 成本丢了可以以后再补，来源标记丢了是会误导交易的。
            for r in rows:
                r.pop("cost_micros", None)
                r.pop("cost_currency", None)
            table.insert(rows).execute()
            logger.error(
                "[three_view] 成本未能落库，已降级为只记来源；"
                "请应用 migration 089_three_view_cost.sql"
            )

    # -----------------------------------------------------------------
    # 万相 (阿里云百炼) —— 默认 provider
    # -----------------------------------------------------------------
    def _generate_one_wan(self, png: bytes, spec: ViewSpec) -> GeneratedView:
        """
        万相图像编辑。与 OpenAI 那条线的差异有三处，都在这里吸收掉：

          1. 入参是 messages 数组（图 + 指令），不是 images.edit 的 multipart
          2. 图走 base64 内联。也可以传 URL 让 DashScope 自己去抓，但那样就
             绕过了 _fetch_source_png 的白名单与压缩，还多一条对外依赖
          3. 返回的是一个临时 URL，不是 base64，得先下载回来再转存
        """
        b64 = "data:image/png;base64," + base64.b64encode(png).decode()
        body = {
            "model": settings.WAN_IMAGE_MODEL,
            "input": {
                "messages": [
                    {
                        "role": "user",
                        "content": [{"image": b64}, {"text": spec.prompt}],
                    }
                ]
            },
            # watermark 必须显式关：右下角糊一个「AI生成」会和我们自己的
            # 来源标记打架，而且那块水印压在衣服上会挡住细节。
            "parameters": {
                "size": settings.WAN_IMAGE_SIZE,
                "n": 1,
                "watermark": False,
            },
        }

        try:
            resp = httpx.post(
                settings.WAN_IMAGE_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {settings.QWEN_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=httpx.Timeout(
                    settings.WAN_IMAGE_TIMEOUT, connect=settings.WAN_CONNECT_TIMEOUT
                ),
            )
        except (httpx.ConnectError, httpx.ConnectTimeout) as e:
            return GeneratedView(
                slug=spec.slug,
                label=spec.label,
                error=f"无法连接图像服务 {settings.WAN_IMAGE_ENDPOINT}: {e}",
                unreachable=True,
            )
        except Exception as e:  # noqa: BLE001
            return GeneratedView(slug=spec.slug, label=spec.label, error=f"生成失败: {e}")

        if resp.status_code != 200:
            return GeneratedView(
                slug=spec.slug,
                label=spec.label,
                error=f"生成失败 HTTP {resp.status_code}: {resp.text[:200]}",
                # 401/403 是配置问题(key 无效、未开通该模型)，不是生成失败。
                # 上游在鉴权阶段就拒了，没有产生任何费用。
                auth_failed=resp.status_code in (401, 403),
            )

        try:
            content = resp.json()["output"]["choices"][0]["message"]["content"]
            image_url = next(c["image"] for c in content if "image" in c)
        except Exception:  # noqa: BLE001
            return GeneratedView(
                slug=spec.slug,
                label=spec.label,
                error=f"返回结构不符预期: {resp.text[:200]}",
            )

        # 走到这里图已经出了，钱已经花了。下面任何一步失败都不影响计费，
        # 所以成本在这里就定下来，后续每个失败分支都带上它。
        cost = image_pricing.wan_cost(settings.WAN_IMAGE_MODEL)

        # 万相给的是有效期有限的临时地址，必须落到自家 Storage，
        # 否则档案里的图过些天就成死链。
        try:
            img = httpx.get(image_url, timeout=_FETCH_TIMEOUT_S).content
        except Exception as e:  # noqa: BLE001
            return GeneratedView(
                slug=spec.slug,
                label=spec.label,
                error=f"生成成功但回源失败: {e}",
                cost_micros=cost,
            )

        url = file_service.upload_image(img, f"three-view-{spec.slug}.png", "image/png")
        if not url:
            return GeneratedView(
                slug=spec.slug,
                label=spec.label,
                error="生成成功但上传失败",
                cost_micros=cost,
            )
        return GeneratedView(
            slug=spec.slug, label=spec.label, url=url, cost_micros=cost
        )

    # -----------------------------------------------------------------
    # OpenAI gpt-image —— 需要境外反代才能用
    # -----------------------------------------------------------------
    def _client(self) -> OpenAI:
        if not settings.OPENAI_API_KEY:
            raise ThreeViewError("OPENAI_API_KEY 未配置", "NOT_CONFIGURED")
        return OpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL,
            # 连接与读取分开：生成本来就慢（读 100s），但连不上不该也等 100s。
            timeout=httpx.Timeout(
                settings.OPENAI_IMAGE_TIMEOUT,
                connect=settings.OPENAI_CONNECT_TIMEOUT,
            ),
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
        except APIConnectionError as e:
            # 连不上 base_url。国内机器直连 api.openai.com 就是死在这里，
            # 报「Connection error.」看不出所以然，这里把地址带上。
            return GeneratedView(
                slug=spec.slug,
                label=spec.label,
                error=f"无法连接图像服务 {settings.OPENAI_BASE_URL}: {e}",
                unreachable=True,
            )
        except (AuthenticationError, PermissionDeniedError) as e:
            # key 无效，或该 key 没被批准使用 gpt-image(需要组织实名验证)。
            return GeneratedView(
                slug=spec.slug,
                label=spec.label,
                error=f"鉴权失败: {e}",
                auth_failed=True,
            )
        except Exception as e:
            return GeneratedView(slug=spec.slug, label=spec.label, error=f"生成失败: {e}")

        usage = getattr(resp, "usage", None)
        tokens = 0
        if usage is not None:
            tokens = (usage.get("total_tokens", 0) if isinstance(usage, dict)
                      else getattr(usage, "total_tokens", 0) or 0)
        # 有 usage 就说明模型确实跑了、确实计了费 —— 哪怕下面没拿到图。
        cost = image_pricing.openai_cost(usage) if usage is not None else 0

        data = resp.data[0] if resp.data else None
        b64 = getattr(data, "b64_json", None) if data else None
        if not b64:
            return GeneratedView(
                slug=spec.slug,
                label=spec.label,
                error="模型未返回图片",
                tokens_used=tokens,
                cost_micros=cost,
            )

        url = file_service.upload_image(
            base64.b64decode(b64), f"three-view-{spec.slug}.png", "image/png"
        )
        if not url:
            return GeneratedView(
                slug=spec.slug,
                label=spec.label,
                error="生成成功但上传失败",
                tokens_used=tokens,
                cost_micros=cost,
            )

        return GeneratedView(
            slug=spec.slug,
            label=spec.label,
            url=url,
            tokens_used=tokens,
            cost_micros=cost,
        )

    @staticmethod
    def _ensure_configured() -> None:
        """
        当前 provider 的 key 配没配。

        放在扣配额之前：没配 key 是部署问题，不该让用户为此掉一次额度。
        """
        if settings.THREE_VIEW_PROVIDER == "openai":
            if not settings.OPENAI_API_KEY:
                raise ThreeViewError("OPENAI_API_KEY 未配置", "NOT_CONFIGURED")
        elif not settings.QWEN_API_KEY:
            raise ThreeViewError(
                "QWEN_API_KEY 未配置（万相与 Qwen 共用百炼 key）", "NOT_CONFIGURED"
            )

    def generate(self, user_id: int, source_image_url: str) -> ThreeViewResult:
        self._ensure_configured()
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

        # 源图的下载、白名单校验、压缩转码两条 provider 共用。
        png = self._fetch_source_png(source_image_url)

        if settings.THREE_VIEW_PROVIDER == "openai":
            client = self._client()
            run = lambda spec: self._generate_one(client, png, spec)  # noqa: E731
        else:
            run = lambda spec: self._generate_one_wan(png, spec)  # noqa: E731

        # 三张互不依赖,并发跑。OpenAI SDK 的 client 线程安全,httpx.post 也是。
        with ThreadPoolExecutor(max_workers=len(VIEW_SPECS)) as pool:
            views = list(pool.map(run, VIEW_SPECS))

        # 先落表再判成败:失败的那几张同样要留记录,否则「为什么这次只出了
        # 两张」事后查不出来。落表失败不影响用户拿到图。
        try:
            self._record(user_id, source_image_url, views)
        except Exception as e:  # noqa: BLE001
            logger.warning("[three_view] record failed: %s", e)

        if all(v.url is None for v in views):
            endpoint = (
                settings.OPENAI_BASE_URL
                if settings.THREE_VIEW_PROVIDER == "openai"
                else settings.WAN_IMAGE_ENDPOINT
            )

            # 退配额的判据是「这次没花钱」，而不是某个具体的失败原因。
            # 之前只认 unreachable，结果 key 失效、上游直接拒了这类同样
            # 分文未花的情况照样扣次数 —— 用户为我们的配置错误买单。
            # cost_micros: 0 = 确认没花，None = 花了但定不出价，>0 = 花了。
            if not any(v.cost_micros != 0 for v in views):
                try:
                    quota_service.refund_three_view(user_id)
                except Exception as e:  # noqa: BLE001
                    logger.warning("[three_view] quota refund failed: %s", e)

            # 能定位的细节进日志，不进用户的弹窗：endpoint 和 key 都是
            # 内部配置，"去换把 key" 也不是用户能做的事。
            if all(v.auth_failed for v in views):
                logger.error(
                    "[three_view] upstream auth rejected: provider=%s endpoint=%s — "
                    "该环境的 API key 无效或没开通对应模型，检查服务器上的 "
                    "%s（本地能跑不代表生产的 key 一样）",
                    settings.THREE_VIEW_PROVIDER,
                    endpoint,
                    "OPENAI_API_KEY" if settings.THREE_VIEW_PROVIDER == "openai"
                    else "QWEN_API_KEY",
                )
                raise ThreeViewError(
                    "三视图服务配置有误，请联系管理员（本次不消耗次数）",
                    "UPSTREAM_AUTH_FAILED",
                )

            if all(v.unreachable for v in views):
                logger.error(
                    "[three_view] upstream unreachable: provider=%s endpoint=%s — "
                    "走 openai 时国内服务器需把 OPENAI_BASE_URL 指向可达的反代网关",
                    settings.THREE_VIEW_PROVIDER,
                    endpoint,
                )
                raise ThreeViewError(
                    "三视图服务暂时不可用，请稍后再试（本次不消耗次数）",
                    "UPSTREAM_UNREACHABLE",
                )

            raise ThreeViewError(
                views[0].error or "三视图全部生成失败", "GENERATION_FAILED"
            )

        return ThreeViewResult(
            source_url=source_image_url,
            views=views,
            model=self._active_model()[0],
            tokens_used=sum(v.tokens_used for v in views),
            # 定不出价的(None)不计入合计 —— 当成 0 会让总额偏低且不自知
            cost_micros=sum(v.cost_micros or 0 for v in views),
            cost_currency=self._active_currency(),
            quota_used=check.info.used,
            quota_limit=check.info.limit,
        )


three_view_service = ThreeViewService()
