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
from typing import Optional, List, Dict, Any, Union
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
# Q&A 选项 (4 步问答的卡片)
# =====================================================

class OptionCard(BaseModel):
    """通用大卡片选项 (id + 名字 + 封面图)。

    id 类型为 Union[int, str]:
      - styles / brands / show_images 是 BIGSERIAL → int
      - shows 表 id 是 MongoDB ObjectId 字符串 (从 memfire 迁移过来的历史
        包袱), 与 post_service._validate_show_ids 处理一致。
    前端 navigation params 也按 number | string 接收。

    AI Studio 编辑式布局 (V3 #25.5) 新增字段:
      - description: 风格/品牌长描述 (Q1 风格说明、Q3 秀场所属品牌名等),
        用于卡片下方的二行小字。空字符串视同 None。
      - tags: 短关键词数组,渲染为方块 chip (例: 风格关键词 ["先锋","极简"])。
        默认空数组,旧前端忽略不显示即可。
    两个字段都向后兼容: 旧客户端不会读它们,后端 None / [] 也不破坏旧 UI。
    """
    id: Union[int, str]
    slug: Optional[str] = None
    name: str
    name_zh: Optional[str] = None
    cover_url: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class OptionListResponse(BaseModel):
    """Q1-Q4 通用选项列表返回。"""
    options: List[OptionCard]
    # 历史保留: 旧版 Q4 looks 走 fallback 时为 true。当前 4 步问答已移除 Q4 looks,
    # 字段恒为 false,但保留字段定义以维持前端 schema 兼容。
    has_fallback: bool = False


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
          "style_id": 1,                                # int
          "brand_id": 2,                                # int
          "show_id": "6978b1bf...",                     # str (MongoDB ObjectId) 或 int
          "perspective": "OUTFIT"                        # AIPostPerspective
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
