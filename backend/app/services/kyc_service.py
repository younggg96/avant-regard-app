"""
卖家实名认证 + 放款账户管理。

业务规则：
  - 必须 KYC.status == 'approved' 才能发起提款
  - 必须至少有一个 is_default = TRUE 的 payout_accounts
  - 身份证号 / 卡号 等敏感字段 API 出参一律 mask
"""
from __future__ import annotations

from typing import List, Optional
from datetime import datetime

from app.db.supabase import get_supabase_admin
from app.schemas.wallet import (
    KYCRecord,
    KYCSubmitRequest,
    PayoutAccount,
    PayoutAccountCreate,
)


def _mask_id_card(no: str) -> str:
    if not no:
        return ""
    if len(no) <= 6:
        return no[0] + "*" * (len(no) - 1)
    return f"{no[:4]}******{no[-2:]}"


def _mask_account(no: str) -> str:
    if not no:
        return ""
    if len(no) <= 8:
        return "*" * (len(no) - 4) + no[-4:]
    head = no[:4]
    tail = no[-4:]
    return f"{head} **** **** {tail}"


def _mask_name(name: str) -> str:
    if not name:
        return ""
    if len(name) <= 1:
        return name
    if len(name) == 2:
        return name[0] + "*"
    return name[0] + "*" * (len(name) - 2) + name[-1]


