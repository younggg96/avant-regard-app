"""
用户常用收货地址簿服务(PRD 模块四 · 支付环节地址管理)。

不变量:
  - 同一 user_id 未删除地址中最多一条 is_default=true(由 partial unique index 保证)。
  - 软删除:set deleted_at,而不是 DELETE,保证历史订单 shipping_address_json 的可读性。
  - 列表查询永远过滤 deleted_at IS NULL,默认地址按 is_default + updated_at 排序。
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from app.db.supabase import get_supabase_admin
from app.schemas.address import (
    UserAddress,
    UserAddressCreate,
    UserAddressUpdate,
)


class AddressService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

    # ---------- formatter ----------

    @staticmethod
    def _format(row: dict) -> UserAddress:
        return UserAddress(
            id=row["id"],
            receiverName=row["receiver_name"],
            phone=row["phone"],
            country=row.get("country"),
            province=row.get("province"),
            city=row.get("city"),
            district=row.get("district"),
            detail=row.get("detail"),
            fullText=row.get("full_text") or "",
            postalCode=row.get("postal_code"),
            label=row.get("label"),
            isDefault=bool(row.get("is_default")),
            createdAt=row.get("created_at"),
            updatedAt=row.get("updated_at"),
        )

    @staticmethod
    def _compose_full_text(payload: UserAddressCreate | UserAddressUpdate) -> Optional[str]:
        """前端没传 fullText 时,用结构化字段拼一个,保证 NOT NULL 约束。"""
        if getattr(payload, "fullText", None):
            return payload.fullText
        parts = [
            getattr(payload, "country", None),
            getattr(payload, "province", None),
            getattr(payload, "city", None),
            getattr(payload, "district", None),
            getattr(payload, "detail", None),
        ]
        joined = " ".join([p for p in parts if p])
        return joined or None

    # ---------- queries ----------

    def list_for_user(self, user_id: int) -> List[UserAddress]:
        res = (
            self.db.table("user_addresses")
            .select("*")
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .order("is_default", desc=True)
            .order("updated_at", desc=True)
            .execute()
        )
        return [self._format(r) for r in (res.data or [])]

    def get_default(self, user_id: int) -> Optional[UserAddress]:
        res = (
            self.db.table("user_addresses")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_default", True)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return self._format(res.data[0])

    def get_one(self, user_id: int, address_id: int) -> Optional[UserAddress]:
        res = (
            self.db.table("user_addresses")
            .select("*")
            .eq("user_id", user_id)
            .eq("id", address_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return self._format(res.data[0])

    # ---------- mutations ----------

    def _clear_other_defaults(self, user_id: int, except_id: Optional[int] = None) -> None:
        q = (
            self.db.table("user_addresses")
            .update({"is_default": False})
            .eq("user_id", user_id)
            .eq("is_default", True)
        )
        if except_id is not None:
            q = q.neq("id", except_id)
        q.execute()

    def create(self, user_id: int, payload: UserAddressCreate) -> UserAddress:
        full_text = self._compose_full_text(payload)
        if not full_text:
            raise ValueError("地址内容不能为空")

        # 用户第一次创建时,自动置为默认(更符合直觉)
        existing = self.list_for_user(user_id)
        is_default = payload.isDefault or len(existing) == 0

        if is_default:
            self._clear_other_defaults(user_id)

        row = {
            "user_id": user_id,
            "receiver_name": payload.receiverName.strip(),
            "phone": payload.phone.strip(),
            "country": payload.country,
            "province": payload.province,
            "city": payload.city,
            "district": payload.district,
            "detail": payload.detail,
            "full_text": full_text,
            "postal_code": payload.postalCode,
            "label": payload.label,
            "is_default": is_default,
        }
        res = self.db.table("user_addresses").insert(row).execute()
        if not res.data:
            raise RuntimeError("地址创建失败")
        return self._format(res.data[0])

    def update(
        self, user_id: int, address_id: int, payload: UserAddressUpdate
    ) -> UserAddress:
        current = self.get_one(user_id, address_id)
        if not current:
            raise ValueError("地址不存在或已删除")

        update: dict = {"updated_at": datetime.utcnow().isoformat()}
        if payload.receiverName is not None:
            update["receiver_name"] = payload.receiverName.strip()
        if payload.phone is not None:
            update["phone"] = payload.phone.strip()
        for field, key in [
            ("country", "country"),
            ("province", "province"),
            ("city", "city"),
            ("district", "district"),
            ("detail", "detail"),
            ("postalCode", "postal_code"),
            ("label", "label"),
        ]:
            v = getattr(payload, field)
            if v is not None:
                update[key] = v

        new_full = self._compose_full_text(payload)
        if new_full:
            update["full_text"] = new_full

        if payload.isDefault is True:
            self._clear_other_defaults(user_id, except_id=address_id)
            update["is_default"] = True
        elif payload.isDefault is False:
            update["is_default"] = False

        self.db.table("user_addresses").update(update).eq("id", address_id).eq(
            "user_id", user_id
        ).execute()
        return self.get_one(user_id, address_id) or current

    def set_default(self, user_id: int, address_id: int) -> UserAddress:
        current = self.get_one(user_id, address_id)
        if not current:
            raise ValueError("地址不存在或已删除")
        self._clear_other_defaults(user_id, except_id=address_id)
        self.db.table("user_addresses").update(
            {"is_default": True, "updated_at": datetime.utcnow().isoformat()}
        ).eq("id", address_id).eq("user_id", user_id).execute()
        return self.get_one(user_id, address_id) or current

    def soft_delete(self, user_id: int, address_id: int) -> None:
        current = self.get_one(user_id, address_id)
        if not current:
            return
        self.db.table("user_addresses").update(
            {
                "deleted_at": datetime.utcnow().isoformat(),
                "is_default": False,
            }
        ).eq("id", address_id).eq("user_id", user_id).execute()


address_service = AddressService()
