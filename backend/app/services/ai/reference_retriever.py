"""
数字护照 · 参照库检索。

把模型第一轮给出的品牌猜测,收敛成「品牌库里真实存在的品牌 + 真实存在的
系列(季度/年份)」。模型只负责看图,能不能落到一个具体系列由这一层说了算 ——
模型说 "Raf Simons AW01" 但品牌库里没有 Raf Simons,那这个候选就不该出现。

## 为什么现在没有图片比对

`show_images` 是空表,9984 条 shows 也没有 cover_image,整个库里没有任何
单品参照图。所以 M1 的候选证据来自「模型的视觉推理 + 真实系列元数据」,
而不是「N 张参照图中 M 张一致」。

`fetch_reference_images()` 已经按最终形态写好,秀场图导入后自动生效,
attribution_service 那边看到 reference_images 非空就会走比对分支。
换成向量检索时,实现一个同样接口的 VectorRetriever 替换即可,服务层不用改。
"""

from __future__ import annotations

import re
import time
import unicodedata
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

from app.core.config import settings
from app.db.supabase import get_supabase_admin


@dataclass
class ReferenceCandidate:
    """一个收敛后的候选:品牌一定真实存在,系列可能为空(只认出品牌没认出季)。"""

    brand_id: int
    brand_name: str
    show_id: Optional[str] = None
    season: Optional[str] = None
    year: Optional[int] = None
    title: Optional[str] = None
    reference_images: List[str] = field(default_factory=list)
    # brand_only          只匹配到品牌,没有落到具体系列
    # show_metadata       落到了真实系列,但证据来自模型视觉推理(当前形态)
    # reference_images    有参照图比对支撑(等 show_images 有数据后)
    match_source: str = "brand_only"


def _normalize(name: str) -> str:
    """
    品牌名归一,让以下写法都折叠到同一个 key:
        "Y-3" / "Y 3" / "y3"
        "Alaïa" / "Alaia"          ← 变音符必须折叠成基字母
        "Hermès" / "Hermes"

    时尚品牌名里变音符极其常见,如果直接把非 ASCII 字符丢掉,
    "Alaïa" 会变成 "alaa" 而匹配不上模型输出的 "Alaia",
    正确候选就被静默丢弃了。NFKD 先把 ï 拆成 i + 组合音标,
    再滤掉音标(Mn 类),就能得到 "alaia"。
    """
    decomposed = unicodedata.normalize("NFKD", name or "")
    folded = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]", "", folded.lower())