class KYCService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

    # ------------------------------------------------------------------
    # KYC
    # ------------------------------------------------------------------

    @staticmethod
    def _format_kyc(row: Optional[dict]) -> Optional[KYCRecord]:
        if not row:
            return None
        return KYCRecord(
            id=row.get("id"),
            userId=row["user_id"],
            realName=_mask_name(row.get("real_name") or ""),
            idCardMasked=_mask_id_card(row.get("id_card_no") or ""),
            idCardFrontUrl=row.get("id_card_front_url"),
            idCardBackUrl=row.get("id_card_back_url"),
            holderPhotoUrl=row.get("holder_photo_url"),
            contactPhone=row.get("contact_phone"),
            status=row.get("status", "none"),
            rejectReason=row.get("reject_reason"),
            submittedAt=row.get("submitted_at"),
            reviewedAt=row.get("reviewed_at"),
        )

    def get(self, user_id: int) -> Optional[KYCRecord]:
        res = (
            self.db.table("seller_kyc")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return self._format_kyc(res.data[0]) if res.data else None

    def submit(self, user_id: int, body: KYCSubmitRequest) -> KYCRecord:
        existing = (
            self.db.table("seller_kyc")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        payload = {
            "user_id": user_id,
            "real_name": body.realName.strip(),
            "id_card_no": body.idCardNo.strip(),
            "id_card_front_url": body.idCardFrontUrl,
            "id_card_back_url": body.idCardBackUrl,
            "holder_photo_url": body.holderPhotoUrl,
            "contact_phone": body.contactPhone,
            "status": "pending",
            "reject_reason": None,
            "reviewed_at": None,
            "submitted_at": datetime.utcnow().isoformat(),
        }
        if existing.data:
            self.db.table("seller_kyc").update(payload).eq(
                "user_id", user_id
            ).execute()
        else:
            self.db.table("seller_kyc").insert(payload).execute()

        # 同步把 seller_profiles.id_verified 推到 false 直到审核通过
        try:
            self.db.table("seller_profiles").update(
                {"id_verified": False}
            ).eq("user_id", user_id).execute()
        except Exception:
            pass

        return self.get(user_id) or KYCRecord(userId=user_id, status="pending")

    def admin_review(
        self,
        user_id: int,
        *,
        decision: str,
        reject_reason: Optional[str] = None,
        admin_user_id: int,
    ) -> KYCRecord:
        update = {
            "status": "approved" if decision == "approved" else "rejected",
            "reject_reason": reject_reason if decision == "rejected" else None,
            "reviewed_by": admin_user_id,
            "reviewed_at": datetime.utcnow().isoformat(),
        }
        self.db.table("seller_kyc").update(update).eq("user_id", user_id).execute()
        # 同步 seller_profiles.id_verified
        try:
            self.db.table("seller_profiles").update(
                {
                    "id_verified": decision == "approved",
                    "id_verified_at": datetime.utcnow().isoformat() if decision == "approved" else None,
                }
            ).eq("user_id", user_id).execute()
        except Exception:
            pass
        return self.get(user_id) or KYCRecord(userId=user_id, status=update["status"])

    def admin_list_pending(self, *, page: int = 1, page_size: int = 30):
        offset = (page - 1) * page_size
        res = (
            self.db.table("seller_kyc")
            .select("*", count="exact")
            .eq("status", "pending")
            .order("submitted_at", desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        return [self._format_kyc(r) for r in (res.data or [])], (res.count or 0)

    # ------------------------------------------------------------------
    # Payout Accounts
    # ------------------------------------------------------------------

    @staticmethod
    def _format_account(row: dict) -> PayoutAccount:
        no = row.get("account_no") or ""
        return PayoutAccount(
            id=row["id"],
            userId=row["user_id"],
            accountType=row.get("account_type"),
            holderName=row.get("holder_name"),
            accountNoMasked=_mask_account(no),
            accountNoLast4=no[-4:] if len(no) >= 4 else no,
            bankName=row.get("bank_name"),
            branchName=row.get("branch_name"),
            isDefault=row.get("is_default", False),
            createdAt=row.get("created_at"),
        )

    def list_payout_accounts(self, user_id: int) -> List[PayoutAccount]:
        res = (
            self.db.table("payout_accounts")
            .select("*")
            .eq("user_id", user_id)
            .order("is_default", desc=True)
            .order("created_at", desc=True)
            .execute()
        )
        return [self._format_account(r) for r in (res.data or [])]

    def has_default_payout(self, user_id: int) -> bool:
        res = (
            self.db.table("payout_accounts")
            .select("id")
            .eq("user_id", user_id)
            .eq("is_default", True)
            .limit(1)
            .execute()
        )
        return bool(res.data)

    def create_payout_account(
        self, user_id: int, body: PayoutAccountCreate
    ) -> PayoutAccount:
        # 实名校验：必须 approved 才能绑卡
        kyc = self.get(user_id)
        if not kyc or kyc.status != "approved":
            raise ValueError("请先完成实名认证")

        # 校验持卡人 = 实名（防止把别人卡填进来）
        try:
            real = (
                self.db.table("seller_kyc")
                .select("real_name")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            real_name = real.data[0]["real_name"] if real.data else None
        except Exception:
            real_name = None
        if real_name and body.holderName.strip() != real_name.strip():
            raise ValueError("持卡人必须与实名一致")

        if body.isDefault:
            # 把已有默认账户重置
            self.db.table("payout_accounts").update({"is_default": False}).eq(
                "user_id", user_id
            ).eq("is_default", True).execute()

        payload = {
            "user_id": user_id,
            "account_type": body.accountType.value,
            "holder_name": body.holderName.strip(),
            "account_no": body.accountNo.strip(),
            "bank_name": body.bankName,
            "branch_name": body.branchName,
            "is_default": body.isDefault,
        }
        ins = self.db.table("payout_accounts").insert(payload).execute()
        if not ins.data:
            raise RuntimeError("绑定账户失败")
        return self._format_account(ins.data[0])

    def set_default_payout_account(self, user_id: int, account_id: int) -> None:
        # 校验归属
        res = (
            self.db.table("payout_accounts")
            .select("id, user_id")
            .eq("id", account_id)
            .limit(1)
            .execute()
        )
        if not res.data or res.data[0]["user_id"] != user_id:
            raise ValueError("账户不存在")
        self.db.table("payout_accounts").update({"is_default": False}).eq(
            "user_id", user_id
        ).execute()
        self.db.table("payout_accounts").update({"is_default": True}).eq(
            "id", account_id
        ).execute()

    def delete_payout_account(self, user_id: int, account_id: int) -> None:
        res = (
            self.db.table("payout_accounts")
            .select("id, user_id")
            .eq("id", account_id)
            .limit(1)
            .execute()
        )
        if not res.data or res.data[0]["user_id"] != user_id:
            raise ValueError("账户不存在")
        self.db.table("payout_accounts").delete().eq("id", account_id).execute()


kyc_service = KYCService()
