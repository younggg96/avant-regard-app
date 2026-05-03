"""
AI 发帖助手 (V3 #25) — 入参 / 出参 / 枚举

设计要点:
  - 两条产品线 (QA_TEXT 文字问答 / IMAGE_BRIEF 图片+简述) 共用一个
    GenerateRequest, 通过 mode 区分,避免前后端两套 schema 维护成本.
  - answers 用宽松字典 (Dict[str, Any]) 装载 Q1-Q5 的 ID/枚举,
    后端 ai_post_service 负责按 mode 解析与校验。Pydantic 层不强约束,
    给后续 prompt 模板演进留余地。
  - GenerateResponse 出参与 V3 #25 接口契约严格对齐:
        {generated_text, suggested_tags, suggested_communities, log_id, quota}
    log_id 必返回,前端「重新生成」按钮要带这个 id 上来。
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from enum import Enum


class AIPostMode(str, Enum):
    QA_TEXT = "QA_TEXT"
    IMAGE_BRIEF = "IMAGE_BRIEF"


class AIPostPerspective(str, Enum):
    """Q5 帖子角度 (5 选 1)"""
    OUTFIT = "OUTFIT"             # 穿搭分享
    COLLECTION = "COLLECTION"     # 收藏分享
    REVIEW = "REVIEW"             # 单品测评
    RANT = "RANT"                 # 吐槽
    INSPIRATION = "INSPIRATION"   # 灵感杂记


class ImageBriefChip(str, Enum):
    """图片+简述模式的 4 个 prompt chip"""
    RECENT_BUY = "RECENT_BUY"             # 最近买了什么
    FAVORITE_ITEM = "FAVORITE_ITEM"       # 最喜欢的单品
    LOOK_APPRECIATION = "LOOK_APPRECIATION"  # 造型欣赏
    CUSTOM = "CUSTOM"                     # 自定义 (需配 user_note)


# =====================================================
# Q&A 选项 (5 步问答的卡片)
# =====================================================

class OptionCard(BaseModel):
    """通用大卡片选项 (id + 名字 + 封面图)。"""
    id: int                                 # styles/designers/shows/looks 主键
    slug: Optional[str] = None              # styles 用 slug,其他表 None
    name: str
    name_zh: Optional[str] = None
    cover_url: Optional[str] = None
    subtitle: Optional[str] = None          # 例如 designer 的 brand,show 的 season


class OptionListResponse(BaseModel):
    """Q1-Q4 通用选项列表返回。"""
    options: List[OptionCard]
    has_fallback: bool = False              # Q4 走 fallback 时为 true,前端切到文字输入


# =====================================================
# 生成接口
# =====================================================

class GenerateRequest(BaseModel):
    """POST /api/ai-post/generate 入参 (V3 #25 接口契约)。"""
    mode: AIPostMode
    answers: Dict[str, Any] = Field(default_factory=dict)
    """
    QA_TEXT 模式:
        {
          "style_id": 1,
          "designer_id": 2,
          "show_id": 3,
          "look_id": 4 | null,
          "look_fallback_text": "细节文字描述" | null,    # Q4 fallback
          "perspective": "OUTFIT"                            # AIPostPerspective
        }
    IMAGE_BRIEF 模式:
        {
          "prompt_chip": "RECENT_BUY",          # ImageBriefChip
          "user_note": "可选 50 字内补充" | null
        }
    """
    image_urls: List[str] = Field(default_factory=list)     # IMAGE_BRIEF 必填 1-9 张
    context: Dict[str, Any] = Field(default_factory=dict)   # 预留扩展位

    @field_validator("image_urls")
    @classmethod
    def validate_image_urls(cls, v: List[str]) -> List[str]:
        if len(v) > 9:
            raise ValueError("最多 9 张图片")
        return v


class RegenerateRequest(BaseModel):
    """POST /api/ai-post/regenerate 入参。"""
    log_id: int = Field(..., description="上一次生成的 ai_post_service_logs.log_id")


class SuggestedCommunity(BaseModel):
    id: int
    name: str
    slug: Optional[str] = None


class QuotaInfo(BaseModel):
    """配额信息,每次生成接口都会回带,前端 UI 显示「今日剩余 N 次」。"""
    daily_generate_used: int
    daily_generate_limit: int
    daily_regen_used: int
    daily_regen_limit: int


class GenerateResponse(BaseModel):
    """生成接口出参 (V3 #25 接口契约)。"""
    log_id: int
    generated_text: str
    suggested_tags: List[str] = Field(default_factory=list)
    suggested_communities: List[SuggestedCommunity] = Field(default_factory=list)
    # 元数据透出给前端,后续真发帖时原样塞进 posts.generation_metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)
    quota: QuotaInfo


class QuotaResponse(BaseModel):
    """GET /api/ai-post/quota 出参。"""
    quota: QuotaInfo
