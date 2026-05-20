"""
AI 发帖助手 — 业务编排层。

职责 (V3 #25):
  - get_qa_options(): Q1-Q4 的卡片选项,从档案表实拉取 (styles / brands /
    shows + 固定枚举 perspectives),不能硬编码。Q4 角度由后端硬编码枚举给出。
    历史 V3 原本 5 步, Q4 是 Look 选图,但秀场 look 覆盖率低,整步移除。
  - generate(): 配额预占 → RAG 召回 → prompt 拼装 → LLM 调用 → 解析 →
    内容安全后置过滤 → 写日志 → 返回。
  - regenerate(): 复用上一次 prompt_snapshot 重跑,新日志,链式 regenerated_from。

PR-1 阶段先把对外接口与配额联动落到位,RAG 与 prompt 拼装放到 PR-2。
这样路由与前端可以基于明确签名先行,不阻塞集成。
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException

from app.core.config import settings
from app.db.supabase import get_supabase, get_supabase_admin
from app.schemas.ai_post import (
    AIPostMode,
    GenerateRequest,
    GenerateResponse,
    OptionCard,
    OptionListResponse,
    QuotaInfo,
    SuggestedCommunity,
)
from app.services.ai.i18n_utils import pick_locale
from app.services.ai.image_moderation import (
    BatchModerationOutcome,
    ImageModerationConfigError,
    image_moderation_service,
)
from app.services.ai.llm_client import LLMClientError, call_text, call_vision
from app.services.ai.log_repo import ai_post_log_repo
from app.services.ai.prompt_builder import (
    PROMPT_VERSION,
    build_image_messages,
    build_qa_messages,
    parse_llm_output,
)
from app.services.ai.quota_service import quota_service
from app.services.ai.rag_retriever import rag_retriever

logger = logging.getLogger(__name__)


def _split_keywords(zh_text: str, en_text: str, limit: int = 4) -> List[str]:
    """从风格/品牌描述里抽 chip 用的短关键词。

    AI Studio 编辑式布局每张卡下方要展示 2-4 个短词 (例:「先锋 · 极简」),
    047 seed 的 description_i18n 已经按「、」分隔写成短语,直接 split + trim
    即可。zh 缺失时退到 en (用 ", " / "; " / " and " 当分隔符)。
    """
    text = (zh_text or "").strip()
    if text:
        # zh 描述常用「、」「,」「,」分割短语;按这些字符切并去掉空串
        import re

        parts = [p.strip() for p in re.split(r"[、,，;；]", text) if p.strip()]
    else:
        text = (en_text or "").strip()
        if not text:
            return []
        import re

        parts = [
            p.strip()
            for p in re.split(r"[,;]| and ", text, flags=re.IGNORECASE)
            if p.strip()
        ]

    cleaned: List[str] = []
    for p in parts:
        # 句号兜底: 把整段长描述当一个 chip 显然违和, 这里掐到 6 字以内才收
        # (zh 4 字就是「实验精神」这种好词, 6 字 hard cap 防止脏数据)。
        # en 控在 18 字符以内 (例: "experimental fabrics")。
        head = p.split("。")[0].split(".")[0].strip()
        if not head:
            continue
        if len(head) <= 18:
            cleaned.append(head)
        if len(cleaned) >= limit:
            break
    return cleaned


# 默认从 communities 表挑活跃池给 LLM, 避免它编社区。
# 这里 LIMIT 30 + ORDER BY post_count 倒序就够,不再动态做用户偏好。
def _fetch_community_pool(db, limit: int = 30) -> List[Dict[str, Any]]:
    try:
        # 用尽量宽松的 select, 不假设 communities 表的具体列名
        resp = (
            db.table("communities")
            .select("id, name, slug")
            .limit(limit)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        logger.warning("[ai_post_service] fetch community pool failed: %s", e)
        return []


def _match_communities(
    chosen_names: List[str], pool: List[Dict[str, Any]]
) -> List[SuggestedCommunity]:
    """LLM 返回的社区名 → 实际 community 行,按 name 模糊命中,只取前 3。"""
    matched: List[SuggestedCommunity] = []
    name_index = {(c.get("name") or "").lower(): c for c in pool}
    for name in chosen_names[:3]:
        c = name_index.get((name or "").lower())
        if c:
            matched.append(
                SuggestedCommunity(id=c["id"], name=c["name"], slug=c.get("slug"))
            )
    return matched


class AIPostService:
    def __init__(self):
        self.db = get_supabase_admin()

    # -----------------------------------------------------------------
    # Q&A 选项 (PR-2 完整实现;PR-1 先给空骨架确保路由层可挂)
    # -----------------------------------------------------------------
    def get_styles_options(self, user_id: int, limit: int = 5) -> OptionListResponse:
        """Q1: styles top N, 用户已关注的设计师风格优先。

        多语言: name_i18n / description_i18n 是 JSONB,这里 pick en + zh
        填充到 OptionCard 的 name + name_zh,前端按 locale 选用 (与既有
        OptionCard 形态保持一致)。新增 locale 不需要改 schema 也不需要
        改 OptionCard, 只在这里多取一个 key 即可。

        AI Studio 编辑式布局 (V3 #25.5):
          - 把 description_i18n[zh] / [en] 填到 OptionCard.description,
            前端在风格卡下方展示 1-2 行说明。
          - 从描述里抽 ≤4 个短关键词填到 tags, 用作 chip 显示。
            约定 zh 描述里用「、」或「," 」分割短语,en 用 "; " 或 ", "。
        """
        # 用户偏好优先 (user_preferred_designers → designers.primary_style_id → styles)
        preferred_style_ids: List[int] = []
        try:
            pref = (
                self.db.table("user_preferred_designers")
                .select("designers(primary_style_id)")
                .eq("user_id", user_id)
                .execute()
            )
            if pref.data:
                for row in pref.data:
                    designer_obj = row.get("designers") or {}
                    sid = designer_obj.get("primary_style_id")
                    if sid and sid not in preferred_style_ids:
                        preferred_style_ids.append(sid)
        except Exception:
            preferred_style_ids = []

        result = (
            self.db.table("styles")
            .select("id, slug, name_i18n, description_i18n, cover_url, sort_order")
            .eq("is_active", True)
            .order("sort_order")
            .execute()
        )
        rows = result.data or []

        # 已关注前置
        if preferred_style_ids:
            preferred_set = set(preferred_style_ids)
            rows = sorted(rows, key=lambda r: (0 if r["id"] in preferred_set else 1, r.get("sort_order", 0)))

        cards: List[OptionCard] = []
        for r in rows[:limit]:
            desc_zh = pick_locale(r.get("description_i18n"), "zh") or ""
            desc_en = pick_locale(r.get("description_i18n"), "en") or ""
            description = desc_zh or desc_en or None
            tags = _split_keywords(desc_zh, desc_en, limit=4)
            cards.append(
                OptionCard(
                    id=r["id"],
                    slug=r.get("slug"),
                    name=pick_locale(r.get("name_i18n"), "en") or r.get("slug", ""),
                    name_zh=pick_locale(r.get("name_i18n"), "zh") or None,
                    cover_url=r.get("cover_url"),
                    description=description,
                    tags=tags,
                )
            )
        return OptionListResponse(options=cards, has_fallback=False)

    def get_brands_options(self, style_id: int, limit: int = 5) -> OptionListResponse:
        """Q2: brands WHERE primary_style_id = style_id LIMIT N。

        AI 发帖助手实际数据库里 designers 表为空,所有秀场挂在 brands 上,
        因此 Q2 用 brands 替代 designers。primary_style_id 来自 053 seed。

        降级策略: 0 命中时回退到全表 top N (按 id 排序保证稳定),保证流程
        不死局。等 brands 全量回填完成 (每个 style >= 5),fallback 不触发。

        AI Studio 编辑式布局 (V3 #25.5):
          - tags 填该品牌主风格名 (zh / en) + brands.category;
            前端在品牌名下方展示 chip。category 可能为 None,Filter 掉空值。
          - description 暂留空 (品牌没有结构化短描述), 前端按 falsy 处理。
        """
        result = (
            self.db.table("brands")
            .select("id, name, cover_image, vogue_slug, category, primary_style_id")
            .eq("primary_style_id", style_id)
            .limit(limit)
            .execute()
        )
        rows = result.data or []
        if not rows:
            fallback = (
                self.db.table("brands")
                .select("id, name, cover_image, vogue_slug, category, primary_style_id")
                .order("id")
                .limit(limit)
                .execute()
            )
            rows = fallback.data or []

        # 一次性把所有用到的 style_id → 名字 拉到内存,避免 N+1 SQL
        style_ids = {r.get("primary_style_id") for r in rows if r.get("primary_style_id")}
        style_name_map: Dict[int, Tuple[str, str]] = {}
        if style_ids:
            try:
                styles_resp = (
                    self.db.table("styles")
                    .select("id, name_i18n")
                    .in_("id", list(style_ids))
                    .execute()
                )
                for s in styles_resp.data or []:
                    style_name_map[s["id"]] = (
                        pick_locale(s.get("name_i18n"), "zh") or "",
                        pick_locale(s.get("name_i18n"), "en") or "",
                    )
            except Exception as e:
                logger.warning("[ai_post_service] fetch style names failed: %s", e)

        cards: List[OptionCard] = []
        for r in rows:
            tags: List[str] = []
            sid = r.get("primary_style_id")
            if sid and sid in style_name_map:
                zh, en = style_name_map[sid]
                # 优先 zh 名 (UI 跑 zh 居多), 退到 en
                if zh:
                    tags.append(zh)
                elif en:
                    tags.append(en)
            cat = (r.get("category") or "").strip()
            if cat and cat not in tags:
                tags.append(cat)
            cards.append(
                OptionCard(
                    id=r["id"],
                    slug=r.get("vogue_slug"),
                    name=r["name"],
                    cover_url=r.get("cover_image"),
                    tags=tags[:4],
                )
            )
        return OptionListResponse(options=cards, has_fallback=len(cards) == 0)

    def get_shows_options(self, brand_id: int, limit: int = 5) -> OptionListResponse:
        """Q3: shows WHERE brand_name = (brands.name from brand_id) LIMIT N。

        shows.brand_name 是字符串列,与 brands.name 一一对应 (建表时就这么设计),
        因此通过 brands.id → brands.name → shows.brand_name 间接关联。

        多语言: title_i18n 是 JSONB,这里 pick en 作为主名 (大多数秀场标题
        本身就是 EN 中性,如「Fall 2023 Ready-to-Wear」),无 i18n 时 fallback
        到 season。前端不需要拿 zh 译名 (秀场标题罕译),所以 OptionCard 的
        name_zh 留空。
        """
        # 先把 brand_id 翻译成 brand_name
        brand_lookup = (
            self.db.table("brands")
            .select("name")
            .eq("id", brand_id)
            .execute()
        )
        brand_name = brand_lookup.data[0]["name"] if brand_lookup.data else None

        rows: List[Dict[str, Any]] = []
        if brand_name:
            result = (
                self.db.table("shows")
                .select("id, season, title_i18n, cover_image, year")
                .eq("brand_name", brand_name)
                .order("year", desc=True)
                .limit(limit)
                .execute()
            )
            rows = result.data or []

        # 降级: 选到的 brand 还没录入秀场时,退到全库最新秀场,保证 Q3 不死局。
        if not rows:
            fallback = (
                self.db.table("shows")
                .select("id, season, title_i18n, cover_image, year")
                .order("year", desc=True)
                .limit(limit)
                .execute()
            )
            rows = fallback.data or []
        cards = []
        for r in rows:
            title = pick_locale(r.get("title_i18n"), "en")
            name = title or r.get("season") or "Show"
            subtitle = f"{r.get('year') or ''} {r.get('season') or ''}".strip()
            # AI Studio 编辑式布局: 卡片大字 = 品牌名,小字 = "year season",
            # 因此把 brand_name 放进 description 让前端单独排版,
            # 同时 subtitle 仍保留 (老前端读 subtitle, 新前端读 description + subtitle)。
            cards.append(
                OptionCard(
                    id=r["id"],
                    name=name,
                    cover_url=r.get("cover_image"),
                    subtitle=subtitle or None,
                    description=brand_name or None,
                )
            )
        return OptionListResponse(options=cards, has_fallback=len(cards) == 0)

    # -----------------------------------------------------------------
    # 配额
    # -----------------------------------------------------------------
    def get_quota(self, user_id: int) -> QuotaInfo:
        return quota_service.get_info(user_id)

    # -----------------------------------------------------------------
    # 生成
    # -----------------------------------------------------------------
    def generate(self, user_id: int, req: GenerateRequest) -> GenerateResponse:
        """
        QA_TEXT 流程:
          quota → RAG 召回 → prompt 拼装 → DeepSeek call_text → 解析 → 落日志
        IMAGE_BRIEF 流程:
          quota → 阿里云图片审核 → prompt 拼装 → Qwen-VL call_vision → 解析 → 落日志
        """
        check = quota_service.check_and_consume(user_id, is_regenerate=False)
        if not check.allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "QUOTA_EXCEEDED",
                    "reason": check.reason,
                    "quota": check.info.model_dump(),
                },
            )
        return self._do_generate(user_id, req, check.info, regenerated_from_log_id=None)

    def regenerate(self, user_id: int, log_id: int) -> GenerateResponse:
        check = quota_service.check_and_consume(user_id, is_regenerate=True)
        if not check.allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "QUOTA_EXCEEDED",
                    "reason": check.reason,
                    "quota": check.info.model_dump(),
                },
            )

        prev = ai_post_log_repo.get(log_id)
        if not prev or prev.get("user_id") != user_id:
            raise HTTPException(status_code=404, detail="日志不存在或不属于当前用户")

        # 复用上次的 request 快照, 重跑一次。
        snapshot = prev.get("prompt_snapshot") or {}
        original_req = snapshot.get("request") or {}
        try:
            req = GenerateRequest.model_validate(original_req)
        except Exception:
            raise HTTPException(status_code=400, detail="历史请求快照已不兼容,无法重跑")

        return self._do_generate(
            user_id, req, check.info, regenerated_from_log_id=log_id
        )

    # -----------------------------------------------------------------
    # 内部: 真实生成实现
    # -----------------------------------------------------------------
    def _do_generate(
        self,
        user_id: int,
        req: GenerateRequest,
        quota: QuotaInfo,
        regenerated_from_log_id: Optional[int],
    ) -> GenerateResponse:
        community_pool = _fetch_community_pool(self.db)

        if req.mode == AIPostMode.QA_TEXT:
            return self._generate_qa(user_id, req, community_pool, quota, regenerated_from_log_id)
        if req.mode == AIPostMode.IMAGE_BRIEF:
            return self._generate_image_brief(
                user_id, req, community_pool, quota, regenerated_from_log_id
            )
        raise HTTPException(status_code=400, detail=f"未知 mode: {req.mode}")

    # -----------------------------------------------------------------
    # QA_TEXT 模式
    # -----------------------------------------------------------------
    def _generate_qa(
        self,
        user_id: int,
        req: GenerateRequest,
        community_pool: List[Dict[str, Any]],
        quota: QuotaInfo,
        regenerated_from_log_id: Optional[int],
    ) -> GenerateResponse:
        rag_ctx = rag_retriever.build_qa_context(req.answers)
        system_prompt, user_prompt = build_qa_messages(rag_ctx, community_pool)

        snapshot = {
            "mode": "QA_TEXT",
            "request": req.model_dump(),
            "rag": rag_ctx,
            "system_prompt": system_prompt,
            "user_prompt": user_prompt,
        }

        try:
            llm_resp = call_text(
                system_prompt, user_prompt, provider=settings.AI_DEFAULT_PROVIDER
            )
        except LLMClientError as e:
            log_id = ai_post_log_repo.insert(
                user_id=user_id,
                mode="QA_TEXT",
                prompt_snapshot=snapshot,
                prompt_version=PROMPT_VERSION,
                model_provider=e.provider or settings.AI_DEFAULT_PROVIDER,
                model_name=e.model or "",
                status="error",
                error_message=str(e),
                regenerated_from_log_id=regenerated_from_log_id,
            )
            raise HTTPException(
                status_code=502,
                detail={"code": "LLM_FAILED", "log_id": log_id, "message": str(e)},
            )

        parsed = parse_llm_output(llm_resp.get("content", ""))
        suggested_communities = _match_communities(parsed["communities"], community_pool)

        log_id = ai_post_log_repo.insert(
            user_id=user_id,
            mode="QA_TEXT",
            prompt_snapshot=snapshot,
            prompt_version=PROMPT_VERSION,
            model_provider=llm_resp["provider"],
            model_name=llm_resp["model"],
            model_response={"raw": llm_resp.get("raw"), "parsed": parsed},
            tokens_used=llm_resp.get("tokens_used"),
            cost_cents=llm_resp.get("cost_cents"),
            status="success",
            regenerated_from_log_id=regenerated_from_log_id,
        )

        # 用户预览页要显示的「文案」: title + 空行 + content_text;前端可单独再编辑
        text = parsed["title"] + "\n\n" + parsed["content_text"] if parsed["title"] else parsed["content_text"]

        return GenerateResponse(
            log_id=log_id,
            generated_text=text,
            suggested_tags=parsed["tags"],
            suggested_communities=suggested_communities,
            metadata={
                "log_id": log_id,
                "provider": llm_resp["provider"],
                "model": llm_resp["model"],
                "prompt_version": PROMPT_VERSION,
                "mode": "QA_TEXT",
                "answers": req.answers,
                "title": parsed["title"],
                "tokens_used": llm_resp.get("tokens_used"),
                "cost_cents": llm_resp.get("cost_cents"),
            },
            quota=quota,
        )

    # -----------------------------------------------------------------
    # IMAGE_BRIEF 模式
    # -----------------------------------------------------------------
    def _generate_image_brief(
        self,
        user_id: int,
        req: GenerateRequest,
        community_pool: List[Dict[str, Any]],
        quota: QuotaInfo,
        regenerated_from_log_id: Optional[int],
    ) -> GenerateResponse:
        if not req.image_urls:
            raise HTTPException(status_code=400, detail="IMAGE_BRIEF 模式至少需要 1 张图片")

        # ---- 图片内容安全 ----
        try:
            outcome: BatchModerationOutcome = image_moderation_service.scan(req.image_urls)
        except ImageModerationConfigError as e:
            raise HTTPException(status_code=503, detail=f"图片审核未就绪: {e!s}")
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail=f"图片审核服务异常: {e!s}")

        if outcome.has_blocked:
            log_id = ai_post_log_repo.insert(
                user_id=user_id,
                mode="IMAGE_BRIEF",
                prompt_snapshot={"request": req.model_dump(), "moderation": {
                    "blocked_indices": outcome.blocked_indices,
                    "results": [r.__dict__ for r in outcome.results],
                }},
                prompt_version=PROMPT_VERSION,
                model_provider=settings.AI_DEFAULT_PROVIDER,
                model_name="(blocked-by-moderation)",
                status="blocked",
                error_message=f"images blocked: {outcome.blocked_indices}",
                regenerated_from_log_id=regenerated_from_log_id,
            )
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "IMAGE_BLOCKED",
                    "blocked_indices": outcome.blocked_indices,
                    "hit_scenes": [r.hit_scenes for r in outcome.results],
                    "log_id": log_id,
                },
            )

        # ---- RAG / Prompt ----
        image_ctx = rag_retriever.build_image_context(
            req.image_urls,
            req.answers.get("prompt_chip"),
            req.answers.get("user_note"),
        )
        system_prompt, user_prompt = build_image_messages(image_ctx, community_pool)

        snapshot = {
            "mode": "IMAGE_BRIEF",
            "request": req.model_dump(),
            "image_ctx": image_ctx,
            "system_prompt": system_prompt,
            "user_prompt": user_prompt,
            "moderation": {
                "blocked_indices": outcome.blocked_indices,
                "scenes_per_image": [r.hit_scenes for r in outcome.results],
            },
        }

        try:
            llm_resp = call_vision(
                system_prompt, user_prompt, req.image_urls, provider="qwen"
            )
        except LLMClientError as e:
            log_id = ai_post_log_repo.insert(
                user_id=user_id,
                mode="IMAGE_BRIEF",
                prompt_snapshot=snapshot,
                prompt_version=PROMPT_VERSION,
                model_provider=e.provider or "qwen",
                model_name=e.model or settings.QWEN_VL_MODEL,
                status="error",
                error_message=str(e),
                regenerated_from_log_id=regenerated_from_log_id,
            )
            raise HTTPException(
                status_code=502,
                detail={"code": "LLM_FAILED", "log_id": log_id, "message": str(e)},
            )

        parsed = parse_llm_output(llm_resp.get("content", ""))
        suggested_communities = _match_communities(parsed["communities"], community_pool)

        log_id = ai_post_log_repo.insert(
            user_id=user_id,
            mode="IMAGE_BRIEF",
            prompt_snapshot=snapshot,
            prompt_version=PROMPT_VERSION,
            model_provider=llm_resp["provider"],
            model_name=llm_resp["model"],
            model_response={"raw": llm_resp.get("raw"), "parsed": parsed},
            tokens_used=llm_resp.get("tokens_used"),
            cost_cents=llm_resp.get("cost_cents"),
            status="success",
            regenerated_from_log_id=regenerated_from_log_id,
        )

        text = parsed["title"] + "\n\n" + parsed["content_text"] if parsed["title"] else parsed["content_text"]

        return GenerateResponse(
            log_id=log_id,
            generated_text=text,
            suggested_tags=parsed["tags"],
            suggested_communities=suggested_communities,
            metadata={
                "log_id": log_id,
                "provider": llm_resp["provider"],
                "model": llm_resp["model"],
                "prompt_version": PROMPT_VERSION,
                "mode": "IMAGE_BRIEF",
                "answers": req.answers,
                "image_urls": req.image_urls,
                "title": parsed["title"],
                "tokens_used": llm_resp.get("tokens_used"),
                "cost_cents": llm_resp.get("cost_cents"),
            },
            quota=quota,
        )


ai_post_service = AIPostService()
