"""
商家商品系统服务。

覆盖资源：
  - store_products            : 商品 CRUD + 列表（支持 category/isNew/hasDiscount 过滤）
  - store_product_likes       : 用户喜欢（like / unlike / check / 我点过的）
  - store_product_comments    : 商品评论（create / list / delete）
  - store_product_comment_likes: 评论点赞

技术要点：
  - 价格统一存 `price_cents`（整数分）；展示层再做两位小数格式化。
  - like_count / comment_count 用读-改-写维护（避免强依赖 RPC；已有的
    `increment_post_like_count` 是绑到 posts 表的不能复用）。在高并发下仍有
    最终一致性风险，后续可按需补 RPC 函数；但商品的写入 QPS 远低于 posts，
    这里先用简单实现。
  - 评论分页、回复结构和 `buyer_store_community_service` 对齐，前端可复用
    同样的 CommentsSection 组件。
"""

from typing import Optional, List, Tuple, Iterable, Dict
from datetime import datetime, date
import hashlib

from app.db.supabase import get_supabase, get_supabase_admin, execute_with_retry
from app.schemas.store_product import (
    StoreProduct,
    StoreProductCreate,
    StoreProductUpdate,
    ProductComment,
    ProductCommentCreate,
    ProductStatus,
    ProductCondition,
    SellerKind,
    PhotoAngles,
    BrandPriceRange,
    SupportContactInfo,
    MarketplaceSearchSuggestion,
)


# PRD 1.6 草稿数量上限 —— 跨设备同步草稿，但不允许无限制存。
LISTING_DRAFT_LIMIT = 5


# ===== 状态机 =====
# 集中表达 PRD 模块一的合法跳转。任何状态变更必须通过 transition_status，
# 直接 UPDATE status 字段会绕过校验，禁止使用。
_LISTING_TRANSITIONS: dict[ProductStatus, set[ProductStatus]] = {
    ProductStatus.DRAFT: {ProductStatus.REVIEWING, ProductStatus.OFFLINE},
    # active → reviewing：图片改了之后由 service 内部触发，重新进入审核。
    ProductStatus.REVIEWING: {ProductStatus.ACTIVE, ProductStatus.REJECTED, ProductStatus.DRAFT},
    ProductStatus.ACTIVE: {ProductStatus.FROZEN, ProductStatus.OFFLINE, ProductStatus.SOLD, ProductStatus.REVIEWING},
    ProductStatus.FROZEN: {ProductStatus.ACTIVE, ProductStatus.SOLD},  # 30 分钟未付款回 active；付款成功 → sold（P4 才会触发）
    ProductStatus.REJECTED: {ProductStatus.DRAFT, ProductStatus.OFFLINE},
    ProductStatus.OFFLINE: {ProductStatus.DRAFT},  # 下架后可重新进入草稿编辑
    ProductStatus.SOLD: set(),                     # 终态
}


def is_valid_transition(src: str, target: str) -> bool:
    try:
        src_e = ProductStatus(src)
        tgt_e = ProductStatus(target)
    except ValueError:
        return False
    return tgt_e in _LISTING_TRANSITIONS.get(src_e, set())


# ===== 统一查询 select 串 =====
# 关联拿分类名（展示用），users / user_info（评论用户名头像）
_PRODUCT_SELECT = (
    "*, store_product_categories(name)"
)
# 与 buyer_store_comments 相同：两张 users 外键必须用 *_fkey 消歧，否则 PostgREST 报错。
_COMMENT_SELECT = (
    "*, users!store_product_comments_user_id_fkey(username, user_info(avatar_url)),"
    " reply_to:users!store_product_comments_reply_to_user_id_fkey(username)"
)


