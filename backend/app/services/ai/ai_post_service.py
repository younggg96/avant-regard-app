"""
AI 发帖助手 — 业务编排层。

职责 (V3 #25):
  - get_qa_options(): Q1-Q5 的卡片选项,从档案表实拉取 (styles / designers /
    shows / show_images),不能硬编码,Q4 无 look 时返回 has_fallback=True。
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
from app.db.supabase import get_supabase
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
        self.db = get_supabase()

    # -----------------------------------------------------------------
    # Q&A 选项 (PR-2 完整实现;PR-1 先给空骨架确保路由层可挂)
    # -----------------------------------------------------------------
    def get_styles_options(self, user_id: int, limit: int = 5) -> OptionListResponse:
        """Q1: styles top N, 用户已关注的设计师风格优先。

        多语言: name_i18n / description_i18n 是 JSONB,这里 pick en + zh
        填充到 OptionCard 的 name + name_zh,前端按 locale 选用 (与既有
        OptionCard 形态保持一致)。新增 locale 不需要改 schema 也不需要
        改 OptionCard, 只在这里多取一个 key 即可。
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
            .select("id, slug, name_i18n, cover_url, sort_order")
            .eq("is_active", True)
            .order("sort_order")
            .execute()
        )
        rows = result.data or []

        # 已关注前置
        if preferred_style_ids:
            preferred_set = set(preferred_style_ids)
            rows = sorted(rows, key=lambda r: (0 if r["id"] in preferred_set else 1, r.get("sort_order", 0)))

        cards = [
            OptionCard(
                id=r["id"],
                slug=r.get("slug"),
                name=pick_locale(r.get("name_i18n"), "en") or r.get("slug", ""),
                name_zh=pick_locale(r.get("name_i18n"), "zh") or None,
                cover_url=r.get("cover_url"),
            )
            for r in rows[:limit]
        ]
        return OptionListResponse(options=cards, has_fallback=False)

    def get_designers_options(self, style_id: int, limit: int = 5) -> OptionListResponse:
        """Q2: designers WHERE primary_style_id = style_id LIMIT N。"""
        result = (
            self.db.table("designers")
            .select("id, name, slug, image_url")
            .eq("primary_style_id", style_id)
            .limit(limit)
            .execute()
        )
        cards = [
            OptionCard(
                id=r["id"],
                slug=r.get("slug"),
                name=r["name"],
                cover_url=r.get("image_url"),
            )
            for r in (result.data or [])
        ]
        return OptionListResponse(options=cards, has_fallback=len(cards) == 0)

    def get_shows_options(self, designer_id: int, limit: int = 5) -> OptionListResponse:
        """Q3: shows WHERE designer_id = designer_id LIMIT N。

        多语言: title_i18n 是 JSONB,这里 pick en 作为主名 (大多数秀场标题
        本身就是 EN 中性,如「Fall 2023 Ready-to-Wear」),无 i18n 时 fallback
        到 season。前端不需要拿 zh 译名 (秀场标题罕译),所以 OptionCard 的
        name_zh 留空。
        """
        result = (
            self.db.table("shows")
            .select("id, season, title_i18n, cover_image, year")
            .eq("designer_id", designer_id)
            .order("year", desc=True)
            .limit(limit)
            .execute()
        )
        cards = []
        for r in (result.data or []):
            title = pick_locale(r.get("title_i18n"), "en")
            name = title or r.get("season") or "Show"
            subtitle = f"{r.get('year') or ''} {r.get('season') or ''}".strip()
            cards.append(
                OptionCard(
                    id=r["id"],
                    name=name,
                    cover_url=r.get("cover_image"),
                    subtitle=subtitle or None,
                )
            )
        return OptionListResponse(options=cards, has_fallback=len(cards) == 0)

    def get_looks_options(self, show_id: int, limit: int = 5) -> OptionListResponse:
        """Q4: show_images WHERE show_id = show_id AND image_type = 'LOOK'。"""
        result = (
            self.db.table("show_images")
            .select("id, image_url, sort_order")
            .eq("show_id", show_id)
            .eq("image_type", "LOOK")
            .order("sort_order")
            .limit(limit)
            .execute()
        )
        cards = [
            OptionCard(
                id=r["id"],
                name=f"Look {idx + 1}",
                cover_url=r.get("image_url"),
            )
            for idx, r in enumerate(result.data or [])
        ]
        # 没有 look 时 fallback 到「描述细节」文字输入
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
