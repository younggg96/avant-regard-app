"""
卖家钱包 + 实名 + 放款账户路由。

  - GET   /wallet/me                  钱包首屏（余额 + KYC 状态 + 默认账户）
  - GET   /wallet/me/pending          待解冻列表（pending_payouts.locked）
  - GET   /wallet/me/ledger           资金流水
  - GET   /wallet/me/withdrawals      我的提现单
  - POST  /wallet/me/withdrawals      发起提现
  - GET   /kyc/me                     我的实名信息
  - POST  /kyc/me                     提交实名（首次或重新提交）
  - GET   /kyc/me/payout-accounts     我的放款账户列表
  - POST  /kyc/me/payout-accounts     绑定新账户
  - POST  /kyc/me/payout-accounts/{id}/default  设为默认
  - DELETE /kyc/me/payout-accounts/{id}        删除
  - 管理后台：
  - GET   /admin/kyc/pending          待审实名列表
  - POST  /admin/kyc/{user_id}/review 审批实名
  - GET   /admin/wallet/withdrawals/pending  待处理提现
  - POST  /admin/wallet/withdrawals/{id}     标记提现单状态
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.response import success
from app.api.deps import get_current_user, get_current_admin_user
from app.services.wallet_service import wallet_service
from app.services.kyc_service import kyc_service
from app.schemas.wallet import (
    KYCSubmitRequest,
    KYCAdminDecision,
    PayoutAccountCreate,
    WithdrawCreateRequest,
    WithdrawalAdminUpdate,
    VerifyIdentityRequest,
    VerifyBankCardRequest,
)


wallet_router = APIRouter(prefix="/wallet", tags=["交易系统 / 钱包"])
kyc_router = APIRouter(prefix="/kyc", tags=["交易系统 / 实名"])
admin_wallet_router = APIRouter(prefix="/admin/wallet", tags=["交易系统 / 后台钱包"])
admin_kyc_router = APIRouter(prefix="/admin/kyc", tags=["交易系统 / 后台实名"])


# =============================== Wallet ===============================


@wallet_router.get("/me")
async def get_my_wallet(user_id: int = Depends(get_current_user)):
    return success(wallet_service.summary(user_id).dict())


@wallet_router.get("/me/pending")
async def list_my_pending(user_id: int = Depends(get_current_user)):
    items = wallet_service.list_pending(user_id)
    return success({"items": [it.dict() for it in items]})


@wallet_router.get("/me/ledger")
async def list_my_ledger(
    page: int = 1,
    pageSize: int = 30,
    user_id: int = Depends(get_current_user),
):
    items, total = wallet_service.list_ledger(user_id, page=page, page_size=pageSize)
    return success(
        {
            "items": [it.dict() for it in items],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }
    )


@wallet_router.get("/me/withdrawals")
async def list_my_withdrawals(
    page: int = 1,
    pageSize: int = 30,
    user_id: int = Depends(get_current_user),
):
    items, total = wallet_service.list_withdrawals(
        user_id, page=page, page_size=pageSize
    )
    return success(
        {
            "items": [it.dict() for it in items],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }
    )


@wallet_router.post("/me/withdrawals")
async def create_withdrawal(
    body: WithdrawCreateRequest, user_id: int = Depends(get_current_user)
):
    try:
        wd = wallet_service.create_withdrawal(
            user_id,
            amount_cents=body.amountCents,
            payout_account_id=body.payoutAccountId,
            note=body.note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(wd.dict())


# =============================== KYC ===============================


@kyc_router.get("/me")
async def get_my_kyc(user_id: int = Depends(get_current_user)):
    rec = kyc_service.get(user_id)
    return success(rec.dict() if rec else {"userId": user_id, "status": "none"})


@kyc_router.post("/me")
async def submit_kyc(
    body: KYCSubmitRequest, user_id: int = Depends(get_current_user)
):
    rec = kyc_service.submit(user_id, body)
    return success(rec.dict())


@kyc_router.post("/me/verify-identity")
async def verify_identity_auto(
    body: VerifyIdentityRequest,
    user_id: int = Depends(get_current_user),
):
    """二要素自动审核(姓名 + 身份证号)。

    通过即把 status 设为 approved,免去管理员人工 review;
    通道临时故障(provider_error)保持 pending,允许用户稍后重试;
    不一致 / 格式错误直接 rejected。
    """
    try:
        rec = kyc_service.verify_identity_auto(
            user_id,
            real_name=body.realName,
            id_card_no=body.idCardNo,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(rec.dict())


@kyc_router.post("/me/verify-bank-card")
async def verify_bank_card(
    body: VerifyBankCardRequest,
    user_id: int = Depends(get_current_user),
):
    """银行卡四要素校验。绑定 payout_account 前调,通过才允许绑卡。"""
    try:
        kyc_service.verify_bank_card4(
            user_id,
            holder_name=body.holderName,
            id_card_no=body.idCardNo,
            bank_no=body.bankNo,
            phone=body.phone,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success({"ok": True})


@kyc_router.get("/me/payout-accounts")
async def list_my_accounts(user_id: int = Depends(get_current_user)):
    items = kyc_service.list_payout_accounts(user_id)
    return success({"items": [it.dict() for it in items]})


@kyc_router.post("/me/payout-accounts")
async def create_payout_account(
    body: PayoutAccountCreate, user_id: int = Depends(get_current_user)
):
    try:
        acct = kyc_service.create_payout_account(user_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(acct.dict())


@kyc_router.post("/me/payout-accounts/{account_id}/default")
async def set_default_account(
    account_id: int, user_id: int = Depends(get_current_user)
):
    try:
        kyc_service.set_default_payout_account(user_id, account_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success({"ok": True})


@kyc_router.delete("/me/payout-accounts/{account_id}")
async def delete_payout_account(
    account_id: int, user_id: int = Depends(get_current_user)
):
    try:
        kyc_service.delete_payout_account(user_id, account_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success({"ok": True})


# =============================== Admin ===============================


@admin_kyc_router.get("/pending")
async def admin_list_pending_kyc(
    page: int = 1,
    pageSize: int = 30,
    _admin=Depends(get_current_admin_user),
):
    items, total = kyc_service.admin_list_pending(page=page, page_size=pageSize)
    return success(
        {
            "items": [it.dict() if it else None for it in items],
            "total": total,
            "page": page,
            "pageSize": pageSize,
        }
    )


@admin_kyc_router.post("/{target_user_id}/review")
async def admin_review_kyc(
    target_user_id: int,
    body: KYCAdminDecision,
    admin_user_id: int = Depends(get_current_admin_user),
):
    rec = kyc_service.admin_review(
        target_user_id,
        decision=body.decision,
        reject_reason=body.rejectReason,
        admin_user_id=admin_user_id,
    )
    return success(rec.dict() if rec else None)


@admin_wallet_router.get("/withdrawals/pending")
async def admin_list_pending_withdrawals(
    page: int = 1,
    pageSize: int = 30,
    _admin=Depends(get_current_admin_user),
):
    """复用 wallet_service.list_withdrawals 时只能按 user_id 过滤。
    管理员视角直接绕过去查 pending / processing。
    """
    from app.db.supabase import get_supabase_admin

    db = get_supabase_admin()
    offset = (page - 1) * pageSize
    res = (
        db.table("wallet_withdrawals")
        .select("*, payout_accounts(*)", count="exact")
        .in_("status", ["pending", "processing"])
        .order("created_at", desc=False)
        .range(offset, offset + pageSize - 1)
        .execute()
    )
    items = []
    for r in res.data or []:
        acct = r.get("payout_accounts")
        if isinstance(acct, list):
            acct = acct[0] if acct else None
        items.append(wallet_service._format_withdrawal(r, acct).dict())
    return success(
        {"items": items, "total": res.count or 0, "page": page, "pageSize": pageSize}
    )


@admin_wallet_router.post("/withdrawals/{withdrawal_id}")
async def admin_update_withdrawal(
    withdrawal_id: int,
    body: WithdrawalAdminUpdate,
    admin_user_id: int = Depends(get_current_admin_user),
):
    try:
        wd = wallet_service.admin_update_withdrawal(
            withdrawal_id,
            admin_user_id=admin_user_id,
            status=body.status,
            reject_reason=body.rejectReason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(wd.dict())
