"""
数字护照 · 上线前自检。

项目里没有配 SUPABASE_DB_URL,迁移只能到控制台 SQL Editor 里手动贴,
所以需要一个能随时复跑的脚本确认表结构到底应用了没有。

两套后端是分开的库,迁移要各贴一次,别只看一边:
  .env      国际版 Supabase
  .env.cn   国内版 MemFireDB (前端 `npm run start:cn` 连的就是这套)

跑法:
  cd backend && ./venv/bin/python -m scripts.passport_preflight        # 国际版
  cd backend && ./venv/bin/python -m scripts.passport_preflight --cn   # 国内版

退出码 0 = 三视图与归因两条链路依赖的表结构、配置都就位。
"""

from __future__ import annotations

import sys

from app.core.config import settings


def _connect(use_cn: bool):
    """返回 (client, 库地址描述)。--cn 时绕开 settings 直接读 .env.cn。"""
    if not use_cn:
        from app.db.supabase import get_supabase_admin

        return get_supabase_admin(), settings.SUPABASE_URL

    from dotenv import dotenv_values
    from supabase import create_client

    cfg = dotenv_values(".env.cn")
    url = cfg.get("SUPABASE_URL")
    key = cfg.get("SUPABASE_SERVICE_KEY") or cfg.get("SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("读不到 .env.cn 里的 SUPABASE_URL / SUPABASE_SERVICE_KEY")
    return create_client(url, key), url


def main() -> int:
    use_cn = "--cn" in sys.argv
    db, target = _connect(use_cn)
    print(f"目标库: {target}  ({'国内版 .env.cn' if use_cn else '国际版 .env'})\n")
    missing: list[str] = []

    # (展示名, 表, 列) —— 用 select 单列探测,列不存在时 PostgREST 会报错。
    columns = [
        ("085 三视图配额", "ai_post_quota", "daily_three_view_count"),
        ("086 归因配额", "ai_post_quota", "daily_attribution_count"),
        ("086 档案品牌外键", "user_archive_items", "brand_id"),
        ("086 档案发布年份", "user_archive_items", "release_year"),
        ("086 档案有效性状态", "user_archive_items", "validity_status"),
        ("086 归因标注表", "passport_attributions", "id"),
        ("087 审核留痕", "user_archive_items", "review_note"),
        ("088 三视图生成记录", "passport_three_views", "id"),
        ("088 AI 图来源标记", "user_archive_items", "ai_photos"),
    ]

    print("表结构:")
    for label, table, column in columns:
        try:
            db.table(table).select(column).limit(1).execute()
            print(f"  ✓ {label}  ({table}.{column})")
        except Exception:
            print(f"  ✗ {label}  ({table}.{column}) 不存在")
            missing.append(f"{table}.{column}")

    print("\n配置:")
    for label, value in [
        ("OPENAI_API_KEY (三视图)", settings.OPENAI_API_KEY),
        ("QWEN_API_KEY (归因视觉识别)", settings.QWEN_API_KEY),
    ]:
        if value:
            print(f"  ✓ {label}")
        else:
            print(f"  ✗ {label} 未配置")
            missing.append(label)

    # 配置齐不等于打得通。生产在上海腾讯云,直连 api.openai.com 是连接阶段
    # 挂住 —— 表现为前端"请求超时"而不是任何错误。这一项必须在服务器上跑
    # 才有意义,本地(能翻墙的机器)永远是绿的。
    print("\n上游连通性:")
    if settings.OPENAI_API_KEY:
        import httpx

        base = settings.OPENAI_BASE_URL.rstrip("/")
        try:
            r = httpx.get(
                f"{base}/models",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                timeout=httpx.Timeout(15, connect=settings.OPENAI_CONNECT_TIMEOUT),
            )
            if r.status_code == 200:
                print(f"  ✓ 图像服务可达 ({base})")
            elif r.status_code in (401, 403):
                body = r.text[:300]
                # 403 + unsupported_country 不是 key 的问题,是反代落在了
                # OpenAI 不服务的地区(最常见是香港)。两者提示完全不同,
                # 混为一谈会把人引到错误的方向上排查半天。
                if "unsupported_country" in body or "country, region" in body.lower():
                    print(f"  ✗ {base} 所在地区不被 OpenAI 支持")
                    print("    反代节点别放香港,换东京 / 新加坡 / 美西")
                    missing.append("反代节点地区不受支持")
                else:
                    print(f"  ✗ {base} 可达但鉴权失败 ({r.status_code})")
                    print(f"    {body[:160]}")
                    missing.append("OPENAI_API_KEY 无效")
            else:
                print(f"  ! {base} 返回 {r.status_code}: {r.text[:160]}")
        except Exception as e:
            print(f"  ✗ 连不上 {base}: {type(e).__name__}")
            print("    国内服务器需把 OPENAI_BASE_URL 指向可达的反代网关")
            missing.append("OPENAI_BASE_URL 不可达")

    print("\n参照库:")
    try:
        brands = db.table("brands").select("id", count="exact").limit(1).execute().count
        shows = db.table("shows").select("id", count="exact").limit(1).execute().count
        imgs = (
            db.table("show_images").select("id", count="exact").limit(1).execute().count
        )
        print(f"  brands {brands} · shows {shows} · show_images {imgs}")
        if not imgs:
            # 不算失败:归因链路不依赖参照图也能跑,只是证据会弱一档。
            print(
                "  ! show_images 为空,候选证据只能来自模型视觉推理,"
                "出不了「N 张参照图中 M 张一致」"
            )
    except Exception as e:
        print(f"  ✗ 读参照库失败: {e}")

    print()
    if missing:
        suffix = " --cn" if use_cn else ""
        print(f"{len(missing)} 项未就位,请到该库的 SQL Editor 应用:")
        print("  app/db/migrations/085_three_view_quota.sql")
        print("  app/db/migrations/086_passport_attribution.sql")
        print("  app/db/migrations/087_archive_review_queue.sql")
        print("  app/db/migrations/088_three_view_provenance.sql")
        print(f"贴完复跑: ./venv/bin/python -m scripts.passport_preflight{suffix}")
        return 1
    print("全部就位")
    return 0


if __name__ == "__main__":
    sys.exit(main())
