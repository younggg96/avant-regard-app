"""
数字护照 · AI 三视图生成 联调烟测。

会真实调用 OpenAI images.edit 并真实写 Supabase Storage,一次跑掉三张图的
计费额度,不要挂进 CI。用途是换模型 / 改 prompt 后人工看一眼出图质量。

跑法:
  cd backend && ./venv/bin/python -m scripts.three_view_smoke
  cd backend && ./venv/bin/python -m scripts.three_view_smoke <源图URL>

默认跳过配额扣减(--with-quota 可打开),因为 daily_three_view_count 列
依赖 migration 085,未应用时扣减会直接报错。

退出码 0 = 三张图全部生成并上传成功。
"""

from __future__ import annotations

import sys
import time

from app.services.ai.three_view_service import VIEW_SPECS, three_view_service


# Alaïa Fall 22 的秀场图,在 _ALLOWED_SOURCE_HOSTS 白名单内,适合当默认样本:
# 原图是上身照,能同时验证「抠掉模特」和「补出侧背面」两件事。
_DEFAULT_SOURCE = (
    "https://assets.vogue.com/photos/61ee0a8f3099cf49778ade70/master/"
    "w_2560%2Cc_limit/00001-Alaia-Fall-22-Paris-credit-brand.jpg"
)


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    with_quota = "--with-quota" in sys.argv
    source = args[0] if args else _DEFAULT_SOURCE

    print(f"[source] {source}")
    print(f"[quota]  {'启用' if with_quota else '跳过 (--with-quota 可开启)'}")

    t0 = time.time()
    if with_quota:
        result = three_view_service.generate(user_id=1, source_image_url=source)
        views = result.views
        print(f"[quota]  {result.quota_used}/{result.quota_limit}")
    else:
        client = three_view_service._client()
        png = three_view_service._fetch_source_png(source)
        print(f"[source] 压缩后 {len(png) // 1024} KB")
        from concurrent.futures import ThreadPoolExecutor

        with ThreadPoolExecutor(max_workers=len(VIEW_SPECS)) as pool:
            views = list(
                pool.map(
                    lambda spec: three_view_service._generate_one(client, png, spec),
                    VIEW_SPECS,
                )
            )

    print(f"[done]   {time.time() - t0:.1f}s")
    for v in views:
        status = v.url if v.url else f"FAILED — {v.error}"
        print(f"  {v.slug:<6} {v.label}  {status}")

    failed = [v for v in views if not v.url]
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
