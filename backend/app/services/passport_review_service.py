"""
数字护照 · 档案人工审核队列 (5.3)。

`validity_status='manual_review'` 的档案条目会堆在这里等人放行。进队列的
原因有三种,审核员需要一眼看出是哪种,因为处理方式完全不同:

  新品牌待审    brand_id 为空但 brand_name 有值 —— 用户提交的新品牌还没通过
                审核。品牌一旦通过,这里 approve 时会自动把 brand_id 补上。
  AI 置信度低    归因跑过,但模型自己也没把握,需要人眼确认品牌对不对。
  跳过 AI 识别   AI 挂了/配额用尽时用户手填入档,这张图根本没过有效性检查,
                审核员要自己看图判断是不是服装。

驳回不删数据:标成 rejected,条目仍在用户档案里,但不是有效护照。
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.db.supabase import get_supabase_admin
from app.services.ai.reference_retriever import reference_retriever

logger = logging.getLogger(__name__)

# 审核员能给出的终态。manual_review 不在其中 —— 那是「还没处理」。
REVIEW_DECISIONS = ("passed", "rejected")


class PassportReviewService:
    def __init__(self):
        self.db = get_supabase_admin()

    # -----------------------------------------------------------------
    # 队列
    # -----------------------------------------------------------------
    def list_queue(
        self,
        *,
        status: str = "manual_review",
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        offset = (page - 1) * page_size
        res = (
            self.db.table("user_archive_items")
            .select("*", count="exact")
            .eq("validity_status", status)
            # 队列按提交时间从早到晚处理,先来先审。
            .order("created_at", desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return {"items": [], "total": res.count or 0}

        # 用户名和归因记录各批量拉一次,避免每行一次往返。
        users = self._fetch_users([r["user_id"] for r in rows])
        attributions = self._fetch_attributions([r["id"] for r in rows])

        items = [
            self._format(r, users.get(r["user_id"]), attributions.get(r["id"]))
            for r in rows
        ]
        return {"items": items, "total": res.count or 0}

    def _fetch_users(self, user_ids: List[int]) -> Dict[int, Dict]:
        ids = list({i for i in user_ids if i})
        if not ids:
            return {}
        try:
            # users 表没有头像列(头像在别处),这里只要用户名。
            res = self.db.table("users").select("id,username").in_("id", ids).execute()
            return {u["id"]: u for u in res.data or []}
        except Exception as e:  # noqa: BLE001
            # 降级成显示 #id 是可以接受的,但必须留下日志 —— 静默吞掉的话,
            # 「所有人都显示成 #1」这种问题没人会发现。
            logger.warning("[passport_review] fetch users failed: %s", e)
            return {}

    def _fetch_attributions(self, item_ids: List[int]) -> Dict[int, Dict]:
        ids = list({i for i in item_ids if i})
        if not ids:
            return {}
        try:
            res = (
                self.db.table("passport_attributions")
                .select(
                    "id,archive_item_id,validity_result,ai_suggestion,"
                    "candidates,user_action,divergence"
                )
                .in_("archive_item_id", ids)
                .execute()
            )
            return {a["archive_item_id"]: a for a in res.data or []}
        except Exception as e:  # noqa: BLE001
            # 同上:归因信息拉不到时队列仍要能开,但不能不吭声 ——
            # 否则所有条目都会被误判成 SKIPPED_AI。
            logger.warning("[passport_review] fetch attributions failed: %s", e)
            return {}

    # -----------------------------------------------------------------
    # 展示
    # -----------------------------------------------------------------
    @staticmethod
    def _reason(row: Dict, attribution: Optional[Dict]) -> Tuple[str, Optional[float]]:
        """返回 (进队列的原因码, AI 置信度)。原因在服务端算好,前端不重复判断。"""
        confidence: Optional[float] = None
        if attribution:
            validity = attribution.get("validity_result") or {}
            try:
                confidence = float(validity.get("confidence"))
            except (TypeError, ValueError):
                confidence = None

        if not row.get("brand_id") and row.get("brand_name"):
            return "PENDING_BRAND", confidence
        if not attribution:
            return "SKIPPED_AI", confidence
        return "LOW_CONFIDENCE", confidence

    def _format(
        self, row: Dict, user: Optional[Dict], attribution: Optional[Dict]
    ) -> Dict[str, Any]:
        reason, confidence = self._reason(row, attribution)

        ai_brands: List[str] = []
        if attribution:
            for c in attribution.get("candidates") or []:
                name = c.get("brand_name")
                if name:
                    ai_brands.append(name)

        return {
            "id": row["id"],
            "userId": row["user_id"],
            "username": (user or {}).get("username") or f"#{row['user_id']}",
            "title": row.get("title"),
            "photos": row.get("photos") or [],
            # 审核员得能看出哪几张是 AI 推测的侧背面，否则会拿生成图去判断
            # 实物状况。这是审核队列和全量管理都要带的，放在 _format 里。
            "aiPhotos": row.get("ai_photos") or [],
            "brandId": row.get("brand_id"),
            "brandName": row.get("brand_name"),
            "releaseYear": row.get("release_year"),
            "showId": row.get("original_show_id"),
            "validityStatus": row.get("validity_status"),
            "createdAt": row.get("created_at"),
            # 审核员的决策依据
            "reason": reason,
            "aiConfidence": confidence,
            "aiBrands": ai_brands,
            "userAction": (attribution or {}).get("user_action"),
            "divergence": (attribution or {}).get("divergence") or {},
            "reviewNote": row.get("review_note"),
            "reviewedAt": row.get("reviewed_at"),
        }

    # -----------------------------------------------------------------
    # 决策
    # -----------------------------------------------------------------
    def review(
        self,
        item_id: int,
        *,
        decision: str,
        reviewer_id: int,
        note: Optional[str] = None,
    ) -> Dict[str, Any]:
        if decision not in REVIEW_DECISIONS:
            raise ValueError(f"decision 只能是 {REVIEW_DECISIONS} 之一")

        res = (
            self.db.table("user_archive_items")
            .select("id,brand_id,brand_name,validity_status")
            .eq("id", item_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise LookupError("档案条目不存在")
        row = res.data[0]
        if row.get("validity_status") != "manual_review":
            raise LookupError("该条目不在待审队列中(可能已被处理)")

        payload: Dict[str, Any] = {
            "validity_status": decision,
            "reviewed_by": reviewer_id,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "review_note": note,
        }

        # 通过时顺手把品牌归一:用户当初填的新品牌可能已经审核通过进了
        # brands 表,这时就该把 brand_id 补上,而不是让它一直挂着裸名字。
        backfilled_brand: Optional[str] = None
        if decision == "passed" and not row.get("brand_id") and row.get("brand_name"):
            brand = reference_retriever.match_brand(row["brand_name"])
            if brand:
                payload["brand_id"] = brand["id"]
                payload["brand_name"] = brand["name"]
                backfilled_brand = brand["name"]

        self.db.table("user_archive_items").update(payload).eq("id", item_id).execute()
        return {"id": item_id, "status": decision, "backfilledBrand": backfilled_brand}

    # -----------------------------------------------------------------
    # 典藏全量管理(不止待审队列)
    # -----------------------------------------------------------------
    def list_archive(
        self,
        *,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        user_id: Optional[int] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """全量档案列表。status 不传就是所有状态,和只看待审队列的 list_queue 区分开。"""
        offset = (page - 1) * page_size
        q = self.db.table("user_archive_items").select("*", count="exact")
        if status:
            q = q.eq("validity_status", status)
        if user_id:
            q = q.eq("user_id", user_id)
        if keyword:
            # 标题或品牌名任一命中。PostgREST 的 or 语法,逗号分隔。
            safe = keyword.replace(",", " ").replace("(", " ").replace(")", " ")
            q = q.or_(f"title.ilike.%{safe}%,brand_name.ilike.%{safe}%")

        res = (
            q.order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return {"items": [], "total": res.count or 0}

        users = self._fetch_users([r["user_id"] for r in rows])
        attributions = self._fetch_attributions([r["id"] for r in rows])
        items = [
            self._format(r, users.get(r["user_id"]), attributions.get(r["id"]))
            for r in rows
        ]
        return {"items": items, "total": res.count or 0}

    def update_archive(self, item_id: int, fields: Dict[str, Any]) -> Dict[str, Any]:
        """管理员改档案字段。只放行白名单里的列,避免把 user_id 之类改掉。"""
        allowed = {
            "title",
            "brand_id",
            "brand_name",
            "release_year",
            "original_show_id",
            "validity_status",
            "review_note",
        }
        payload = {k: v for k, v in fields.items() if k in allowed}
        if not payload:
            raise ValueError("没有可更新的字段")

        # 改了品牌就把冗余的 brand_name 同步过来,避免两边对不上。
        if "brand_id" in payload and payload["brand_id"]:
            res = (
                self.db.table("brands")
                .select("id,name")
                .eq("id", payload["brand_id"])
                .limit(1)
                .execute()
            )
            if not res.data:
                raise ValueError(f"品牌 {payload['brand_id']} 不存在")
            payload["brand_name"] = res.data[0]["name"]

        res = (
            self.db.table("user_archive_items")
            .update(payload)
            .eq("id", item_id)
            .execute()
        )
        if not res.data:
            raise LookupError("档案条目不存在")
        return {"id": item_id, "updated": list(payload.keys())}

    def delete_archive(self, item_id: int) -> None:
        """删除档案条目。持有记录级联不一定配了,这里显式清一次。"""
        try:
            self.db.table("archive_holding_history").delete().eq(
                "archive_item_id", item_id
            ).execute()
        except Exception as e:  # noqa: BLE001
            logger.warning("[passport_review] clean holdings failed: %s", e)
        res = self.db.table("user_archive_items").delete().eq("id", item_id).execute()
        if not res.data:
            raise LookupError("档案条目不存在")

    # -----------------------------------------------------------------
    # 三视图管理
    # -----------------------------------------------------------------
    def list_three_views(
        self,
        *,
        status: Optional[str] = None,
        user_id: Optional[int] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        offset = (page - 1) * page_size
        q = self.db.table("passport_three_views").select("*", count="exact")
        if status:
            q = q.eq("status", status)
        if user_id:
            q = q.eq("user_id", user_id)

        res = (
            q.order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = res.data or []
        users = self._fetch_users([r["user_id"] for r in rows])
        items = [
            {
                "id": r["id"],
                "userId": r["user_id"],
                "username": (users.get(r["user_id"]) or {}).get("username")
                or f"#{r['user_id']}",
                "archiveItemId": r.get("archive_item_id"),
                "sourceImageUrl": r.get("source_image_url"),
                "viewSlug": r.get("view_slug"),
                "imageUrl": r.get("image_url"),
                "model": r.get("model"),
                "imageSize": r.get("image_size"),
                "tokensUsed": r.get("tokens_used") or 0,
                "costCents": r.get("cost_cents") or 0,
                "status": r.get("status"),
                "errorMessage": r.get("error_message"),
                "disableReason": r.get("disable_reason"),
                "createdAt": r.get("created_at"),
            }
            for r in rows
        ]
        return {"items": items, "total": res.count or 0}

    def three_view_stats(self) -> Dict[str, Any]:
        """用量概览。gpt-image-1 按张计费,这几个数是算账用的。"""

        def _count(**eq) -> int:
            q = self.db.table("passport_three_views").select("id", count="exact").limit(1)
            for k, v in eq.items():
                q = q.eq(k, v)
            try:
                return q.execute().count or 0
            except Exception:
                return 0

        total = _count()
        return {
            "total": total,
            "success": _count(status="success"),
            "failed": _count(status="failed"),
            "disabled": _count(status="disabled"),
        }

    def disable_three_view(
        self, view_id: int, *, admin_id: int, reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        下架一张不合格的生成图。

        只改状态不删记录:成本已经花掉了,记录要留着算账。同时把它从所有
        引用它的档案的 ai_photos / photos 里摘掉,否则公开页还会展示。
        """
        res = (
            self.db.table("passport_three_views")
            .select("id,image_url,status")
            .eq("id", view_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise LookupError("生成记录不存在")
        row = res.data[0]

        self.db.table("passport_three_views").update(
            {
                "status": "disabled",
                "disabled_by": admin_id,
                "disabled_at": datetime.now(timezone.utc).isoformat(),
                "disable_reason": reason,
            }
        ).eq("id", view_id).execute()

        removed_from = self._detach_photo(row.get("image_url"))
        return {"id": view_id, "removedFromItems": removed_from}

    def _detach_photo(self, image_url: Optional[str]) -> List[int]:
        """把一张图从所有引用它的档案条目的 photos / ai_photos 里摘掉。"""
        if not image_url:
            return []
        try:
            res = (
                self.db.table("user_archive_items")
                .select("id,photos,ai_photos")
                .contains("photos", [image_url])
                .execute()
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("[passport_review] find items by photo failed: %s", e)
            return []

        touched: List[int] = []
        for r in res.data or []:
            self.db.table("user_archive_items").update(
                {
                    "photos": [p for p in (r.get("photos") or []) if p != image_url],
                    "ai_photos": [
                        p for p in (r.get("ai_photos") or []) if p != image_url
                    ],
                }
            ).eq("id", r["id"]).execute()
            touched.append(r["id"])
        return touched

    def pending_count(self) -> int:
        try:
            res = (
                self.db.table("user_archive_items")
                .select("id", count="exact")
                .eq("validity_status", "manual_review")
                .limit(1)
                .execute()
            )
            return res.count or 0
        except Exception:
            return 0


passport_review_service = PassportReviewService()
