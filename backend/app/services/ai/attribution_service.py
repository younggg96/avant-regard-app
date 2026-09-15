"""
数字护照 · AI 识别、用户确认与入库 (5.2 / 5.3)。

## 流程

    上传照片
      → 有效性检查 + 品牌年代推测   (1 次 Qwen-VL 调用,合并成一次)
      → 不是服装/时尚单品 → blocked,不入库,让用户重拍
      → 在 brands / shows 里收敛成真实候选
      → 有参照图时逐张比对          (每候选 1 次 VL 调用,当前休眠)
      → 用户确认 / 修改 / 都不对
      → 写 user_archive_items + 回填 passport_attributions

## 三条设计取舍

1. **有效性检查和品牌推测合并成一次调用,并且跨接口复用。** 两件事看的是
   同一张图、同一套视觉特征,拆开等于花两份钱看同一张图。服务层拿到结果
   先看 is_fashion_item 这个闸门,不通过就地终止。

   5.3 又要求有效性检查是一个能单独调的闸门,所以 /validate 保留,但它会
   把模型输出落成一条 status='validated' 的记录;随后对同一组照片调
   /attribute 时直接捡起这条结果,既不再调模型也不再扣配额。
   两个接口因此可以任意组合,不存在「调了 validate 就被扣两次」的坑。

2. **模型不能凭空造出品牌。** 模型给的是品牌「候选名」,必须经
   reference_retriever 对到 brands 表才会进入候选列表。对不上的猜测直接
   丢弃 —— 用户在确认页看到的每个品牌都能在品牌库里点开。

3. **候选为空不是错误。** 认不出来很正常(非经典款、小众品牌、库里没收录),
   这时返回空候选 + 可编辑表单,让用户自己填,而不是硬塞一个像的品牌。
   用户手填的结果同样落 passport_attributions,是最有价值的标注数据。

## 当前限制

`show_images` 是空表,库里没有任何单品参照图,所以「N 张参照图中 M 张一致」
这类证据现在产不出来,候选证据来自模型的视觉推理 + 真实系列元数据。
参照图一旦导入,_compare_candidate 自动接管,无需改调用方。
"""

from __future__ import annotations

import hashlib
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence

from app.core.config import settings
from app.db.supabase import get_supabase_admin
from app.schemas.archive_plus import ArchiveItem, ArchiveItemManualCreate
from app.services.ai.image_source import all_allowed
from app.services.ai.llm_client import LLMClientError, call_vision
from app.services.ai.prompt_builder import (
    PROMPT_VERSION,
    build_passport_compare_messages,
    build_passport_recognize_messages,
    parse_json_output,
)
from app.services.ai.quota_service import quota_service
from app.services.ai.reference_retriever import ReferenceCandidate, reference_retriever

logger = logging.getLogger(__name__)


class AttributionError(RuntimeError):
    """归因链路失败。code 供路由层翻译成 HTTP 状态。"""

    def __init__(self, message: str, code: str, payload: Optional[Dict] = None):
        super().__init__(message)
        self.code = code
        self.payload = payload or {}


# 送进识别调用的用户图张数上限。多给不会更准,只会更贵。
_MAX_RECOGNIZE_PHOTOS = 4


@dataclass
class ValidityResult:
    is_fashion_item: bool
    reject_reason: Optional[str] = None
    category: Optional[str] = None
    category_zh: Optional[str] = None
    confidence: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_fashion_item": self.is_fashion_item,
            "reject_reason": self.reject_reason,
            "category": self.category,
            "category_zh": self.category_zh,
            "confidence": self.confidence,
        }


@dataclass
class Candidate:
    brand_id: int
    brand_name: str
    show_id: Optional[str] = None
    season: Optional[str] = None
    year: Optional[int] = None
    title: Optional[str] = None
    evidence: str = ""
    # 参照图比对结果。没有参照图时都是 None,前端据此决定要不要显示
    # 「N 张中 M 张一致」这行。
    matched_refs: Optional[int] = None
    total_refs: Optional[int] = None
    confidence: float = 0.0
    match_source: str = "show_metadata"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "brand_id": self.brand_id,
            "brand_name": self.brand_name,
            "show_id": self.show_id,
            "season": self.season,
            "year": self.year,
            "title": self.title,
            "evidence": self.evidence,
            "matched_refs": self.matched_refs,
            "total_refs": self.total_refs,
            "confidence": self.confidence,
            "match_source": self.match_source,
        }


@dataclass
class AttributionResult:
    attribution_id: int
    validity: ValidityResult
    candidates: List[Candidate] = field(default_factory=list)
    visual_summary: Optional[str] = None
    year_range: Optional[List[int]] = None
    quota_used: int = 0
    quota_limit: int = 0


