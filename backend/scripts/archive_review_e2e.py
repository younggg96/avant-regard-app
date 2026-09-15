"""
数字护照 · 档案人工审核队列端到端验证 (5.3)。

直接往 user_archive_items 造待审数据(不走 AI,不烧 token),验证:

  - 三种入队原因能被正确识别(新品牌待审 / AI 置信度低 / 跳过识别)
  - 放行写入终态与审核留痕(谁、何时、什么理由)
  - 放行时裸品牌名能自动归一到 brands 并补上 brand_id
  - 驳回保留数据,只把状态标成 rejected
  - 同一条不能审两次

真实写库,结束时无论成败都清理(finally)。默认跑国内库:

  cd backend && ./venv/bin/python -m scripts.archive_review_e2e

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
from app.services.passport_review_service import (  # noqa: E402
    passport_review_service as svc,
)

_TEST_USER_ID = 1
_FAILS: list[str] = []


def _assert(cond: bool, msg: str) -> None:
    print(f"  {'✓' if cond else '✗'} {msg}")
    if not cond:
        _FAILS.append(msg)


def main() -> int:
    db = svc.db
    print(f"目标库: {settings.SUPABASE_URL}\n")

    # 审核动作依赖 087 的留痕列。缺了就直接说清楚,不要让脚本在中途
    # 抛一个 PostgREST 原始错误。
    try:
        db.table("user_archive_items").select("review_note").limit(1).execute()
    except Exception:
        print("✗ 缺少 087 的审核留痕列 (review_note)")
        print("  请先应用 app/db/migrations/087_archive_review_queue.sql")
        return 1

    created: list[int] = []

    try:
        # 取一个真实品牌，用来验证放行时的品牌归一。
        brand = db.table("brands").select("id,name").limit(1).execute().data[0]
        # 故意用「去掉变音符 + 大小写不同」的写法，顺带验归一化。
        pending_name = brand["name"].lower()

        print("[1] 造三条待审数据")
        fixtures = [
            # 新品牌待审：brand_id 为空但有裸名字
            {"title": "E2E 新品牌待审", "brand_name": pending_name, "brand_id": None},
            # 跳过 AI 识别：有 brand_id、没有归因记录
            {"title": "E2E 跳过识别", "brand_name": brand["name"], "brand_id": brand["id"]},
            # 待驳回
            {"title": "E2E 待驳回", "brand_name": brand["name"], "brand_id": brand["id"]},
        ]
        for f in fixtures:
            row = (
                db.table("user_archive_items")
                .insert(
                    {
                        "user_id": _TEST_USER_ID,
                        "source": "manual",
                        "validity_status": "manual_review",
                        "photos": [],
                        **f,
                    }
                )
                .execute()
                .data[0]
            )
            created.append(row["id"])
        _assert(len(created) == 3, f"已造 {len(created)} 条待审数据")

        print("\n[2] list_queue:入队原因识别")
        queue = svc.list_queue(page=1, page_size=100)
        by_id = {i["id"]: i for i in queue["items"]}
        _assert(
            all(cid in by_id for cid in created), "三条都出现在待审队列里"
        )
        _assert(
            by_id[created[0]]["reason"] == "PENDING_BRAND",
            f"裸品牌名 → PENDING_BRAND (实际 {by_id[created[0]]['reason']})",
        )
        _assert(
            by_id[created[1]]["reason"] == "SKIPPED_AI",
            f"无归因记录 → SKIPPED_AI (实际 {by_id[created[1]]['reason']})",
        )
        _assert(
            by_id[created[0]]["username"] != f"#{_TEST_USER_ID}",
            f"用户名已关联 ({by_id[created[0]]['username']})",
        )

        print("\n[3] 放行 + 品牌自动归一")
        res = svc.review(
            created[0], decision="passed", reviewer_id=_TEST_USER_ID, note="看过了"
        )
        _assert(
            res["backfilledBrand"] == brand["name"],
            f"裸名 {pending_name!r} 归一到 {res['backfilledBrand']!r}",
        )
        row = (
            db.table("user_archive_items")
            .select("*")
            .eq("id", created[0])
            .execute()
            .data[0]
        )
        _assert(row["validity_status"] == "passed", "状态 → passed")
        _assert(row["brand_id"] == brand["id"], "brand_id 已补上")
        _assert(row["reviewed_by"] == _TEST_USER_ID, "留痕:审核人")
        _assert(bool(row["reviewed_at"]), "留痕:审核时间")
        _assert(row["review_note"] == "看过了", "留痕:备注")

        print("\n[4] 驳回:保留数据只改状态")
        svc.review(
            created[2], decision="rejected", reviewer_id=_TEST_USER_ID, note="不是服装"
        )
        row = (
            db.table("user_archive_items")
            .select("validity_status,review_note,title")
            .eq("id", created[2])
            .execute()
            .data[0]
        )
        _assert(row["validity_status"] == "rejected", "状态 → rejected")
        _assert(row["title"] == "E2E 待驳回", "条目仍在，数据没被删")
        _assert(row["review_note"] == "不是服装", "驳回理由已记录")

        print("\n[5] 重复审核被拒")
        try:
            svc.review(created[0], decision="passed", reviewer_id=_TEST_USER_ID)
            _assert(False, "重复审核被拒")
        except LookupError as e:
            _assert(True, f"重复审核被拒 ({e})")

        print("\n[6] 非法决定值被拒")
        try:
            svc.review(created[1], decision="manual_review", reviewer_id=_TEST_USER_ID)
            _assert(False, "非法 decision 被拒")
        except ValueError:
            _assert(True, "非法 decision 被拒")

    finally:
        print("\n[清理]")
        for cid in created:
            try:
                db.table("archive_holding_history").delete().eq(
                    "archive_item_id", cid
                ).execute()
            except Exception:
                pass
            db.table("user_archive_items").delete().eq("id", cid).execute()
        print(f"  已删除 {len(created)} 条测试数据")

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
