"""
AI 发帖助手 (V3 #25) 离线烟测.

不依赖 LLM / Supabase, 只验证:
  - prompt_builder.build_qa_messages / build_image_messages 输出符合预期
  - parse_llm_output 在不同 LLM 返回格式下都能稳健落地

跑法:
  cd backend && python -m scripts.ai_post_smoke

退出码 0 = 全通过, 1 = 至少一项断言失败。CI/本地都可挂在 git pre-push 上。
"""

from __future__ import annotations

import sys

from app.services.ai.prompt_builder import (
    PROMPT_VERSION,
    build_image_messages,
    build_qa_messages,
    parse_llm_output,
)


_FAILS: list[str] = []


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        _FAILS.append(msg)
        print(f"  ✗ {msg}")
    else:
        print(f"  ✓ {msg}")


def test_qa_prompt():
    print("[test] build_qa_messages")
    rag = {
        "style": {"id": 1, "name": "Avant-garde", "name_zh": "先锋", "description": "解构与实验"},
        "brand": {
            "id": 2, "name": "Yohji Yamamoto", "country": "JP",
            "founded_year": "1972", "founder": "Yohji Yamamoto", "category": "先锋设计师品牌",
        },
        "show": {"id": 3, "title": "FW23", "season": "Fall 23", "year": 2023, "city": "Paris", "brand_name": "Yohji Yamamoto"},
        "perspective": "OUTFIT",
    }
    pool = [{"id": 1, "name": "复古风", "slug": "vintage"}, {"id": 2, "name": "极简", "slug": "minimal"}]
    sys_p, usr_p = build_qa_messages(rag, pool)
    _assert("严格 JSON" in sys_p, "system prompt 含格式约束")
    _assert("Yohji Yamamoto" in usr_p, "user prompt 包含品牌名")
    _assert("OUTFIT" in usr_p, "user prompt 含角度")
    _assert("复古风" in usr_p, "user prompt 含 community 池")


def test_image_prompt():
    print("[test] build_image_messages")
    image_ctx = {"image_count": 3, "prompt_chip": "RECENT_BUY", "user_note": "新买的山本耀司大衣"}
    pool = [{"id": 1, "name": "复古风"}]
    sys_p, usr_p = build_image_messages(image_ctx, pool)
    _assert("RECENT_BUY" in usr_p, "user prompt 含 chip")
    _assert("最近买了什么" in usr_p, "chip 中文 label 已展开")
    _assert("新买的山本耀司大衣" in usr_p, "user_note 已注入")
    _assert("严格 JSON" in sys_p, "system prompt 含格式约束")


def test_parse_strict_json():
    print("[test] parse_llm_output: 严格 JSON")
    raw = '{"title":"今天的搭配","content_text":"今天穿了一件...","tags":["#yohji","#fw23"],"communities":["复古风"]}'
    parsed = parse_llm_output(raw)
    _assert(parsed["title"] == "今天的搭配", "title 解析")
    _assert("yohji" in parsed["tags"][0], "tag 解析")
    _assert(parsed["communities"][0] == "复古风", "community 解析")


def test_parse_messy_json():
    print("[test] parse_llm_output: 带前后文的脏 JSON")
    raw = """好的, 我帮你生成:
```json
{"title":"先锋黑色调","content_text":"这套利落剪裁","tags":["#avant"],"communities":["先锋"]}
```
希望你喜欢!"""
    parsed = parse_llm_output(raw)
    _assert(parsed["title"] == "先锋黑色调", "脏文本中提取 JSON")
    _assert(parsed["tags"][0] == "#avant", "tags 自动加 #")


def test_parse_plain_text_fallback():
    print("[test] parse_llm_output: 纯文本兜底")
    raw = "今天穿了一件 Yohji Yamamoto 的黑色大衣..."
    parsed = parse_llm_output(raw)
    _assert(parsed["title"] == "", "无 JSON 时 title 为空")
    _assert(raw in parsed["content_text"], "原文进 content_text")
    _assert(parsed["tags"] == [], "tags 为空 list")


def test_parse_tag_normalization():
    print("[test] parse_llm_output: tag 不带 # 自动补")
    raw = '{"title":"x","content_text":"y","tags":["yohji","fw23"],"communities":[]}'
    parsed = parse_llm_output(raw)
    _assert(all(t.startswith("#") for t in parsed["tags"]), "tag 自动补 #")


def main() -> int:
    print(f"AI 发帖助手 PROMPT_VERSION = {PROMPT_VERSION}\n")
    test_qa_prompt()
    test_image_prompt()
    test_parse_strict_json()
    test_parse_messy_json()
    test_parse_plain_text_fallback()
    test_parse_tag_normalization()

    print()
    if _FAILS:
        print(f"[FAIL] {len(_FAILS)} 项断言失败")
        for f in _FAILS:
            print(f"  - {f}")
        return 1
    print("[OK] 全部通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
