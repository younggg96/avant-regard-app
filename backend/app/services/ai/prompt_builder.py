"""
AI 发帖助手 — Prompt 拼装与输出解析。

PROMPT_VERSION 由人工 bump,每次改 prompt 都要 +1。所有日志会带版本,
方便后续按版本切流量做 A/B。

输出契约: LLM 必须返回 JSON
    {
      "title": "...",
      "content_text": "...",
      "tags": ["#xx", "#yy"],
      "communities": ["复古风", "极简"]
    }
解析失败时回退: 把 raw content 当 content_text, tags/communities 留空。
这样即便模型不守 JSON, 用户预览页仍可手改, 不至于整流挂掉。
"""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple

PROMPT_VERSION = "v1.0.0"

logger = logging.getLogger(__name__)


# =====================================================
# Prompt key 枚举 (与 admin /api/admin/ai-prompts 路由 + 054 表 key 列严格对齐)
# =====================================================
PROMPT_KEY_QA_SYSTEM = "qa_system"
PROMPT_KEY_IMAGE_BRIEF_SYSTEM = "image_brief_system"

ALL_PROMPT_KEYS = (PROMPT_KEY_QA_SYSTEM, PROMPT_KEY_IMAGE_BRIEF_SYSTEM)


# =====================================================
# System Prompt 默认值 (V3 #25 反虚构条款)
#
# 改动建议:
#   - 改文案首选走 admin web `/admin/ai-prompts`,不要直接改这里的常量,
#     省得每次微调都要部署。
#   - 这里的常量是兜底:DB 表丢了 / 不可达时仍然能保证 LLM 流程不崩。
# =====================================================
DEFAULT_QA_SYSTEM_PROMPT = """你是「Avant Regard」的发帖助手。
任务是基于用户提供的【风格 / 品牌 / 秀场 / 角度】,生成一篇真实
有质感的中文帖子。

严格约束:
1. 仅引用用户上下文中明确给出的品牌、秀场。如果上下文里没有,
   绝对不要编造名字、年份或地点。需要泛指时用「这一品牌」「这一季」。
2. 风格描述必须与给定的风格短描一致,不要扩散到其他流派。
3. 用户「角度」字段指明了帖子语气:
     - OUTFIT: 穿搭分享, 第一人称, 有具体单品搭配
     - COLLECTION: 收藏分享, 罗列收藏理由
     - REVIEW: 单品测评, 客观优缺点
     - RANT: 吐槽, 口语化, 带情绪但不脏
     - INSPIRATION: 灵感杂记, 散文化
4. 整篇 200-400 字, 标题 8-20 字。
5. 必须返回严格 JSON, 不要带任何代码块标记或解释:
   {"title": "...", "content_text": "...", "tags": ["#xx"], "communities": ["xx"]}
   tags 1-5 个, 全用 # 开头; communities 1-3 个,只能从给定的 community 列表中选。
"""


DEFAULT_IMAGE_BRIEF_SYSTEM_PROMPT = """你是「Avant Regard」的发帖助手。
用户上传了一组图片以及一个意图标签 (prompt_chip), 可能附带一句话说明。
请基于图片内容写一篇真实的中文分享帖。

严格约束:
1. 只描述你能从图中确认的视觉信息。不要猜测品牌或设计师名字, 除非用户
   在 user_note 中明确写了。
2. prompt_chip 决定语气:
     - RECENT_BUY: 最近买了什么, 兴奋分享, 有购买理由
     - FAVORITE_ITEM: 最喜欢的单品, 突出搭配场景
     - LOOK_APPRECIATION: 造型欣赏, 风格化叙述
     - CUSTOM: 按 user_note 走
3. 200-400 字, 标题 8-20 字。
4. 必须返回严格 JSON:
   {"title": "...", "content_text": "...", "tags": ["#xx"], "communities": ["xx"]}
"""


_DEFAULTS_BY_KEY: Dict[str, str] = {
    PROMPT_KEY_QA_SYSTEM: DEFAULT_QA_SYSTEM_PROMPT,
    PROMPT_KEY_IMAGE_BRIEF_SYSTEM: DEFAULT_IMAGE_BRIEF_SYSTEM_PROMPT,
}


