"""
数字护照 · AI 归因 (5.2 / 5.3) 联调烟测。

会真实调用 Qwen-VL 并读 brands / shows,不要挂进 CI。

跑法:
  cd backend && ./venv/bin/python -m scripts.attribution_smoke

验证三件事:
  1. 有效性闸门能不能把非服装图拦下来          (真实 VL 调用)
  2. 服装图能不能出候选,候选品牌都真实存在      (真实 VL 调用)
  3. validate → attribute 只扣一次配额、只调一次模型、只留一条标注数据
     (纯桩,不联网,也不需要 migration 086 已应用)

前两项默认绕开配额与落库(依赖 migration 086),直接打服务内部方法。

退出码 0 = 三项都符合预期。
"""

from __future__ import annotations

import io
import sys
from datetime import datetime
from typing import Any

from app.services.ai import attribution_service as attr_mod
from app.services.ai.attribution_service import AttributionError, attribution_service
from app.services.ai.reference_retriever import reference_retriever
from app.services.file_service import file_service


# Alaïa Fall 22 秀场照,在白名单内,典型的「穿在人身上但单品看得清」。
_GARMENT_URL = (
    "https://assets.vogue.com/photos/61ee0a8f3099cf49778ade70/master/"
    "w_2560%2Cc_limit/00001-Alaia-Fall-22-Paris-credit-brand.jpg"
)

_FAILS: list[str] = []


def _assert(cond: bool, msg: str) -> None:
    if cond:
        print(f"  ✓ {msg}")
    else:
        _FAILS.append(msg)
        print(f"  ✗ {msg}")


def _make_text_image_url() -> str | None:
    """
    造一张纯文字截图并传到 Storage,用来验证有效性闸门。
    prompt 里明确把「纯文字截图」列为不通过,这是最容易复现的负样本。
    """
    from PIL import Image, ImageDraw

    im = Image.new("RGB", (900, 600), "white")
    d = ImageDraw.Draw(im)
    for i, line in enumerate(
        [
            "TERMS OF SERVICE",
            "",
            "1. This is a plain text screenshot.",
            "2. There is no garment in this image.",
            "3. Section 4.2 shall not apply.",
        ]
    ):
        d.text((40, 60 + i * 48), line, fill="black")
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return file_service.upload_image(buf.getvalue(), "smoke-text.png", "image/png")


def test_rejects_non_garment() -> None:
    print("[test] 有效性闸门:纯文字截图应被拦下")
    url = _make_text_image_url()
    if not url:
        _assert(False, "测试图上传失败,无法验证闸门")
        return
    parsed, _ = attribution_service._recognize([url], None)
    validity = attribution_service._to_validity(parsed)
    _assert(
        validity.is_fashion_item is False,
        f"判为非服装 (reject_reason={validity.reject_reason!r})",
    )


def test_attributes_garment() -> None:
    print("[test] 服装图:应通过闸门并给出候选")
    parsed, _ = attribution_service._recognize([_GARMENT_URL], None)
    validity = attribution_service._to_validity(parsed)
    _assert(validity.is_fashion_item is True, "判为服装单品")
    print(f"    品类: {validity.category_zh or validity.category}")
    print(f"    推测品牌: {parsed.get('brand_guesses')}")
    print(f"    年代区间: {parsed.get('year_range')}  置信度: {validity.confidence}")
    print(f"    证据: {parsed.get('evidence')}")

    candidates = attribution_service._build_candidates(parsed, _GARMENT_URL)
    print(f"    收敛后候选数: {len(candidates)}")
    for c in candidates:
        refs = (
            f" [{c.matched_refs}/{c.total_refs} 参照图一致]"
            if c.matched_refs is not None
            else " [无参照图]"
        )
        print(f"      - {c.brand_name} {c.season or ''} ({c.year or '?'}){refs}")
        print(f"        证据: {c.evidence}")

    # 候选可以为空(认不出很正常),但只要有候选,品牌就必须真实存在。
    for c in candidates:
        _assert(
            reference_retriever.match_brand(c.brand_name) is not None,
            f"候选品牌 {c.brand_name} 存在于 brands 表",
        )


# =====================================================
# 复用路径(纯桩)
# =====================================================


class _Result:
    def __init__(self, data: Any):
        self.data = data


