"""
C2C 个人卖家档案服务。

负责 seller_profiles 表的读写。设计要点：
  - 个人卖家发布第一笔单品前，由 store_product_service 自动 upsert 一条 default 记录。
  - 信用分 / 响应速度 / GMV 由 P4（订单引擎）、P5（IM）异步写入；
    Phase 1 只保证表存在并暴露读写最基础字段。
  - 实名认证 (id_verified) 在 PRD 中未硬性规定时机；本实现倾向于「首次成交前必须认证」，
    Phase 4 在订单创建时校验。
"""

from typing import Optional

from app.db.supabase import get_supabase_admin, execute_with_retry
from app.schemas.store_product import SellerProfile, SellerProfileUpsert


class SellerProfileService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

    @staticmethod
    def _format(row: dict) -> SellerProfile:
        return SellerProfile(
            userId=row["user_id"],
            displayName=row.get("display_name"),
            bio=row.get("bio"),
            idVerified=row.get("id_verified", False),
            idVerifiedAt=row.get("id_verified_at"),
            creditScore=row.get("credit_score", 100),
            responseAvgMinutes=row.get("response_avg_minutes"),
            totalSales=row.get("total_sales", 0),
            totalGmvCents=row.get("total_gmv_cents", 0),
            createdAt=row.get("created_at"),
            updatedAt=row.get("updated_at"),
        )

    def get(self, user_id: int) -> Optional[SellerProfile]:
        res = execute_with_retry(
            lambda: self.db.table("seller_profiles")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute(),
            label="seller_profiles.get",
        )
        if not res.data:
            return None
        return self._format(res.data[0])

    def ensure_exists(self, user_id: int, default_display_name: Optional[str] = None) -> SellerProfile:
        """首次发布时若不存在则创建。幂等。"""
        existing = self.get(user_id)
        if existing:
            return existing
        try:
            self.db.table("seller_profiles").insert(
                {
                    "user_id": user_id,
                    "display_name": default_display_name,
                }
            ).execute()
        except Exception:
            # 并发竞态：另一个请求已经插入；再读一次即可
            pass
        return self.get(user_id) or SellerProfile(userId=user_id)

    def upsert(self, user_id: int, data: SellerProfileUpsert) -> SellerProfile:
        patch = {k: v for k, v in {
            "display_name": data.displayName,
            "bio": data.bio,
        }.items() if v is not None}

        existing = self.get(user_id)
        if existing is None:
            insert_data = {"user_id": user_id, **patch}
            self.db.table("seller_profiles").insert(insert_data).execute()
        elif patch:
            self.db.table("seller_profiles").update(patch).eq("user_id", user_id).execute()

        return self.get(user_id) or SellerProfile(userId=user_id)


seller_profile_service = SellerProfileService()
