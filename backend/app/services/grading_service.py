"""
帖子内容评级引擎

评级规则（字数统计 + 结构化标签 + 品牌关键词）：
  A 级：300字+ 深度内容，奖励 30 元
  B 级：50字+ 单品介绍，奖励 15 元
  C 级：日常分享，奖励 5 元
  D 级：无关联，最低优先级
  F 级：违规自动驳回（与敏感内容过滤共用检测逻辑）
"""

import re
import threading
from typing import Optional

from app.schemas.post import PostGrade, GRADE_REWARD_MAP

SENSITIVE_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"赌博|博彩|开奖|下注",
        r"色情|裸体|约炮|性爱",
        r"毒品|大麻|冰毒|海洛因",
        r"枪支|弹药|军火",
        r"诈骗|传销|资金盘|杀猪盘",
        r"代购假货|高仿|A货|超A",
        r"fuck|shit|porn|xxx",
    ]
]

STRUCTURED_TAGS = {
    "OUTFIT", "ITEM_REVIEW", "ARTICLES",
}


def detect_sensitive_content(text: str) -> bool:
    """
    检测文本是否包含敏感/违规内容。
    F 级评级与审核驳回共用此函数，避免重复开发。
    """
    if not text:
        return False
    for pattern in SENSITIVE_PATTERNS:
        if pattern.search(text):
            return True
    return False


def _has_brand_keywords(
    post_type: str,
    brand_name: Optional[str],
    item_brand: Optional[str],
    brand_ids: list,
    content_text: str,
) -> bool:
    if brand_name or item_brand:
        return True
    if brand_ids:
        return True
    brand_hint_re = re.compile(
        r"(品牌|brand|设计师|designer|联名|collab)",
        re.IGNORECASE,
    )
    return bool(brand_hint_re.search(content_text))


def grade_post(
    post_type: str,
    content_text: str,
    title: str,
    brand_name: Optional[str] = None,
    item_brand: Optional[str] = None,
    brand_ids: list = None,
    show_ids: list = None,
) -> PostGrade:
    """
    根据规则对帖子进行评级，返回 PostGrade 枚举。
    """
    brand_ids = brand_ids or []
    show_ids = show_ids or []
    full_text = f"{title} {content_text}"
    char_count = len(full_text.strip())

    if detect_sensitive_content(full_text):
        return PostGrade.F

    has_structured_tag = post_type in STRUCTURED_TAGS
    has_brand = _has_brand_keywords(
        post_type, brand_name, item_brand, brand_ids, content_text
    )
    has_show = bool(show_ids)

    if char_count >= 300 and has_structured_tag and (has_brand or has_show):
        return PostGrade.A

    if char_count >= 50 and (
        post_type == "ITEM_REVIEW" or (has_structured_tag and has_brand)
    ):
        return PostGrade.B

    if char_count >= 10 and (has_structured_tag or has_brand or has_show):
        return PostGrade.C

    return PostGrade.D


def get_reward(grade: PostGrade) -> int:
    return GRADE_REWARD_MAP.get(grade, 0)


def grade_post_async(post_id: int):
    """
    异步触发评级：在后台线程中执行数据库读写，不阻塞请求。
    """
    thread = threading.Thread(
        target=_grade_and_persist, args=(post_id,), daemon=True
    )
    thread.start()


def _grade_and_persist(post_id: int):
    """读取帖子、计算评级、写回 grade 字段；F 级自动驳回。"""
    try:
        from app.db.supabase import get_supabase

        db = get_supabase()
        result = db.table("posts").select("*").eq("id", post_id).execute()
        if not result.data:
            return

        row = result.data[0]
        grade = grade_post(
            post_type=(row.get("post_type") or "").strip(),
            content_text=row.get("content_text", ""),
            title=row.get("title", ""),
            brand_name=row.get("brand_name"),
            item_brand=row.get("item_brand"),
            brand_ids=row.get("brand_ids") or [],
            show_ids=row.get("show_ids") or [],
        )

        update_data = {"grade": grade.value}
        if grade == PostGrade.F:
            update_data["audit_status"] = "REJECTED"

        db.table("posts").update(update_data).eq("id", post_id).execute()
    except Exception as e:
        print(f"[GradingEngine] Failed to grade post {post_id}: {e}")
