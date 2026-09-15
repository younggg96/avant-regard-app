"""
数字护照 · 三视图溯源与后台管理端到端验证 (088)。

直接造 passport_three_views 记录和档案条目(不调 OpenAI,不烧钱),验证:

  - 入库时服务端能反查出哪些照片是 AI 生成的,回填进 ai_photos
  - 客户端谎称「AI 图是实拍」不起作用(反查以生成记录为准)
  - 失败的生成记录不会被当成 AI 图(status != success 的不算)
  - 档案落库后能回填 passport_three_views.archive_item_id
  - 典藏全量管理的列表、搜索、改字段、删除
  - 三视图列表与用量统计
  - 下架生成图:记录留痕 + 从引用它的档案 photos/ai_photos 里摘掉

真实写库,结束时无论成败都清理(finally)。默认跑国内库:

  cd backend && ./venv/bin/python -m scripts.three_view_admin_e2e

加 --intl 改跑国际版 Supabase。
"""

from __future__ import annotations

import os
import sys

from dotenv import dotenv_values

# settings 在 import 时固化,必须抢在任何 app.* 之前铺好环境变量。
if "--intl" not in sys.argv:
    _cn = dotenv_values(".env.cn")
    for _k in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "SUPABASE_KEY"):
        if _cn.get(_k):
            os.environ[_k] = _cn[_k]

from app.core.config import settings  # noqa: E402
from app.schemas.archive_plus import ArchiveItemManualCreate  # noqa: E402
from app.services.archive_service import archive_service  # noqa: E402
from app.services.passport_review_service import (  # noqa: E402
    passport_review_service as svc,
)

_TEST_USER_ID = 1
_TAG = "[e2e-088]"
_FAILS: list[str] = []

# 这些 URL 不会被真的下载,只当标识符用。
_REAL = "https://example.invalid/e2e088-real-shot.jpg"
_AI_FRONT = "https://example.invalid/e2e088-ai-front.png"
_AI_BACK = "https://example.invalid/e2e088-ai-back.png"
_AI_FAILED = "https://example.invalid/e2e088-ai-failed.png"
_SOURCE = "https://example.invalid/e2e088-source.jpg"


def _assert(cond: bool, msg: str) -> None:
    print(f"  {'✓' if cond else '✗'} {msg}")
    if not cond:
        _FAILS.append(msg)