# =====================================================
# DB override 读取 + 短缓存
#
# 设计:
#   - generate / regenerate 路径每次都拼 prompt,不能为此读一次 DB。
#   - 30s 缓存窗口对 admin "改完保存→稍等几秒看效果" 是可接受的代价,
#     避免热点路径跟 Supabase 网关来回 RTT 拖慢 generate。
#   - 缓存按 key 粒度,任意一项 admin 改完只需要刷它自己的 key
#     (`invalidate_prompt_cache(key)`)。
#   - DB 不可达时直接返 default,不抛异常,LLM 流程必须扛得住存储波动。
# =====================================================
_CACHE_TTL_SEC = 30.0
_cache: Dict[str, Tuple[float, str]] = {}     # key → (expires_at, content)


def _fetch_override_from_db(key: str) -> Optional[str]:
    """读 DB override; 不存在返 None, 异常返 None (静默降级到 default)。"""
    try:
        # 这里晚 import 避免 prompt_builder 在不带 supabase 配置的脚本里被导入时报错
        from app.db.supabase import get_supabase_admin
        db = get_supabase_admin()
        resp = (
            db.table("ai_prompt_overrides")
            .select("content")
            .eq("key", key)
            .limit(1)
            .execute()
        )
        if resp.data:
            return resp.data[0].get("content")
        return None
    except Exception as e:  # noqa: BLE001
        logger.warning("[prompt_builder] read override key=%s failed: %s", key, e)
        return None


def get_prompt(key: str) -> str:
    """运行时取某个 prompt 的当前值。DB 优先, 缓存 30s, 失败/缺失回 default。"""
    if key not in _DEFAULTS_BY_KEY:
        raise KeyError(f"unknown prompt key: {key}")

    now = time.monotonic()
    cached = _cache.get(key)
    if cached and cached[0] > now:
        return cached[1]

    override = _fetch_override_from_db(key)
    content = override if (override and override.strip()) else _DEFAULTS_BY_KEY[key]
    _cache[key] = (now + _CACHE_TTL_SEC, content)
    return content


def invalidate_prompt_cache(key: Optional[str] = None) -> None:
    """admin 改完保存后由路由层显式调,免得等 30s 才生效。key=None 清全部。"""
    if key is None:
        _cache.clear()
    else:
        _cache.pop(key, None)


def get_default_prompt(key: str) -> str:
    """admin 「重置回默认」按钮要展示默认值,这里直接返代码里那段。"""
    if key not in _DEFAULTS_BY_KEY:
        raise KeyError(f"unknown prompt key: {key}")
    return _DEFAULTS_BY_KEY[key]


# =====================================================
# QA_TEXT user prompt
# =====================================================
def build_qa_user_prompt(ctx: Dict[str, Any], community_pool: List[Dict[str, Any]]) -> str:
    parts: List[str] = []
    parts.append("【档案上下文】")
    if ctx.get("style"):
        s = ctx["style"]
        parts.append(
            f"- 风格: {s.get('name')} ({s.get('name_zh') or ''}) — {s.get('description') or ''}"
        )
    if ctx.get("brand"):
        b = ctx["brand"]
        meta = []
        if b.get("country"):
            meta.append(f"产地 {b['country']}")
        if b.get("founded_year"):
            meta.append(f"创立 {b['founded_year']}")
        if b.get("founder"):
            meta.append(f"创始人 {b['founder']}")
        if b.get("category"):
            meta.append(b["category"])
        meta_str = ", ".join(meta)
        parts.append(f"- 品牌: {b.get('name')}" + (f" ({meta_str})" if meta_str else ""))
    if ctx.get("show"):
        sh = ctx["show"]
        parts.append(
            f"- 秀场: {sh.get('title') or sh.get('season') or ''} "
            f"({sh.get('year') or ''}, {sh.get('brand_name') or ''})"
        )
        if sh.get("review_text"):
            parts.append(f"  秀评摘要: {(sh.get('review_text') or '')[:300]}")

    parts.append(f"\n【角度】 {ctx.get('perspective') or 'OUTFIT'}")

    # 限定可选社区,防止虚构
    if community_pool:
        names = ", ".join([c.get("name", "") for c in community_pool])
        parts.append(f"\n【可选社区池】 {names}")
        parts.append("communities 字段必须从上面这个列表中选 1-3 个。")

    parts.append("\n现在请按 system 约束输出严格 JSON。")
    return "\n".join(parts)


