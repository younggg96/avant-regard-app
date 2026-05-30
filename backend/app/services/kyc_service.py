"""
卖家实名认证 + 放款账户管理。

业务规则：
  - 必须 KYC.status == 'approved' 才能发起提款
  - 必须至少有一个 is_default = TRUE 的 payout_accounts
  - 身份证号 / 卡号 等敏感字段:
      * 入库前 Fernet 对称加密(`KYC_ENCRYPTION_KEY` 必须配置)
      * API 出参一律 mask(只露 head/tail)
  - 实名校验 / 银行卡四要素通过 VerifyProvider 抽象,
    生产接阿里云,开发回落 mock(任何合法格式都通过)。
"""
from __future__ import annotations

from typing import List, Optional
from datetime import datetime

from app.db.supabase import get_supabase_admin
from app.core.config import settings
from app.core.crypto import encrypt_str, decrypt_str
from app.services.verify import (
    get_verify_provider,
    get_identity_session_provider,
    resolve_region,
)
from app.services.verify.base import VerifySession
from app.schemas.wallet import (
    KYCRecord,
    KYCSubmitRequest,
    IdentitySession,
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
        # 兼容历史明文数据:decrypt_str 在解密失败(InvalidToken)时会原样返回,
        # 因此对老库里没加密过的身份证号也能 mask 正确。
        id_no_plain = decrypt_str(row.get("id_card_no") or "") or ""
        return KYCRecord(
            id=row.get("id"),
            userId=row["user_id"],
            realName=_mask_name(row.get("real_name") or ""),
            idCardMasked=_mask_id_card(id_no_plain),
            idCardFrontUrl=row.get("id_card_front_url"),
            idCardBackUrl=row.get("id_card_back_url"),
            holderPhotoUrl=row.get("holder_photo_url"),
            contactPhone=row.get("contact_phone"),
            status=row.get("status", "none"),
            rejectReason=row.get("reject_reason"),
            submittedAt=row.get("submitted_at"),
            reviewedAt=row.get("reviewed_at"),
            provider=row.get("provider"),
            verifiedCountry=row.get("verified_country"),
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
            # 加密落库,API 出参再 _mask 给前端
            "id_card_no": encrypt_str(body.idCardNo.strip()),
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
        is_stripe_connect = body.accountType.value == "stripe_connect"

        if is_stripe_connect:
            # Stripe Connect 走 Stripe 自家 KYC, 不要求本地 seller_kyc.approved。
            # 但要求用户已经完成 connect 账号 onboarding(status=active),
            # 并且本接口传入的 accountNo == stripe_account_id, 防止伪造关联。
            from app.services.payment.stripe_connect_service import (
                stripe_connect_service,
            )
            connect_row = stripe_connect_service.get_account_row(user_id)
            if not connect_row:
                raise ValueError("请先完成 Stripe Connect 接入")
            if connect_row["status"] != "active":
                raise ValueError("Stripe 账号尚未通过审核, 请稍后再绑定")
            if body.accountNo.strip() != connect_row["stripe_account_id"]:
                raise ValueError("Stripe 账号 ID 不匹配")
        else:
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

    # ------------------------------------------------------------------
    # 自动审核(实名 二要素 / 银行卡 四要素)
    # ------------------------------------------------------------------

    def verify_identity_auto(
        self, user_id: int, *, real_name: str, id_card_no: str
    ) -> KYCRecord:
        """二要素自动审核:阿里云通过即把 status 设为 approved,失败保持 pending。

        前置:用户必须已经通过 submit() 提交过三张身份证照(走人工兜底);
        本方法只是把二要素这一关自动化,通过后免去管理员人工 review 这一步。
        """
        provider = get_verify_provider()
        result = provider.verify_id_card(name=real_name, id_no=id_card_no)

        existing = (
            self.db.table("seller_kyc")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        base_payload = {
            "user_id": user_id,
            "real_name": real_name.strip(),
            "id_card_no": encrypt_str(id_card_no.strip()),
            "submitted_at": datetime.utcnow().isoformat(),
        }
        if result.ok:
            base_payload.update(
                {
                    "status": "approved",
                    "reject_reason": None,
                    "reviewed_at": datetime.utcnow().isoformat(),
                }
            )
        else:
            base_payload.update(
                {
                    "status": "pending" if result.status == "provider_error" else "rejected",
                    "reject_reason": result.message or "实名校验未通过",
                    "reviewed_at": None,
                }
            )

        if existing.data:
            self.db.table("seller_kyc").update(base_payload).eq(
                "user_id", user_id
            ).execute()
        else:
            self.db.table("seller_kyc").insert(base_payload).execute()

        # 同步 seller_profiles.id_verified
        try:
            self.db.table("seller_profiles").update(
                {
                    "id_verified": result.ok,
                    "id_verified_at": (
                        datetime.utcnow().isoformat() if result.ok else None
                    ),
                }
            ).eq("user_id", user_id).execute()
        except Exception:
            pass

        return self.get(user_id) or KYCRecord(
            userId=user_id, status=base_payload["status"]
        )

    # ------------------------------------------------------------------
    # 实名总判定(供上架门 / 提现门复用)
    # ------------------------------------------------------------------

    def is_identity_verified(self, user_id: int) -> bool:
        """是否已实名 —— 上架 / 提现门的统一判定。

        通过条件(任一):
          1. seller_kyc.status == 'approved'
             (中国大陆阿里云二要素 / 海外 Stripe Identity 证件+自拍)
          2. 海外短路:已完成 Stripe Connect onboarding(status=active),
             Connect 自带 KYC, 不必再走一次 Identity。
             仅当 KYC_CONNECT_COUNTS_AS_VERIFIED 开启时生效。
        """
        kyc = self.get(user_id)
        if kyc and kyc.status == "approved":
            return True
        return self.connect_satisfies_kyc(user_id)

    def connect_satisfies_kyc(self, user_id: int) -> bool:
        """该用户是否凭 Stripe Connect active 满足实名(海外短路)。"""
        if not settings.KYC_CONNECT_COUNTS_AS_VERIFIED:
            return False
        try:
            from app.services.payment.stripe_connect_service import (
                stripe_connect_service,
            )
            row = stripe_connect_service.get_account_row(user_id)
        except Exception:
            return False
        return bool(row and row.get("status") == "active")

    def mark_verified_via_connect(self, user_id: int) -> None:
        """Connect 状态翻到 active 时回写一条 seller_kyc approved。

        让 seller_kyc 始终是实名状态的单一事实源(钱包 UI / 后台 / 绑卡校验
        都读它),避免"Connect 已 active 但 seller_kyc 还显示未实名"的不一致。
        由 stripe_connect_service._sync_from_stripe 在状态变 active 时调用。
        """
        if not settings.KYC_CONNECT_COUNTS_AS_VERIFIED:
            return
        existing = (
            self.db.table("seller_kyc")
            .select("id, status, real_name")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        row = existing.data[0] if existing.data else None
        # 已经 approved 就别覆盖(可能是 Identity / 阿里云通过的,保留其 provider)。
        if row and row.get("status") == "approved":
            return
        now = datetime.utcnow().isoformat()
        payload = {
            "user_id": user_id,
            "provider": "stripe_connect",
            "status": "approved",
            "reject_reason": None,
            "reviewed_at": now,
            "submitted_at": now,
        }
        if row:
            self.db.table("seller_kyc").update(payload).eq(
                "user_id", user_id
            ).execute()
        else:
            # 首次创建:Connect 不回传可信姓名,real_name 占位(API 出参会 mask)。
            payload["real_name"] = "Verified via Stripe"
            self.db.table("seller_kyc").insert(payload).execute()
        try:
            self.db.table("seller_profiles").update(
                {"id_verified": True, "id_verified_at": now}
            ).eq("user_id", user_id).execute()
        except Exception:
            pass

    # ------------------------------------------------------------------
    # 会话式实名(海外 / 美国:证件影像 + 活体自拍)
    # ------------------------------------------------------------------

    def _identity_return_url(self, app_scheme: Optional[str]) -> Optional[str]:
        """Stripe Identity 托管页完成后回跳的 https 跳板 URL。
        附上 ?scheme= 让跳板页 JS 跳回正确的 App variant deep link。
        没配 STRIPE_IDENTITY_RETURN_URL 时返回 None(mock 不依赖它)。
        """
        base = settings.STRIPE_IDENTITY_RETURN_URL or ""
        if not base:
            return None
        if not app_scheme:
            return base
        sep = "&" if "?" in base else "?"
        return f"{base}{sep}scheme={app_scheme}"

    def start_identity_session(
        self,
        user_id: int,
        *,
        region: Optional[str] = None,
        app_scheme: Optional[str] = None,
        email: Optional[str] = None,
    ) -> IdentitySession:
        """发起一次实名验证。

        - CN(中国大陆):不创建第三方会话,返回 mode='id_two_factor',
          前端走既有"姓名 + 身份证号 + 三张证件照"表单(verify_identity_auto / submit)。
        - US / 海外:创建会话式(证件 + 活体自拍)provider 会话,落库
          provider / provider_session_id,返回托管页 url(或 client_secret)。
          mock provider 创建即 verified → 直接置 approved。
        """
        resolved = resolve_region(region)
        kyc = self.get(user_id)
        if resolved == "CN":
            return IdentitySession(
                mode="id_two_factor",
                provider="aliyun",
                status="requires_input",
                kycStatus=kyc.status if kyc else "none",
            )

        # 海外短路:已实名(seller_kyc.approved 或 Connect active)就别再发起一次
        # 重复验证,直接告诉前端已通过。若仅靠 Connect 满足而 seller_kyc 还没
        # 回写,这里顺手补一条,保证钱包 / 后台 / 刷新都看到 approved。
        if self.is_identity_verified(user_id):
            self.mark_verified_via_connect(user_id)
            return IdentitySession(
                mode="document_selfie",
                provider=(kyc.provider if kyc and kyc.provider else "stripe_connect"),
                status="verified",
                kycStatus="approved",
            )

        provider = get_identity_session_provider()
        return_url = self._identity_return_url(app_scheme)
        # 跳转式(hosted)流程必须有 return_url 才会拿到托管页 url;
        # 缺失时前端会卡住,这里直接失败(路由层 → 503)而不是静默返回空 url。
        if provider.name == "stripe_identity" and not return_url:
            raise RuntimeError(
                "STRIPE_IDENTITY_RETURN_URL 未配置,无法发起身份验证"
            )
        session = provider.create_session(
            user_id=user_id, return_url=return_url, email=email
        )
        self._persist_identity_session(user_id, session)
        new_status = self._map_session_status(session.status)
        return IdentitySession(
            mode="document_selfie",
            provider=session.provider,
            status=session.status,
            sessionId=session.session_id,
            clientSecret=session.client_secret,
            url=session.url,
            kycStatus=new_status,
        )

    def sync_identity_session(self, user_id: int) -> IdentitySession:
        """主动从第三方拉一次会话状态(前端从托管页跳回 App 后调一次)。"""
        row = (
            self.db.table("seller_kyc")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        data = row.data[0] if row.data else None
        session_id = data.get("provider_session_id") if data else None
        if not data or not session_id:
            # 没有第三方会话:可能是 Connect 短路已满足实名,据此回报状态。
            if self.is_identity_verified(user_id):
                self.mark_verified_via_connect(user_id)
                return IdentitySession(
                    mode="document_selfie",
                    provider=(data or {}).get("provider") or "stripe_connect",
                    status="verified",
                    kycStatus="approved",
                )
            cur = self.get(user_id)
            return IdentitySession(
                mode="document_selfie",
                provider=(data or {}).get("provider") or "stripe_identity",
                status="requires_input",
                kycStatus=cur.status if cur else "none",
            )
        provider = get_identity_session_provider()
        session = provider.retrieve_session(session_id)
        self._persist_identity_session(user_id, session)
        return IdentitySession(
            mode="document_selfie",
            provider=session.provider,
            status=session.status,
            sessionId=session.session_id,
            clientSecret=session.client_secret,
            url=session.url,
            kycStatus=self._map_session_status(session.status),
        )

    def handle_identity_webhook(self, session_obj: dict) -> None:
        """identity.verification_session.* webhook 入口。
        用 metadata.appUserId 或 provider_session_id 反查本地用户后同步状态。"""
        provider = get_identity_session_provider()
        session = provider.parse_webhook_object(session_obj)

        user_id: Optional[int] = None
        metadata = session_obj.get("metadata") or {}
        if isinstance(metadata, dict) and metadata.get("appUserId"):
            try:
                user_id = int(metadata["appUserId"])
            except (TypeError, ValueError):
                user_id = None
        if user_id is None and session.session_id:
            res = (
                self.db.table("seller_kyc")
                .select("user_id")
                .eq("provider_session_id", session.session_id)
                .limit(1)
                .execute()
            )
            if res.data:
                user_id = res.data[0]["user_id"]
        if user_id is None:
            print(
                f"[kyc] identity webhook for unknown session {session.session_id}",
                flush=True,
            )
            return
        self._persist_identity_session(user_id, session)

    @staticmethod
    def _map_session_status(session_status: str) -> str:
        """会话 status → seller_kyc.status。"""
        if session_status == "verified":
            return "approved"
        if session_status == "canceled":
            return "rejected"
        return "pending"

    def _persist_identity_session(
        self, user_id: int, session: VerifySession
    ) -> None:
        """把一次会话式实名的状态落库到 seller_kyc(upsert)。"""
        kyc_status = self._map_session_status(session.status)
        now = datetime.utcnow().isoformat()
        payload: dict = {
            "user_id": user_id,
            "provider": session.provider,
            "provider_session_id": session.session_id,
            "status": kyc_status,
            "submitted_at": now,
        }
        if session.verified_country:
            payload["verified_country"] = session.verified_country
        if kyc_status == "approved":
            payload["reviewed_at"] = now
            payload["reject_reason"] = None
            # 证件 + 自拍流程没有身份证号;real_name 用第三方回传的核验姓名。
            payload["real_name"] = session.verified_name or "Verified"
        elif kyc_status == "rejected":
            payload["reject_reason"] = session.message or "实名验证未通过"
            payload["reviewed_at"] = None
        else:
            payload["reject_reason"] = None
            payload["reviewed_at"] = None

        existing = (
            self.db.table("seller_kyc")
            .select("id, real_name, status")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        existing_row = existing.data[0] if existing.data else None
        # 不允许把已 approved 的记录降级:防止迟到的 canceled/requires_input 事件
        # (例如用户放弃 Identity 改走 Connect 后,旧会话过期推来的 canceled)
        # 把一个已经通过的用户打回未通过。撤销实名应走管理员动作。
        if (
            existing_row
            and existing_row.get("status") == "approved"
            and kyc_status != "approved"
        ):
            return
        if existing_row:
            # 已有记录:pending 阶段别覆盖既有 real_name(可能是历史中国大陆数据)。
            if kyc_status != "approved":
                payload.pop("real_name", None)
            self.db.table("seller_kyc").update(payload).eq(
                "user_id", user_id
            ).execute()
        else:
            # 首次创建:NOT NULL real_name 兜底占位,verified 时会被覆盖。
            payload.setdefault("real_name", session.verified_name or "Pending")
            self.db.table("seller_kyc").insert(payload).execute()

        try:
            self.db.table("seller_profiles").update(
                {
                    "id_verified": kyc_status == "approved",
                    "id_verified_at": now if kyc_status == "approved" else None,
                }
            ).eq("user_id", user_id).execute()
        except Exception:
            pass

    def verify_bank_card4(
        self,
        user_id: int,
        *,
        holder_name: str,
        id_card_no: str,
        bank_no: str,
        phone: str,
    ) -> bool:
        """银行卡四要素。绑定 payout_account 前调,通过才允许绑卡。

        不写库,纯校验。落地后 create_payout_account 会拿同一组数据 + 真实姓名做双重保险。
        """
        provider = get_verify_provider()
        result = provider.verify_bank_card4(
            name=holder_name,
            id_no=id_card_no,
            bank_no=bank_no,
            phone=phone,
        )
        if not result.ok:
            raise ValueError(result.message or "银行卡四要素未通过")
        return True


kyc_service = KYCService()