class _FakeTable:
    """
    够用就好的 supabase-py 替身:记录 .eq()/.gte() 过滤条件,
    execute() 时在内存行上求值。只支持本服务实际用到的那几种调用。
    """

    def __init__(self, store: list[dict]):
        self.store = store
        self._op = None
        self._payload: dict = {}
        self._eq: list[tuple[str, Any]] = []

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def insert(self, payload: dict):
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload: dict):
        self._op, self._payload = "update", payload
        return self

    def eq(self, col: str, val: Any):
        self._eq.append((col, val))
        return self

    def gte(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def _matches(self, row: dict) -> bool:
        return all(row.get(c) == v for c, v in self._eq)

    def execute(self) -> _Result:
        if self._op == "insert":
            row = dict(self._payload)
            row["id"] = len(self.store) + 1
            row["created_at"] = datetime.utcnow().isoformat()
            self.store.append(row)
            return _Result([row])
        if self._op == "update":
            hit = [r for r in self.store if self._matches(r)]
            for r in hit:
                r.update(self._payload)
            return _Result(hit)
        return _Result([r for r in self.store if self._matches(r)])


class _FakeDB:
    def __init__(self):
        self.rows: list[dict] = []

    def table(self, _name: str) -> _FakeTable:
        return _FakeTable(self.rows)


def test_validate_then_attribute_charges_once() -> None:
    """
    validate 之后紧接着 attribute,是最容易重复计费的路径。
    这里锁死三条:模型只调一次、配额只扣一次、只留一条标注数据。
    """
    print("[test] validate → attribute 复用:只扣一次费")

    photos = ["https://example.test/a.jpg"]
    calls = {"recognize": 0, "consume": 0}

    fake_db = _FakeDB()
    recognized = {
        "is_fashion_item": True,
        "category_zh": "外套",
        "brand_guesses": ["Raf Simons"],
        "year_range": [1998, 2004],
        "evidence": "双头拉链",
        "confidence": 0.4,
    }

    class _FakeQuotaInfo:
        used, limit = 1, 20

    class _FakeCheck:
        allowed, info, reason = True, _FakeQuotaInfo(), None

    def fake_consume(_uid):
        calls["consume"] += 1
        return _FakeCheck()

    def fake_recognize(_photos, _hint):
        calls["recognize"] += 1
        return dict(recognized), {"provider": "qwen", "model": "qwen-vl-plus"}

    orig = (
        attribution_service.db,
        attribution_service._recognize,
        attribution_service._check_photos,
        attr_mod.quota_service.check_and_consume_attribution,
        attr_mod.quota_service.get_attribution_info,
        attr_mod.reference_retriever.find,
    )
    try:
        attribution_service.db = fake_db
        attribution_service._recognize = fake_recognize
        # 白名单与候选检索各有自己的测试,这里只关心计费路径。
        attribution_service._check_photos = lambda _p: None
        attr_mod.quota_service.check_and_consume_attribution = fake_consume
        attr_mod.quota_service.get_attribution_info = lambda _uid: _FakeQuotaInfo()
        attr_mod.reference_retriever.find = lambda *_a, **_k: []

        validity = attribution_service.validate(1, photos)
        _assert(validity.is_fashion_item, "validate 通过闸门")
        _assert(
            len(fake_db.rows) == 1 and fake_db.rows[0]["status"] == "validated",
            "validate 落下一条 status='validated' 记录",
        )

        result = attribution_service.attribute(1, photos)
        _assert(calls["recognize"] == 1, f"模型只调了 1 次 (实际 {calls['recognize']})")
        _assert(calls["consume"] == 1, f"配额只扣了 1 次 (实际 {calls['consume']})")
        _assert(
            len(fake_db.rows) == 1,
            f"只留下 1 条标注数据 (实际 {len(fake_db.rows)})",
        )
        _assert(
            fake_db.rows[0]["status"] == "success",
            "原记录被就地升级成 status='success'",
        )
        _assert(
            result.attribution_id == fake_db.rows[0]["id"],
            "返回的 attributionId 指向同一条记录",
        )
        _assert(
            fake_db.rows[0].get("model_name") == "qwen-vl-plus",
            "复用时没有把模型信息覆盖成空",
        )

        # 换一组照片必须重新识别,不能错误命中上一条。
        attribution_service.attribute(1, ["https://example.test/b.jpg"])
        _assert(calls["recognize"] == 2, "换一组照片会重新识别")
    finally:
        (
            attribution_service.db,
            attribution_service._recognize,
            attribution_service._check_photos,
            attr_mod.quota_service.check_and_consume_attribution,
            attr_mod.quota_service.get_attribution_info,
            attr_mod.reference_retriever.find,
        ) = orig


def main() -> int:
    try:
        test_validate_then_attribute_charges_once()
        test_rejects_non_garment()
        test_attributes_garment()
    except AttributionError as e:
        print(f"  ✗ AttributionError[{e.code}] {e}")
        return 1

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
