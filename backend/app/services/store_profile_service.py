"""
店铺主页可配置项服务。

覆盖 3 个资源的 CRUD / 列表：
  - store_profile_configs      : StoreProfileCard 数据源
  - store_entry_cards          : CategoryCards 数据源
  - store_product_categories   : 商家自定义分类

这些功能和 "商家内容发布" 概念(公告/Banner/活动/折扣/商品) 职责不同，单开一个
service，避免 `store_merchant_service.py` / `store_product_service.py` 继续膨胀。

权限校验：全部放在路由层（现成的 merchant 查询在 `store_merchant_service`），
本 service 只做数据 CRUD。
"""

from typing import Optional, List, Tuple
from app.db.supabase import get_supabase, get_supabase_admin, execute_with_retry
from app.schemas.store_product import (
    StoreProfileConfig,
    StoreProfileConfigUpsert,
    StoreEntryCard,
    StoreEntryCardCreate,
    StoreEntryCardUpdate,
    StoreProductCategory,
    StoreProductCategoryCreate,
    StoreProductCategoryUpdate,
)


class StoreProfileService:
    """店铺主页/入口卡片/分类 CRUD 服务"""

    def __init__(self) -> None:
        self.db = get_supabase_admin()
        self.db_admin = get_supabase_admin()

    # ========================================================================
    # StoreProfileConfig
    # ========================================================================

    @staticmethod
    def _format_profile_config(row: dict) -> StoreProfileConfig:
        return StoreProfileConfig(
            storeId=row["store_id"],
            merchantId=row.get("merchant_id"),
            logoImage=row.get("logo_image"),
            coverImage=row.get("cover_image"),
            shortDescription=row.get("short_description"),
            longDescription=row.get("long_description"),
            tags=row.get("tags") or [],
            createdAt=row.get("created_at"),
            updatedAt=row.get("updated_at"),
        )

    def get_profile_config(self, store_id: str) -> Optional[StoreProfileConfig]:
        """公开接口：读取某店铺的主页配置；未配置返回 None。"""
        result = execute_with_retry(
            lambda: self.db.table("store_profile_configs")
            .select("*")
            .eq("store_id", store_id)
            .limit(1)
            .execute(),
            label="store_profile_configs.get",
        )
        if not result.data:
            return None
        return self._format_profile_config(result.data[0])

    def upsert_profile_config(
        self,
        store_id: str,
        merchant_id: int,
        data: StoreProfileConfigUpsert,
    ) -> StoreProfileConfig:
        """商家 upsert 主页配置。

        使用 `on_conflict=store_id` 的 upsert；未显式传入的字段保持不变（PostgREST
        的 upsert 语义会覆盖传入字段，所以只把 exclude_unset 后的字段传进去）。
        """
        patch = data.model_dump(exclude_unset=True)

        # 字段映射 camelCase -> snake_case
        field_map = {
            "logoImage": "logo_image",
            "coverImage": "cover_image",
            "shortDescription": "short_description",
            "longDescription": "long_description",
            "tags": "tags",
        }
        db_patch: dict = {field_map[k]: v for k, v in patch.items() if k in field_map}

        # 先查是否存在
        existing = (
            self.db.table("store_profile_configs")
            .select("store_id")
            .eq("store_id", store_id)
            .limit(1)
            .execute()
        )

        if existing.data:
            if not db_patch:
                # 没有更新字段 —— 直接回查现有值
                current = self.get_profile_config(store_id)
                if current is None:
                    raise RuntimeError("profile config vanished during update")
                return current
            result = (
                self.db_admin.table("store_profile_configs")
                .update(db_patch)
                .eq("store_id", store_id)
                .execute()
            )
        else:
            insert_data = {
                "store_id": store_id,
                "merchant_id": merchant_id,
                **db_patch,
            }
            result = (
                self.db_admin.table("store_profile_configs")
                .insert(insert_data)
                .execute()
            )

        if not result.data:
            raise RuntimeError("failed to upsert profile config")
        return self._format_profile_config(result.data[0])

    # ========================================================================
    # StoreEntryCard
    # ========================================================================

    @staticmethod
    def _format_entry_card(row: dict) -> StoreEntryCard:
        return StoreEntryCard(
            id=row["id"],
            storeId=row["store_id"],
            merchantId=row.get("merchant_id"),
            cardType=row["card_type"],
            label=row["label"],
            labelEn=row.get("label_en"),
            imageUrl=row["image_url"],
            targetCategoryId=row.get("target_category_id"),
            sortOrder=row.get("sort_order", 0),
            status=row.get("status", "PUBLISHED"),
            createdAt=row.get("created_at"),
            updatedAt=row.get("updated_at"),
        )

    def list_entry_cards(
        self, store_id: str, *, include_hidden: bool = False
    ) -> List[StoreEntryCard]:
        query = (
            self.db.table("store_entry_cards")
            .select("*")
            .eq("store_id", store_id)
            .order("sort_order")
            .order("id")
        )
        if not include_hidden:
            query = query.eq("status", "PUBLISHED")
        result = execute_with_retry(
            lambda: query.execute(), label="store_entry_cards.list"
        )
        return [self._format_entry_card(row) for row in result.data]

    def create_entry_card(
        self,
        store_id: str,
        merchant_id: int,
        data: StoreEntryCardCreate,
    ) -> StoreEntryCard:
        insert_data = {
            "store_id": store_id,
            "merchant_id": merchant_id,
            "card_type": data.cardType.value,
            "label": data.label,
            "label_en": data.labelEn,
            "image_url": data.imageUrl,
            "target_category_id": data.targetCategoryId,
            "sort_order": data.sortOrder,
            "status": data.status.value,
        }
        result = self.db_admin.table("store_entry_cards").insert(insert_data).execute()
        return self._format_entry_card(result.data[0])

    def update_entry_card(
        self,
        card_id: int,
        merchant_id: int,
        data: StoreEntryCardUpdate,
    ) -> StoreEntryCard:
        patch = data.model_dump(exclude_unset=True)
        field_map = {
            "cardType": "card_type",
            "label": "label",
            "labelEn": "label_en",
            "imageUrl": "image_url",
            "targetCategoryId": "target_category_id",
            "sortOrder": "sort_order",
            "status": "status",
        }
        db_patch: dict = {}
        for k, v in patch.items():
            if k not in field_map:
                continue
            if hasattr(v, "value"):  # Enum -> value
                v = v.value
            db_patch[field_map[k]] = v

        if not db_patch:
            existing = self._get_entry_card_raw(card_id)
            if not existing or existing["merchant_id"] != merchant_id:
                raise ValueError("入口卡片不存在或无权限")
            return self._format_entry_card(existing)

        result = (
            self.db_admin.table("store_entry_cards")
            .update(db_patch)
            .eq("id", card_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
        if not result.data:
            raise ValueError("入口卡片不存在或无权限")
        return self._format_entry_card(result.data[0])

    def delete_entry_card(self, card_id: int, merchant_id: int) -> bool:
        result = (
            self.db_admin.table("store_entry_cards")
            .delete()
            .eq("id", card_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
        return bool(result.data)

    def _get_entry_card_raw(self, card_id: int) -> Optional[dict]:
        result = (
            self.db.table("store_entry_cards")
            .select("*")
            .eq("id", card_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    # ========================================================================
    # StoreProductCategory
    # ========================================================================

    @staticmethod
    def _format_category(row: dict, product_count: Optional[int] = None) -> StoreProductCategory:
        return StoreProductCategory(
            id=row["id"],
            storeId=row["store_id"],
            merchantId=row.get("merchant_id"),
            name=row["name"],
            coverImage=row.get("cover_image"),
            sortOrder=row.get("sort_order", 0),
            productCount=product_count,
            createdAt=row.get("created_at"),
            updatedAt=row.get("updated_at"),
        )

    def list_categories(
        self,
        store_id: str,
        *,
        with_product_count: bool = False,
    ) -> List[StoreProductCategory]:
        result = execute_with_retry(
            lambda: self.db.table("store_product_categories")
            .select("*")
            .eq("store_id", store_id)
            .order("sort_order")
            .order("id")
            .execute(),
            label="store_product_categories.list",
        )
        rows = result.data or []
        if not with_product_count or not rows:
            return [self._format_category(row) for row in rows]

        # 批量查询每个分类下的发布态商品数量（只数一次，避免 N+1）
        category_ids = [row["id"] for row in rows]
        count_map: dict[int, int] = {cid: 0 for cid in category_ids}
        if category_ids:
            counts = (
                self.db.table("store_products")
                .select("category_id", count="exact")
                .in_("category_id", category_ids)
                .eq("status", "PUBLISHED")
                .execute()
            )
            # PostgREST 不会按 group by 回填；这里手动合并
            for item in counts.data or []:
                cid = item.get("category_id")
                if cid in count_map:
                    count_map[cid] = count_map[cid] + 1

        return [self._format_category(row, count_map.get(row["id"], 0)) for row in rows]

    def create_category(
        self,
        store_id: str,
        merchant_id: int,
        data: StoreProductCategoryCreate,
    ) -> StoreProductCategory:
        insert_data = {
            "store_id": store_id,
            "merchant_id": merchant_id,
            "name": data.name,
            "cover_image": data.coverImage,
            "sort_order": data.sortOrder,
        }
        result = self.db_admin.table("store_product_categories").insert(insert_data).execute()
        return self._format_category(result.data[0])

    def update_category(
        self,
        category_id: int,
        merchant_id: int,
        data: StoreProductCategoryUpdate,
    ) -> StoreProductCategory:
        patch = data.model_dump(exclude_unset=True)
        field_map = {
            "name": "name",
            "coverImage": "cover_image",
            "sortOrder": "sort_order",
        }
        db_patch: dict = {field_map[k]: v for k, v in patch.items() if k in field_map}

        if not db_patch:
            current = self._get_category_raw(category_id)
            if not current or current.get("merchant_id") != merchant_id:
                raise ValueError("分类不存在或无权限")
            return self._format_category(current)

        result = (
            self.db_admin.table("store_product_categories")
            .update(db_patch)
            .eq("id", category_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
        if not result.data:
            raise ValueError("分类不存在或无权限")
        return self._format_category(result.data[0])

    def delete_category(self, category_id: int, merchant_id: int) -> bool:
        result = (
            self.db_admin.table("store_product_categories")
            .delete()
            .eq("id", category_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
        return bool(result.data)

    def _get_category_raw(self, category_id: int) -> Optional[dict]:
        result = (
            self.db.table("store_product_categories")
            .select("*")
            .eq("id", category_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None


store_profile_service = StoreProfileService()