class StoreProductService:
    """商品 + 商品评论 + 商品点赞 服务"""

    def __init__(self) -> None:
        self.db = get_supabase_admin()
        self.db_admin = get_supabase_admin()

    # ========================================================================
    # 商品 CRUD
    # ========================================================================

    @staticmethod
    def _format_product(
        row: dict,
        *,
        liked_by_me: Optional[bool] = None,
        favorited_by_me: Optional[bool] = None,
        wanted_by_me: Optional[bool] = None,
    ) -> StoreProduct:
        category = row.get("store_product_categories") or {}
        return StoreProduct(
            id=row["id"],
            storeId=row.get("store_id"),
            merchantId=row.get("merchant_id"),
            sellerKind=row.get("seller_kind", "merchant"),
            sellerUserId=row.get("seller_user_id"),
            categoryId=row.get("category_id"),
            categoryName=category.get("name") if isinstance(category, dict) else None,
            categoryKind=row.get("category_kind"),
            title=row["title"],
            description=row.get("description"),
            brand=row.get("brand"),
            images=row.get("images") or [],
            priceCents=row["price_cents"],
            currency=row.get("currency", "CNY"),
            discountPriceCents=row.get("discount_price_cents"),
            hasDiscount=row.get("has_discount", False),
            isNew=row.get("is_new", False),
            tags=row.get("tags") or [],
            likeCount=row.get("like_count", 0),
            commentCount=row.get("comment_count", 0),
            viewCount=row.get("view_count", 0),
            wantCount=row.get("want_count", 0),
            favoriteCount=row.get("favorite_count", 0),
            status=row.get("status", "draft"),
            size=row.get("size"),
            color=row.get("color"),
            condition=row.get("condition"),
            conditionNote=row.get("condition_note"),
            originalShowId=row.get("original_show_id"),
            originalAcquiredAt=row.get("original_acquired_at"),
            acceptOffer=row.get("accept_offer", True),
            photoAngles=row.get("photo_angles"),
            frozenUntil=row.get("frozen_until"),
            currentBuyerId=row.get("current_buyer_id"),
            soldAt=row.get("sold_at"),
            rejectedReason=row.get("rejected_reason"),
            likedByMe=liked_by_me,
            favoritedByMe=favorited_by_me,
            wantedByMe=wanted_by_me,
            publishedAt=row.get("published_at"),
            createdAt=row.get("created_at"),
            updatedAt=row.get("updated_at"),
            isCurated=bool(row.get("is_curated") or False),
            curatedSortOrder=row.get("curated_sort_order"),
            completenessScore=int(row.get("completeness_score") or 0),
            # PRD 单品 Phase 2
            styleName=row.get("style_name"),
            accessoriesNote=row.get("accessories_note"),
            shipFromCountry=row.get("ship_from_country"),
            shipFromState=row.get("ship_from_state"),
            shipFromCity=row.get("ship_from_city"),
            shippingFeeMode=row.get("shipping_fee_mode") or "cod",
            commissionRateBps=row.get("commission_rate_bps") or 100,
        )

    # ------------------------------------------------------------------
    # 单品防重复 / 草稿上限工具（PRD 1.6）
    # ------------------------------------------------------------------

    @staticmethod
    def _make_dedup_signature(
        *,
        brand: Optional[str],
        style_name: Optional[str],
        size: Optional[str],
        color: Optional[str],
    ) -> Optional[str]:
        """品牌 + 款式 + 尺码 + 颜色的小写归一指纹。

        任意一项为空都返回 None：同一卖家发 2 件信息都没填的草稿不算重复。
        """
        if not brand or not size or not color:
            return None
        raw = "|".join(
            (
                (brand or "").strip().lower(),
                (style_name or "").strip().lower(),
                (size or "").strip().lower(),
                (color or "").strip().lower(),
            )
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]

    def _count_open_drafts(self, seller_user_id: int) -> int:
        """返回该用户当前 individual 草稿数。"""
        try:
            res = (
                self.db.table("store_products")
                .select("id", count="exact")
                .eq("seller_user_id", seller_user_id)
                .eq("seller_kind", "individual")
                .eq("status", "draft")
                .limit(1)
                .execute()
            )
            return res.count or 0
        except Exception:
            return 0

    def _find_active_duplicate(
        self,
        *,
        seller_user_id: Optional[int],
        merchant_id: Optional[int],
        signature: Optional[str],
        exclude_product_id: Optional[int] = None,
    ) -> Optional[int]:
        """根据指纹查找同卖家未售出的重复 listing，命中返回 product_id。"""
        if not signature:
            return None
        try:
            q = (
                self.db.table("store_products")
                .select("id, status")
                .eq("dedup_signature", signature)
                .in_("status", ("draft", "reviewing", "active", "frozen"))
            )
            if seller_user_id is not None:
                q = q.eq("seller_user_id", seller_user_id)
            elif merchant_id is not None:
                q = q.eq("merchant_id", merchant_id)
            else:
                return None
            rows = q.execute().data or []
        except Exception:
            return None
        for r in rows:
            if exclude_product_id is not None and int(r.get("id")) == int(exclude_product_id):
                continue
            return int(r.get("id"))
        return None

    # ------------------------------------------------------------------
    # 品牌历史价格区间（PRD 1.4）
    # ------------------------------------------------------------------

    def suggest_brand_price_range(
        self,
        *,
        brand: str,
        condition: Optional[str] = None,
    ) -> BrandPriceRange:
        """读 ``brand_price_history`` 视图，命中时按 P25 / P50 / P75 返回区间。

        - 当 condition 也命中、且样本量 >= 3 时优先返回那条；
        - 否则按品牌聚合所有 condition 的样本（加权 P25/50/75）；
        - 完全没有历史样本时返回 source=fallback 占位 (lowCents=0)。
        """
        brand_key = (brand or "").strip().lower()
        if not brand_key:
            return BrandPriceRange(brand=brand or "", source="fallback")

        try:
            rows = (
                self.db.table("brand_price_history")
                .select("*")
                .eq("brand_key", brand_key)
                .execute()
                .data
                or []
            )
        except Exception as e:
            print(f"[brand_price_history] query failed brand={brand}: {e}")
            rows = []

        if not rows:
            return BrandPriceRange(brand=brand, condition=condition, source="fallback")

        match: Optional[dict] = None
        if condition:
            for r in rows:
                if (r.get("condition") or "") == condition and (r.get("sample_size") or 0) >= 3:
                    match = r
                    break

        if match:
            return BrandPriceRange(
                brand=brand,
                condition=condition,
                sampleSize=int(match.get("sample_size") or 0),
                lowCents=int(match.get("p25_cents") or 0),
                medianCents=int(match.get("p50_cents") or 0),
                highCents=int(match.get("p75_cents") or 0),
                minCents=int(match.get("min_cents") or 0),
                maxCents=int(match.get("max_cents") or 0),
                source="history",
            )

        total = sum((r.get("sample_size") or 0) for r in rows)
        if total <= 0:
            return BrandPriceRange(brand=brand, condition=condition, source="fallback")
        p25 = sum(((r.get("p25_cents") or 0) * (r.get("sample_size") or 0)) for r in rows) / total
        p50 = sum(((r.get("p50_cents") or 0) * (r.get("sample_size") or 0)) for r in rows) / total
        p75 = sum(((r.get("p75_cents") or 0) * (r.get("sample_size") or 0)) for r in rows) / total
        mn = min((r.get("min_cents") or 0) for r in rows)
        mx = max((r.get("max_cents") or 0) for r in rows)
        return BrandPriceRange(
            brand=brand,
            condition=condition,
            sampleSize=int(total),
            lowCents=int(p25),
            medianCents=int(p50),
            highCents=int(p75),
            minCents=int(mn),
            maxCents=int(mx),
            source="history",
        )

    # ------------------------------------------------------------------
    # 客服联系配置
    # ------------------------------------------------------------------

    def get_support_contact(self) -> SupportContactInfo:
        try:
            res = (
                self.db.table("support_contact_config")
                .select("*")
                .eq("id", 1)
                .limit(1)
                .execute()
            )
            row = (res.data or [None])[0]
        except Exception:
            row = None
        if not row:
            return SupportContactInfo(
                weekdayHours="09:00 - 21:00",
                weekendHours="10:00 - 18:00",
                timezone="Asia/Shanghai",
                email="support@avantregard.com",
                notice="工作日 09:00-21:00 · 周末 10:00-18:00",
            )
        return SupportContactInfo(
            weekdayHours=row.get("weekday_hours") or "09:00 - 21:00",
            weekendHours=row.get("weekend_hours") or "10:00 - 18:00",
            timezone=row.get("timezone") or "Asia/Shanghai",
            wechatId=row.get("wechat_id"),
            email=row.get("email"),
            notice=row.get("notice"),
        )

    def create_product(
        self, store_id: str, merchant_id: int, data: StoreProductCreate
    ) -> StoreProduct:
        """买手店发布商品（保留旧入口签名，兼容已有路由）。

        新版 PRD 单品发布同样允许个人卖家走 create_listing。本方法将 seller_kind
        强制成 merchant 并把数据组装好后委派给统一的 _insert_listing。
        """
        return self._insert_listing(
            data,
            store_id=store_id,
            merchant_id=merchant_id,
            seller_kind=SellerKind.MERCHANT,
            seller_user_id=None,
        )

    def create_individual_listing(
        self, seller_user_id: int, data: StoreProductCreate
    ) -> StoreProduct:
        """C2C 个人卖家发布单品。

        - 自动 ensure_exists seller_profiles
        - store_id / merchant_id 强制为 NULL
        - 默认状态为 draft（除非显式传 reviewing / active，后者只允许在 dev 自动审核 flag 下生效）
        """
        from app.services.seller_profile_service import seller_profile_service
        seller_profile_service.ensure_exists(seller_user_id)
        return self._insert_listing(
            data,
            store_id=None,
            merchant_id=None,
            seller_kind=SellerKind.INDIVIDUAL,
            seller_user_id=seller_user_id,
        )

    def _insert_listing(
        self,
        data: StoreProductCreate,
        *,
        store_id: Optional[str],
        merchant_id: Optional[int],
        seller_kind: SellerKind,
        seller_user_id: Optional[int],
    ) -> StoreProduct:
        # 提交即 active 的快捷路径只在草稿态以外的显式 status 时生效；其他状态由 transition 接口路由。
        status_value = data.status.value if hasattr(data.status, "value") else str(data.status)
        photo_angles_payload = (
            data.photoAngles.model_dump(exclude={"REQUIRED_SLOTS"})
            if isinstance(data.photoAngles, PhotoAngles)
            else data.photoAngles
        )

        # PRD 1.6 草稿数量上限（individual 卖家最多 5 个 draft）
        if seller_kind == SellerKind.INDIVIDUAL and status_value == "draft" and seller_user_id is not None:
            count = self._count_open_drafts(seller_user_id)
            if count >= LISTING_DRAFT_LIMIT:
                raise ValueError(
                    f"草稿数量已达上限 {LISTING_DRAFT_LIMIT} 份，请先提交或删除已有草稿"
                )

        # 防重复指纹（同一卖家若 brand+style+size+color 完全一致，提示去续草稿）
        signature = self._make_dedup_signature(
            brand=data.brand,
            style_name=getattr(data, "styleName", None),
            size=data.size,
            color=data.color,
        )
        if signature:
            dup = self._find_active_duplicate(
                seller_user_id=seller_user_id,
                merchant_id=merchant_id,
                signature=signature,
            )
            if dup:
                raise ValueError(f"已存在同款单品 (#{dup})，请直接编辑或先下架")

        insert_data: dict = {
            "store_id": store_id,
            "merchant_id": merchant_id,
            "seller_kind": seller_kind.value,
            "seller_user_id": seller_user_id,
            "category_id": data.categoryId,
            "category_kind": getattr(data, "categoryKind", None),
            "title": data.title,
            "description": data.description,
            "brand": data.brand,
            "images": data.images,
            "price_cents": data.priceCents,
            "currency": data.currency,
            "discount_price_cents": data.discountPriceCents,
            "is_new": data.isNew,
            "tags": data.tags,
            "status": status_value,
            "size": data.size,
            "color": data.color,
            "condition": data.condition.value if data.condition else None,
            "condition_note": data.conditionNote,
            "original_show_id": data.originalShowId,
            "original_acquired_at": (
                data.originalAcquiredAt.isoformat() if data.originalAcquiredAt else None
            ),
            "accept_offer": data.acceptOffer,
            "photo_angles": photo_angles_payload,
            # PRD 单品 Phase 2 新字段
            "style_name": getattr(data, "styleName", None),
            "accessories_note": getattr(data, "accessoriesNote", None),
            "ship_from_country": getattr(data, "shipFromCountry", None),
            "ship_from_state": getattr(data, "shipFromState", None),
            "ship_from_city": getattr(data, "shipFromCity", None),
            "shipping_fee_mode": getattr(data, "shippingFeeMode", "cod") or "cod",
            "commission_rate_bps": 100,  # PRD：发布即 1% 抽佣
            "dedup_signature": signature,
        }
        result = self.db_admin.table("store_products").insert(insert_data).execute()
        if not result.data:
            raise RuntimeError("failed to create listing")
        return self.get_product(result.data[0]["id"]) or self._format_product(result.data[0])

    # ========================================================================
    # 所有权 / 卖家解析
    # ========================================================================

    def assert_owner(self, product_id: int, *, user_id: int, merchant_id: Optional[int] = None) -> dict:
        """统一所有权校验：merchant（按 merchant_id）或 individual（按 seller_user_id）。

        返回 raw row；失败抛 ValueError。
        """
        raw = self._get_product_raw(product_id)
        if not raw:
            raise ValueError("商品不存在")
        kind = raw.get("seller_kind", "merchant")
        if kind == "merchant":
            if merchant_id is None or raw.get("merchant_id") != merchant_id:
                raise ValueError("无权限操作")
        elif kind == "individual":
            if raw.get("seller_user_id") != user_id:
                raise ValueError("无权限操作")
        else:
            raise ValueError("未知 seller_kind")
        return raw

    def update_product(
        self,
        product_id: int,
        merchant_id: int,
        data: StoreProductUpdate,
    ) -> StoreProduct:
        """旧入口：买手店更新商品（按 merchant_id 校验所有权）。"""
        return self._update_listing(
            product_id, data, owner_user_id=None, owner_merchant_id=merchant_id
        )

    def update_listing_by_user(
        self,
        product_id: int,
        user_id: int,
        data: StoreProductUpdate,
    ) -> StoreProduct:
        """C2C 个人卖家更新单品（按 seller_user_id 校验所有权）。"""
        return self._update_listing(
            product_id, data, owner_user_id=user_id, owner_merchant_id=None
        )

    def _update_listing(
        self,
        product_id: int,
        data: StoreProductUpdate,
        *,
        owner_user_id: Optional[int],
        owner_merchant_id: Optional[int],
    ) -> StoreProduct:
        raw = self._get_product_raw(product_id)
        if not raw:
            raise ValueError("商品不存在")

        kind = raw.get("seller_kind", "merchant")
        if kind == "merchant":
            if owner_merchant_id is None or raw.get("merchant_id") != owner_merchant_id:
                raise ValueError("无权限操作")
        else:
            if owner_user_id is None or raw.get("seller_user_id") != owner_user_id:
                raise ValueError("无权限操作")

        # 状态变更必须走 transition 接口，禁止从 update 路径直接改成非草稿态。
        patch = data.model_dump(exclude_unset=True)
        if "status" in patch and patch["status"] is not None:
            new_status = patch["status"].value if hasattr(patch["status"], "value") else patch["status"]
            cur_status = raw.get("status", "draft")
            # 仅允许 draft <-> draft 这种 noop，其他状态变更要求走 transition 接口
            if new_status != cur_status:
                raise ValueError("请调用 transition 接口切换商品状态")
            patch.pop("status")

        field_map = {
            "categoryId": "category_id",
            "categoryKind": "category_kind",
            "title": "title",
            "description": "description",
            "brand": "brand",
            "images": "images",
            "priceCents": "price_cents",
            "currency": "currency",
            "discountPriceCents": "discount_price_cents",
            "isNew": "is_new",
            "tags": "tags",
            "size": "size",
            "color": "color",
            "condition": "condition",
            "conditionNote": "condition_note",
            "originalShowId": "original_show_id",
            "originalAcquiredAt": "original_acquired_at",
            "acceptOffer": "accept_offer",
            "photoAngles": "photo_angles",
            # PRD 单品 Phase 2
            "styleName": "style_name",
            "accessoriesNote": "accessories_note",
            "shipFromCountry": "ship_from_country",
            "shipFromState": "ship_from_state",
            "shipFromCity": "ship_from_city",
            "shippingFeeMode": "shipping_fee_mode",
        }
        db_patch: dict = {}
        for k, v in patch.items():
            if k not in field_map:
                continue
            if hasattr(v, "value"):
                v = v.value
            if isinstance(v, PhotoAngles):
                v = v.model_dump(exclude={"REQUIRED_SLOTS"})
            # date / datetime 不能直接交给 supabase client(json.dumps 会报
            # "Object of type date is not JSON serializable")，统一转 ISO 字符串。
            if isinstance(v, (datetime, date)):
                v = v.isoformat()
            db_patch[field_map[k]] = v

        # 折扣价合法性（update 场景）：要同时考虑是否也在改 priceCents
        new_price = db_patch.get("price_cents", raw["price_cents"])
        if "discount_price_cents" in db_patch:
            new_discount = db_patch["discount_price_cents"]
            if new_discount is not None and new_discount > new_price:
                raise ValueError("折扣价不能高于原价")

        if not db_patch:
            return self._format_product(raw)

        # ---- PRD 重审逻辑 ----
        # 改价格 / 描述 / 物流 等不影响审核；图片变化（images 或 photoAngles）
        # 在 active 状态下要重新进入 reviewing，期间 marketplace 不再返回。
        cur_status = raw.get("status", "draft")
        image_fields_changed = ("images" in db_patch) or ("photo_angles" in db_patch)

        def _image_actually_different() -> bool:
            if "images" in db_patch:
                if (db_patch["images"] or []) != (raw.get("images") or []):
                    return True
            if "photo_angles" in db_patch:
                if (db_patch["photo_angles"] or {}) != (raw.get("photo_angles") or {}):
                    return True
            return False

        retrigger_review = (
            cur_status == "active"
            and image_fields_changed
            and _image_actually_different()
        )
        if retrigger_review:
            db_patch["status"] = "reviewing"
            # 重新进入审核期间不再展示在 marketplace（status 字段就够了，不必额外字段）

        # 同步指纹：brand / styleName / size / color 任一更新都会重算
        if any(k in db_patch for k in ("brand", "style_name", "size", "color")):
            new_brand = db_patch.get("brand", raw.get("brand"))
            new_style = db_patch.get("style_name", raw.get("style_name"))
            new_size = db_patch.get("size", raw.get("size"))
            new_color = db_patch.get("color", raw.get("color"))
            signature = self._make_dedup_signature(
                brand=new_brand,
                style_name=new_style,
                size=new_size,
                color=new_color,
            )
            dup = self._find_active_duplicate(
                seller_user_id=owner_user_id if kind == "individual" else None,
                merchant_id=owner_merchant_id if kind == "merchant" else None,
                signature=signature,
                exclude_product_id=product_id,
            )
            if dup:
                raise ValueError(f"已存在同款单品 (#{dup})，请勿重复上架")
            db_patch["dedup_signature"] = signature

        # 改价检测: 在 update 落库前抓住旧价, 落库后向收藏用户广播
        old_price_cents = int(raw.get("price_cents") or 0)
        new_price_cents = (
            int(db_patch["price_cents"])
            if "price_cents" in db_patch and db_patch["price_cents"] is not None
            else None
        )
        # 只有 active 在售商品才发改价通知 (草稿改价无意义)
        should_notify_price = (
            new_price_cents is not None
            and new_price_cents != old_price_cents
            and cur_status == "active"
        )

        q = self.db_admin.table("store_products").update(db_patch).eq("id", product_id)
        if kind == "merchant":
            q = q.eq("merchant_id", owner_merchant_id)
        else:
            q = q.eq("seller_user_id", owner_user_id)
        result = q.execute()
        if not result.data:
            raise ValueError("商品更新失败")

        # 重审：图片改了 -> 需要写一条审核轨迹 + 撤销已有出价
        if retrigger_review:
            try:
                self.db_admin.table("product_review_audits").insert(
                    {
                        "product_id": product_id,
                        "reviewer_user_id": None,
                        "decision": "image_resubmit",
                        "reason": "卖家修改了实拍图，需重新审核",
                    }
                ).execute()
            except Exception as e:
                print(f"[store_products] write resubmit audit failed: {e}")
            # 重审期间撤回所有 pending 出价（PRD：商品消失 + offer 自动清空）
            try:
                self._withdraw_pending_offers(product_id, reason="重新审核期间下架")
            except Exception as e:
                print(f"[store_products] withdraw offers on re-review failed: {e}")

        if should_notify_price:
            self._notify_interested_users(
                product_id,
                kind="price_changed",
                exclude_user_id=owner_user_id if kind == "individual" else None,
                old_price_cents=old_price_cents,
                new_price_cents=new_price_cents,
            )

        return self.get_product(product_id) or self._format_product(result.data[0])

    # ------------------------------------------------------------------
    # 下架 / 重审时批量撤销 offer
    # ------------------------------------------------------------------

    def _withdraw_pending_offers(
        self, product_id: int, *, reason: str = "商品已下架"
    ) -> int:
        """商品下架或重审时，把所有 pending offers 标为 withdrawn。

        买家在 MyOffers 看到的是 withdrawn 状态而不是"消失"，避免疑惑。
        返回受影响的 offer 数量；失败时静默吞错（这是辅助操作，不阻塞主流程）。
        """
        try:
            res = (
                self.db_admin.table("offers")
                .update(
                    {
                        "status": "withdrawn",
                        "resolved_at": datetime.utcnow().isoformat(),
                        "message": reason,
                    }
                )
                .eq("product_id", product_id)
                .eq("status", "pending")
                .execute()
            )
            return len(res.data or [])
        except Exception as e:
            print(f"[store_products] _withdraw_pending_offers failed pid={product_id}: {e}")
            return 0

    # ========================================================================
    # PRD 状态机：草稿 -> 审核 -> 上架 -> 冻结 -> 售出
    # ========================================================================

    def transition_status(
        self,
        product_id: int,
        target: ProductStatus,
        *,
        actor_user_id: int,
        is_admin: bool = False,
        reason: Optional[str] = None,
    ) -> StoreProduct:
        """集中处理 PRD 单品状态机迁移。

        - 普通卖家可触发：draft→reviewing、reviewing→draft、active→offline、offline→draft、rejected→draft。
        - admin 可额外触发：reviewing→active（审核通过）、reviewing→rejected。
        - active→frozen / frozen→active / frozen→sold 由订单引擎在 P4 调用，要求 actor=系统级。
        - 任何非法跳转抛 ValueError。
        """
        raw = self._get_product_raw(product_id)
        if not raw:
            raise ValueError("商品不存在")

        src = raw.get("status", "draft")
        if not is_valid_transition(src, target.value):
            raise ValueError(f"非法状态跳转：{src} → {target.value}")

        # 卖家自助转移的权限矩阵
        seller_allowed: dict[str, set[str]] = {
            "draft": {"reviewing", "offline"},
            "reviewing": {"draft"},
            "active": {"offline"},
            "rejected": {"draft", "offline"},
            "offline": {"draft"},
        }
        # 管理员转移的额外能力
        admin_allowed: dict[str, set[str]] = {
            "reviewing": {"active", "rejected"},
        }
        kind = raw.get("seller_kind", "merchant")
        is_owner = (
            kind == "individual" and raw.get("seller_user_id") == actor_user_id
        )
        # merchant 路径下 actor 是否为 owner 由调用方提前校验（路由层）
        if kind == "merchant":
            is_owner = True  # 路由保证

        if not is_admin and not is_owner:
            raise ValueError("无权限操作")
        if not is_admin:
            if target.value not in seller_allowed.get(src, set()):
                raise ValueError(f"非法状态跳转：{src} → {target.value}")
        if is_admin and not is_owner:
            if target.value not in admin_allowed.get(src, set()):
                raise ValueError(f"管理员不能从 {src} 跳转到 {target.value}")

        update_payload: dict = {"status": target.value}
        if target == ProductStatus.ACTIVE and src == ProductStatus.REVIEWING:
            update_payload["published_at"] = datetime.utcnow().isoformat()
            update_payload["rejected_reason"] = None
        if target == ProductStatus.REJECTED:
            update_payload["rejected_reason"] = reason
        if target == ProductStatus.SOLD:
            update_payload["sold_at"] = datetime.utcnow().isoformat()

        result = (
            self.db_admin.table("store_products")
            .update(update_payload)
            .eq("id", product_id)
            .execute()
        )
        if not result.data:
            raise ValueError("状态变更失败")

        # listing 进入 active 时播种履历事件（PRD 模块三）
        if target == ProductStatus.ACTIVE and src == ProductStatus.REVIEWING:
            try:
                from app.services.provenance_service import provenance_service
                provenance_service.seed_initial_events(
                    product_id,
                    seller_kind=raw.get("seller_kind", "merchant"),
                    seller_user_id=raw.get("seller_user_id"),
                    merchant_id=raw.get("merchant_id"),
                    original_show_id=raw.get("original_show_id"),
                    original_acquired_at=raw.get("original_acquired_at"),
                    brand_id=None,
                )
            except Exception as e:
                print(f"[store_products] provenance seed skipped: {e}")

            # 通知卖家粉丝：你关注的卖家上架了新单品
            try:
                self._notify_followers_new_listing(product_id, raw)
            except Exception as e:
                print(f"[store_products] notify followers skipped pid={product_id}: {e}")

        # 审核轨迹（reviewing → active / rejected）
        if src == "reviewing" and target in (ProductStatus.ACTIVE, ProductStatus.REJECTED):
            decision = "approved" if target == ProductStatus.ACTIVE else "rejected"
            try:
                self.db_admin.table("product_review_audits").insert(
                    {
                        "product_id": product_id,
                        "reviewer_user_id": actor_user_id if is_admin else None,
                        "decision": decision if is_admin else "auto_approved",
                        "reason": reason,
                    }
                ).execute()
            except Exception as e:
                print(f"[store_products] write review audit failed: {e}")

        # ====== PRD 模块三 收藏夹通知 (售出 / 下架) ======
        # active → sold : 通知所有收藏 / 想要的用户 "已售出"
        # *     → offline (卖家主动下架, 不是被订单冻结) : 通知 "已下架"
        if target == ProductStatus.SOLD:
            self._notify_interested_users(
                product_id,
                kind="sold",
                exclude_user_id=actor_user_id if not is_admin else None,
            )
        elif target == ProductStatus.OFFLINE and src in ("active", "rejected"):
            # 只在从 active 或 rejected 主动下架时通知, draft↔offline 是后台过渡
            self._notify_interested_users(
                product_id,
                kind="offline",
                exclude_user_id=actor_user_id if not is_admin else None,
            )
            # PRD：下架后买家已发起的 offer 自动撤回
            try:
                self._withdraw_pending_offers(product_id, reason="商品已下架")
            except Exception as e:
                print(f"[store_products] withdraw on offline failed pid={product_id}: {e}")

        return self.get_product(product_id) or self._format_product(result.data[0])

    # ========================================================================
    # 卖家管理后台
    # ========================================================================

    def list_seller_listings(
        self,
        *,
        seller_user_id: Optional[int] = None,
        merchant_id: Optional[int] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[StoreProduct], int]:
        """卖家（个人或买手店）后台的库存列表。"""
        q = self.db.table("store_products").select(_PRODUCT_SELECT, count="exact")
        if seller_user_id is not None:
            q = q.eq("seller_user_id", seller_user_id).eq("seller_kind", "individual")
        if merchant_id is not None:
            q = q.eq("merchant_id", merchant_id).eq("seller_kind", "merchant")
        if status:
            q = q.eq("status", status)
        q = q.order("created_at", desc=True)
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        result = execute_with_retry(lambda: q.execute(), label="store_products.list_seller")
        rows = result.data or []
        total = result.count or 0
        return [self._format_product(r) for r in rows], total

    def seller_listings_status_summary(
        self,
        *,
        seller_user_id: Optional[int] = None,
        merchant_id: Optional[int] = None,
    ) -> Dict[str, int]:
        """聚合卖家各 listing 状态的数量（卖家管理后台顶部统计卡片）。"""
        statuses = (
            "active",
            "draft",
            "reviewing",
            "sold",
            "offline",
            "rejected",
            "frozen",
        )
        counts: Dict[str, int] = {s: 0 for s in statuses}

        def _accumulate(*, uid: Optional[int] = None, mid: Optional[int] = None) -> None:
            q = self.db.table("store_products").select("status")
            if uid is not None:
                q = q.eq("seller_user_id", uid).eq("seller_kind", "individual")
            if mid is not None:
                q = q.eq("merchant_id", mid).eq("seller_kind", "merchant")
            res = execute_with_retry(
                lambda: q.execute(),
                label="store_products.seller_listings_status_summary",
            )
            for row in res.data or []:
                status = (row or {}).get("status")
                if status in counts:
                    counts[status] += 1

        if seller_user_id is not None:
            _accumulate(uid=seller_user_id)
        if merchant_id is not None:
            _accumulate(mid=merchant_id)
        return counts

    def batch_set_offline(
        self,
        product_ids: List[int],
        *,
        actor_user_id: int,
        seller_user_id: Optional[int] = None,
        merchant_id: Optional[int] = None,
    ) -> int:
        """批量下架（PRD 1.6）。只对 active 状态的商品生效；其余跳过。

        要求所有 product_id 都属于调用方。返回成功转换为 offline 的数量。
        """
        if not product_ids:
            return 0
        q = self.db.table("store_products").select("id, status, seller_kind, seller_user_id, merchant_id").in_("id", product_ids)
        rows = (q.execute().data or [])
        target_ids: List[int] = []
        for r in rows:
            kind = r.get("seller_kind", "merchant")
            if kind == "individual" and r.get("seller_user_id") != seller_user_id:
                raise ValueError("无权限操作")
            if kind == "merchant" and r.get("merchant_id") != merchant_id:
                raise ValueError("无权限操作")
            if r.get("status") == "active":
                target_ids.append(r["id"])
        if not target_ids:
            return 0
        self.db_admin.table("store_products").update({"status": "offline"}).in_("id", target_ids).execute()
        # 批量下架后逐个通知收藏用户 + 撤回所有 pending offer
        for pid in target_ids:
            try:
                self._notify_interested_users(
                    pid,
                    kind="offline",
                    exclude_user_id=actor_user_id,
                )
            except Exception as e:
                print(f"[store_products] batch offline notify pid={pid} failed: {e}")
            try:
                self._withdraw_pending_offers(pid, reason="商品已下架")
            except Exception as e:
                print(f"[store_products] batch offline withdraw pid={pid} failed: {e}")
        return len(target_ids)

    def batch_delete_drafts(
        self,
        product_ids: List[int],
        *,
        seller_user_id: Optional[int] = None,
        merchant_id: Optional[int] = None,
    ) -> int:
        """批量删除（允许 draft / rejected / offline）。返回删除数量。"""
        if not product_ids:
            return 0
        q = self.db.table("store_products").select("id, status, seller_kind, seller_user_id, merchant_id").in_("id", product_ids)
        rows = (q.execute().data or [])
        target_ids: List[int] = []
        for r in rows:
            kind = r.get("seller_kind", "merchant")
            if kind == "individual" and r.get("seller_user_id") != seller_user_id:
                raise ValueError("无权限操作")
            if kind == "merchant" and r.get("merchant_id") != merchant_id:
                raise ValueError("无权限操作")
            if r.get("status") in ("draft", "rejected", "offline"):
                target_ids.append(r["id"])
        if not target_ids:
            return 0
        self.db_admin.table("store_products").delete().in_("id", target_ids).execute()
        return len(target_ids)

    def admin_list_all_products(
        self,
        *,
        status: Optional[str] = None,
        search_query: Optional[str] = None,
        seller_kind: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[StoreProduct], int]:
        """管理员后台：列出所有商品（可按状态/关键词/卖家类型筛选）。"""
        q = self.db.table("store_products").select(_PRODUCT_SELECT, count="exact")
        if status:
            q = q.eq("status", status)
        if seller_kind:
            q = q.eq("seller_kind", seller_kind)
        if search_query:
            kw = search_query.replace("%", "\\%").replace("_", "\\_").strip()
            if kw:
                q = q.or_(f"title.ilike.%{kw}%,brand.ilike.%{kw}%")
        q = q.order("created_at", desc=True)
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        result = execute_with_retry(lambda: q.execute(), label="store_products.admin_list_all")
        rows = result.data or []
        total = result.count or 0
        return [self._format_product(r) for r in rows], total

    def admin_update_product(
        self,
        product_id: int,
        data: StoreProductUpdate,
    ) -> StoreProduct:
        """管理员更新商品（跳过所有权校验，允许直接修改状态）。"""
        raw = self._get_product_raw(product_id)
        if not raw:
            raise ValueError("商品不存在")

        patch = data.model_dump(exclude_unset=True)

        field_map = {
            "categoryId": "category_id",
            "categoryKind": "category_kind",
            "title": "title",
            "description": "description",
            "brand": "brand",
            "images": "images",
            "priceCents": "price_cents",
            "currency": "currency",
            "discountPriceCents": "discount_price_cents",
            "isNew": "is_new",
            "tags": "tags",
            "size": "size",
            "color": "color",
            "condition": "condition",
            "conditionNote": "condition_note",
            "originalShowId": "original_show_id",
            "originalAcquiredAt": "original_acquired_at",
            "acceptOffer": "accept_offer",
            "photoAngles": "photo_angles",
            "status": "status",
        }
        db_patch: dict = {}
        for k, v in patch.items():
            if k not in field_map:
                continue
            if hasattr(v, "value"):
                v = v.value
            if isinstance(v, PhotoAngles):
                v = v.model_dump(exclude={"REQUIRED_SLOTS"})
            # date / datetime 不能直接交给 supabase client(json.dumps 会报
            # "Object of type date is not JSON serializable")，统一转 ISO 字符串。
            if isinstance(v, (datetime, date)):
                v = v.isoformat()
            db_patch[field_map[k]] = v

        if not db_patch:
            return self._format_product(raw)

        result = self.db_admin.table("store_products").update(db_patch).eq("id", product_id).execute()
        if not result.data:
            raise ValueError("商品更新失败")
        return self.get_product(product_id) or self._format_product(result.data[0])

    def admin_delete_product(self, product_id: int) -> bool:
        """管理员删除商品（跳过所有权校验，不限状态）。"""
        result = (
            self.db_admin.table("store_products")
            .delete()
            .eq("id", product_id)
            .execute()
        )
        return bool(result.data)

    def admin_create_product(self, data: StoreProductCreate) -> StoreProduct:
        """管理员创建商品（跳过所有权校验）。"""
        seller_kind = data.sellerKind if hasattr(data, "sellerKind") else SellerKind.INDIVIDUAL
        return self._insert_listing(
            data,
            store_id=None,
            merchant_id=None,
            seller_kind=seller_kind if isinstance(seller_kind, SellerKind) else SellerKind(seller_kind),
            seller_user_id=None,
        )

    def list_reviewing(self, *, page: int = 1, page_size: int = 50) -> Tuple[List[StoreProduct], int]:
        """管理员后台：审核队列。"""
        q = (
            self.db.table("store_products")
            .select(_PRODUCT_SELECT, count="exact")
            .eq("status", "reviewing")
            .order("created_at", desc=False)
        )
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        result = execute_with_retry(lambda: q.execute(), label="store_products.list_reviewing")
        rows = result.data or []
        total = result.count or 0
        return [self._format_product(r) for r in rows], total

    def submit_for_review(
        self,
        product_id: int,
        *,
        actor_user_id: int,
        auto_approve: bool = False,
    ) -> StoreProduct:
        """卖家提交审核（draft → reviewing）。

        - 校验：7 视角图必须齐全、condition 必填。
        - auto_approve（dev / feature flag 开启）：连接到 reviewing → active 自动通过。
        """
        raw = self._get_product_raw(product_id)
        if not raw:
            raise ValueError("商品不存在")
        if raw.get("status") != "draft":
            raise ValueError("仅草稿状态可提交审核")

        photo_angles = raw.get("photo_angles") or {}
        # 与 PhotoAngles.REQUIRED_SLOTS 保持一致 —— 后端是唯一权威, 前端校验只是
        # 用户体验. 任何缺失都拒提交, 让卖家在 wizard step2 补齐.
        required_slots = (
            "front",
            "back",
            "wash_label",
            "wash_label_back",
            "brand_label",
            "brand_label_back",
            "flaw",
        )
        missing = [k for k in required_slots if not photo_angles.get(k)]
        if missing:
            raise ValueError(f"以下视角图缺失：{','.join(missing)}")
        if not raw.get("condition"):
            raise ValueError("请选择成色")

        # draft → reviewing
        result = self.transition_status(
            product_id,
            ProductStatus.REVIEWING,
            actor_user_id=actor_user_id,
            is_admin=False,
        )
        if auto_approve:
            # reviewing → active（系统自动审核，actor 用同一个用户但 is_admin=True）
            result = self.transition_status(
                product_id,
                ProductStatus.ACTIVE,
                actor_user_id=actor_user_id,
                is_admin=True,
                reason="auto-approved by feature flag",
            )
        return result

    def delete_product(self, product_id: int, merchant_id: int) -> bool:
        result = (
            self.db_admin.table("store_products")
            .delete()
            .eq("id", product_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
        return bool(result.data)

    def get_product(
        self, product_id: int, *, user_id: Optional[int] = None
    ) -> Optional[StoreProduct]:
        result = execute_with_retry(
            lambda: self.db.table("store_products")
            .select(_PRODUCT_SELECT)
            .eq("id", product_id)
            .limit(1)
            .execute(),
            label="store_products.get",
        )
        if not result.data:
            return None
        liked = None
        favorited = None
        wanted = None
        if user_id is not None:
            liked = self.check_product_liked(product_id, user_id)
            favorited = self.check_product_favorited(product_id, user_id)
            wanted = self.check_product_wanted(product_id, user_id)
        return self._format_product(
            result.data[0],
            liked_by_me=liked,
            favorited_by_me=favorited,
            wanted_by_me=wanted,
        )

    # ========================================================================
    # 商品详情页 —— 富数据聚合接口（卖家 / 关联秀场 / 同卖家相关品牌 / 相关推荐 / 评论）
    # ========================================================================

    def get_product_rich_detail(
        self, product_id: int, *, user_id: Optional[int] = None
    ) -> Optional[dict]:
        """商品详情页一次性返回所有附加数据，避免前端 N+1。

        返回结构：
          {
            "product": StoreProduct.dict(),
            "seller":  {userId, username, avatarUrl, level, positiveRate, totalSales,
                        joinedAt, listingCount, soldCount}            | None,
            "show":    {id, brandName, season, year, category, title} | None,
            "relatedBrands":   [{name, listingCount, imageUrl}],
            "relatedProducts": [StoreProduct.dict()],          # 同品牌其他商品
            "sellerOtherProducts": [StoreProduct.dict()],      # 同卖家发布的其他在售单品
            "reviews":         {items: [{rating, comment, reviewerUsername,
                                          reviewerAvatar, submittedAt}], total},
          }
        所有子查询都做了 fail-safe：单点失败不影响主体 product 返回。
        """
        product = self.get_product(product_id, user_id=user_id)
        if not product:
            return None

        seller = self._fetch_seller_card(product)
        show = self._fetch_related_show(product.originalShowId)
        related_brands = self._fetch_seller_related_brands(product)
        related_products = self._fetch_related_products(product, exclude_id=product_id)
        seller_other_products = self._fetch_seller_other_products(
            product, exclude_id=product_id
        )
        reviews = self._fetch_seller_reviews(product.sellerUserId, limit=5)

        return {
            "product": product.model_dump(),
            "seller": seller,
            "show": show,
            "relatedBrands": related_brands,
            "relatedProducts": [p.model_dump() for p in related_products],
            "sellerOtherProducts": [p.model_dump() for p in seller_other_products],
            "reviews": reviews,
        }

    # ---- 内部聚合 helpers --------------------------------------------------

    def _attach_seller_display_bulk(self, products: List[StoreProduct]) -> None:
        """批量为 marketplace 列表卡片补充卖家展示信息（头像 + 名称）。

        与 ``_fetch_seller_card`` 不同：这里只取「头像 + 展示名」两项最轻量字段，
        并把同一批 listing 的查询合并成几条 IN 查询，避免列表场景下的 N+1。
        所有子查询失败都视为缺省，前端会走首字母占位兜底。
        """
        if not products:
            return

        # 1) merchant_id -> user_id（merchant 卖家需先反查 store_merchants）
        merchant_ids = {
            p.merchantId
            for p in products
            if p.sellerKind == "merchant" and p.merchantId is not None
        }
        merchant_user_map: dict[int, int] = {}
        if merchant_ids:
            try:
                rows = (
                    self.db.table("store_merchants")
                    .select("id, user_id")
                    .in_("id", list(merchant_ids))
                    .execute()
                    .data
                    or []
                )
                for r in rows:
                    if r.get("user_id") is not None:
                        merchant_user_map[r["id"]] = r["user_id"]
            except Exception:
                pass

        # 2) 解析每个 listing 对应的 user_id
        product_user: dict[int, Optional[int]] = {}
        for p in products:
            uid: Optional[int] = None
            if p.sellerKind == "individual":
                uid = p.sellerUserId
            elif p.sellerKind == "merchant" and p.merchantId is not None:
                uid = merchant_user_map.get(p.merchantId)
            product_user[p.id] = uid

        user_ids = {uid for uid in product_user.values() if uid}
        if not user_ids:
            return

        # 3) users + user_info(avatar_url)
        username_map: dict[int, Optional[str]] = {}
        avatar_map: dict[int, Optional[str]] = {}
        try:
            rows = (
                self.db.table("users")
                .select("id, username, user_info(avatar_url)")
                .in_("id", list(user_ids))
                .execute()
                .data
                or []
            )
            for r in rows:
                uid = r.get("id")
                if uid is None:
                    continue
                username_map[uid] = r.get("username")
                ui = r.get("user_info")
                if isinstance(ui, list) and ui:
                    avatar_map[uid] = (ui[0] or {}).get("avatar_url")
                elif isinstance(ui, dict):
                    avatar_map[uid] = ui.get("avatar_url")
        except Exception:
            pass

        # 注意：这里刻意不用 seller_profiles.display_name 覆盖 —— 列表卡片要和
        # 帖子卡片一致，展示用户的 id 名（users.username）；自定义展示名只在
        # 详情页卖家卡（_fetch_seller_card）里使用。

        for p in products:
            uid = product_user.get(p.id)
            if not uid:
                continue
            p.sellerName = username_map.get(uid)
            p.sellerAvatarUrl = avatar_map.get(uid)

    def _fetch_seller_card(self, product: StoreProduct) -> Optional[dict]:
        """根据卖家身份组合 seller_profiles + users + user_info + user_levels + 评价聚合。

        - merchant 路径：通过 store_merchants.id → user_id 再走下面同样链路
        - individual 路径：直接用 seller_user_id
        所有子查询失败都视为 None / 默认值，UI 侧走兜底。
        """
        user_id: Optional[int] = None
        if product.sellerKind == "individual":
            user_id = product.sellerUserId
        elif product.sellerKind == "merchant" and product.merchantId is not None:
            try:
                merchant_row = (
                    self.db.table("store_merchants")
                    .select("user_id")
                    .eq("id", product.merchantId)
                    .limit(1)
                    .execute()
                    .data
                )
                if merchant_row:
                    user_id = merchant_row[0].get("user_id")
            except Exception:
                pass

        if not user_id:
            return None

        username: Optional[str] = None
        avatar_url: Optional[str] = None
        joined_at: Optional[str] = None
        try:
            res = (
                self.db.table("users")
                .select("id, username, created_at, user_info(avatar_url)")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            if res.data:
                row = res.data[0]
                username = row.get("username")
                joined_at = row.get("created_at")
                ui = row.get("user_info")
                if isinstance(ui, list) and ui:
                    avatar_url = (ui[0] or {}).get("avatar_url")
                elif isinstance(ui, dict):
                    avatar_url = ui.get("avatar_url")
        except Exception:
            pass

        # seller_profiles：可能不存在（merchant 卖家通常没有）
        total_sales = 0
        display_name = None
        try:
            sp = (
                self.db.table("seller_profiles")
                .select("display_name, total_sales")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
                .data
            )
            if sp:
                display_name = sp[0].get("display_name")
                total_sales = sp[0].get("total_sales") or 0
        except Exception:
            pass

        # 成交笔数：seller_profiles.total_sales 没有写入路径（始终为 0），
        # 实时统计 orders 表中已付款且未退款的订单数，取两者较大值兜底。
        try:
            oc = (
                self.db.table("orders")
                .select("id", count="exact")
                .eq("seller_user_id", user_id)
                .in_("status", ["paid", "shipped", "delivered", "completed", "settled"])
                .limit(1)
                .execute()
            )
            total_sales = max(total_sales, oc.count or 0)
        except Exception:
            pass

        # user_levels
        level = 0
        try:
            lv = (
                self.db.table("user_levels")
                .select("current_level")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
                .data
            )
            if lv:
                level = lv[0].get("current_level") or 0
        except Exception:
            pass

        # 好评率：rating >= 4 的占比；trade_reviews + visible=TRUE
        positive_rate: Optional[float] = None
        try:
            rv = (
                self.db.table("trade_reviews")
                .select("rating")
                .eq("target_user_id", user_id)
                .eq("visible", True)
                .execute()
                .data
                or []
            )
            if rv:
                positives = sum(1 for r in rv if (r.get("rating") or 0) >= 4)
                positive_rate = positives / len(rv)
        except Exception:
            pass

        # 在售件数（仅 active 状态）
        listing_count = 0
        try:
            lc = (
                self.db.table("store_products")
                .select("id", count="exact")
                .eq("seller_user_id", user_id)
                .eq("status", "active")
                .limit(1)
                .execute()
            )
            listing_count = lc.count or 0
        except Exception:
            pass

        return {
            "userId": user_id,
            # 与帖子卡 / 商品卡一致，优先展示 users.username（用户名），
            # seller_profiles.display_name 仅作兜底——mock 数据把 display_name
            # 写成了 'Seller-<id>'，若优先用它会显示成 id 而非用户名。
            "username": username or display_name or "—",
            "avatarUrl": avatar_url,
            "level": level,
            "positiveRate": positive_rate,
            "totalSales": total_sales,
            "joinedAt": joined_at,
            "listingCount": listing_count,
        }

    def _fetch_related_show(self, show_id: Optional[str]) -> Optional[dict]:
        """商品关联的秀场。show_id 为空或秀场不存在时返回 None。"""
        if not show_id:
            return None
        try:
            res = (
                self.db.table("shows")
                .select("id, brand_name, season, year, category, title, cover_image")
                .eq("id", show_id)
                .limit(1)
                .execute()
                .data
            )
            if not res:
                return None
            row = res[0]
            return {
                "id": row.get("id"),
                "brandName": row.get("brand_name"),
                "season": row.get("season"),
                "year": row.get("year"),
                "category": row.get("category"),
                "title": row.get("title"),
                "coverImage": row.get("cover_image"),
            }
        except Exception:
            return None

    def _fetch_seller_related_brands(self, product: StoreProduct) -> List[dict]:
        """同卖家挂出的其他品牌（按当前 active 数量降序，最多 5 个）。

        若当前商品没有 sellerUserId（merchant 暂未在 seller_user_id 里）则返回空列表。
        """
        user_id = product.sellerUserId
        if not user_id:
            return []
        try:
            rows = (
                self.db.table("store_products")
                .select("brand")
                .eq("seller_user_id", user_id)
                .eq("status", "active")
                .execute()
                .data
                or []
            )
        except Exception:
            return []
        counts: dict = {}
        for r in rows:
            b = (r.get("brand") or "").strip()
            if not b:
                continue
            counts[b] = counts.get(b, 0) + 1
        if not counts:
            return []
        top = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:5]
        # 取品牌封面图
        names = [n for n, _ in top]
        cover_by_brand: dict = {}
        try:
            br = (
                self.db.table("brands")
                .select("id, name, brand_images(image_url, is_selected, status)")
                .in_("name", names)
                .execute()
                .data
                or []
            )
            for row in br:
                imgs = row.get("brand_images") or []
                if isinstance(imgs, dict):
                    imgs = [imgs]
                # 优先 APPROVED + is_selected
                pick = next(
                    (
                        i
                        for i in imgs
                        if i and i.get("is_selected") and i.get("status") in ("APPROVED", None)
                    ),
                    imgs[0] if imgs else None,
                )
                if pick:
                    cover_by_brand[row.get("name")] = pick.get("image_url")
        except Exception:
            pass
        return [
            {"name": name, "listingCount": cnt, "imageUrl": cover_by_brand.get(name)}
            for name, cnt in top
        ]

    def _fetch_related_products(
        self, product: StoreProduct, *, exclude_id: int, limit: int = 4
    ) -> List[StoreProduct]:
        """相关推荐：优先同品牌的其他 active 商品；不足再补同分类。"""
        out: List[StoreProduct] = []
        seen_ids: set = {exclude_id}
        try:
            if product.brand:
                q = (
                    self.db.table("store_products")
                    .select(_PRODUCT_SELECT)
                    .eq("status", "active")
                    .ilike("brand", product.brand)
                    .neq("id", exclude_id)
                    .order("favorite_count", desc=True)
                    .limit(limit)
                    .execute()
                    .data
                    or []
                )
                for r in q:
                    if r["id"] in seen_ids:
                        continue
                    seen_ids.add(r["id"])
                    out.append(self._format_product(r))
        except Exception:
            pass
        # 补足
        if len(out) < limit and product.categoryId:
            try:
                q = (
                    self.db.table("store_products")
                    .select(_PRODUCT_SELECT)
                    .eq("status", "active")
                    .eq("category_id", product.categoryId)
                    .neq("id", exclude_id)
                    .order("favorite_count", desc=True)
                    .limit(limit - len(out))
                    .execute()
                    .data
                    or []
                )
                for r in q:
                    if r["id"] in seen_ids:
                        continue
                    seen_ids.add(r["id"])
                    out.append(self._format_product(r))
            except Exception:
                pass
        return out[:limit]

    def _fetch_seller_other_products(
        self, product: StoreProduct, *, exclude_id: int, limit: int = 6
    ) -> List[StoreProduct]:
        """同一卖家挂出的其他在售单品（卖家本人发布的其他商品）。

        - individual 卖家：按 seller_user_id 匹配
        - merchant 卖家：按 merchant_id 匹配
        排除当前商品，仅取 active 状态，按上新时间倒序。
        """
        out: List[StoreProduct] = []
        try:
            q = (
                self.db.table("store_products")
                .select(_PRODUCT_SELECT)
                .eq("status", "active")
                .neq("id", exclude_id)
            )
            if product.sellerKind == "merchant" and product.merchantId is not None:
                q = q.eq("merchant_id", product.merchantId)
            elif product.sellerUserId is not None:
                q = q.eq("seller_user_id", product.sellerUserId)
            else:
                return []
            rows = (
                q.order("created_at", desc=True).limit(limit).execute().data or []
            )
            for r in rows:
                out.append(self._format_product(r))
        except Exception:
            pass
        return out[:limit]

    def _fetch_seller_reviews(
        self, seller_user_id: Optional[int], *, limit: int = 5
    ) -> dict:
        """返回某卖家最近的可见双盲评价（含评价者头像 / 用户名 / 等级）。"""
        if not seller_user_id:
            return {"items": [], "total": 0}
        try:
            res = (
                self.db.table("trade_reviews")
                .select("id, rating, comment, submitted_at, reviewer_user_id", count="exact")
                .eq("target_user_id", seller_user_id)
                .eq("visible", True)
                .order("submitted_at", desc=True)
                .limit(limit)
                .execute()
            )
            rows = res.data or []
            total = res.count or 0
        except Exception:
            return {"items": [], "total": 0}

        reviewer_ids = [r.get("reviewer_user_id") for r in rows if r.get("reviewer_user_id")]
        username_by_id: dict = {}
        avatar_by_id: dict = {}
        level_by_id: dict = {}
        if reviewer_ids:
            try:
                ur = (
                    self.db.table("users")
                    .select("id, username, user_info(avatar_url)")
                    .in_("id", reviewer_ids)
                    .execute()
                    .data
                    or []
                )
                for u in ur:
                    username_by_id[u["id"]] = u.get("username")
                    ui = u.get("user_info")
                    if isinstance(ui, list) and ui:
                        avatar_by_id[u["id"]] = (ui[0] or {}).get("avatar_url")
                    elif isinstance(ui, dict):
                        avatar_by_id[u["id"]] = ui.get("avatar_url")
            except Exception:
                pass
            try:
                lv = (
                    self.db.table("user_levels")
                    .select("user_id, current_level")
                    .in_("user_id", reviewer_ids)
                    .execute()
                    .data
                    or []
                )
                for l in lv:
                    level_by_id[l["user_id"]] = l.get("current_level") or 0
            except Exception:
                pass

        items = []
        for r in rows:
            rid = r.get("reviewer_user_id")
            items.append({
                "id": r["id"],
                "rating": r.get("rating") or 0,
                "comment": r.get("comment"),
                "submittedAt": r.get("submitted_at"),
                "reviewerUserId": rid,
                "reviewerUsername": username_by_id.get(rid),
                "reviewerAvatar": avatar_by_id.get(rid),
                "reviewerLevel": level_by_id.get(rid, 0),
            })
        return {"items": items, "total": total}

    def _get_product_raw(self, product_id: int) -> Optional[dict]:
        result = (
            self.db.table("store_products")
            .select("*")
            .eq("id", product_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    def list_products(
        self,
        store_id: str,
        *,
        category_id: Optional[int] = None,
        is_new: Optional[bool] = None,
        has_discount: Optional[bool] = None,
        status: str = "active",
        search_query: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        user_id: Optional[int] = None,
    ) -> Tuple[List[StoreProduct], int]:
        """列表查询。

        - 默认只列出 active 状态的商品，商家后台查看完整列表时可以传 status="" (空串)。
        - 过滤参数相互可组合：既可以查"分类 A 下的折扣商品"，也可以查"新品"。
        - user_id 传入时会批量回填 likedByMe，供详情页上的"喜欢"按钮定态。
        - 旧调用方传入 "PUBLISHED" 时自动改写成 "active"，保持向前兼容。
        """
        # count 必须每页都请求且使用 exact —— 同 list_comments 的注释，
        # planned + page==1-only 会让前端在第二页拿到 total=0、误判没有更多。
        query = self.db.table("store_products").select(_PRODUCT_SELECT, count="exact")

        query = query.eq("store_id", store_id)
        if status:
            # 兼容旧字符串
            normalized = {"PUBLISHED": "active", "SOLD_OUT": "sold", "HIDDEN": "offline", "DRAFT": "draft"}.get(status, status)
            query = query.eq("status", normalized)
        if category_id is not None:
            query = query.eq("category_id", category_id)
        if is_new is True:
            query = query.eq("is_new", True)
        if has_discount is True:
            query = query.eq("has_discount", True)
        if search_query:
            # title / brand 模糊搜索
            kw = search_query.replace("%", "\\%").replace("_", "\\_").strip()
            if kw:
                query = query.or_(f"title.ilike.%{kw}%,brand.ilike.%{kw}%")

        query = query.order("published_at", desc=True).order("id", desc=True)
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)

        result = execute_with_retry(
            lambda: query.execute(), label="store_products.list"
        )
        rows = result.data or []
        total = result.count or 0

        # 批量回填 likedByMe / favoritedByMe / wantedByMe
        liked_map: dict[int, bool] = {}
        favorited_map: dict[int, bool] = {}
        wanted_map: dict[int, bool] = {}
        if user_id is not None and rows:
            ids = [r["id"] for r in rows]
            liked_map = self._check_products_liked_bulk(ids, user_id)
            favorited_map = self._check_products_favorited_bulk(ids, user_id)
            wanted_map = self._check_products_wanted_bulk(ids, user_id)

        products = [
            self._format_product(
                row,
                liked_by_me=liked_map.get(row["id"]),
                favorited_by_me=favorited_map.get(row["id"]),
                wanted_by_me=wanted_map.get(row["id"]),
            )
            for row in rows
        ]
        return products, total

    def _resolve_category_ids_by_name(self, names: List[str]) -> List[int]:
        """把 PRD 6 大类名 (外套/上衣/裤装/鞋履/包袋/配饰) 反查成 category_id 列表。

        各买手店分类命名各异，做模糊匹配（``name ilike %外套%``）；命中的所有
        ``store_product_categories.id`` 都纳入查询。结果可能跨多个店铺。
        """
        if not names:
            return []
        cleaned = [n.replace("%", "").replace("_", "").strip() for n in names if n and n.strip()]
        if not cleaned:
            return []
        try:
            # 按 OR 一次性查回所有匹配的分类 id
            expr = ",".join(f"name.ilike.%{n}%" for n in cleaned)
            res = execute_with_retry(
                lambda: (
                    self.db.table("store_product_categories")
                    .select("id")
                    .or_(expr)
                    .limit(500)
                    .execute()
                ),
                label="store_product_categories.resolve_kind",
            )
            return [int(r["id"]) for r in (res.data or []) if r.get("id") is not None]
        except Exception as e:
            print(f"[store_product] resolve_category_ids_by_name failed: {e}")
            return []

    @staticmethod
    def _sanitize_search_keyword(keyword: str) -> str:
        """清理搜索关键词，转义 PostgREST ilike 特殊字符。"""
        sanitized = keyword.replace("\\", "\\\\")
        sanitized = sanitized.replace("%", "\\%")
        sanitized = sanitized.replace("_", "\\_")
        sanitized = sanitized.replace(",", " ")
        return sanitized.strip()

    @staticmethod
    def _show_season_code(season: Optional[str], year: Optional[int]) -> str:
        """把秀场季度 + 年份格式化为 FW07 / SS24 这类短码。"""
        s = (season or "").strip().lower()
        abbr = ""
        if any(token in s for token in ("fall", "winter", "fw", "autumn", "秋冬")):
            abbr = "FW"
        elif any(token in s for token in ("spring", "summer", "ss", "春夏")):
            abbr = "SS"
        elif season:
            compact = season.replace(" ", "").upper()
            if compact.startswith("FW") or compact.startswith("SS"):
                abbr = compact[:2]
        if year and abbr:
            year_text = str(year)
            return f"{abbr}{year_text[-2:]}"
        return abbr or (season or "").strip()

    def _format_show_search_label(self, show: dict) -> str:
        brand = (show.get("brand_name") or "").strip()
        code = self._show_season_code(show.get("season"), show.get("year"))
        if brand and code:
            return f"{brand} {code}"
        title = (show.get("title") or "").strip()
        if brand and title:
            return f"{brand} {title}"
        return brand or title

    def _resolve_show_ids_by_keyword(self, keyword: str, limit: int = 50) -> List[str]:
        """按秀场关键词反查 show id 列表，供 Marketplace 关键词搜索使用。"""
        safe = self._sanitize_search_keyword(keyword)
        if not safe:
            return []
        try:
            text_filters = (
                f"brand_name.ilike.*{safe}*,"
                f"title.ilike.*{safe}*,"
                f"season.ilike.*{safe}*,"
                f"category.ilike.*{safe}*,"
                f"designer.ilike.*{safe}*,"
                f"description.ilike.*{safe}*"
            )
            res = execute_with_retry(
                lambda: (
                    self.db.table("shows")
                    .select("id")
                    .or_(text_filters)
                    .or_("status.eq.APPROVED,status.is.null")
                    .limit(limit)
                    .execute()
                ),
                label="shows.resolve_keyword",
            )
            return [str(r["id"]) for r in (res.data or []) if r.get("id")]
        except Exception as e:
            print(f"[marketplace] resolve_show_ids failed: {e}")
            return []

    def get_marketplace_search_suggestions(
        self,
        keyword: str,
        limit: int = 8,
    ) -> List[MarketplaceSearchSuggestion]:
        """交易大厅搜索下拉建议。

        聚合品牌名、款式/系列（style_name）、单品标题、秀场关键词，按热度排序。
        """
        safe = self._sanitize_search_keyword(keyword)
        if not safe:
            return []

        suggestions: List[MarketplaceSearchSuggestion] = []
        seen_labels: set[str] = set()

        def push(item: MarketplaceSearchSuggestion) -> None:
            key = item.label.strip().lower()
            if not key or key in seen_labels:
                return
            seen_labels.add(key)
            suggestions.append(item)

        # 1) 品牌（brands 表 + 在售 listing 计数）
        try:
            brand_rows = execute_with_retry(
                lambda: (
                    self.db.table("brands")
                    .select("id, name")
                    .ilike("name", f"*{safe}*")
                    .order("name")
                    .limit(limit * 2)
                    .execute()
                ),
                label="marketplace.suggest.brands",
            ).data or []
        except Exception as e:
            print(f"[marketplace] suggest brands failed: {e}")
            brand_rows = []

        listing_counts: dict[str, int] = {}
        try:
            active_brands = execute_with_retry(
                lambda: (
                    self.db.table("store_products")
                    .select("brand")
                    .eq("status", "active")
                    .ilike("brand", f"*{safe}*")
                    .limit(1000)
                    .execute()
                ),
                label="marketplace.suggest.active_brands",
            ).data or []
            for row in active_brands:
                name = (row.get("brand") or "").strip()
                if name:
                    listing_counts[name.lower()] = listing_counts.get(name.lower(), 0) + 1
        except Exception as e:
            print(f"[marketplace] suggest active brand counts failed: {e}")

        brand_candidates: dict[str, dict] = {}
        for row in brand_rows:
            name = (row.get("name") or "").strip()
            if not name:
                continue
            brand_candidates[name.lower()] = {
                "name": name,
                "brandId": row.get("id"),
            }
        for name_lower, count in listing_counts.items():
            if name_lower not in brand_candidates:
                brand_candidates[name_lower] = {"name": name_lower.title(), "brandId": None}
            brand_candidates[name_lower]["listingCount"] = count

        for meta in sorted(
            brand_candidates.values(),
            key=lambda x: (-x.get("listingCount", 0), x["name"].lower()),
        ):
            push(
                MarketplaceSearchSuggestion(
                    label=meta["name"],
                    type="brand",
                    query=meta["name"],
                    brand=meta["name"],
                    brandId=meta.get("brandId"),
                    listingCount=meta.get("listingCount") or 0,
                )
            )
            if len(suggestions) >= limit:
                return suggestions[:limit]

        # 2) 品牌 + 款式/系列（如 Rick Owens DRKSHDW）
        try:
            style_rows = execute_with_retry(
                lambda: (
                    self.db.table("store_products")
                    .select("brand, style_name")
                    .eq("status", "active")
                    .or_(
                        f"brand.ilike.*{safe}*,style_name.ilike.*{safe}*,title.ilike.*{safe}*"
                    )
                    .not_.is_("brand", "null")
                    .limit(200)
                    .execute()
                ),
                label="marketplace.suggest.styles",
            ).data or []
        except Exception as e:
            print(f"[marketplace] suggest styles failed: {e}")
            style_rows = []

        style_counts: dict[str, int] = {}
        for row in style_rows:
            brand = (row.get("brand") or "").strip()
            style = (row.get("style_name") or "").strip()
            if not brand:
                continue
            label = f"{brand} {style}".strip() if style else brand
            if safe.lower() not in label.lower():
                continue
            style_counts[label] = style_counts.get(label, 0) + 1

        for label, count in sorted(style_counts.items(), key=lambda x: (-x[1], x[0].lower())):
            brand_part = label.split(" ", 1)[0]
            push(
                MarketplaceSearchSuggestion(
                    label=label,
                    type="keyword",
                    query=label,
                    brand=brand_part,
                    listingCount=count,
                )
            )
            if len(suggestions) >= limit:
                return suggestions[:limit]

        # 3) 秀场关键词（如 Rick Owens FW07）
        try:
            show_rows = execute_with_retry(
                lambda: (
                    self.db.table("shows")
                    .select("id, brand_name, season, year, title, cover_image")
                    .or_(
                        f"brand_name.ilike.*{safe}*,"
                        f"title.ilike.*{safe}*,"
                        f"season.ilike.*{safe}*,"
                        f"category.ilike.*{safe}*,"
                        f"designer.ilike.*{safe}*"
                    )
                    .or_("status.eq.APPROVED,status.is.null")
                    .order("year", desc=True)
                    .limit(limit * 2)
                    .execute()
                ),
                label="marketplace.suggest.shows",
            ).data or []
        except Exception as e:
            print(f"[marketplace] suggest shows failed: {e}")
            show_rows = []

        for show in show_rows:
            label = self._format_show_search_label(show)
            if safe.lower() not in label.lower():
                continue
            push(
                MarketplaceSearchSuggestion(
                    label=label,
                    type="show",
                    query=label,
                    brand=(show.get("brand_name") or "").strip() or None,
                    showId=str(show.get("id")) if show.get("id") else None,
                    imageUrl=show.get("cover_image"),
                )
            )
            if len(suggestions) >= limit:
                return suggestions[:limit]

        # 4) 单品标题
        try:
            product_rows = execute_with_retry(
                lambda: (
                    self.db.table("store_products")
                    .select("id, title, brand, images, favorite_count")
                    .eq("status", "active")
                    .or_(
                        f"title.ilike.*{safe}*,brand.ilike.*{safe}*,style_name.ilike.*{safe}*"
                    )
                    .order("favorite_count", desc=True)
                    .order("published_at", desc=True)
                    .limit(limit * 2)
                    .execute()
                ),
                label="marketplace.suggest.products",
            ).data or []
        except Exception as e:
            print(f"[marketplace] suggest products failed: {e}")
            product_rows = []

        for row in product_rows:
            title = (row.get("title") or "").strip()
            if not title:
                continue
            images = row.get("images") or []
            push(
                MarketplaceSearchSuggestion(
                    label=title,
                    type="product",
                    query=title,
                    brand=(row.get("brand") or "").strip() or None,
                    productId=row.get("id"),
                    imageUrl=images[0] if images else None,
                    listingCount=row.get("favorite_count") or 0,
                )
            )
            if len(suggestions) >= limit:
                break

        return suggestions[:limit]

    def search_marketplace(
        self,
        *,
        keyword: Optional[str] = None,
        brands: Optional[List[str]] = None,
        category_ids: Optional[List[int]] = None,
        category_kinds: Optional[List[str]] = None,
        sizes: Optional[List[str]] = None,
        colors: Optional[List[str]] = None,
        conditions: Optional[List[str]] = None,
        seller_kind: Optional[str] = None,
        price_min_cents: Optional[int] = None,
        price_max_cents: Optional[int] = None,
        sort: str = "newest",
        page: int = 1,
        page_size: int = 20,
        user_id: Optional[int] = None,
        # ---- 旧的单值入参，保留向后兼容 ----
        brand: Optional[str] = None,
        category_id: Optional[int] = None,
        size: Optional[str] = None,
        color: Optional[str] = None,
        condition: Optional[str] = None,
    ) -> Tuple[List[StoreProduct], int]:
        """PRD 模块二 · Marketplace 交易大厅查询。

        - 只返回 status='active' 的单品。
        - 支持 品牌/品类/尺码/颜色/成色/卖家类型/价格区间 多选过滤；多选采用 OR
          语义（命中任一即返回）。
        - ``category_kinds`` 走 PRD 6 大类（外套/上衣/裤装/鞋履/包袋/配饰），
          通过反查 ``store_product_categories.name`` ILIKE 匹配获取
          ``category_id`` 列表后再过滤。
        - 排序：newest / price_asc / price_desc / featured。
        """
        # 单值兼容：如果只传了旧的单值字段，转成单元素 list 走多选分支
        if brands is None and brand:
            brands = [brand]
        if category_ids is None and category_id is not None:
            category_ids = [category_id]
        if sizes is None and size:
            sizes = [size]
        if colors is None and color:
            colors = [color]
        if conditions is None and condition:
            conditions = [condition]

        q = self.db.table("store_products").select(_PRODUCT_SELECT, count="exact")
        q = q.eq("status", "active")
        if keyword:
            kw = self._sanitize_search_keyword(keyword)
            if kw:
                parts = [
                    f"title.ilike.%{kw}%",
                    f"brand.ilike.%{kw}%",
                    f"style_name.ilike.%{kw}%",
                    f"description.ilike.%{kw}%",
                    f"tags.cs.{{{kw}}}",
                ]
                show_ids = self._resolve_show_ids_by_keyword(kw)
                if show_ids:
                    ids_csv = ",".join(show_ids)
                    parts.append(f"original_show_id.in.({ids_csv})")
                q = q.or_(",".join(parts))
        if brands:
            # 品牌不区分大小写，使用 ilike 多分支 or
            cleaned = [b.replace(",", "").strip() for b in brands if b and b.strip()]
            if len(cleaned) == 1:
                q = q.ilike("brand", cleaned[0])
            elif cleaned:
                expr = ",".join(f"brand.ilike.{b}" for b in cleaned)
                q = q.or_(expr)
        # PRD 6 大类筛选。两条命中路径取 OR：
        #   1. 单品直接写了 ``category_kind``（发布单品 Step1 选的 PRD 大类，含个人卖家 C2C）。
        #   2. 买手店自建分类：按名称模糊匹配 store_product_categories.name → category_id。
        if category_kinds:
            extra_ids = self._resolve_category_ids_by_name(category_kinds)
            merged_ids = list(
                {int(c) for c in ((category_ids or []) + (extra_ids or []))}
            )
            or_parts: List[str] = []
            kinds_csv = ",".join(k for k in category_kinds if k)
            if kinds_csv:
                or_parts.append(f"category_kind.in.({kinds_csv})")
            if merged_ids:
                ids_csv = ",".join(str(i) for i in merged_ids)
                or_parts.append(f"category_id.in.({ids_csv})")
            if not or_parts:
                # 用户选了 PRD 大类但既无 category_kind 命中也无对应分类 → 直接返回空集，
                # 比把 filter 静默忽略要诚实。
                return [], 0
            q = q.or_(",".join(or_parts))
            # category_id 已在上面的 or_ 中处理，跳过下面的精确过滤分支。
            category_ids = None
        if category_ids:
            uniq = list({int(c) for c in category_ids})
            if len(uniq) == 1:
                q = q.eq("category_id", uniq[0])
            else:
                q = q.in_("category_id", uniq)
        if sizes:
            cleaned = [s for s in sizes if s]
            if len(cleaned) == 1:
                q = q.eq("size", cleaned[0])
            elif cleaned:
                q = q.in_("size", cleaned)
        if colors:
            cleaned = [c for c in colors if c]
            if len(cleaned) == 1:
                q = q.eq("color", cleaned[0])
            elif cleaned:
                q = q.in_("color", cleaned)
        if conditions:
            cleaned = [c for c in conditions if c]
            if len(cleaned) == 1:
                q = q.eq("condition", cleaned[0])
            elif cleaned:
                q = q.in_("condition", cleaned)
        if seller_kind:
            q = q.eq("seller_kind", seller_kind)
        if price_min_cents is not None:
            q = q.gte("price_cents", price_min_cents)
        if price_max_cents is not None:
            q = q.lte("price_cents", price_max_cents)
        # 排序
        # - newest    : 最新上架（published_at desc）
        # - price_asc : 价格升序
        # - price_desc: 价格降序
        # - featured  : 精选推荐 —— 主页推荐同款思路：信息最全的单品 (A 级) 优先，
        #               同分级再按收藏度 + 上架时间稳定排序。
        #               completeness_score 由 trigger 在 INSERT/UPDATE 时刷新（migration 065）。
        if sort == "price_asc":
            q = q.order("price_cents", desc=False)
        elif sort == "price_desc":
            q = q.order("price_cents", desc=True)
        elif sort == "featured":
            q = (
                q.order("completeness_score", desc=True)
                .order("favorite_count", desc=True)
                .order("published_at", desc=True)
                .order("id", desc=True)
            )
        else:
            q = q.order("published_at", desc=True).order("id", desc=True)

        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        result = execute_with_retry(lambda: q.execute(), label="store_products.marketplace")
        rows = result.data or []
        total = result.count or 0
        liked_map: dict[int, bool] = {}
        favorited_map: dict[int, bool] = {}
        wanted_map: dict[int, bool] = {}
        if user_id is not None and rows:
            ids = [r["id"] for r in rows]
            liked_map = self._check_products_liked_bulk(ids, user_id)
            favorited_map = self._check_products_favorited_bulk(ids, user_id)
            wanted_map = self._check_products_wanted_bulk(ids, user_id)
        products = [
            self._format_product(
                row,
                liked_by_me=liked_map.get(row["id"]),
                favorited_by_me=favorited_map.get(row["id"]),
                wanted_by_me=wanted_map.get(row["id"]),
            )
            for row in rows
        ]
        self._attach_seller_display_bulk(products)
        return products, total

    def get_popular_brands(self, limit: int = 6, *, daily_rotate: bool = True) -> List[dict]:
        """Marketplace 顶部「热门品牌」聚合。

        实现策略：
          1. 取最近活跃的 store_products（status=active）品牌字段，按上架数量降序；
             这样既能反映"热门"也能保证有真实在售货品的品牌才出现，避免空点击。
          2. 用品牌名再去 `brands` 表关联一次，拿到 cover image / id；找不到的就
             仅返回名称（前端会显示首字母占位头像）。
          3. 当 ``daily_rotate=True``：取在售单品数量前 30 名，按当前 UTC 日期作为
             随机种子打乱后取前 ``limit`` 个。这样保证每天首屏顺序不同，但当天内
             多次刷新顺序一致；不在前 30 名的冷门品牌不会冒出。

        返回每条结构：``{"name": str, "brandId": int|None, "imageUrl": str|None, "listingCount": int}``。
        """
        import random
        from datetime import datetime, timezone
        try:
            rows_resp = execute_with_retry(
                lambda: (
                    self.db.table("store_products")
                    .select("brand")
                    .eq("status", "active")
                    .not_.is_("brand", "null")
                    .limit(2000)
                    .execute()
                ),
                label="store_products.popular_brands.scan",
            )
        except Exception as e:
            print(f"[popular_brands] scan failed: {e}")
            return []
        rows = rows_resp.data or []
        # 计数
        counts: dict[str, int] = {}
        for row in rows:
            name = (row.get("brand") or "").strip()
            if not name:
                continue
            counts[name] = counts.get(name, 0) + 1
        if not counts:
            return []
        # 取前 30 候选池：保证只在真正"热门"的品牌之间洗牌，冷门品牌不会冒出。
        candidate_pool_size = max(limit * 5, 30)
        sorted_items = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
        candidate_pool = sorted_items[:candidate_pool_size]
        if daily_rotate and len(candidate_pool) > limit:
            today_seed = datetime.now(timezone.utc).strftime("%Y%m%d")
            rng = random.Random(today_seed)
            shuffled = list(candidate_pool)
            rng.shuffle(shuffled)
            top = shuffled[:limit]
        else:
            top = candidate_pool[:limit]
        names = [name for name, _ in top]
        # 关联 brands 拿 logo / id（大小写不敏感匹配）
        brand_meta: dict[str, dict] = {}
        try:
            ors = ",".join([f"name.ilike.{name}" for name in names])
            if ors:
                meta_resp = execute_with_retry(
                    lambda: (
                        self.db.table("brands")
                        .select("id, name")
                        .or_(ors)
                        .execute()
                    ),
                    label="store_products.popular_brands.brands_lookup",
                )
                meta_rows = meta_resp.data or []
                ids = [m["id"] for m in meta_rows if m.get("id") is not None]
                # 取首图
                image_map: dict[int, str] = {}
                if ids:
                    try:
                        from app.services.brand_service import brand_service
                        image_map = brand_service._get_first_brand_images(ids)
                    except Exception:
                        image_map = {}
                for m in meta_rows:
                    key = (m.get("name") or "").lower()
                    if not key:
                        continue
                    brand_meta[key] = {
                        "brandId": m.get("id"),
                        "imageUrl": image_map.get(m.get("id")),
                    }
        except Exception as e:
            print(f"[popular_brands] brands lookup failed: {e}")
        return [
            {
                "name": name,
                "brandId": brand_meta.get(name.lower(), {}).get("brandId"),
                "imageUrl": brand_meta.get(name.lower(), {}).get("imageUrl"),
                "listingCount": count,
            }
            for name, count in top
        ]

    # ========================================================================
    # 「大家都在看」管理员策展 (migration 065)
    # ========================================================================

    def list_curated_products(
        self,
        *,
        limit: int = 10,
        user_id: Optional[int] = None,
    ) -> List[StoreProduct]:
        """返回管理员标记为「大家都在看」的商品。

        - 仅返回 status='active'。
        - 排序：``curated_sort_order`` asc (NULL 最大 → 最后)，再按 published_at desc。
        - 不分页：策展段一屏最多 10 张就够，前端按 limit 截断即可。
        """
        try:
            res = execute_with_retry(
                lambda: (
                    self.db.table("store_products")
                    .select(_PRODUCT_SELECT)
                    .eq("status", "active")
                    .eq("is_curated", True)
                    .order("curated_sort_order", desc=False, nullsfirst=False)
                    .order("published_at", desc=True)
                    .order("id", desc=True)
                    .limit(limit)
                    .execute()
                ),
                label="store_products.list_curated",
            )
        except Exception as e:
            print(f"[store_products] list_curated failed: {e}")
            return []
        rows = res.data or []
        liked_map: dict[int, bool] = {}
        favorited_map: dict[int, bool] = {}
        wanted_map: dict[int, bool] = {}
        if user_id is not None and rows:
            ids = [r["id"] for r in rows]
            liked_map = self._check_products_liked_bulk(ids, user_id)
            favorited_map = self._check_products_favorited_bulk(ids, user_id)
            wanted_map = self._check_products_wanted_bulk(ids, user_id)
        return [
            self._format_product(
                row,
                liked_by_me=liked_map.get(row["id"]),
                favorited_by_me=favorited_map.get(row["id"]),
                wanted_by_me=wanted_map.get(row["id"]),
            )
            for row in rows
        ]

    def admin_set_curated(
        self,
        product_id: int,
        *,
        is_curated: bool,
        sort_order: Optional[int] = None,
    ) -> StoreProduct:
        """管理员策展开关：把单品设为/取消「大家都在看」。

        - is_curated=False 时会同时把 sort_order 清空。
        - is_curated=True 时若 sort_order=None，自动落到当前已策展中的最大值 +1。
        """
        raw = self._get_product_raw(product_id)
        if not raw:
            raise ValueError("商品不存在")

        patch: dict = {"is_curated": bool(is_curated)}
        if not is_curated:
            patch["curated_sort_order"] = None
        else:
            if sort_order is None:
                # 取当前最大 sort_order，+1 追加到末尾
                try:
                    res = (
                        self.db.table("store_products")
                        .select("curated_sort_order")
                        .eq("is_curated", True)
                        .not_.is_("curated_sort_order", "null")
                        .order("curated_sort_order", desc=True)
                        .limit(1)
                        .execute()
                    )
                    rows = res.data or []
                    next_order = (
                        int(rows[0]["curated_sort_order"]) + 1 if rows else 0
                    )
                except Exception:
                    next_order = 0
                patch["curated_sort_order"] = next_order
            else:
                patch["curated_sort_order"] = int(sort_order)

        result = (
            self.db_admin.table("store_products")
            .update(patch)
            .eq("id", product_id)
            .execute()
        )
        if not result.data:
            raise ValueError("策展状态更新失败")
        return self.get_product(product_id) or self._format_product(result.data[0])

    # ========================================================================
    # 全平台所有「录入品牌」列表（marketplace 顶部「更多」展开用）
    # ========================================================================

    def list_all_platform_brands(
        self,
        *,
        keyword: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[dict], int]:
        """返回平台已录入的所有品牌（从 brands 表查），含在售单品数 + 封面图。

        与 `brand_service.get_all_brands` 不同点：
          - 顺手把每个品牌的 ``listingCount`` 算出来（active 在售）；
          - 字段精简到 marketplace 模态框需要的几项 (name / brandId / imageUrl /
            listingCount / category / country)，避免移动端解析多余字段。

        排序：默认按在售单品数量降序、再按品牌名 asc，配合 keyword 搜索。
        """
        from app.services.brand_service import brand_service as _brand_svc

        offset = (page - 1) * page_size
        try:
            q = self.db.table("brands").select("*", count="exact")
            if keyword:
                kw = (
                    keyword.replace("\\", "\\\\")
                    .replace("%", "\\%")
                    .replace("_", "\\_")
                    .strip()
                )
                if kw:
                    q = q.or_(
                        f"name.ilike.*{kw}*,founder.ilike.*{kw}*,country.ilike.*{kw}*"
                    )
            q = q.order("name", desc=False).range(offset, offset + page_size - 1)
            res = execute_with_retry(lambda: q.execute(), label="marketplace.all_brands")
        except Exception as e:
            print(f"[all_brands] query failed: {e}")
            return [], 0

        rows = res.data or []
        total = res.count or 0
        if not rows:
            return [], total

        brand_ids = [r["id"] for r in rows if r.get("id") is not None]
        # 封面图（is_selected=APPROVED）
        try:
            image_map = _brand_svc._get_first_brand_images(brand_ids)
        except Exception:
            image_map = {}

        # 在售单品数：按品牌名 ilike 聚合（store_products.brand 是字符串）
        listing_count_by_name: dict[str, int] = {}
        try:
            names = [(r.get("name") or "").strip() for r in rows]
            names = [n for n in names if n]
            if names:
                # OR 一次性查回（PostgREST 的 or_ 长度安全：每页最多 50）
                or_expr = ",".join(
                    f"brand.ilike.{n.replace(',', ' ')}" for n in names
                )
                cnt_res = (
                    self.db.table("store_products")
                    .select("brand", count="exact")
                    .eq("status", "active")
                    .or_(or_expr)
                    .limit(2000)
                    .execute()
                )
                for row in cnt_res.data or []:
                    nm = (row.get("brand") or "").strip().lower()
                    if not nm:
                        continue
                    listing_count_by_name[nm] = listing_count_by_name.get(nm, 0) + 1
        except Exception as e:
            print(f"[all_brands] listing count failed: {e}")

        items: List[dict] = []
        for r in rows:
            name = (r.get("name") or "").strip()
            if not name:
                continue
            items.append(
                {
                    "brandId": r.get("id"),
                    "name": name,
                    "imageUrl": image_map.get(r.get("id")),
                    "category": r.get("category"),
                    "country": r.get("country"),
                    "listingCount": listing_count_by_name.get(name.lower(), 0),
                }
            )
        return items, total

    def search_products_global(
        self,
        search_query: str,
        *,
        page: int = 1,
        page_size: int = 20,
        user_id: Optional[int] = None,
    ) -> Tuple[List[StoreProduct], int]:
        """跨店铺全局商品搜索，只搜索 PUBLISHED 状态的商品。"""
        kw = search_query.replace("%", "\\%").replace("_", "\\_").strip()
        if not kw:
            return [], 0

        query = self.db.table("store_products").select(_PRODUCT_SELECT, count="exact")
        query = query.eq("status", "active")
        query = query.or_(f"title.ilike.%{kw}%,brand.ilike.%{kw}%,tags.cs.{{{kw}}}")
        query = query.order("published_at", desc=True).order("id", desc=True)
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)

        result = execute_with_retry(
            lambda: query.execute(), label="store_products.search_global"
        )
        rows = result.data or []
        total = result.count or 0

        liked_map: dict[int, bool] = {}
        favorited_map: dict[int, bool] = {}
        wanted_map: dict[int, bool] = {}
        if user_id is not None and rows:
            ids = [r["id"] for r in rows]
            liked_map = self._check_products_liked_bulk(ids, user_id)
            favorited_map = self._check_products_favorited_bulk(ids, user_id)
            wanted_map = self._check_products_wanted_bulk(ids, user_id)

        products = [
            self._format_product(
                row,
                liked_by_me=liked_map.get(row["id"]),
                favorited_by_me=favorited_map.get(row["id"]),
                wanted_by_me=wanted_map.get(row["id"]),
            )
            for row in rows
        ]
        return products, total

    # ========================================================================
    # 点赞 / 喜欢
    # ========================================================================

    def like_product(self, product_id: int, user_id: int) -> bool:
        """点喜欢；重复点击返回 False 但不抛错。"""
        try:
            self.db_admin.table("store_product_likes").insert(
                {"product_id": product_id, "user_id": user_id}
            ).execute()
        except Exception:
            # 唯一约束冲突 -> 视为幂等成功，不动计数
            return False

        self._bump_like_count(product_id, delta=1)
        return True

    def unlike_product(self, product_id: int, user_id: int) -> bool:
        result = (
            self.db_admin.table("store_product_likes")
            .delete()
            .eq("product_id", product_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            return False
        self._bump_like_count(product_id, delta=-1)
        return True

    def check_product_liked(self, product_id: int, user_id: int) -> bool:
        result = (
            self.db.table("store_product_likes")
            .select("id")
            .eq("product_id", product_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return bool(result.data)

    def _check_products_liked_bulk(
        self, product_ids: Iterable[int], user_id: int
    ) -> dict[int, bool]:
        ids = list(product_ids)
        if not ids:
            return {}
        result = (
            self.db.table("store_product_likes")
            .select("product_id")
            .in_("product_id", ids)
            .eq("user_id", user_id)
            .execute()
        )
        liked_set = {row["product_id"] for row in (result.data or [])}
        return {pid: (pid in liked_set) for pid in ids}

    def list_user_liked_products(
        self, user_id: int, *, page: int = 1, page_size: int = 20
    ) -> Tuple[List[StoreProduct], int]:
        """登录用户点过喜欢的商品列表（Profile 页会用）。"""
        # 同 list_comments / list_products，count 每页都用 exact，
        # 否则第二页之后 total=0 会让前端误判分页结束。
        q = self.db.table("store_product_likes").select(
            "product_id, created_at", count="exact"
        )
        q = q.eq("user_id", user_id).order("created_at", desc=True)
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = q.execute()

        product_ids = [r["product_id"] for r in (res.data or [])]
        total = res.count or 0
        if not product_ids:
            return [], total

        products_res = (
            self.db.table("store_products")
            .select(_PRODUCT_SELECT)
            .in_("id", product_ids)
            .execute()
        )
        rows = products_res.data or []
        # 按点赞顺序还原
        by_id = {row["id"]: row for row in rows}
        ordered = [by_id[pid] for pid in product_ids if pid in by_id]
        products = [
            self._format_product(row, liked_by_me=True) for row in ordered
        ]
        return products, total

    # ========================================================================
    # 收藏 (Save / Bookmark)
    # ========================================================================
    #
    # 与 like 完全平行：独立表 + 独立计数 + 独立 likedByMe/favoritedByMe；
    # 用 RPC 维护 favorite_count 与 posts 上的 favorite 行为命名对齐
    # （`increment_post_favorite_count`），便于将来抽公共。

    def _list_interested_user_ids(self, product_id: int) -> List[int]:
        """返回所有收藏 (favorite) 或想要 (want) 该商品的用户 ID, 去重。

        用于状态变化通知 (售出 / 下架 / 改价)。
        """
        ids: set[int] = set()
        try:
            r1 = (
                self.db.table("store_product_favorites")
                .select("user_id")
                .eq("product_id", product_id)
                .execute()
            )
            for row in r1.data or []:
                uid = row.get("user_id")
                if uid is not None:
                    ids.add(int(uid))
        except Exception as e:
            print(f"[store_products] list favoriters failed id={product_id}: {e}")
        try:
            r2 = (
                self.db.table("store_product_wants")
                .select("user_id")
                .eq("product_id", product_id)
                .execute()
            )
            for row in r2.data or []:
                uid = row.get("user_id")
                if uid is not None:
                    ids.add(int(uid))
        except Exception as e:
            print(f"[store_products] list wanters failed id={product_id}: {e}")
        return list(ids)

    def _notify_interested_users(
        self,
        product_id: int,
        kind: str,
        *,
        exclude_user_id: Optional[int] = None,
        old_price_cents: Optional[int] = None,
        new_price_cents: Optional[int] = None,
    ) -> None:
        """统一向收藏 / 想要该商品的用户推送状态变化通知。

        kind: 'sold' | 'offline' | 'price_changed'
        """
        try:
            from app.services.notification_service import notification_service
        except Exception as e:
            print(f"[store_products] notification_service import failed: {e}")
            return

        raw = self._get_product_raw(product_id)
        if not raw:
            return

        title = raw.get("title") or "商品"
        images = raw.get("images") or []
        first_image = images[0] if images else None
        currency = raw.get("currency") or "CNY"

        recipients = self._list_interested_user_ids(product_id)
        if exclude_user_id is not None:
            recipients = [uid for uid in recipients if uid != exclude_user_id]

        for uid in recipients:
            try:
                if kind == "sold":
                    notification_service.notify_favorited_product_sold(
                        uid,
                        product_id=product_id,
                        product_title=title,
                        product_image=first_image,
                    )
                elif kind == "offline":
                    notification_service.notify_favorited_product_offline(
                        uid,
                        product_id=product_id,
                        product_title=title,
                        product_image=first_image,
                    )
                elif kind == "price_changed":
                    if old_price_cents is None or new_price_cents is None:
                        continue
                    notification_service.notify_favorited_product_price_changed(
                        uid,
                        product_id=product_id,
                        product_title=title,
                        old_price_cents=old_price_cents,
                        new_price_cents=new_price_cents,
                        currency=currency,
                        product_image=first_image,
                    )
            except Exception as e:
                print(
                    f"[store_products] notify {kind} to uid={uid} pid={product_id} failed: {e}"
                )

    def _resolve_seller_user_id(self, raw: dict) -> Optional[int]:
        """从 product raw 行解析出 seller 的 userId.

        - 个人卖家: seller_user_id 直接给出
        - 买手店: 查 store_merchants.user_id
        """
        seller_user_id = raw.get("seller_user_id")
        if seller_user_id:
            try:
                return int(seller_user_id)
            except (TypeError, ValueError):
                pass
        merchant_id = raw.get("merchant_id")
        if not merchant_id:
            return None
        try:
            res = (
                self.db_admin.table("store_merchants")
                .select("user_id")
                .eq("id", merchant_id)
                .limit(1)
                .execute()
            )
            if res.data and res.data[0].get("user_id"):
                return int(res.data[0]["user_id"])
        except Exception as e:
            print(f"[store_products] resolve merchant user_id failed mid={merchant_id}: {e}")
        return None

    def _notify_followers_new_listing(self, product_id: int, raw: dict) -> None:
        """新单品成功上架后, 给「卖家的全部粉丝」推送通知.

        与 _notify_interested_users 走同一套 notification_service 接口, 失败静默.
        """
        seller_user_id = self._resolve_seller_user_id(raw)
        if not seller_user_id:
            return

        try:
            from app.services.follow_service import follow_service
            follower_ids = follow_service.get_follower_ids(seller_user_id)
        except Exception as e:
            print(f"[store_products] get_follower_ids failed uid={seller_user_id}: {e}")
            return

        if not follower_ids:
            return

        try:
            from app.services.notification_service import notification_service
        except Exception as e:
            print(f"[store_products] notification_service import failed: {e}")
            return

        # 取卖家展示名（粉丝在通知里需要看到「谁」上新了）
        seller_username = ""
        try:
            ures = (
                self.db_admin.table("users")
                .select("username")
                .eq("id", seller_user_id)
                .limit(1)
                .execute()
            )
            if ures.data:
                seller_username = ures.data[0].get("username") or ""
        except Exception as e:
            print(f"[store_products] read seller username failed uid={seller_user_id}: {e}")

        title = raw.get("title") or "新单品"
        images = raw.get("images") or []
        first_image = images[0] if images else None

        for uid in follower_ids:
            if uid == seller_user_id:
                continue
            try:
                notification_service.notify_new_listing_from_followee(
                    uid,
                    seller_user_id=seller_user_id,
                    seller_username=seller_username,
                    product_id=product_id,
                    product_title=title,
                    product_image=first_image,
                )
            except Exception as e:
                print(
                    f"[store_products] notify new listing to uid={uid} pid={product_id} failed: {e}"
                )

    def favorite_product(self, product_id: int, user_id: int) -> bool:
        try:
            self.db_admin.table("store_product_favorites").insert(
                {"product_id": product_id, "user_id": user_id}
            ).execute()
        except Exception:
            # 唯一约束冲突 -> 视为幂等成功，不动计数
            return False

        try:
            self.db_admin.rpc(
                "increment_store_product_favorite_count",
                {"product_id_param": product_id},
            ).execute()
        except Exception as e:
            print(
                f"[store_products] increment favorite_count failed id={product_id}: {e}"
            )
        return True

    def unfavorite_product(self, product_id: int, user_id: int) -> bool:
        result = (
            self.db_admin.table("store_product_favorites")
            .delete()
            .eq("product_id", product_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            return False
        try:
            self.db_admin.rpc(
                "decrement_store_product_favorite_count",
                {"product_id_param": product_id},
            ).execute()
        except Exception as e:
            print(
                f"[store_products] decrement favorite_count failed id={product_id}: {e}"
            )
        return True

    def check_product_favorited(self, product_id: int, user_id: int) -> bool:
        result = (
            self.db.table("store_product_favorites")
            .select("id")
            .eq("product_id", product_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return bool(result.data)

    def _check_products_favorited_bulk(
        self, product_ids: Iterable[int], user_id: int
    ) -> dict[int, bool]:
        ids = list(product_ids)
        if not ids:
            return {}
        result = (
            self.db.table("store_product_favorites")
            .select("product_id")
            .in_("product_id", ids)
            .eq("user_id", user_id)
            .execute()
        )
        favorited_set = {row["product_id"] for row in (result.data or [])}
        return {pid: (pid in favorited_set) for pid in ids}

    def list_user_favorited_products(
        self,
        user_id: int,
        *,
        page: int = 1,
        page_size: int = 20,
        collection_id: Optional[int] = None,
        only_default: bool = False,
    ) -> Tuple[List[StoreProduct], int]:
        """用户收藏的商品分页列表。

        - collection_id 为 None 且 only_default=False : 返回全部收藏 (扁平视图)
        - collection_id 不为 None                      : 仅返回该收藏夹的商品
        - only_default=True                            : 仅返回未被分组的"默认收藏" (collection_id IS NULL)
        """
        q = (
            self.db.table("store_product_favorites")
            .select("product_id, created_at", count="exact")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
        )
        if collection_id is not None:
            q = q.eq("collection_id", collection_id)
        elif only_default:
            q = q.is_("collection_id", "null")
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = q.execute()

        product_ids = [r["product_id"] for r in (res.data or [])]
        total = res.count or 0
        if not product_ids:
            return [], total

        products_res = (
            self.db.table("store_products")
            .select(_PRODUCT_SELECT)
            .in_("id", product_ids)
            .execute()
        )
        rows = products_res.data or []
        by_id = {row["id"]: row for row in rows}
        ordered = [by_id[pid] for pid in product_ids if pid in by_id]
        products = [
            self._format_product(row, favorited_by_me=True) for row in ordered
        ]
        return products, total

    # ========================================================================
    # 浏览记录 (Browsing History)
    # ========================================================================
    #
    # 与收藏不同：进入商品详情页自动落库，且每个 (product, user) 只保留一行，
    # 重复浏览时 UPSERT 刷新 viewed_at 置顶。不维护任何商品计数。

    def record_browsing_history(self, product_id: int, user_id: int) -> bool:
        """记录一次浏览；已存在则刷新 viewed_at 使其置顶。幂等、永不抛错。"""
        try:
            self.db_admin.table("store_product_browsing_history").upsert(
                {
                    "product_id": product_id,
                    "user_id": user_id,
                    "viewed_at": datetime.utcnow().isoformat(),
                },
                on_conflict="product_id,user_id",
            ).execute()
            return True
        except Exception as e:
            print(
                f"[store_products] record browsing history failed "
                f"pid={product_id} uid={user_id}: {e}"
            )
            return False

    def list_user_browsing_history(
        self,
        user_id: int,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[StoreProduct], int]:
        """用户浏览过的商品分页列表，按最近浏览倒序。"""
        q = (
            self.db.table("store_product_browsing_history")
            .select("product_id, viewed_at", count="exact")
            .eq("user_id", user_id)
            .order("viewed_at", desc=True)
        )
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = q.execute()

        product_ids = [r["product_id"] for r in (res.data or [])]
        total = res.count or 0
        if not product_ids:
            return [], total

        products_res = (
            self.db.table("store_products")
            .select(_PRODUCT_SELECT)
            .in_("id", product_ids)
            .execute()
        )
        rows = products_res.data or []
        by_id = {row["id"]: row for row in rows}
        # 保持浏览顺序（viewed_at desc），过滤已删除的商品。
        ordered = [by_id[pid] for pid in product_ids if pid in by_id]
        # 标注当前用户对这些商品的收藏态，方便列表里直接显示收藏图标。
        favorited_map = self._check_products_favorited_bulk(
            [row["id"] for row in ordered], user_id
        )
        products = [
            self._format_product(
                row, favorited_by_me=favorited_map.get(row["id"], False)
            )
            for row in ordered
        ]
        return products, total

    def remove_browsing_history_item(self, product_id: int, user_id: int) -> bool:
        """从浏览记录中移除单个商品。"""
        result = (
            self.db_admin.table("store_product_browsing_history")
            .delete()
            .eq("product_id", product_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)

    def clear_browsing_history(self, user_id: int) -> int:
        """清空用户的全部浏览记录，返回删除的行数。"""
        result = (
            self.db_admin.table("store_product_browsing_history")
            .delete()
            .eq("user_id", user_id)
            .execute()
        )
        return len(result.data or [])

    # ========================================================================
    # 想要 (愿望单)
    # ========================================================================
    #
    # 与 like 走的是相同的乐观幂等模型，但计数用 RPC 维护以与 posts 实现
    # (`increment_post_want_count`) 命名/语义对齐 —— 便于将来抽公共。

    def want_product(self, product_id: int, user_id: int) -> bool:
        """加入愿望单；重复操作返回 False 但不抛错。"""
        try:
            self.db_admin.table("store_product_wants").insert(
                {"product_id": product_id, "user_id": user_id}
            ).execute()
        except Exception:
            # 唯一约束冲突 -> 视为幂等成功，不动计数
            return False

        try:
            self.db_admin.rpc(
                "increment_store_product_want_count",
                {"product_id_param": product_id},
            ).execute()
        except Exception as e:
            print(
                f"[store_products] increment want_count failed id={product_id}: {e}"
            )

        # 等级规则引擎：复用 want_clicked 计数器 —— 用户对商品/帖子点的"想要"
        # 在用户成长体系里语义一致。
        try:
            from app.services.level_service import level_service
            from app.schemas.level import LevelAction
            level_service.record_action(user_id, LevelAction.WANT_CLICKED)
        except Exception:
            pass
        return True

    def unwant_product(self, product_id: int, user_id: int) -> bool:
        result = (
            self.db_admin.table("store_product_wants")
            .delete()
            .eq("product_id", product_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            return False
        try:
            self.db_admin.rpc(
                "decrement_store_product_want_count",
                {"product_id_param": product_id},
            ).execute()
        except Exception as e:
            print(
                f"[store_products] decrement want_count failed id={product_id}: {e}"
            )
        return True

    def check_product_wanted(self, product_id: int, user_id: int) -> bool:
        result = (
            self.db.table("store_product_wants")
            .select("id")
            .eq("product_id", product_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return bool(result.data)

    def _check_products_wanted_bulk(
        self, product_ids: Iterable[int], user_id: int
    ) -> dict[int, bool]:
        ids = list(product_ids)
        if not ids:
            return {}
        result = (
            self.db.table("store_product_wants")
            .select("product_id")
            .in_("product_id", ids)
            .eq("user_id", user_id)
            .execute()
        )
        wanted_set = {row["product_id"] for row in (result.data or [])}
        return {pid: (pid in wanted_set) for pid in ids}

    def list_user_wanted_products(
        self, user_id: int, *, page: int = 1, page_size: int = 20
    ) -> Tuple[List[StoreProduct], int]:
        """用户愿望单：标记过想要的商品列表。Profile 页 / 个人中心可用。"""
        q = (
            self.db.table("store_product_wants")
            .select("product_id, created_at", count="exact")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
        )
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = q.execute()

        product_ids = [r["product_id"] for r in (res.data or [])]
        total = res.count or 0
        if not product_ids:
            return [], total

        products_res = (
            self.db.table("store_products")
            .select(_PRODUCT_SELECT)
            .in_("id", product_ids)
            .execute()
        )
        rows = products_res.data or []
        by_id = {row["id"]: row for row in rows}
        ordered = [by_id[pid] for pid in product_ids if pid in by_id]
        products = [
            self._format_product(row, wanted_by_me=True) for row in ordered
        ]
        return products, total

    def _bump_like_count(self, product_id: int, *, delta: int) -> None:
        """读-改-写维护 like_count；失败仅打 log 不抛错（不阻塞交互）。"""
        try:
            current = self._get_product_raw(product_id)
            if current is None:
                return
            new_val = max(0, (current.get("like_count") or 0) + delta)
            self.db_admin.table("store_products").update(
                {"like_count": new_val}
            ).eq("id", product_id).execute()
        except Exception as e:
            print(f"[store_products] bump like_count failed id={product_id} delta={delta}: {e}")

    def _bump_comment_count(self, product_id: int, *, delta: int) -> None:
        try:
            current = self._get_product_raw(product_id)
            if current is None:
                return
            new_val = max(0, (current.get("comment_count") or 0) + delta)
            self.db_admin.table("store_products").update(
                {"comment_count": new_val}
            ).eq("id", product_id).execute()
        except Exception as e:
            print(f"[store_products] bump comment_count failed id={product_id} delta={delta}: {e}")

    # ========================================================================
    # 评论
    # ========================================================================

    @staticmethod
    def _format_comment(row: dict, *, liked_by_me: Optional[bool] = None) -> ProductComment:
        user_data = row.get("users") or {}
        if not isinstance(user_data, dict):
            user_data = {}
        user_info = user_data.get("user_info") or {}
        if not isinstance(user_info, dict):
            user_info = {}
        reply_to = row.get("reply_to") or {}
        if not isinstance(reply_to, dict):
            reply_to = {}

        return ProductComment(
            id=row["id"],
            productId=row["product_id"],
            userId=row.get("user_id"),
            username=user_data.get("username"),
            userAvatar=user_info.get("avatar_url"),
            parentId=row.get("parent_id"),
            replyToUserId=row.get("reply_to_user_id"),
            replyToUsername=reply_to.get("username"),
            content=row["content"],
            likeCount=row.get("like_count", 0),
            replyCount=row.get("reply_count", 0),
            likedByMe=liked_by_me,
            createdAt=row.get("created_at"),
            updatedAt=row.get("updated_at"),
        )

    def list_comments(
        self,
        product_id: int,
        *,
        page: int = 1,
        page_size: int = 20,
        user_id: Optional[int] = None,
    ) -> Tuple[List[ProductComment], int]:
        """只列出顶层评论（parent_id IS NULL）；回复另开接口拉。

        count 必须每页都请求 —— 早先实现只在 page==1 请求，导致下一页拿到
        `res.count == None` → `total == 0`，进而前端把 commentsTotal 写成 0、
        把 hasMore 关掉，分页直接断在第二页。

        count 走 exact 而非 planned：planner 估值在新表 / 大批量插入后会和实际值
        相差几个数量级（postgres 的 pg_stats 不实时刷新），用户会看到
        "Comments (1)" + 空列表 的错配。代价是 RPC 多扫一遍计数行，量级在
        万行以下完全无感；和 admin_service / store_merchant_service 等
        其它 39 处保持一致。
        """
        q = (
            self.db.table("store_product_comments")
            .select(_COMMENT_SELECT, count="exact")
            .eq("product_id", product_id)
            .is_("parent_id", "null")
            .order("created_at", desc=True)
        )
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = execute_with_retry(lambda: q.execute(), label="store_product_comments.list")
        rows = res.data or []
        total = res.count or 0

        liked_map: dict[int, bool] = {}
        if user_id is not None and rows:
            ids = [r["id"] for r in rows]
            liked_map = self._check_comments_liked_bulk(ids, user_id)

        comments = [
            self._format_comment(row, liked_by_me=liked_map.get(row["id"]))
            for row in rows
        ]
        return comments, total

    def list_comment_replies(self, parent_id: int) -> List[ProductComment]:
        res = (
            self.db.table("store_product_comments")
            .select(_COMMENT_SELECT)
            .eq("parent_id", parent_id)
            .order("created_at", desc=False)
            .execute()
        )
        return [self._format_comment(row) for row in (res.data or [])]

    def create_comment(
        self, product_id: int, user_id: int, data: ProductCommentCreate
    ) -> ProductComment:
        insert_data = {
            "product_id": product_id,
            "user_id": user_id,
            "content": data.content,
            "parent_id": data.parentId,
            "reply_to_user_id": data.replyToUserId,
        }
        result = self.db_admin.table("store_product_comments").insert(insert_data).execute()
        if not result.data:
            raise RuntimeError("failed to create product comment")

        # 维护父评论回复数
        if data.parentId:
            try:
                parent = (
                    self.db.table("store_product_comments")
                    .select("reply_count")
                    .eq("id", data.parentId)
                    .limit(1)
                    .execute()
                )
                if parent.data:
                    new_count = (parent.data[0].get("reply_count") or 0) + 1
                    self.db_admin.table("store_product_comments").update(
                        {"reply_count": new_count}
                    ).eq("id", data.parentId).execute()
            except Exception:
                pass
        else:
            # 顶层评论才计入商品评论总数（回复不计，避免刷数）
            self._bump_comment_count(product_id, delta=1)

        # 回查以补齐 user / reply_to join
        rid = result.data[0]["id"]
        full = (
            self.db.table("store_product_comments")
            .select(_COMMENT_SELECT)
            .eq("id", rid)
            .limit(1)
            .execute()
        )
        row = full.data[0] if full.data else result.data[0]
        return self._format_comment(row)

    def delete_comment(self, comment_id: int, user_id: int) -> bool:
        # 只允许评论作者本人删
        current = (
            self.db.table("store_product_comments")
            .select("id, product_id, parent_id, user_id")
            .eq("id", comment_id)
            .limit(1)
            .execute()
        )
        if not current.data or current.data[0]["user_id"] != user_id:
            return False

        row = current.data[0]
        res = (
            self.db_admin.table("store_product_comments")
            .delete()
            .eq("id", comment_id)
            .execute()
        )
        if not res.data:
            return False

        if row.get("parent_id") is None:
            self._bump_comment_count(row["product_id"], delta=-1)
        return True

    # ---- 评论点赞 ----

    def like_comment(self, comment_id: int, user_id: int) -> bool:
        try:
            self.db_admin.table("store_product_comment_likes").insert(
                {"comment_id": comment_id, "user_id": user_id}
            ).execute()
        except Exception:
            return False
        self._bump_comment_like_count(comment_id, delta=1)
        return True

    def unlike_comment(self, comment_id: int, user_id: int) -> bool:
        res = (
            self.db_admin.table("store_product_comment_likes")
            .delete()
            .eq("comment_id", comment_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not res.data:
            return False
        self._bump_comment_like_count(comment_id, delta=-1)
        return True

    def _check_comments_liked_bulk(
        self, comment_ids: Iterable[int], user_id: int
    ) -> dict[int, bool]:
        ids = list(comment_ids)
        if not ids:
            return {}
        result = (
            self.db.table("store_product_comment_likes")
            .select("comment_id")
            .in_("comment_id", ids)
            .eq("user_id", user_id)
            .execute()
        )
        liked_set = {row["comment_id"] for row in (result.data or [])}
        return {cid: (cid in liked_set) for cid in ids}

    def _bump_comment_like_count(self, comment_id: int, *, delta: int) -> None:
        try:
            current = (
                self.db.table("store_product_comments")
                .select("like_count")
                .eq("id", comment_id)
                .limit(1)
                .execute()
            )
            if not current.data:
                return
            new_val = max(0, (current.data[0].get("like_count") or 0) + delta)
            self.db_admin.table("store_product_comments").update(
                {"like_count": new_val}
            ).eq("id", comment_id).execute()
        except Exception as e:
            print(f"[store_product_comments] bump like_count failed id={comment_id}: {e}")


store_product_service = StoreProductService()
