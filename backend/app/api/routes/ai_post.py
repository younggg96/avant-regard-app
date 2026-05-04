"""
AI 发帖助手路由 (V3 #25)。

接口契约 (前端 aiPostService.ts 必须严格对齐):
  GET  /api/ai-post/options/styles
  GET  /api/ai-post/options/brands?style_id=
  GET  /api/ai-post/options/shows?brand_id=
  GET  /api/ai-post/options/perspectives
  POST /api/ai-post/generate
  POST /api/ai-post/regenerate
  GET  /api/ai-post/quota

设计要点:
  - 所有接口要求登录 (get_current_user_id), 配额按用户。
  - 选项类接口故意不带分页, 业务上限就是 5,前端直接渲染。
  - generate / regenerate 的失败语义统一通过 HTTPException(detail=dict) 抛,
    路由层不再做翻译,前端按 detail.code 分支处理。
"""

from typing import List

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user_id
from app.core.response import success
from app.schemas.ai_post import (
    AIPostPerspective,
    GenerateRequest,
    OptionCard,
    OptionListResponse,
    QuotaResponse,
    RegenerateRequest,
)
from app.services.ai.ai_post_service import ai_post_service

router = APIRouter(prefix="/ai-post", tags=["AI 发帖助手"])


# =====================================================
# Q1-Q5 选项
# =====================================================

@router.get("/options/styles")
async def get_styles_options(
    current_user_id: int = Depends(get_current_user_id),
):
    """Q1: 风格大卡 (用户已关注的设计师风格优先)"""
    resp: OptionListResponse = ai_post_service.get_styles_options(current_user_id)
    return success(resp.model_dump())


@router.get("/options/brands")
async def get_brands_options(
    style_id: int = Query(..., description="Q1 选定的 style_id"),
    current_user_id: int = Depends(get_current_user_id),
):
    """Q2: 该风格下的品牌 (取代旧的 /options/designers,
    因数据库实际只录入了 brands,designers 表为空)。"""
    resp: OptionListResponse = ai_post_service.get_brands_options(style_id)
    return success(resp.model_dump())


@router.get("/options/shows")
async def get_shows_options(
    brand_id: int = Query(..., description="Q2 选定的 brand_id"),
    current_user_id: int = Depends(get_current_user_id),
):
    """Q3: 该品牌的秀场/系列"""
    resp: OptionListResponse = ai_post_service.get_shows_options(brand_id)
    return success(resp.model_dump())


@router.get("/options/perspectives")
async def get_perspectives_options(
    current_user_id: int = Depends(get_current_user_id),
):
    """Q4: 帖子角度 5 选 1 (枚举固定,不查 DB)"""
    options: List[OptionCard] = [
        OptionCard(id=1, slug=AIPostPerspective.OUTFIT.value, name="Outfit", name_zh="穿搭分享"),
        OptionCard(id=2, slug=AIPostPerspective.COLLECTION.value, name="Collection", name_zh="收藏分享"),
        OptionCard(id=3, slug=AIPostPerspective.REVIEW.value, name="Review", name_zh="单品测评"),
        OptionCard(id=4, slug=AIPostPerspective.RANT.value, name="Rant", name_zh="吐槽"),
        OptionCard(id=5, slug=AIPostPerspective.INSPIRATION.value, name="Inspiration", name_zh="灵感杂记"),
    ]
    resp = OptionListResponse(options=options, has_fallback=False)
    return success(resp.model_dump())


# =====================================================
# 生成 / 重新生成 / 配额
# =====================================================

@router.post("/generate")
async def generate(
    request: GenerateRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """生成 AI 帖子草稿 (V3 #25)。返回 log_id + 文本 + 标签 + 社区建议 + 配额。"""
    resp = ai_post_service.generate(current_user_id, request)
    return success(resp.model_dump())


@router.post("/regenerate")
async def regenerate(
    request: RegenerateRequest,
    current_user_id: int = Depends(get_current_user_id),
):
    """基于上次 log_id 重新生成 (每天 <= 3 次)。"""
    resp = ai_post_service.regenerate(current_user_id, request.log_id)
    return success(resp.model_dump())


@router.get("/quota")
async def get_quota(
    current_user_id: int = Depends(get_current_user_id),
):
    """剩余配额。前端 UI 显示「今日剩余 N 次」。"""
    info = ai_post_service.get_quota(current_user_id)
    return success(QuotaResponse(quota=info).model_dump())