def main() -> int:
    db = svc.db
    print(f"目标库: {settings.SUPABASE_URL}\n")

    try:
        db.table("passport_three_views").select("id").limit(1).execute()
        db.table("user_archive_items").select("ai_photos").limit(1).execute()
    except Exception:
        print("✗ 缺少 088 的表/列 (passport_three_views / ai_photos)")
        print("  请先应用 app/db/migrations/088_three_view_provenance.sql")
        return 1

    view_ids: list[int] = []
    item_ids: list[int] = []

    try:
        # ── 1. 造三视图生成记录 ──────────────────────────────────────────
        print("1. 造生成记录(2 成功 + 1 失败)")
        rows = db.table("passport_three_views").insert([
            {
                "user_id": _TEST_USER_ID,
                "source_image_url": _SOURCE,
                "view_slug": "front",
                "image_url": _AI_FRONT,
                "model": "gpt-image-1",
                "image_size": "1024x1024",
                "status": "success",
            },
            {
                "user_id": _TEST_USER_ID,
                "source_image_url": _SOURCE,
                "view_slug": "back",
                "image_url": _AI_BACK,
                "model": "gpt-image-1",
                "image_size": "1024x1024",
                "status": "success",
            },
            {
                "user_id": _TEST_USER_ID,
                "source_image_url": _SOURCE,
                "view_slug": "side",
                "image_url": _AI_FAILED,
                "model": "gpt-image-1",
                "status": "failed",
                "error_message": "e2e: 模拟生成失败",
            },
        ]).execute().data
        view_ids = [r["id"] for r in rows]
        _assert(len(view_ids) == 3, f"写入 3 条生成记录 (ids={view_ids})")

        # ── 2. 入库反查 ai_photos ────────────────────────────────────────
        print("\n2. 入库时反查 AI 图来源")
        item = archive_service.manual_create(
            _TEST_USER_ID,
            ArchiveItemManualCreate(
                title=f"{_TAG} 溯源测试",
                brandName="E2E Brand 088",
                # 故意把实拍、两张 AI 成功图、一张 AI 失败图混在一起
                photos=[_REAL, _AI_FRONT, _AI_BACK, _AI_FAILED],
            ),
        )
        item_ids.append(item.id)
        _assert(
            set(item.aiPhotos) == {_AI_FRONT, _AI_BACK},
            f"只认出 2 张 AI 成功图,实拍与失败图不算 (ai_photos={len(item.aiPhotos)})",
        )
        _assert(
            _REAL not in item.aiPhotos,
            "实拍图没有被误标成 AI 生成",
        )
        _assert(
            _AI_FAILED not in item.aiPhotos,
            "生成失败的记录不算 AI 图(status != success)",
        )
        _assert(
            item.aiPhotos == [p for p in item.photos if p in item.aiPhotos],
            "ai_photos 与 photos 顺序一致",
        )

        # ── 3. 回填 archive_item_id ─────────────────────────────────────
        print("\n3. 生成记录回挂档案")
        linked = (
            db.table("passport_three_views")
            .select("id,archive_item_id")
            .in_("image_url", [_AI_FRONT, _AI_BACK])
            .execute()
            .data
        )
        _assert(
            all(r["archive_item_id"] == item.id for r in linked),
            f"2 条成功记录都挂上了档案 #{item.id}",
        )

        # ── 4. 客户端谎报不起作用 ───────────────────────────────────────
        print("\n4. 客户端无法谎称 AI 图是实拍")
        # ArchiveItemManualCreate 里根本没有 aiPhotos 字段,客户端连撒谎的
        # 入口都没有;这里验证同样的一组图,结果仍由服务端反查决定。
        _assert(
            not hasattr(ArchiveItemManualCreate, "aiPhotos")
            and "aiPhotos" not in ArchiveItemManualCreate.model_fields,
            "创建接口不接受客户端自报的 aiPhotos",
        )

        # ── 5. 典藏全量管理 ─────────────────────────────────────────────
        print("\n5. 典藏全量管理")
        listed = svc.list_archive(keyword=_TAG, page=1, page_size=10)
        found = [i for i in listed["items"] if i["id"] == item.id]
        _assert(len(found) == 1, "按标题关键字搜到了这条档案")
        if found:
            _assert(
                set(found[0]["aiPhotos"]) == {_AI_FRONT, _AI_BACK},
                "列表里带出了 AI 图标记",
            )

        svc.update_archive(item.id, {"title": f"{_TAG} 改过的标题", "release_year": 2003})
        after = (
            db.table("user_archive_items")
            .select("title,release_year")
            .eq("id", item.id)
            .execute()
            .data[0]
        )
        _assert(
            after["title"] == f"{_TAG} 改过的标题" and after["release_year"] == 2003,
            "改字段生效",
        )

        try:
            svc.update_archive(item.id, {"user_id": 99999})
            _assert(False, "白名单外的字段被拒绝")
        except ValueError:
            _assert(True, "白名单外的字段被拒绝 (user_id 改不动)")

        # ── 6. 三视图列表与统计 ─────────────────────────────────────────
        print("\n6. 三视图列表与用量统计")
        tv = svc.list_three_views(user_id=_TEST_USER_ID, page=1, page_size=50)
        mine = [r for r in tv["items"] if r["id"] in view_ids]
        _assert(len(mine) == 3, "列表里能看到这 3 条记录")
        failed = [r for r in mine if r["status"] == "failed"]
        _assert(
            len(failed) == 1 and failed[0]["errorMessage"],
            "失败记录带出了失败原因",
        )
        stats = svc.three_view_stats()
        _assert(
            stats["total"] >= 3 and stats["success"] >= 2 and stats["failed"] >= 1,
            f"统计可读 (total={stats['total']} success={stats['success']} "
            f"failed={stats['failed']} disabled={stats['disabled']})",
        )

        # ── 7. 下架生成图 ───────────────────────────────────────────────
        print("\n7. 下架不合格的生成图")
        res = svc.disable_three_view(
            view_ids[0], admin_id=_TEST_USER_ID, reason="e2e: 配饰没去干净"
        )
        _assert(
            item.id in res["removedFromItems"],
            f"从引用它的档案里摘掉了 (removedFrom={res['removedFromItems']})",
        )
        row = (
            db.table("passport_three_views")
            .select("status,disable_reason,disabled_by,image_url")
            .eq("id", view_ids[0])
            .execute()
            .data[0]
        )
        _assert(row["status"] == "disabled", "记录状态标成 disabled")
        _assert(
            row["disable_reason"] and row["disabled_by"] == _TEST_USER_ID,
            "留下了下架人和原因",
        )
        _assert(
            row["image_url"] == _AI_FRONT,
            "记录本身没删,成本还能算账",
        )
        item_row = (
            db.table("user_archive_items")
            .select("photos,ai_photos")
            .eq("id", item.id)
            .execute()
            .data[0]
        )
        _assert(
            _AI_FRONT not in (item_row["photos"] or []),
            "档案 photos 里已移除该图",
        )
        _assert(
            _AI_FRONT not in (item_row["ai_photos"] or []),
            "档案 ai_photos 里已移除该图",
        )
        _assert(
            _AI_BACK in (item_row["ai_photos"] or []),
            "另一张 AI 图不受影响",
        )

        # ── 8. 删除档案 ─────────────────────────────────────────────────
        print("\n8. 删除档案")
        svc.delete_archive(item.id)
        gone = (
            db.table("user_archive_items").select("id").eq("id", item.id).execute().data
        )
        _assert(not gone, "档案已删除")
        item_ids.remove(item.id)

        try:
            svc.delete_archive(item.id)
            _assert(False, "删不存在的档案会报 404")
        except LookupError:
            _assert(True, "删不存在的档案会报 404")

    finally:
        print("\n清理测试数据")
        for iid in item_ids:
            try:
                db.table("user_archive_items").delete().eq("id", iid).execute()
            except Exception as e:
                print(f"  ! 清理档案 {iid} 失败: {e}")
        if view_ids:
            try:
                db.table("passport_three_views").delete().in_("id", view_ids).execute()
            except Exception as e:
                print(f"  ! 清理生成记录失败: {e}")
        print("  done")

    print()
    if _FAILS:
        print(f"{len(_FAILS)} 项未通过:")
        for f in _FAILS:
            print(f"  - {f}")
        return 1
    print("全部通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