# =====================================================
# IMAGE_BRIEF user prompt
# =====================================================
_CHIP_LABELS = {
    "RECENT_BUY": "最近买了什么",
    "FAVORITE_ITEM": "最喜欢的单品",
    "LOOK_APPRECIATION": "造型欣赏",
    "CUSTOM": "自定义",
}


def build_image_user_prompt(
    image_ctx: Dict[str, Any], community_pool: List[Dict[str, Any]]
) -> str:
    chip = image_ctx.get("prompt_chip") or "CUSTOM"
    parts = [
        f"【意图】 {chip} ({_CHIP_LABELS.get(chip, '')})",
        f"【图片数】 {image_ctx.get('image_count', 0)}",
    ]
    note = (image_ctx.get("user_note") or "").strip()
    if note:
        parts.append(f"【用户补充】 {note}")
    if community_pool:
        names = ", ".join([c.get("name", "") for c in community_pool])
        parts.append(f"【可选社区池】 {names}")
        parts.append("communities 字段必须从上面这个列表中选 1-3 个。")
    parts.append("\n请基于上方图片按 system 约束输出严格 JSON。")
    return "\n".join(parts)


# =====================================================
# 暴露给 service 的 build* 入口
# =====================================================
def build_qa_messages(
    rag_ctx: Dict[str, Any], community_pool: List[Dict[str, Any]]
) -> Tuple[str, str]:
    return get_prompt(PROMPT_KEY_QA_SYSTEM), build_qa_user_prompt(rag_ctx, community_pool)


def build_image_messages(
    image_ctx: Dict[str, Any], community_pool: List[Dict[str, Any]]
) -> Tuple[str, str]:
    return (
        get_prompt(PROMPT_KEY_IMAGE_BRIEF_SYSTEM),
        build_image_user_prompt(image_ctx, community_pool),
    )


# =====================================================
# 输出解析
# =====================================================
_JSON_BLOCK = re.compile(r"\{[\s\S]*\}")


def parse_llm_output(content: str) -> Dict[str, Any]:
    """
    宽容解析:
      1. 优先 json.loads(content)
      2. 失败 → 提取第一段花括号 JSON
      3. 仍失败 → {"title":"", "content_text": content, "tags":[], "communities":[]}
    """
    text = (content or "").strip()
    if not text:
        return {"title": "", "content_text": "", "tags": [], "communities": []}

    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return _normalize(data, fallback_text=text)
    except Exception:
        pass

    m = _JSON_BLOCK.search(text)
    if m:
        try:
            data = json.loads(m.group(0))
            if isinstance(data, dict):
                return _normalize(data, fallback_text=text)
        except Exception:
            pass

    # 兜底: 把整段当 content_text
    return {
        "title": "",
        "content_text": text[:1500],
        "tags": [],
        "communities": [],
    }


def _normalize(data: Dict[str, Any], fallback_text: str) -> Dict[str, Any]:
    title = (data.get("title") or "").strip()[:200]
    content_text = (data.get("content_text") or data.get("content") or "").strip()
    if not content_text:
        content_text = fallback_text[:1500]

    raw_tags = data.get("tags") or []
    tags: List[str] = []
    if isinstance(raw_tags, list):
        for t in raw_tags[:8]:
            t = str(t).strip()
            if not t:
                continue
            if not t.startswith("#"):
                t = "#" + t
            tags.append(t[:30])

    raw_comms = data.get("communities") or data.get("suggested_communities") or []
    communities: List[str] = []
    if isinstance(raw_comms, list):
        for c in raw_comms[:5]:
            if isinstance(c, dict):
                communities.append(str(c.get("name", "")).strip())
            else:
                communities.append(str(c).strip())
        communities = [c for c in communities if c]

    return {
        "title": title,
        "content_text": content_text[:2000],
        "tags": tags,
        "communities": communities,
    }
