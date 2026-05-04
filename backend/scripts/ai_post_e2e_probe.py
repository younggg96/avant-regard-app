"""
AI 发帖助手端到端 API 探针 (一次性诊断脚本)。

目标:
  - 走真实路由 (FastAPI TestClient), 不打 HTTP, 不需要后端常驻进程
  - 覆盖 4 步问答 5 个 GET 选项接口 + 配额接口
  - 复用 `get_current_user_id` 的依赖覆盖, 跳过 Supabase Auth, 用一个固定的
    fake_user_id 当被测用户
  - generate 接口可选 (默认开启, 用 --skip-generate 跳过, 因为会真打 LLM 扣 quota)

跑法:
  cd backend && source venv/bin/activate && python -m scripts.ai_post_e2e_probe
  cd backend && source venv/bin/activate && python -m scripts.ai_post_e2e_probe --skip-generate
"""

from __future__ import annotations

import argparse
import json
import sys
import traceback
from typing import Any

from fastapi.testclient import TestClient

from app.api.deps import get_current_user_id
from app.db.supabase import get_supabase_admin
from app.main import app


FAKE_USER_ID = 999999  # 用足够大的 id 避开真实 user


def section(title: str) -> None:
    print(f"\n{'=' * 6} {title} {'=' * 6}")


def show(resp, label: str) -> dict[str, Any] | None:
    print(f"[{resp.status_code}] {label}")
    try:
        body = resp.json()
    except Exception:
        print(f"  raw: {resp.text[:300]}")
        return None
    print("  body:", json.dumps(body, ensure_ascii=False, default=str)[:600])
    return body


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--skip-generate",
        action="store_true",
        help="跳过会真打 LLM / 扣配额的 POST /generate",
    )
    ap.add_argument(
        "--use-real-user",
        type=int,
        default=None,
        help="用一个真实 users.id (e.g. --use-real-user 12)，而不是 FAKE_USER_ID。"
             "测 generate 时必须用真实 id, 否则 quota upsert 会失败。",
    )
    args = ap.parse_args()

    user_id = args.use_real_user or FAKE_USER_ID
    print(f"using user_id = {user_id}")

    # 1) 覆盖 auth 依赖, 不验证 token
    app.dependency_overrides[get_current_user_id] = lambda: user_id
    client = TestClient(app)

    # 2) 触发健康检查, 顺带把可能的启动错误暴露出来
    section("0. /health")
    show(client.get("/health"), "/health")

    # 3) options/styles
    section("1. GET /api/ai-post/options/styles")
    body = show(
        client.get("/api/ai-post/options/styles"),
        "/api/ai-post/options/styles",
    )
    style_id = None
    if body and body.get("data", {}).get("options"):
        style_id = body["data"]["options"][0]["id"]
        print(f"  -> picked style_id = {style_id}")

    # 4) options/brands
    section(f"2. GET /api/ai-post/options/brands?style_id={style_id}")
    body = show(
        client.get(
            "/api/ai-post/options/brands",
            params={"style_id": style_id or 1},
        ),
        "/api/ai-post/options/brands",
    )
    brand_id = None
    if body and body.get("data", {}).get("options"):
        brand_id = body["data"]["options"][0]["id"]
        print(f"  -> picked brand_id = {brand_id}")

    # 5) options/shows
    section(f"3. GET /api/ai-post/options/shows?brand_id={brand_id}")
    body = show(
        client.get(
            "/api/ai-post/options/shows",
            params={"brand_id": brand_id or 1},
        ),
        "/api/ai-post/options/shows",
    )
    show_id = None
    if body and body.get("data", {}).get("options"):
        show_id = body["data"]["options"][0]["id"]
        print(f"  -> picked show_id = {show_id}")

    # 6) options/perspectives (硬编码)
    section("4. GET /api/ai-post/options/perspectives")
    show(
        client.get("/api/ai-post/options/perspectives"),
        "/api/ai-post/options/perspectives",
    )

    # 7) quota
    section("5. GET /api/ai-post/quota")
    show(client.get("/api/ai-post/quota"), "/api/ai-post/quota")

    # 8) 确认旧版 /options/looks 已下线 (应该 404)
    section("6. GET /api/ai-post/options/looks (下线确认, 应 404)")
    show(
        client.get(
            "/api/ai-post/options/looks",
            params={"show_id": show_id or "x"},
        ),
        "/api/ai-post/options/looks",
    )

    # 9) generate (真打 LLM, 默认跑)
    if args.skip_generate:
        print("\n[skip] POST /generate (--skip-generate)")
        return 0

    if not (style_id and brand_id and show_id):
        print(
            "\n[skip] POST /generate: 上一步 options 拿不全 (本地 Supabase "
            "可能没 brands/shows seed),无法构造 answers"
        )
        return 0

    section("7. POST /api/ai-post/generate (真打 LLM)")
    payload = {
        "mode": "QA_TEXT",
        "answers": {
            "style_id": int(style_id),
            "brand_id": int(brand_id),
            "show_id": show_id,
            "perspective": "OUTFIT",
        },
        "image_urls": [],
    }
    print("  request:", json.dumps(payload, ensure_ascii=False))
    resp = client.post("/api/ai-post/generate", json=payload)
    body = show(resp, "/api/ai-post/generate")

    # 关键: 验证错误响应 detail 是 dict 时, 仍然能拿到可读 message
    if resp.status_code >= 400 and body:
        print("\n  ↳ 错误体结构分析:")
        detail = body.get("detail")
        if isinstance(detail, dict):
            print(
                f"    detail.code     = {detail.get('code')}\n"
                f"    detail.message  = {detail.get('message')}\n"
                f"    detail.log_id   = {detail.get('log_id')}"
            )
        else:
            print(f"    detail (top)    = {detail}")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        traceback.print_exc()
        sys.exit(1)
