"""
数字护照 · 归因入库链路端到端验证 (5.2)。

attribution_smoke 只打服务内部方法,绕开了配额与落库;这个脚本反过来,
走完整的 attribute() → confirm() 并真实读写数据库,验证:

  - 归因记录落表,候选里的 brand_id 真实存在
  - confirm 写出 user_archive_items(brand_id / release_year / validity_status)
  - passport_attributions 被回填 archive_item_id / user_final / user_action
  - divergence 能算出 AI 建议与用户最终选择的差异
  - 品牌白名单:伪造的 brand_id 必须被拒
  - 重复提交:同一条归因不能入库两次

会真实写库,所以结束时无论成败都清理掉本次创建的行(finally)。
默认跑国内库,那是前端 `npm run start:cn` 连的那套:

  cd backend && ./venv/bin/python -m scripts.attribution_e2e

加 --intl 改跑国际版 Supabase。
"""

from __future__ import annotations

import os
import sys

from dotenv import dotenv_values

# settings 在 import 时就固化了,必须抢在任何 app.* 之前把环境变量铺好。
# 真实环境变量优先级高于 .env 文件,以此把整个服务指向国内库。
if "--intl" not in sys.argv:
    _cn = dotenv_values(".env.cn")
    for _k in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "SUPABASE_KEY"):
        if _cn.get(_k):
            os.environ[_k] = _cn[_k]

from app.core.config import settings  # noqa: E402
from app.services.ai.attribution_service import (  # noqa: E402
    AttributionError,
    attribution_service,
)

# 白名单内的秀场图,穿在人身上但单品看得清。
_GARMENT_URL = (
    "https://assets.vogue.com/photos/61ee0a8f3099cf49778ade70/master/"
    "w_2560%2Cc_limit/00001-Alaia-Fall-22-Paris-credit-brand.jpg"
)
_TEST_USER_ID = 1

_FAILS: list[str] = []


def _assert(cond: bool, msg: str) -> None:
    print(f"  {'✓' if cond else '✗'} {msg}")
    if not cond:
        _FAILS.append(msg)


def main() -> int:
    db = attribution_service.db
    print(f"目标库: {settings.SUPABASE_URL}\n")

    attribution_id: int | None = None
    archive_id: int | None = None

    try:
        # ---------------- attribute ----------------
        print("[1] attribute:归因并落表")
        result = attribution_service.attribute(_TEST_USER_ID, [_GARMENT_URL])
        attribution_id = result.attribution_id
        _assert(attribution_id > 0, f"归因记录已落表 id={attribution_id}")
        _assert(
            result.validity.is_fashion_item, "通过 5.3 有效性闸门"
        )
        print(f"    配额: {result.quota_used}/{result.quota_limit}")
        print(f"    候选: {[(c.brand_name, c.season, c.year) for c in result.candidates]}")

        row = (
            db.table("passport_attributions")
            .select("*")
            .eq("id", attribution_id)
            .execute()
            .data[0]
        )
        _assert(row["status"] == "success", "status=success")
        _assert(bool(row.get("photos_fingerprint")), "photos_fingerprint 已写入")
        _assert(row.get("ai_suggestion") is not None, "ai_suggestion 已存档")

        # ---------------- 品牌白名单 ----------------
        print("\n[2] 品牌白名单:伪造的 brand_id 必须被拒")
        try:
            attribution_service.confirm(
                _TEST_USER_ID,
                attribution_id,
                title="不该成功",
                brand_id=999_999_999,
                pending_brand_name=None,
                show_id=None,
                release_year=None,
                user_action="accepted",
            )
            _assert(False, "伪造 brand_id 被拒")
        except AttributionError as e:
            _assert(e.code == "BRAND_REQUIRED", f"伪造 brand_id 被拒 ({e.code})")

        # ---------------- confirm ----------------
        print("\n[3] confirm:写入档案并回填标注数据")
        # 故意不选 AI 给的候选,用一个固定品牌,以此验证 divergence 能算出来。
        brand = db.table("brands").select("id,name").eq("name", "Rick Owens").execute()
        brand_id = brand.data[0]["id"] if brand.data else None
        if not brand_id:
            brand_id = db.table("brands").select("id").limit(1).execute().data[0]["id"]

        item = attribution_service.confirm(
            _TEST_USER_ID,
            attribution_id,
            title="E2E 测试单品",
            brand_id=brand_id,
            pending_brand_name=None,
            show_id=None,
            release_year=2003,
            user_action="edited",
            color="黑",
        )
        archive_id = item.id
        _assert(archive_id > 0, f"档案条目已创建 id={archive_id}")
        _assert(item.brandId == brand_id, "brand_id 写入正确")
        _assert(item.releaseYear == 2003, "release_year 写入正确")
        _assert(
            item.validityStatus in ("passed", "manual_review"),
            f"validity_status={item.validityStatus}",
        )
        _assert(
            item.brandName is not None,
            f"brand_name 由服务端按 brand_id 回填 ({item.brandName})",
        )

        row = (
            db.table("passport_attributions")
            .select("*")
            .eq("id", attribution_id)
            .execute()
            .data[0]
        )
        _assert(row["archive_item_id"] == archive_id, "归因记录回填 archive_item_id")
        _assert(row["user_action"] == "edited", "user_action 已记录")
        _assert(row.get("user_final") is not None, "user_final(标注答案)已记录")
        _assert(bool(row.get("confirmed_at")), "confirmed_at 已记录")
        divergence = row.get("divergence") or {}
        _assert(
            "brand_id" in divergence,
            f"divergence 算出了品牌差异 {divergence.get('brand_id')}",
        )

        # ---------------- 重复提交 ----------------
        print("\n[4] 重复提交:同一条归因不能入库两次")
        try:
            attribution_service.confirm(
                _TEST_USER_ID,
                attribution_id,
                title="重复",
                brand_id=brand_id,
                pending_brand_name=None,
                show_id=None,
                release_year=None,
                user_action="accepted",
            )
            _assert(False, "重复提交被拒")
        except AttributionError as e:
            _assert(e.code == "ALREADY_CONFIRMED", f"重复提交被拒 ({e.code})")

    finally:
        print("\n[清理] 删除本次创建的数据")
        if archive_id:
            try:
                db.table("archive_holding_history").delete().eq(
                    "archive_item_id", archive_id
                ).execute()
            except Exception as e:
                print(f"  ! 持有记录清理失败: {str(e)[:80]}")
            db.table("user_archive_items").delete().eq("id", archive_id).execute()
            print(f"  已删除 user_archive_items id={archive_id}")
        if attribution_id:
            db.table("passport_attributions").delete().eq("id", attribution_id).execute()
            print(f"  已删除 passport_attributions id={attribution_id}")

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
