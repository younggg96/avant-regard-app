"""
AI 发帖助手 - Prompt 运行时管理 (V3 #25.5)。

admin 在不重新部署的情况下查看与修改 system prompt。

接口契约 (前端 web admin /admin/ai-prompts 严格对齐):
  GET    /api/admin/ai-prompts            列出所有可被覆盖的 prompt
  PUT    /api/admin/ai-prompts/{key}      更新某条 prompt (覆盖 default)
  DELETE /api/admin/ai-prompts/{key}      重置回 default (删除 DB 行)
  POST   /api/admin/ai-prompts/preview    用 fixture 拼一次完整 messages, 不调 LLM

设计要点:
  - 与 admin.py 隔离, 因为 prompt 管理逻辑跟运营 admin 关心的事完全不重叠。
  - 鉴权全部走 get_current_admin_user (现有体系)。
  - 所有写操作改完后立即 invalidate 内存缓存, 不等 30s。
  - preview 不打 LLM, 不消耗 token, 不写日志, 纯函数级 prompt 拼装。
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field

from app.api.deps import get_current_admin_user
from app.core.response import success
from app.db.supabase import get_supabase_admin
from app.services.ai.prompt_builder import (
    ALL_PROMPT_KEYS,
    PROMPT_KEY_IMAGE_BRIEF_SYSTEM,
    PROMPT_KEY_QA_SYSTEM,
    PROMPT_VERSION,
    build_image_user_prompt,
    build_qa_user_prompt,
    get_default_prompt,
    get_prompt,
    invalidate_prompt_cache,
)

router = APIRouter(prefix="/admin/ai-prompts", tags=["管理员-AI Prompt"])


# =====================================================
# 请求/响应模型
# =====================================================

class PromptItem(BaseModel):
    """admin 列表项: 当前值 + default + 是否被覆盖 + 审计字段。"""
    key: str
    label: str                                       # 给 UI 用的可读名
    description: str                                 # 一句话说明这条 prompt 在哪用
    current: str                                     # 当前 runtime 实际生效的内容
    default: str                                     # hardcoded 默认值
    is_overridden: bool                              # current != default
    updated_at: Optional[datetime] = None
    updated_by: Optional[int] = None
    notes: Optional[str] = None


class PromptListResponse(BaseModel):
    items: List[PromptItem]
    prompt_version: str                              # 当前代码层 PROMPT_VERSION


class UpdatePromptRequest(BaseModel):
    content: str = Field(..., min_length=10, max_length=8000)
    notes: Optional[str] = Field(None, max_length=500)


class PreviewRequest(BaseModel):
    """admin 预览拼装结果用。两条 system 都接受 override 字符串, 不传就用当前生效值。"""
    qa_system_override: Optional[str] = None
    image_brief_system_override: Optional[str] = None


class PreviewModeResult(BaseModel):
    system_prompt: str
    user_prompt: str


class PreviewResponse(BaseModel):
    qa: PreviewModeResult
    image_brief: PreviewModeResult


# =====================================================
# UI 元数据 (label / description), 集中放, 改文案不需要碰前端
# =====================================================
_KEY_LABELS: Dict[str, Dict[str, str]] = {
    PROMPT_KEY_QA_SYSTEM: {
        "label": "QA 文字模式 - System Prompt",
        "description": "5 步问答 (style→brand→show→perspective) 走 DeepSeek 时的 system 角色文本。",
    },
    PROMPT_KEY_IMAGE_BRIEF_SYSTEM: {
        "label": "图片+简述模式 - System Prompt",
        "description": "用户上传图片 + chip + user_note 走 Qwen-VL 时的 system 角色文本。",
    },
}


# =====================================================
# Fixture: preview 用的稳定示例数据
#
# 这套数据故意做"日常但有特点"的真实 case: 山本耀司 FW23 黑色解构外套穿搭。
# 改 fixture 时请保持档案库里真实存在的字段全部覆盖, 让 admin 能看到
# prompt 在所有插槽都被填满后的样子。
# =====================================================
_PREVIEW_QA_CTX: Dict[str, Any] = {
    "style": {
        "id": 1,
        "name": "Avant-garde",
        "name_zh": "先锋",
        "description": "强调解构、不规则廓形与实验性面料,挑战传统审美",
    },
    "brand": {
        "id": 2,
        "name": "Yohji Yamamoto",
        "country": "JP",
        "founded_year": "1972",
        "founder": "Yohji Yamamoto",
        "category": "先锋设计师品牌",
    },
    "show": {
        "id": "preview-show-fw23",
        "title": "Yohji Yamamoto Fall 2023 Ready-to-Wear",
        "season": "Fall 2023",
        "year": 2023,
        "brand_name": "Yohji Yamamoto",
        "review_text": "全黑色调与不对称结构延续了山本一贯的语言, 比起前几季更克制",
    },
    "perspective": "OUTFIT",
}

_PREVIEW_IMAGE_CTX: Dict[str, Any] = {
    "image_count": 3,
    "prompt_chip": "RECENT_BUY",
    "user_note": "新买的 Yohji 解构外套, 想配一身全黑",
}

_PREVIEW_COMMUNITY_POOL: List[Dict[str, Any]] = [
    {"id": 1, "name": "Fashion Outfits", "slug": "fashion-outfit"},
    {"id": 2, "name": "Avant-garde", "slug": "avant-garde"},
    {"id": 3, "name": "Vintage", "slug": "vintage"},
]


# =====================================================
# 内部工具
# =====================================================

def _validate_key(key: str) -> None:
    if key not in ALL_PROMPT_KEYS:
        raise HTTPException(
            status_code=400,
            detail=f"unknown prompt key: {key}; valid: {list(ALL_PROMPT_KEYS)}",
        )


def _fetch_override_row(db, key: str) -> Optional[Dict[str, Any]]:
    """读 ai_prompt_overrides 一行;不存在返 None。"""
    resp = (
        db.table("ai_prompt_overrides")
        .select("*")
        .eq("key", key)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def _build_item(db, key: str) -> PromptItem:
    """把 default + DB override 合成一个 PromptItem 给 admin 用。"""
    default = get_default_prompt(key)
    row = _fetch_override_row(db, key)
    current = (row.get("content") if row else None) or default
    labels = _KEY_LABELS.get(key, {"label": key, "description": ""})
    return PromptItem(
        key=key,
        label=labels["label"],
        description=labels["description"],
        current=current,
        default=default,
        is_overridden=bool(row and (row.get("content") or "").strip() != default.strip()),
        updated_at=row.get("updated_at") if row else None,
        updated_by=row.get("updated_by") if row else None,
        notes=row.get("notes") if row else None,
    )


# =====================================================
# 路由
# =====================================================

@router.get("")
def list_prompts(
    current_user_id: int = Depends(get_current_admin_user),
):
    """列出所有可被覆盖的 prompt + 各自 default / current / 审计信息。"""
    db = get_supabase_admin()
    items = [_build_item(db, key) for key in ALL_PROMPT_KEYS]
    resp = PromptListResponse(items=items, prompt_version=PROMPT_VERSION)
    return success(resp.model_dump())


@router.put("/{key}")
def update_prompt(
    request: UpdatePromptRequest,
    key: str = Path(..., description="qa_system | image_brief_system"),
    current_user_id: int = Depends(get_current_admin_user),
):
    """覆盖某条 prompt。空白 / 跟 default 完全相同时建议走 DELETE 而不是 PUT。"""
    _validate_key(key)
    content = request.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="content 不能为空字符串")

    db = get_supabase_admin()
    # upsert: PRIMARY KEY = key, 没有就 INSERT, 有就 UPDATE
    # NB: PostgREST 不解析 "now()" 字面量, 会把它当成普通字符串发给 PG, 触发
    # invalid input syntax for type timestamp with time zone。这里显式传 ISO,
    # supabase-py 走 JSON 序列化时 datetime 自动 isoformat。
    db.table("ai_prompt_overrides").upsert(
        {
            "key": key,
            "content": content,
            "updated_by": current_user_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "notes": request.notes or None,
        },
        on_conflict="key",
    ).execute()

    # 立即清缓存, 否则 generate 路径要等 30s 才看到改动
    invalidate_prompt_cache(key)

    return success(_build_item(db, key).model_dump())


@router.delete("/{key}")
def reset_prompt(
    key: str = Path(..., description="qa_system | image_brief_system"),
    current_user_id: int = Depends(get_current_admin_user),
):
    """重置回 hardcoded default (删除 DB override 行)。"""
    _validate_key(key)
    db = get_supabase_admin()
    db.table("ai_prompt_overrides").delete().eq("key", key).execute()
    invalidate_prompt_cache(key)
    return success(_build_item(db, key).model_dump())


@router.post("/preview")
def preview_prompts(
    request: PreviewRequest,
    current_user_id: int = Depends(get_current_admin_user),
):
    """
    用一组真实 fixture 拼一次完整的 (system_prompt, user_prompt) 给 admin 看,
    不打 LLM。请求体里可以带未保存的 system prompt 文本预览改动效果。
    """
    qa_system = (
        request.qa_system_override
        if (request.qa_system_override and request.qa_system_override.strip())
        else get_prompt(PROMPT_KEY_QA_SYSTEM)
    )
    image_system = (
        request.image_brief_system_override
        if (request.image_brief_system_override and request.image_brief_system_override.strip())
        else get_prompt(PROMPT_KEY_IMAGE_BRIEF_SYSTEM)
    )

    qa_user = build_qa_user_prompt(_PREVIEW_QA_CTX, _PREVIEW_COMMUNITY_POOL)
    image_user = build_image_user_prompt(_PREVIEW_IMAGE_CTX, _PREVIEW_COMMUNITY_POOL)

    resp = PreviewResponse(
        qa=PreviewModeResult(system_prompt=qa_system, user_prompt=qa_user),
        image_brief=PreviewModeResult(system_prompt=image_system, user_prompt=image_user),
    )
    return success(resp.model_dump())
