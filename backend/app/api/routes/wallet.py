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
  - GET   /wallet/me/connect          Stripe Connect 账号当前状态
  - POST  /wallet/me/connect/onboard  创建 Connect 账号 + 返回 onboarding URL
  - POST  /wallet/me/connect/refresh  主动从 Stripe 拉一次状态
  - 管理后台：
  - GET   /admin/kyc/pending          待审实名列表
  - POST  /admin/kyc/{user_id}/review 审批实名
  - GET   /admin/wallet/withdrawals/pending  待处理提现
  - POST  /admin/wallet/withdrawals/{id}     标记提现单状态
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app.core.response import success
from app.api.deps import get_current_user, get_current_admin_user
from app.services.wallet_service import wallet_service
from app.services.kyc_service import kyc_service
from app.services.payment.stripe_connect_service import stripe_connect_service
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
# Stripe Connect onboarding 跳板 — 不带 auth, 公开访问。
# Stripe 在用户完成 onboarding 时把浏览器导到这里(必须 HTTPS),
# 我们渲染一段 HTML 立刻 JS 跳到 App 的 deep link, expo-web-browser
# 的 ASWebAuthenticationSession 看到 scheme 匹配会自动 dismiss。
connect_bridge_router = APIRouter(prefix="/connect", tags=["Stripe Connect / 跳板"])


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


# =============================== Stripe Connect ===============================


class ConnectOnboardRequest(BaseModel):
    country: Optional[str] = None  # ISO 2 字母
    email: Optional[str] = None
    # 调用方所在 App variant 的 URL scheme(avantregard / avantregardna),
    # 透传到跳板页, 决定 onboarding 完成后跳哪个 App。
    appScheme: Optional[str] = None


def _connect_status_payload(row: Optional[dict]) -> dict:
    """统一前端要的字段。row 为 None 表示用户尚未创建 Connect 账号。"""
    if not row:
        return {
            "exists": False,
            "status": "none",
            "stripeAccountId": None,
            "country": None,
            "defaultCurrency": None,
            "chargesEnabled": False,
            "payoutsEnabled": False,
            "detailsSubmitted": False,
            "requirementsCurrentlyDue": [],
            "requirementsDisabledReason": None,
        }
    return {
        "exists": True,
        "status": row.get("status"),
        "stripeAccountId": row.get("stripe_account_id"),
        "country": row.get("country"),
        "defaultCurrency": row.get("default_currency"),
        "chargesEnabled": bool(row.get("charges_enabled")),
        "payoutsEnabled": bool(row.get("payouts_enabled")),
        "detailsSubmitted": bool(row.get("details_submitted")),
        "requirementsCurrentlyDue": list(row.get("requirements_currently_due") or []),
        "requirementsDisabledReason": row.get("requirements_disabled_reason"),
    }


@wallet_router.get("/me/connect")
async def get_my_connect(user_id: int = Depends(get_current_user)):
    """返回当前用户的 Stripe Connect 账号状态。
    没创建过返回 exists=False, 前端展示"接入"入口。"""
    row = stripe_connect_service.get_account_row(user_id)
    return success(_connect_status_payload(row))


