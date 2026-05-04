"""
档案 RAG 召回 (V3 #25)。

设计理念:
  - 首期不上向量库 (pgvector / 外置 Milvus 都太重),用结构化关系召回
    完全够用: styles → brands → shows 已经形成强主键链路,
    用户在 4 步问答里已经把要召回的档案手动选好了。
  - 视觉模式下没有档案结构化输入,但用户上传图本身是最强的"上下文",
    交给 Qwen-VL 直接看图描述,prompt_chip 作为意图分类。
  - 下一期升级到 pgvector: IMAGE_BRIEF 用户写 50 字时, 把这段文字
    embedding 召回相似档案,丰富 prompt 上下文。

返回结构 (字典) 直接灌进 prompt_builder, 不再做二次解析。
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from app.db.supabase import get_supabase
from app.services.ai.i18n_utils import pick_locale


class RAGRetriever:
    def __init__(self):
        self.db = get_supabase()

    # -----------------------------------------------------------------
    # 文字问答模式: 把 5 步答案展开成档案上下文
    # -----------------------------------------------------------------
    def build_qa_context(self, answers: Dict[str, Any]) -> Dict[str, Any]:
        """
        answers: { style_id, brand_id, show_id, perspective }

        返回:
          {
            "style": {"id","name","name_zh","description"} | None,
            "brand": {"id","name","country","founded_year","category"} | None,
            "show":  {"id","title","season","year","city","brand_name","review_text"} | None,
            "perspective": str,
          }
        缺失的关节填 None,prompt_builder 自动跳过。
        """
        ctx: Dict[str, Any] = {
            "style": None,
            "brand": None,
            "show": None,
            "perspective": answers.get("perspective"),
        }

        style_id = answers.get("style_id")
        if style_id:
            r = (
                self.db.table("styles")
                .select("id, slug, name_i18n, description_i18n")
                .eq("id", style_id)
                .execute()
            )
            if r.data:
                row = r.data[0]
                # prompt_builder 期待的是 {name, name_zh, description},
                # 在这里把 JSONB 拍平,Prompt 模板与 LLM 上下文不感知 i18n schema。
                # description 注入 LLM 的是中文,因为当前 system prompt 是中文;
                # 后续 prompt 也国际化时这里改成 pick_locale(_, user_locale)。
                ctx["style"] = {
                    "id": row["id"],
                    "name": pick_locale(row.get("name_i18n"), "en") or row.get("slug", ""),
                    "name_zh": pick_locale(row.get("name_i18n"), "zh") or None,
                    "description": pick_locale(row.get("description_i18n"), "zh")
                        or pick_locale(row.get("description_i18n"), "en"),
                }

        brand_id = answers.get("brand_id")
        if brand_id:
            r = (
                self.db.table("brands")
                .select("id, name, country, founded_year, category_i18n, founder")
                .eq("id", brand_id)
                .execute()
            )
            if r.data:
                row = r.data[0]
                # name 是专有名词不翻译,直接透传。category 拍平到 user_locale。
                ctx["brand"] = {
                    "id": row["id"],
                    "name": row.get("name", ""),
                    "country": row.get("country"),
                    "founded_year": row.get("founded_year"),
                    "founder": row.get("founder"),
                    "category": pick_locale(row.get("category_i18n"), "zh")
                        or pick_locale(row.get("category_i18n"), "en"),
                }

        show_id = answers.get("show_id")
        if show_id:
            r = (
                self.db.table("shows")
                .select(
                    "id, title_i18n, season, year, city, brand_name, review_text_i18n"
                )
                .eq("id", show_id)
                .execute()
            )
            if r.data:
                row = r.data[0]
                ctx["show"] = {
                    "id": row["id"],
                    "title": pick_locale(row.get("title_i18n"), "zh")
                        or pick_locale(row.get("title_i18n"), "en"),
                    "season": row.get("season"),
                    "year": row.get("year"),
                    "city": row.get("city"),
                    "brand_name": row.get("brand_name"),
                    "review_text": pick_locale(row.get("review_text_i18n"), "zh")
                        or pick_locale(row.get("review_text_i18n"), "en"),
                }

        return ctx

    # -----------------------------------------------------------------
    # 图片+简述模式: 把 chip + user_note 包装成上下文
    # -----------------------------------------------------------------
    def build_image_context(
        self, image_urls: list, prompt_chip: Optional[str], user_note: Optional[str]
    ) -> Dict[str, Any]:
        return {
            "image_count": len(image_urls or []),
            "prompt_chip": prompt_chip,
            "user_note": (user_note or "")[:50],     # 强约束 <= 50 字
        }


rag_retriever = RAGRetriever()