class ShowMetadataRetriever:
    """M1 实现:品牌名 → brands → shows(季度/年份),参照图按需取(当前为空)。"""

    # 品牌表只有 283 行,整表拉回来在内存里做归一化匹配,比让 Postgres 猜
    # ilike 模式稳得多("Y3" vs "Y-3" 这种 ilike 匹不上)。缓存 5 分钟。
    _BRAND_CACHE_TTL_SEC = 300.0

    def __init__(self):
        self.db = get_supabase_admin()
        self._brand_cache: Optional[Tuple[float, List[Dict]]] = None

    # -----------------------------------------------------------------
    # 品牌
    # -----------------------------------------------------------------
    def _all_brands(self) -> List[Dict]:
        now = time.monotonic()
        if self._brand_cache and self._brand_cache[0] > now:
            return self._brand_cache[1]
        try:
            res = self.db.table("brands").select("id,name,category,country").execute()
            rows = res.data or []
        except Exception:
            # 品牌库读不到时返回空:宁可没有候选,也不能把模型的裸猜测
            # 当成「品牌库里的品牌」推给用户。
            return self._brand_cache[1] if self._brand_cache else []
        self._brand_cache = (now + self._BRAND_CACHE_TTL_SEC, rows)
        return rows

    def match_brand(self, guess: str) -> Optional[Dict]:
        """把一个模型猜测的品牌名对到品牌库。对不上返回 None。"""
        key = _normalize(guess)
        if not key:
            return None
        brands = self._all_brands()

        for b in brands:
            if _normalize(b.get("name", "")) == key:
                return b
        # 退一步做包含匹配,但要求长度 >= 3,避免 "y" 命中一堆品牌。
        if len(key) >= 3:
            for b in brands:
                nb = _normalize(b.get("name", ""))
                if nb and (key in nb or nb in key):
                    return b
        return None

    # -----------------------------------------------------------------
    # 系列
    # -----------------------------------------------------------------
    def _shows_for_brand(
        self, brand_name: str, year_range: Optional[Sequence[int]]
    ) -> List[Dict]:
        """
        取该品牌的系列。shows 表里一个季度有几十行(每行大致是一个 look),
        这里按 (season, year) 去重,只保留每季一条代表。
        """
        try:
            q = (
                self.db.table("shows")
                .select("id,brand_name,season,year,title,category")
                .ilike("brand_name", brand_name)
            )
            if year_range and len(year_range) == 2 and all(year_range):
                lo, hi = int(year_range[0]), int(year_range[1])
                q = q.gte("year", lo).lte("year", hi)
            res = q.limit(400).execute()
            rows = res.data or []
        except Exception:
            return []

        seen: set = set()
        deduped: List[Dict] = []
        for r in rows:
            key = (r.get("season"), r.get("year"))
            if key in seen:
                continue
            seen.add(key)
            deduped.append(r)

        # 年份新的排前面。用户手上的单品没有年份线索时,近季更可能被认出来。
        deduped.sort(key=lambda r: (r.get("year") or 0), reverse=True)
        return deduped

    def fetch_reference_images(self, show_id: str) -> List[str]:
        """
        取某个系列的参照图。

        当前恒定返回空 —— show_images 表没有数据。秀场图导入后这里自动
        开始供图,attribution_service 会据此切到图片比对分支。
        """
        try:
            res = (
                self.db.table("show_images")
                .select("image_url")
                .eq("show_id", show_id)
                .limit(settings.ATTRIBUTION_MAX_REFS_PER_CANDIDATE)
                .execute()
            )
            return [r["image_url"] for r in (res.data or []) if r.get("image_url")]
        except Exception:
            return []

    # -----------------------------------------------------------------
    # 对外入口
    # -----------------------------------------------------------------
    def find(
        self,
        brand_guesses: Sequence[str],
        year_range: Optional[Sequence[int]] = None,
        limit: Optional[int] = None,
    ) -> List[ReferenceCandidate]:
        """
        品牌猜测 → 候选列表。对不上品牌库的猜测会被直接丢弃,
        所以返回的每个候选里的品牌都一定能在 brands 表里点开。
        """
        limit = limit or settings.ATTRIBUTION_MAX_CANDIDATES
        out: List[ReferenceCandidate] = []
        used_brand_ids: set = set()

        for guess in brand_guesses:
            if len(out) >= limit:
                break
            brand = self.match_brand(guess)
            if not brand or brand["id"] in used_brand_ids:
                continue
            used_brand_ids.add(brand["id"])

            shows = self._shows_for_brand(brand["name"], year_range)
            if not shows:
                out.append(
                    ReferenceCandidate(
                        brand_id=brand["id"],
                        brand_name=brand["name"],
                        match_source="brand_only",
                    )
                )
                continue

            # 同一个品牌只放最相关的一季,否则 3 个候选会被一个品牌的
            # 十几季刷满,用户反而挑不出来。
            show = shows[0]
            refs = self.fetch_reference_images(show["id"])
            out.append(
                ReferenceCandidate(
                    brand_id=brand["id"],
                    brand_name=brand["name"],
                    show_id=show["id"],
                    season=show.get("season"),
                    year=show.get("year"),
                    title=show.get("title"),
                    reference_images=refs,
                    match_source="reference_images" if refs else "show_metadata",
                )
            )

        return out


reference_retriever = ShowMetadataRetriever()