@wallet_router.post("/me/connect/onboard")
async def connect_onboard(
    body: ConnectOnboardRequest, user_id: int = Depends(get_current_user)
):
    """幂等创建 Connect 账号 + 签发 Onboarding URL。
    前端拿到 url 后用 WebBrowser.openAuthSessionAsync 打开;
    用户在 stripe.com 完成 KYC 后回到 return_url。"""
    try:
        stripe_connect_service.create_or_get_account(
            user_id, country=body.country, email=body.email
        )
        url = stripe_connect_service.create_account_link(
            user_id, app_scheme=_resolve_scheme(body.appScheme)
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    row = stripe_connect_service.get_account_row(user_id)
    return success({"url": url, "account": _connect_status_payload(row)})


@wallet_router.post("/me/connect/refresh")
async def connect_refresh(user_id: int = Depends(get_current_user)):
    """主动从 Stripe 拉账号状态。前端从 onboarding 跳回 App 时建议立刻调,
    防止 webhook 还没到就让用户看到 stale 状态。"""
    try:
        row = stripe_connect_service.refresh_account(user_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return success(_connect_status_payload(row))


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


# =============================== Connect bridge pages ===============================

# Stripe Account Link 强制 https, 不能直接给 avantregard:// scheme,
# 所以我们用一段超薄 HTML 做"https → 自定义 scheme"的中继。
#
# 流程:
#   1. App 调 /api/wallet/me/connect/onboard 拿到 stripe.com 的 onboarding URL
#   2. App 用 expo-web-browser.openAuthSessionAsync(url, "avantregard://connect/return")
#      打开。该 API 在 iOS 用 ASWebAuthenticationSession,Android 用 Custom Tabs,
#      只要看到 URL 跳到 redirectUrl(或其前缀)就 dismiss 并把控制权交回 App。
#   3. 用户在 stripe.com 完成 KYC 后, Stripe 把浏览器导到我们的
#      /api/connect/return(必须 https), 我们立刻 <script> 跳到
#      avantregard://connect/return, 浏览器看到 scheme 切换 → ASWebAuthenticationSession
#      监听到匹配 → dismiss → App 拿到 result.type === "success"。
#   4. App 调 refreshConnectStatus() 把最新状态拉一次。
#
# 注意:
#   - 这两个页面绝对不能放任何账号 / 用户敏感信息(URL 会被 stripe 跳转日志记录)
#   - 也不需要 query 参数;状态完全由后端按当前 user_id 重新拉
#   - <noscript> 路径给一个手动按钮做兜底,以防部分内嵌浏览器禁了 JS

_CONNECT_BRIDGE_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <style>
    body {{
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f7f7f7;
      color: #1a1a1a;
      padding: 24px;
    }}
    .card {{
      background: #fff;
      border-radius: 12px;
      padding: 28px 32px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      max-width: 420px;
      width: 100%;
      text-align: center;
    }}
    h1 {{ font-size: 18px; margin: 0 0 12px; }}
    p {{ font-size: 14px; color: #555; line-height: 1.5; margin: 0 0 16px; }}
    a.btn {{
      display: inline-block;
      padding: 12px 22px;
      background: #1a1a1a;
      color: #fff;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
    }}
    .muted {{ color: #888; font-size: 12px; margin-top: 18px; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>{title}</h1>
    <p>{message}</p>
    <a class="btn" href="{deep_link}">{cta}</a>
    <p class="muted">{footer}</p>
  </div>
  <script>
    // ASWebAuthenticationSession / Custom Tabs 看到这次跳转就会 dismiss。
    // setTimeout 给页面一个绘制周期,免得在某些浏览器上拦截被认定为弹窗。
    setTimeout(function() {{
      try {{ window.location.replace({deep_link_js}); }} catch (e) {{}}
    }}, 50);
  </script>
</body>
</html>"""


# 允许的 App scheme 白名单 — 防止有人恶意 ?scheme=javascript: 之类攻击。
# 当前两个 variant: avantregard(全球) / avantregardna(北美)。
_ALLOWED_APP_SCHEMES = {"avantregard", "avantregardna"}


def _resolve_scheme(scheme: Optional[str]) -> str:
    if scheme and scheme in _ALLOWED_APP_SCHEMES:
        return scheme
    return "avantregard"


def _bridge_html(*, title: str, message: str, cta: str, deep_link: str, footer: str) -> str:
    import json as _json
    return _CONNECT_BRIDGE_HTML.format(
        title=title,
        message=message,
        cta=cta,
        # href 上的 deep_link 来自白名单, 不会出现注入。
        deep_link=deep_link,
        # JS 字符串走 json.dumps 转义, 双保险。
        deep_link_js=_json.dumps(deep_link),
        footer=footer,
    )


@connect_bridge_router.get("/return", response_class=HTMLResponse)
async def connect_return_bridge(scheme: Optional[str] = None) -> HTMLResponse:
    """Stripe onboarding 完成后跳板页。
    用户完成 KYC → Stripe 跳到这里 → JS 自动跳 App。
    `?scheme=` 由 stripe_connect_service 在创建 AccountLink 时附带,
    告诉跳板页应该跳哪个 App variant 的 deep link。"""
    s = _resolve_scheme(scheme)
    return HTMLResponse(
        _bridge_html(
            title="Stripe setup complete",
            message="You can return to the Avant Regard app now.",
            cta="Open Avant Regard",
            deep_link=f"{s}://connect/return",
            footer="If the app doesn't open automatically, tap the button above.",
        )
    )


@connect_bridge_router.get("/refresh", response_class=HTMLResponse)
async def connect_refresh_bridge(scheme: Optional[str] = None) -> HTMLResponse:
    """Stripe onboarding URL 过期或用户中途取消时的跳板。"""
    s = _resolve_scheme(scheme)
    return HTMLResponse(
        _bridge_html(
            title="Continue Stripe setup",
            message="The previous link expired. Reopen Stripe verification from the Avant Regard app.",
            cta="Open Avant Regard",
            deep_link=f"{s}://connect/refresh",
            footer="Tap the button above to return to the app.",
        )
    )
