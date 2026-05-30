"""
Stripe Connect 服务 —— 卖家自动放款。

使用场景:
  - 卖家完成确认收货 + T+3 后, available_cents 转入卖家钱包;
  - 卖家发起 withdrawal -> 如果选了 stripe_connect 类型的 payout_account,
    本服务把 wallet_withdrawals 行翻译成一次 Stripe Payout (走 Connect),
    Stripe 把钱直接打到卖家绑定的银行卡 / 借记卡。

Express vs Standard vs Custom:
  - 我们用 Express, Stripe 托管 KYC + 银行账号验证 + dashboard,
    平台不存敏感信息(SSN / 国际 IBAN 等)。
  - Account onboarding 走 Account Link (短期 url),前端 WebView / 系统浏览器
    打开 -> 用户在 Stripe 域名完成材料 -> 跳回我们的 return_url。

资金路径(关键):
  - 我们目前是平台收单(charges 直接进平台账户), 然后通过 Connect Transfer
    把每次 withdrawal 的金额转到 connected account(separate transfer + payout
    模式)。这种模式下平台对资金有完全控制, 退款 / 扣回都好做。
  - 若未来想 destination charges 直接付给卖家(平台只收 fee), 这部分逻辑
    要把 Transfer 提前到 PaymentIntent.create 时(application_fee_amount +
    transfer_data.destination), 当前不做。

环境变量:
  - STRIPE_API_KEY (复用 stripe_provider 的)
  - STRIPE_CONNECT_REFRESH_URL  Onboarding 失败 / 过期重试时跳的 URL
  - STRIPE_CONNECT_RETURN_URL   Onboarding 完成回跳 URL
  - 没装 stripe SDK / 没 API_KEY → 所有方法 raise RuntimeError, 路由层
    必须捕获并 503 提示用户用其它放款方式。
"""
from __future__ import annotations

import os
from typing import Optional, Dict, Any, List
from datetime import datetime

from app.db.supabase import get_supabase_admin


try:  # pragma: no cover - optional dep
    import stripe  # type: ignore
    _HAS_STRIPE = True
except Exception:  # pragma: no cover
    stripe = None  # type: ignore
    _HAS_STRIPE = False


# 与 stripe_provider._STRIPE_API_VERSION 保持一致, 同时也对齐 Dashboard
# webhook endpoint 上选的 API 版本 (避免 account.updated payload 字段歧义)。
_STRIPE_API_VERSION = "2026-04-22.dahlia"


def _ensure_live() -> None:
    if not _HAS_STRIPE:
        raise RuntimeError("stripe SDK 未安装,无法使用 Connect")
    api_key = os.getenv("STRIPE_API_KEY")
    if not api_key:
        raise RuntimeError("STRIPE_API_KEY 未配置,无法使用 Connect")
    stripe.api_key = api_key  # type: ignore
    try:
        stripe.api_version = _STRIPE_API_VERSION  # type: ignore
    except Exception:
        pass


def _onboarding_urls(app_scheme: Optional[str] = None) -> Dict[str, str]:
    """读取 env 里的跳板基础 URL, 按需追加 ?scheme= 让跳板页知道
    要往哪个 App variant 的 deep link 跳(avantregard 还是 avantregardna)。

    base URL 必须是 https(Stripe 要求)。如果 env 没配, 用一个会 404
    的占位 — 这种情况下卖家不会真走到 onboarding 流程, 因为路由层
    Connect endpoints 在 STRIPE_API_KEY 缺失时已经 503。
    """
    base_refresh = os.getenv("STRIPE_CONNECT_REFRESH_URL") or ""
    base_return = os.getenv("STRIPE_CONNECT_RETURN_URL") or ""

    def _with_scheme(u: str) -> str:
        if not u or not app_scheme:
            return u
        sep = "&" if "?" in u else "?"
        return f"{u}{sep}scheme={app_scheme}"

    return {
        "refresh_url": _with_scheme(base_refresh),
        "return_url": _with_scheme(base_return),
    }