class AttributionService:
    def __init__(self):
        self.db = get_supabase_admin()

    # =================================================================
    # 第一轮:有效性检查 + 品牌年代推测
    # =================================================================
    def _recognize(
        self, photos: Sequence[str], user_hint: Optional[str]
    ) -> tuple[Dict[str, Any], Dict[str, Any]]:
        """返回 (解析后的结构化结果, LLM 元信息)。解析不出 JSON 视为失败。"""
        system, user = build_passport_recognize_messages(
            photo_count=len(photos), user_hint=user_hint
        )
        try:
            resp = call_vision(system, user, list(photos[:_MAX_RECOGNIZE_PHOTOS]))
        except LLMClientError as e:
            raise AttributionError(f"识别调用失败: {e}", "LLM_FAILED") from e

        parsed = parse_json_output(resp.get("content", ""))
        if not parsed:
            # 拿不到结构化字段就没有候选可展示,不做兜底,让上层落 error 日志。
            raise AttributionError("模型未返回可解析的识别结果", "LLM_FAILED")
        return parsed, resp

    @staticmethod
    def _to_validity(parsed: Dict[str, Any]) -> ValidityResult:
        try:
            confidence = float(parsed.get("confidence") or 0.0)
        except (TypeError, ValueError):
            confidence = 0.0
        return ValidityResult(
            # 字段缺失时按「不通过」处理:宁可让用户重拍,也不要把
            # 识别不出的图直接放进正式档案。
            is_fashion_item=bool(parsed.get("is_fashion_item")),
            reject_reason=parsed.get("reject_reason"),
            category=parsed.get("category"),
            category_zh=parsed.get("category_zh"),
            confidence=confidence,
        )

    # =================================================================
    # 第二轮:参照图比对(当前休眠,show_images 为空)
    # =================================================================
    def _compare_candidate(
        self, user_photo: str, ref: ReferenceCandidate
    ) -> tuple[Optional[int], Optional[int], str, float]:
        """
        返回 (matched, total, evidence, confidence)。
        没有参照图或比对失败时 matched/total 为 None,证据留空由调用方回填。
        """
        refs = ref.reference_images[: settings.ATTRIBUTION_MAX_REFS_PER_CANDIDATE]
        if not refs:
            return None, None, "", 0.0

        system, user = build_passport_compare_messages(
            brand_name=ref.brand_name,
            season=ref.season or "",
            ref_count=len(refs),
        )
        try:
            # 第 1 张必须是用户图,prompt 里按这个顺序描述编号。
            resp = call_vision(system, user, [user_photo, *refs])
        except LLMClientError as e:
            logger.warning("[attribution] compare failed brand=%s: %s", ref.brand_name, e)
            return None, None, "", 0.0

        parsed = parse_json_output(resp.get("content", ""))
        if not parsed:
            return None, None, "", 0.0

        raw_matched = parsed.get("matched") or []
        # 模型偶尔会回超出范围的编号,过滤掉,否则 matched 会大于 total。
        matched = [i for i in raw_matched if isinstance(i, int) and 1 <= i <= len(refs)]
        try:
            confidence = float(parsed.get("confidence") or 0.0)
        except (TypeError, ValueError):
            confidence = 0.0
        return len(matched), len(refs), str(parsed.get("evidence") or ""), confidence

    # =================================================================
    # 对外:有效性检查
    # =================================================================
    def validate(
        self, user_id: int, photos: Sequence[str], user_hint: Optional[str] = None
    ) -> ValidityResult:
        """
        只跑 5.3 的有效性闸门。

        模型输出会整条存下来(status='validated'),随后对同一组照片调
        attribute() 会直接复用,不再调模型也不再扣配额。所以「先 validate
        拿个快速反馈、再 attribute 出候选」这种用法总共只花一次钱。
        """
        self._check_photos(photos)

        reused = self._find_reusable(user_id, photos)
        if reused:
            return self._to_validity(reused.get("ai_suggestion") or {})

        self._consume_quota(user_id)
        parsed, resp = self._recognize(photos, user_hint)
        validity = self._to_validity(parsed)

        # 候选留空:这一步只过闸门。真要候选时由 attribute 捡起这条记录补上。
        self._save(
            user_id=user_id,
            photos=photos,
            validity=validity,
            ai_suggestion=parsed,
            status="validated",
            resp=resp,
        )
        return validity

    # =================================================================
    # 对外:完整归因
    # =================================================================
    @staticmethod
    def _check_photos(photos: Sequence[str]) -> None:
        """
        图片 URL 会被原样交给 DashScope 去拉,所以必须限定成自家 Storage,
        否则这个接口就成了「用我们的额度访问任意 URL」的代理。
        """
        if not photos:
            raise AttributionError("至少需要一张照片", "BAD_INPUT")
        if not all_allowed(photos):
            raise AttributionError(
                "图片必须先上传到本站(URL 不在允许的源站白名单)", "BAD_INPUT"
            )

    def attribute(
        self, user_id: int, photos: Sequence[str], user_hint: Optional[str] = None
    ) -> AttributionResult:
        self._check_photos(photos)

        # 刚 validate 过同一组照片的话,那次的模型输出直接拿来用 ——
        # 识别调用本来就同时产出了有效性和品牌推测,没有理由再问一遍。
        reused = self._find_reusable(user_id, photos)
        if reused:
            parsed = reused.get("ai_suggestion") or {}
            resp: Dict[str, Any] = {}
            existing_id: Optional[int] = reused["id"]
            quota = quota_service.get_attribution_info(user_id)
        else:
            quota = self._consume_quota(user_id).info
            existing_id = None
            try:
                parsed, resp = self._recognize(photos, user_hint)
            except AttributionError as e:
                self._save(
                    user_id=user_id,
                    photos=photos,
                    status="error",
                    error_message=str(e),
                )
                raise

        validity = self._to_validity(parsed)

        # 5.3 硬闸门:不是服装/时尚单品,到此为止,不进归因也不入库。
        if not validity.is_fashion_item:
            attribution_id = self._save(
                user_id=user_id,
                photos=photos,
                validity=validity,
                ai_suggestion=parsed,
                status="blocked",
                resp=resp,
                existing_id=existing_id,
            )
            raise AttributionError(
                validity.reject_reason or "这张图看起来不是服装或时尚单品",
                "NOT_FASHION_ITEM",
                {"attributionId": attribution_id, "validity": validity.to_dict()},
            )

        candidates = self._build_candidates(parsed, photos[0])

        attribution_id = self._save(
            user_id=user_id,
            photos=photos,
            validity=validity,
            ai_suggestion=parsed,
            candidates=candidates,
            status="success",
            resp=resp,
            existing_id=existing_id,
        )

        return AttributionResult(
            attribution_id=attribution_id,
            validity=validity,
            candidates=candidates,
            visual_summary=parsed.get("visual_summary"),
            year_range=parsed.get("year_range"),
            quota_used=quota.used,
            quota_limit=quota.limit,
        )

    def _build_candidates(
        self, parsed: Dict[str, Any], user_photo: str
    ) -> List[Candidate]:
        guesses = parsed.get("brand_guesses") or []
        if not isinstance(guesses, list):
            return []
        guesses = [str(g) for g in guesses if g]

        refs = reference_retriever.find(
            guesses,
            year_range=parsed.get("year_range"),
            limit=settings.ATTRIBUTION_MAX_CANDIDATES,
        )
        if not refs:
            return []

        base_evidence = str(parsed.get("evidence") or "")
        try:
            base_confidence = float(parsed.get("confidence") or 0.0)
        except (TypeError, ValueError):
            base_confidence = 0.0

        # 有参照图的候选才需要比对调用。当前一律无图,这个池子是空的,
        # 整个分支零开销。
        comparable = [r for r in refs if r.reference_images]
        compared: Dict[int, tuple] = {}
        if comparable:
            with ThreadPoolExecutor(max_workers=len(comparable)) as pool:
                results = pool.map(
                    lambda r: self._compare_candidate(user_photo, r), comparable
                )
                compared = {id(r): res for r, res in zip(comparable, results)}

        out: List[Candidate] = []
        for r in refs:
            matched, total, evidence, conf = compared.get(id(r), (None, None, "", 0.0))
            out.append(
                Candidate(
                    brand_id=r.brand_id,
                    brand_name=r.brand_name,
                    show_id=r.show_id,
                    season=r.season,
                    year=r.year,
                    title=r.title,
                    evidence=evidence or base_evidence,
                    matched_refs=matched,
                    total_refs=total,
                    # 有图比对过的用比对置信度,否则退回第一轮的整体置信度。
                    confidence=conf if matched is not None else base_confidence,
                    match_source=r.match_source,
                )
            )

        out.sort(key=lambda c: c.confidence, reverse=True)
        return out

    # =================================================================
    # 对外:用户确认入库
    # =================================================================
    def confirm(
        self,
        user_id: int,
        attribution_id: int,
        *,
        title: str,
        brand_id: Optional[int],
        pending_brand_name: Optional[str],
        show_id: Optional[str],
        release_year: Optional[int],
        user_action: str,
        size: Optional[str] = None,
        color: Optional[str] = None,
        condition: Optional[str] = None,
        acquired_at: Optional[str] = None,
        acquired_price_cents: Optional[int] = None,
        note: Optional[str] = None,
        storage_location: Optional[str] = None,
        photos: Optional[Sequence[str]] = None,
    ) -> ArchiveItem:
        row = self._get_attribution(user_id, attribution_id)

        brand_name, validity_status = self._resolve_brand(brand_id, pending_brand_name)

        # 低置信归因也转人工复核,即便品牌是从列表里正经选的。
        validity = row.get("validity_result") or {}
        if validity_status == "passed":
            try:
                if float(validity.get("confidence") or 0.0) < settings.ATTRIBUTION_REVIEW_CONFIDENCE:
                    validity_status = "manual_review"
            except (TypeError, ValueError):
                pass

        final_photos = list(photos) if photos else list(row.get("photos") or [])

        # 延迟 import:archive_service 会 import 一堆交易链路的东西,
        # 放模块顶会绕出循环依赖。
        from app.services.archive_service import archive_service

        item = archive_service.manual_create(
            user_id,
            ArchiveItemManualCreate(
                title=title,
                brandName=brand_name,
                brandId=brand_id,
                size=size,
                color=color,
                condition=condition,
                acquiredPriceCents=acquired_price_cents,
                photos=final_photos,
                acquiredAt=acquired_at,
                note=note,
                storageLocation=storage_location,
                originalShowId=show_id,
                releaseYear=release_year,
            ),
            # 这条链路真跑过 5.3 闸门,可以给出比默认 manual_review 更准的结论。
            validity_status=validity_status,
        )

        user_final = {
            "title": title,
            "brand_id": brand_id,
            "brand_name": brand_name,
            "show_id": show_id,
            "release_year": release_year,
            "validity_status": validity_status,
        }
        self._finalize_attribution(
            attribution_id,
            archive_item_id=item.id,
            user_final=user_final,
            user_action=user_action,
            divergence=self._diff(row.get("candidates") or [], user_final),
        )
        return item

    def _resolve_brand(
        self, brand_id: Optional[int], pending_brand_name: Optional[str]
    ) -> tuple[Optional[str], str]:
        """
        品牌只能来自品牌列表(brand_id),这是 5.3 的硬约束。返回
        (要冗余存进 brand_name 的名字, validity_status)。

        例外是「新品牌已提交、还在后台审核」:此时 brands 表里还没有这一行,
        拿不到 brand_id。直接拒绝会把用户卡死在提交页,所以允许先带着
        pending_brand_name 入库,标 manual_review,等品牌审核通过后再由
        后台回填 brand_id。
        """
        if brand_id:
            # 必须回查一次:brand_id 是客户端传上来的,不能信。查不到就说明
            # 前端绕过了品牌选择器,直接拒绝。
            res = (
                self.db.table("brands")
                .select("id,name")
                .eq("id", brand_id)
                .limit(1)
                .execute()
            )
            if not res.data:
                raise AttributionError(
                    f"品牌 {brand_id} 不在品牌列表中", "BRAND_REQUIRED"
                )
            return res.data[0].get("name"), "passed"

        if pending_brand_name and pending_brand_name.strip():
            return pending_brand_name.strip(), "manual_review"

        raise AttributionError(
            "品牌必须从品牌列表中选择;列表中没有时请先提交新品牌", "BRAND_REQUIRED"
        )

    def _get_attribution(self, user_id: int, attribution_id: int) -> Dict[str, Any]:
        res = (
            self.db.table("passport_attributions")
            .select("*")
            .eq("id", attribution_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise AttributionError("归因记录不存在", "NOT_FOUND")
        row = res.data[0]
        if row.get("user_id") != user_id:
            raise AttributionError("无权操作该归因记录", "FORBIDDEN")
        if row.get("archive_item_id"):
            raise AttributionError("该归因已入库,请勿重复提交", "ALREADY_CONFIRMED")
        return row

    @staticmethod
    def _diff(candidates: List[Dict], user_final: Dict[str, Any]) -> Dict[str, Any]:
        """
        AI 建议(top1)与用户最终选择的差异。后台审核异常偏差、以及后续
        训练评估都靠这个字段。
        """
        top = candidates[0] if candidates else {}
        out: Dict[str, Any] = {}
        for ai_key, user_key in (
            ("brand_id", "brand_id"),
            ("show_id", "show_id"),
            ("year", "release_year"),
        ):
            ai_val = top.get(ai_key)
            user_val = user_final.get(user_key)
            if ai_val != user_val:
                out[user_key] = {"ai": ai_val, "user": user_val}
        return out

    # =================================================================
    # 落库
    # =================================================================
    def _consume_quota(self, user_id: int):
        try:
            check = quota_service.check_and_consume_attribution(user_id)
        except Exception as e:
            raise AttributionError(
                f"配额检查失败(是否未应用 migration 086?): {e}", "NOT_CONFIGURED"
            ) from e
        if not check.allowed:
            raise AttributionError(
                f"今日识别次数已用完 ({check.info.used}/{check.info.limit})",
                "QUOTA_EXCEEDED",
            )
        return check

    @staticmethod
    def _fingerprint(photos: Sequence[str]) -> str:
        """
        照片组指纹。顺序参与计算 —— 识别只送前几张,换个顺序等于换了输入,
        不该复用上一次的结果。
        """
        return hashlib.sha256("\n".join(photos).encode("utf-8")).hexdigest()

    def _find_reusable(
        self, user_id: int, photos: Sequence[str]
    ) -> Optional[Dict[str, Any]]:
        """
        找这组照片最近一次「只过了闸门、还没出候选」的识别结果。

        限定 status='validated' 是关键:已经出过候选(success)或已被拦下
        (blocked)的记录不在复用范围内,重新发起归因就该重新识别。
        """
        cutoff = (
            datetime.utcnow() - timedelta(minutes=settings.ATTRIBUTION_REUSE_TTL_MIN)
        ).isoformat()
        try:
            res = (
                self.db.table("passport_attributions")
                .select("id,ai_suggestion")
                .eq("user_id", user_id)
                .eq("photos_fingerprint", self._fingerprint(photos))
                .eq("status", "validated")
                .gte("created_at", cutoff)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
        except Exception as e:  # noqa: BLE001
            # 查不到就当没有,重新识别。复用是省钱优化,不该因为它挂掉主流程。
            logger.warning("[attribution] reuse lookup failed: %s", e)
            return None

        if not res.data:
            return None
        row = res.data[0]
        # ai_suggestion 为空说明那条记录本身就没存住模型输出,复用没有意义。
        return row if row.get("ai_suggestion") else None

    def _save(
        self,
        *,
        user_id: int,
        photos: Sequence[str],
        validity: Optional[ValidityResult] = None,
        ai_suggestion: Optional[Dict[str, Any]] = None,
        candidates: Optional[List[Candidate]] = None,
        status: str = "success",
        error_message: Optional[str] = None,
        resp: Optional[Dict[str, Any]] = None,
        existing_id: Optional[int] = None,
    ) -> int:
        """
        写一条归因记录并返回 id。

        existing_id 有值时是在就地升级一条 validated 记录(复用路径),
        不新开一行 —— 同一组照片的一次识别只应该留下一条标注数据。
        """
        payload = {
            "user_id": user_id,
            "photos": list(photos),
            "photos_fingerprint": self._fingerprint(photos),
            "validity_result": validity.to_dict() if validity else None,
            "ai_suggestion": ai_suggestion,
            "candidates": [c.to_dict() for c in (candidates or [])],
            "prompt_version": PROMPT_VERSION,
            "status": status,
            "error_message": error_message,
        }
        # 复用路径没有新的 LLM 响应,这几个字段保留 validate 那次写进去的值,
        # 覆盖成 None 会把真实的模型/用量信息抹掉。
        if resp:
            payload.update(
                {
                    "model_provider": resp.get("provider"),
                    "model_name": resp.get("model"),
                    "tokens_used": resp.get("tokens_used") or 0,
                }
            )

        if existing_id:
            res = (
                self.db.table("passport_attributions")
                .update(payload)
                .eq("id", existing_id)
                .execute()
            )
            if res.data:
                return existing_id
            # 行没了(极少见):退回插入,总之要有一条标注数据留下来。
            logger.warning("[attribution] upgrade row %s missed, inserting", existing_id)

        res = self.db.table("passport_attributions").insert(payload).execute()
        if not res.data:
            raise AttributionError("写入 passport_attributions 失败", "DB_ERROR")
        return res.data[0]["id"]

    def _finalize_attribution(
        self,
        attribution_id: int,
        *,
        archive_item_id: int,
        user_final: Dict[str, Any],
        user_action: str,
        divergence: Dict[str, Any],
    ) -> None:
        self.db.table("passport_attributions").update(
            {
                "archive_item_id": archive_item_id,
                "user_final": user_final,
                "user_action": user_action,
                "divergence": divergence,
                "confirmed_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", attribution_id).execute()


attribution_service = AttributionService()
