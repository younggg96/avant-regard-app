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

from typing import Optional, List, Tuple, Iterable
from datetime import datetime
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
)


# ===== 状态机 =====
# 集中表达 PRD 模块一的合法跳转。任何状态变更必须通过 transition_status，
# 直接 UPDATE status 字段会绕过校验，禁止使用。
_LISTING_TRANSITIONS: dict[ProductStatus, set[ProductStatus]] = {
    ProductStatus.DRAFT: {ProductStatus.REVIEWING, ProductStatus.OFFLINE},
    ProductStatus.REVIEWING: {ProductStatus.ACTIVE, ProductStatus.REJECTED, ProductStatus.DRAFT},
    ProductStatus.ACTIVE: {ProductStatus.FROZEN, ProductStatus.OFFLINE, ProductStatus.SOLD},
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

        insert_data: dict = {
            "store_id": store_id,
            "merchant_id": merchant_id,
            "seller_kind": seller_kind.value,
            "seller_user_id": seller_user_id,
            "category_id": data.categoryId,
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
        }
        db_patch: dict = {}
        for k, v in patch.items():
            if k not in field_map:
                continue
            if hasattr(v, "value"):
                v = v.value
            if isinstance(v, PhotoAngles):
                v = v.model_dump(exclude={"REQUIRED_SLOTS"})
            db_patch[field_map[k]] = v

        # 折扣价合法性（update 场景）：要同时考虑是否也在改 priceCents
        new_price = db_patch.get("price_cents", raw["price_cents"])
        if "discount_price_cents" in db_patch:
            new_discount = db_patch["discount_price_cents"]
            if new_discount is not None and new_discount > new_price:
                raise ValueError("折扣价不能高于原价")

        if not db_patch:
            return self._format_product(raw)

        q = self.db_admin.table("store_products").update(db_patch).eq("id", product_id)
        if kind == "merchant":
            q = q.eq("merchant_id", owner_merchant_id)
        else:
            q = q.eq("seller_user_id", owner_user_id)
        result = q.execute()
        if not result.data:
            raise ValueError("商品更新失败")
        return self.get_product(product_id) or self._format_product(result.data[0])

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
        return len(target_ids)

    def batch_delete_drafts(
        self,
        product_ids: List[int],
        *,
        seller_user_id: Optional[int] = None,
        merchant_id: Optional[int] = None,
    ) -> int:
        """批量删除（只允许 draft / rejected）。返回删除数量。"""
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
            if r.get("status") in ("draft", "rejected"):
                target_ids.append(r["id"])
        if not target_ids:
            return 0
        self.db_admin.table("store_products").delete().in_("id", target_ids).execute()
        return len(target_ids)

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

        - 校验：5 视角图必须齐全、condition / condition_note 必填。
        - auto_approve（dev / feature flag 开启）：连接到 reviewing → active 自动通过。
        """
        raw = self._get_product_raw(product_id)
        if not raw:
            raise ValueError("商品不存在")
        if raw.get("status") != "draft":
            raise ValueError("仅草稿状态可提交审核")

        photo_angles = raw.get("photo_angles") or {}
        required_slots = ("front", "back", "wash_label", "brand_label", "flaw")
        missing = [k for k in required_slots if not photo_angles.get(k)]
        if missing:
            raise ValueError(f"以下视角图缺失：{','.join(missing)}")
        if not raw.get("condition"):
            raise ValueError("请选择成色")
        if not raw.get("condition_note"):
            raise ValueError("请填写成色说明（PRD 1.3：无瑕疵也需说明）")

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
        reviews = self._fetch_seller_reviews(product.sellerUserId, limit=5)

        return {
            "product": product.model_dump(),
            "seller": seller,
            "show": show,
            "relatedBrands": related_brands,
            "relatedProducts": [p.model_dump() for p in related_products],
            "reviews": reviews,
        }

    # ---- 内部聚合 helpers --------------------------------------------------

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
            "username": display_name or username or "—",
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

    def search_marketplace(
        self,
        *,
        keyword: Optional[str] = None,
        brand: Optional[str] = None,
        category_id: Optional[int] = None,
        size: Optional[str] = None,
        color: Optional[str] = None,
        condition: Optional[str] = None,
        seller_kind: Optional[str] = None,
        price_min_cents: Optional[int] = None,
        price_max_cents: Optional[int] = None,
        sort: str = "newest",
        page: int = 1,
        page_size: int = 20,
        user_id: Optional[int] = None,
    ) -> Tuple[List[StoreProduct], int]:
        """PRD 模块二 · Marketplace 交易大厅查询。

        - 只返回 status='active' 的单品。
        - 支持品牌/品类/尺码/颜色/成色/卖家类型/价格区间过滤。
        - 排序：newest / price_asc / price_desc。
        """
        q = self.db.table("store_products").select(_PRODUCT_SELECT, count="exact")
        q = q.eq("status", "active")
        if keyword:
            kw = keyword.replace("%", "\\%").replace("_", "\\_").strip()
            if kw:
                q = q.or_(f"title.ilike.%{kw}%,brand.ilike.%{kw}%,tags.cs.{{{kw}}}")
        if brand:
            q = q.ilike("brand", brand)
        if category_id is not None:
            q = q.eq("category_id", category_id)
        if size:
            q = q.eq("size", size)
        if color:
            q = q.eq("color", color)
        if condition:
            q = q.eq("condition", condition)
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
        # - featured  : 精选推荐（favorite_count desc 兜底 published_at desc）
        if sort == "price_asc":
            q = q.order("price_cents", desc=False)
        elif sort == "price_desc":
            q = q.order("price_cents", desc=True)
        elif sort == "featured":
            q = q.order("favorite_count", desc=True).order(
                "published_at", desc=True
            ).order("id", desc=True)
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
        return products, total

    def get_popular_brands(self, limit: int = 6) -> List[dict]:
        """Marketplace 顶部「热门品牌」聚合。

        实现策略：
          1. 取最近活跃的 store_products（status=active）品牌字段，按上架数量降序；
             这样既能反映"热门"也能保证有真实在售货品的品牌才出现，避免空点击。
          2. 用品牌名再去 `brands` 表关联一次，拿到 cover image / id；找不到的就
             仅返回名称（前端会显示首字母占位头像）。

        返回每条结构：``{"name": str, "brandId": int|None, "imageUrl": str|None, "listingCount": int}``。
        """
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
        top = sorted(counts.items(), key=lambda x: (-x[1], x[0]))[:limit]
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
        self, user_id: int, *, page: int = 1, page_size: int = 20
    ) -> Tuple[List[StoreProduct], int]:
        """用户收藏的商品分页列表（Profile 「我收藏的商品」会用）。"""
        q = (
            self.db.table("store_product_favorites")
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
            self._format_product(row, favorited_by_me=True) for row in ordered
        ]
        return products, total

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