class StripeConnectService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

    # -----------------------------------------------------------------
    # Account 创建 / Onboarding link
    # -----------------------------------------------------------------

    def get_account_row(self, user_id: int) -> Optional[Dict[str, Any]]:
        res = (
            self.db.table("stripe_connect_accounts")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def create_or_get_account(
        self,
        user_id: int,
        *,
        country: Optional[str] = None,
        email: Optional[str] = None,
    ) -> Dict[str, Any]:
        """幂等创建 Express account。已经有的话直接返回当前行。

        country: ISO 2 字母, 影响 Stripe 验证项与默认币种。不传时让 Stripe
                 从用户 IP / browser 推断,但建议前端传明确值。
        email:   用户邮箱, Stripe 用于发 onboarding 提醒;不传时用占位。
        """
        existing = self.get_account_row(user_id)
        if existing:
            return existing

        _ensure_live()
        params: Dict[str, Any] = {
            "type": "express",
            # capabilities 决定该账号能做什么。transfers 必须开,
            # 才能让平台用 Transfer 把钱挪给它。
            "capabilities": {
                "transfers": {"requested": True},
            },
            # 平台承担退款 / 争议责任(默认行为, 显式声明便于审计)。
            "controller": {
                "stripe_dashboard": {"type": "express"},
                "fees": {"payer": "application"},
                "losses": {"payments": "application"},
            },
        }
        if country:
            params["country"] = country
        if email:
            params["email"] = email

        account = stripe.Account.create(**params)  # type: ignore
        row_payload = {
            "user_id": user_id,
            "stripe_account_id": account.id,
            "account_type": "express",
            "country": getattr(account, "country", None),
            "default_currency": getattr(account, "default_currency", None),
            "charges_enabled": bool(getattr(account, "charges_enabled", False)),
            "payouts_enabled": bool(getattr(account, "payouts_enabled", False)),
            "details_submitted": bool(getattr(account, "details_submitted", False)),
            "status": "pending",
            "last_synced_at": datetime.utcnow().isoformat(),
        }
        res = self.db.table("stripe_connect_accounts").insert(row_payload).execute()
        if not res.data:
            raise RuntimeError("写入 stripe_connect_accounts 失败")
        return res.data[0]

    def create_account_link(
        self, user_id: int, *, app_scheme: Optional[str] = None
    ) -> str:
        """生成短期 Onboarding URL, 前端用 WebBrowser 打开。
        Account Link 通常 24h 内有效, 多次签发互不影响。

        app_scheme: 调用方所在 App variant 的自定义 scheme(avantregard /
        avantregardna), 透传到跳板页的 ?scheme= 上, 让跳板页跳对 App。
        """
        row = self.get_account_row(user_id)
        if not row:
            raise ValueError("尚未创建 Connect 账号, 请先调 create_or_get_account")
        _ensure_live()
        urls = _onboarding_urls(app_scheme=app_scheme)
        link = stripe.AccountLink.create(  # type: ignore
            account=row["stripe_account_id"],
            refresh_url=urls["refresh_url"],
            return_url=urls["return_url"],
            type="account_onboarding",
        )
        return link.url

    # -----------------------------------------------------------------
    # 账号状态同步
    # -----------------------------------------------------------------

    def refresh_account(self, user_id: int) -> Dict[str, Any]:
        """主动从 Stripe 拉一次最新状态。前端 PayoutAccountsScreen 进入时调,
        防止 webhook 还没到就让用户看到 stale 状态。"""
        row = self.get_account_row(user_id)
        if not row:
            raise ValueError("尚未创建 Connect 账号")
        _ensure_live()
        acc = stripe.Account.retrieve(row["stripe_account_id"])  # type: ignore
        return self._sync_from_stripe(row, acc)

    def handle_account_updated_webhook(self, account_payload: Dict[str, Any]) -> None:
        """account.updated webhook 入口, 用 stripe_account_id 反查本地行,
        然后同步字段。找不到行直接忽略(可能是别的平台或测试数据)。"""
        sid = account_payload.get("id")
        if not sid:
            return
        res = (
            self.db.table("stripe_connect_accounts")
            .select("*")
            .eq("stripe_account_id", sid)
            .limit(1)
            .execute()
        )
        if not res.data:
            print(f"[connect] account.updated for unknown id {sid}", flush=True)
            return
        self._sync_from_stripe(res.data[0], account_payload)

    def _sync_from_stripe(self, row: Dict[str, Any], acc: Any) -> Dict[str, Any]:
        """把 stripe Account 对象 / dict 同步到本地行。计算 status:
          - details_submitted=False        → pending
          - payouts_enabled=False           → restricted
          - 都 ok                            → active
          - 已经被设为 disabled 不动(管理员手动)
        """
        def _get(obj: Any, k: str, default: Any = None) -> Any:
            if isinstance(obj, dict):
                return obj.get(k, default)
            return getattr(obj, k, default)

        details_submitted = bool(_get(acc, "details_submitted", False))
        charges_enabled = bool(_get(acc, "charges_enabled", False))
        payouts_enabled = bool(_get(acc, "payouts_enabled", False))
        country = _get(acc, "country")
        default_currency = _get(acc, "default_currency")

        requirements = _get(acc, "requirements") or {}
        if hasattr(requirements, "to_dict"):
            requirements = requirements.to_dict()
        currently_due = list(
            (requirements.get("currently_due") or []) if isinstance(requirements, dict) else []
        )
        disabled_reason = (
            requirements.get("disabled_reason") if isinstance(requirements, dict) else None
        )

        if row["status"] == "disabled":
            new_status = "disabled"
        elif not details_submitted:
            new_status = "pending"
        elif not payouts_enabled:
            new_status = "restricted"
        else:
            new_status = "active"

        update = {
            "country": country,
            "default_currency": default_currency,
            "charges_enabled": charges_enabled,
            "payouts_enabled": payouts_enabled,
            "details_submitted": details_submitted,
            "requirements_currently_due": currently_due,
            "requirements_disabled_reason": disabled_reason,
            "status": new_status,
            "last_synced_at": datetime.utcnow().isoformat(),
        }
        try:
            self.db.table("stripe_connect_accounts").update(update).eq(
                "id", row["id"]
            ).execute()
        except Exception as e:
            print(f"[connect] sync update failed: {e}", flush=True)
            return row
        prev_status = row["status"]
        row.update(update)

        # Connect onboarding 完成(刚翻到 active)→ 视同实名通过, 回写 seller_kyc,
        # 海外卖家免去再走一次 Stripe Identity(避免重复验证)。
        if new_status == "active" and prev_status != "active":
            try:
                from app.services.kyc_service import kyc_service
                kyc_service.mark_verified_via_connect(row["user_id"])
            except Exception as e:
                print(f"[connect] mark kyc via connect failed: {e}", flush=True)
        return row

    # -----------------------------------------------------------------
    # Withdrawal 走 Connect Transfer
    # -----------------------------------------------------------------

    def transfer_to_account(
        self,
        *,
        stripe_account_id: str,
        amount_cents: int,
        currency: str,
        withdrawal_id: int,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """从平台余额 Transfer 到 connected account。返回 Stripe Transfer 对象的简化 dict。

        说明:
          - Transfer 是平台 → connected account 的资金移动, 不直接到银行;
            到银行还需要 connected account 上 Payout(默认自动每日)。
          - 平台余额必须有钱(测试模式 Stripe 给 100 万额度;生产需要先收单)。
          - 同一 withdrawal 重复调用通过 idempotency_key 避免重复 Transfer。
        """
        _ensure_live()
        idem = idempotency_key or f"withdrawal_{withdrawal_id}_transfer"
        try:
            tr = stripe.Transfer.create(  # type: ignore
                amount=amount_cents,
                currency=currency.lower(),
                destination=stripe_account_id,
                metadata={"withdrawalId": str(withdrawal_id)},
                idempotency_key=idem,
            )
            return {
                "id": tr.id,
                "amount": tr.amount,
                "currency": tr.currency,
                "destination": tr.destination,
                "created": tr.created,
            }
        except Exception as e:  # pragma: no cover
            raise RuntimeError(f"stripe transfer failed: {e}") from e

    def list_recent_payouts(self, stripe_account_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """读 Connect 账号的近期 Payout, 给客服查"卖家说没收到钱"用。
        Connect API 默认 Payout 是 connected account 自己的, 我们用 stripe_account 头查。"""
        _ensure_live()
        try:
            res = stripe.Payout.list(  # type: ignore
                limit=limit, stripe_account=stripe_account_id
            )
        except Exception as e:  # pragma: no cover
            print(f"[connect] list payouts failed: {e}", flush=True)
            return []
        out: List[Dict[str, Any]] = []
        for p in (res.data or []):
            out.append({
                "id": p.id,
                "amount": p.amount,
                "currency": p.currency,
                "arrival_date": getattr(p, "arrival_date", None),
                "status": p.status,
            })
        return out


stripe_connect_service = StripeConnectService()
