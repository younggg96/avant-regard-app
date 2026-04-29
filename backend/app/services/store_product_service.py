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
)


# ===== 统一查询 select 串 =====
# 关联拿分类名（展示用），users / user_info（评论用户名头像）
_PRODUCT_SELECT = (
    "*, store_product_categories(name)"
)
_COMMENT_SELECT = (
    "*, users(username, user_info(avatar_url)),"
    " reply_to:reply_to_user_id(username)"
)


class StoreProductService:
    """商品 + 商品评论 + 商品点赞 服务"""

    def __init__(self) -> None:
        self.db = get_supabase()
        self.db_admin = get_supabase_admin()

    # ========================================================================
    # 商品 CRUD
    # ========================================================================

    @staticmethod
    def _format_product(row: dict, *, liked_by_me: Optional[bool] = None) -> StoreProduct:
        category = row.get("store_product_categories") or {}
        return StoreProduct(
            id=row["id"],
            storeId=row["store_id"],
            merchantId=row.get("merchant_id"),
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
            status=row.get("status", "PUBLISHED"),
            likedByMe=liked_by_me,
            publishedAt=row.get("published_at"),
            createdAt=row.get("created_at"),
            updatedAt=row.get("updated_at"),
        )

    def create_product(
        self, store_id: str, merchant_id: int, data: StoreProductCreate
    ) -> StoreProduct:
        insert_data = {
            "store_id": store_id,
            "merchant_id": merchant_id,
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
            "status": data.status.value,
        }
        result = self.db_admin.table("store_products").insert(insert_data).execute()
        if not result.data:
            raise RuntimeError("failed to create product")
        # 新插入后回查一次以拿到 category join 结果
        return self.get_product(result.data[0]["id"]) or self._format_product(result.data[0])

    def update_product(
        self,
        product_id: int,
        merchant_id: int,
        data: StoreProductUpdate,
    ) -> StoreProduct:
        # 先校验商品属于该商家
        raw = self._get_product_raw(product_id)
        if not raw or raw.get("merchant_id") != merchant_id:
            raise ValueError("商品不存在或无权限")

        patch = data.model_dump(exclude_unset=True)
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
            "status": "status",
        }
        db_patch: dict = {}
        for k, v in patch.items():
            if k not in field_map:
                continue
            if hasattr(v, "value"):
                v = v.value
            db_patch[field_map[k]] = v

        # 折扣价合法性（update 场景）：要同时考虑是否也在改 priceCents
        new_price = db_patch.get("price_cents", raw["price_cents"])
        if "discount_price_cents" in db_patch:
            new_discount = db_patch["discount_price_cents"]
            if new_discount is not None and new_discount > new_price:
                raise ValueError("折扣价不能高于原价")

        if not db_patch:
            return self._format_product(raw)

        result = (
            self.db_admin.table("store_products")
            .update(db_patch)
            .eq("id", product_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
        if not result.data:
            raise ValueError("商品更新失败")
        return self.get_product(product_id) or self._format_product(result.data[0])

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
        if user_id is not None:
            liked = self.check_product_liked(product_id, user_id)
        return self._format_product(result.data[0], liked_by_me=liked)

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
        status: str = "PUBLISHED",
        search_query: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        user_id: Optional[int] = None,
    ) -> Tuple[List[StoreProduct], int]:
        """列表查询。

        - 默认只列出 PUBLISHED 的商品，商家后台查看完整列表时可以传 status=None。
        - 过滤参数相互可组合：既可以查"分类 A 下的折扣商品"，也可以查"新品"。
        - user_id 传入时会批量回填 likedByMe，供详情页上的"喜欢"按钮定态。
        """
        if page == 1:
            query = self.db.table("store_products").select(_PRODUCT_SELECT, count="planned")
        else:
            query = self.db.table("store_products").select(_PRODUCT_SELECT)

        query = query.eq("store_id", store_id)
        if status:
            query = query.eq("status", status)
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

        # 批量回填 likedByMe
        liked_map: dict[int, bool] = {}
        if user_id is not None and rows:
            ids = [r["id"] for r in rows]
            liked_map = self._check_products_liked_bulk(ids, user_id)

        products = [
            self._format_product(row, liked_by_me=liked_map.get(row["id"]))
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
        if page == 1:
            q = self.db.table("store_product_likes").select(
                "product_id, created_at", count="planned"
            )
        else:
            q = self.db.table("store_product_likes").select(
                "product_id, created_at"
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
        """只列出顶层评论（parent_id IS NULL）；回复另开接口拉。"""
        if page == 1:
            q = (
                self.db.table("store_product_comments")
                .select(_COMMENT_SELECT, count="planned")
            )
        else:
            q = self.db.table("store_product_comments").select(_COMMENT_SELECT)
        q = q.eq("product_id", product_id).is_("parent_id", "null").order(
            "created_at", desc=True
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
