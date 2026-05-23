"""
卖家钱包服务。

负责：
  - 钱包余额读取（available + pending + 流水）
  - 「3 天锁定」资金的自动释放（cron 入口）
  - 提现申请（pending → processing → paid / rejected）
  - 与 order_service 的接口：buyer_confirm 后写一笔 pending_payout + 通知

资金账本守恒：
  - 任一时刻 sum(pending_payouts.locked.amount) == seller_balances.pending_cents
  - 任一时刻 sum(credit) - sum(debit) on settlement_ledger == seller_balances.available_cents + pending_cents
  - 提款打款（paid） 时把 available 从 seller_balances 扣到 total_withdrawn
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any

from app.db.supabase import get_supabase_admin, execute_with_retry
from app.schemas.wallet import (
    SellerBalance,
    PendingPayoutItem,
    LedgerEntry,
    WalletSummary,
    Withdrawal,
)


PENDING_RELEASE_DAYS = 3   # 「3 天后才可提款」业务规则
DEFAULT_CURRENCY = "CNY"


class WalletService:
    def __init__(self) -> None:
        self.db = get_supabase_admin()

    # ------------------------------------------------------------------
    # 余额 / 流水读取
    # ------------------------------------------------------------------

    @staticmethod
    def _format_balance(row: Optional[dict]) -> SellerBalance:
        if not row:
            return SellerBalance()
        return SellerBalance(
            ownerKind=row.get("owner_kind", "user"),
            ownerUserId=row.get("owner_user_id"),
            ownerMerchantId=row.get("owner_merchant_id"),
            availableCents=row.get("available_cents") or 0,
            pendingCents=row.get("pending_cents") or 0,
            totalPayoutCents=row.get("total_payout_cents") or 0,
            totalWithdrawnCents=row.get("total_withdrawn_cents") or 0,
            currency=row.get("currency", DEFAULT_CURRENCY),
            lastReleaseAt=row.get("last_release_at"),
            updatedAt=row.get("updated_at"),
        )

    def _get_balance_row(self, user_id: int) -> Optional[dict]:
        res = (
            self.db.table("seller_balances")
            .select("*")
            .eq("owner_kind", "user")
            .eq("owner_user_id", user_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def get_balance(self, user_id: int) -> SellerBalance:
        row = self._get_balance_row(user_id)
        if row is None:
            return SellerBalance(ownerKind="user", ownerUserId=user_id)
        return self._format_balance(row)

    def list_pending(self, user_id: int) -> List[PendingPayoutItem]:
        """卖家待解冻列表（pending_payouts.locked）。"""
        res = (
            self.db.table("pending_payouts")
            .select("*, orders!inner(order_no)")
            .eq("owner_user_id", user_id)
            .eq("status", "locked")
            .order("release_at", desc=False)
            .execute()
        )
        items: List[PendingPayoutItem] = []
        for r in res.data or []:
            order_no = None
            order_join = r.get("orders")
            if isinstance(order_join, dict):
                order_no = order_join.get("order_no")
            elif isinstance(order_join, list) and order_join:
                order_no = order_join[0].get("order_no")
            items.append(
                PendingPayoutItem(
                    id=r["id"],
                    orderId=r["order_id"],
                    orderNo=order_no,
                    amountCents=r["amount_cents"],
                    grossAmountCents=r.get("gross_amount_cents") or 0,
                    commissionCents=r.get("commission_cents") or 0,
                    currency=r.get("currency", DEFAULT_CURRENCY),
                    releaseAt=r["release_at"],
                    status=r.get("status", "locked"),
                    createdAt=r.get("created_at"),
                )
            )
        return items

    def list_ledger(
        self,
        user_id: int,
        *,
        page: int = 1,
        page_size: int = 30,
    ) -> Tuple[List[LedgerEntry], int]:
        q = (
            self.db.table("settlement_ledger")
            .select("*", count="exact")
            .eq("owner_user_id", user_id)
            .order("created_at", desc=True)
        )
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = execute_with_retry(lambda: q.execute(), label="wallet.ledger")
        items = [
            LedgerEntry(
                id=r["id"],
                orderId=r.get("order_id"),
                direction=r["direction"],
                amountCents=r["amount_cents"],
                currency=r.get("currency", DEFAULT_CURRENCY),
                reason=r.get("reason") or "",
                note=(r.get("metadata") or {}).get("note") if isinstance(r.get("metadata"), dict) else None,
                createdAt=r.get("created_at"),
            )
            for r in (res.data or [])
        ]
        return items, (res.count or 0)

    def summary(self, user_id: int) -> WalletSummary:
        balance = self.get_balance(user_id)

        # KYC + 默认账户
        from app.services.kyc_service import kyc_service
        kyc = kyc_service.get(user_id)
        kyc_status = kyc.status if kyc else "none"
        has_default = kyc_service.has_default_payout(user_id)

        # 未来 24h 释放
        now = datetime.utcnow()
        soon = (now + timedelta(hours=24)).isoformat()
        soon_res = (
            self.db.table("pending_payouts")
            .select("amount_cents")
            .eq("owner_user_id", user_id)
            .eq("status", "locked")
            .lte("release_at", soon)
            .execute()
        )
        upcoming = sum((r.get("amount_cents") or 0) for r in (soon_res.data or []))

        pending_count = (
            self.db.table("pending_payouts")
            .select("id", count="exact")
            .eq("owner_user_id", user_id)
            .eq("status", "locked")
            .execute()
            .count
            or 0
        )

        return WalletSummary(
            balance=balance,
            upcomingReleaseCents=upcoming,
            pendingCount=pending_count,
            kycStatus=kyc_status,
            hasDefaultPayoutAccount=has_default,
        )

    # ------------------------------------------------------------------
    # 写入：买家确认收货后调
    # ------------------------------------------------------------------

    def credit_pending_for_order(self, order_id: int) -> Optional[Dict[str, Any]]:
        """订单刚被买家确认 → 把卖家应收挂到 pending_cents（锁 3 天）。
        返回 pending_payouts 行（包含 release_at），供通知层用。
        """
        # 已经写过就直接幂等返回
        existing = (
            self.db.table("pending_payouts")
            .select("*")
            .eq("order_id", order_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            return existing.data[0]

        order_res = (
            self.db.table("orders")
            .select("*")
            .eq("id", order_id)
            .limit(1)
            .execute()
        )
        if not order_res.data:
            return None
        order = order_res.data[0]

        seller_user_id = order.get("seller_user_id")
        seller_merchant_id = order.get("seller_merchant_id")
        owner_user_id, owner_merchant_id = self._resolve_owner(
            seller_user_id, seller_merchant_id
        )
        if owner_user_id is None and owner_merchant_id is None:
            return None
        owner_kind = "user" if owner_user_id is not None else "merchant"

        now = datetime.utcnow()
        release_at = now + timedelta(days=PENDING_RELEASE_DAYS)

        payload = {
            "order_id": order_id,
            "owner_kind": owner_kind,
            "owner_user_id": owner_user_id,
            "owner_merchant_id": owner_merchant_id,
            "amount_cents": order["seller_payout_cents"],
            "commission_cents": order.get("commission_cents") or 0,
            "gross_amount_cents": order["paid_price_cents"],
            "currency": order.get("currency", DEFAULT_CURRENCY),
            "release_at": release_at.isoformat(),
            "status": "locked",
        }
        ins = self.db.table("pending_payouts").insert(payload).execute()
        row = ins.data[0] if ins.data else payload

        # 流水 + balance.pending_cents
        self._write_ledger(
            order_id=order_id,
            owner_kind=owner_kind,
            owner_user_id=owner_user_id,
            owner_merchant_id=owner_merchant_id,
            direction="credit",
            amount_cents=order["seller_payout_cents"],
            currency=order.get("currency", DEFAULT_CURRENCY),
            reason="pending_lock",
            metadata={
                "orderNo": order["order_no"],
                "grossCents": order["paid_price_cents"],
                "commissionCents": order.get("commission_cents") or 0,
                "releaseAt": release_at.isoformat(),
            },
        )
        self._bump_balance(
            owner_kind=owner_kind,
            owner_user_id=owner_user_id,
            owner_merchant_id=owner_merchant_id,
            currency=order.get("currency", DEFAULT_CURRENCY),
            pending_delta=order["seller_payout_cents"],
            total_payout_delta=order["seller_payout_cents"],
        )

        return row

    def reverse_pending_for_order(
        self, order_id: int, *, reason: str = "order_refund"
    ) -> Optional[Dict[str, Any]]:
        """订单发生退款 / 仲裁退给买家时把对应的 pending_payout 反向冲账。

        - 仅处理仍处于 `locked` 状态的 pending；如果已经 `released`（钱已进 available）
          则代表 3 天锁定期已过，需要在更高层（disputes 仲裁）单独处理可用余额回收。
        - 守恒：`pending_cents -= amount`，写一条 `refund_reverse` 的 debit 流水。
        - 幂等：如果该订单的 pending 已被 reverse 过，直接返回 None。
        """
        try:
            res = (
                self.db.table("pending_payouts")
                .select("*")
                .eq("order_id", order_id)
                .limit(1)
                .execute()
            )
        except Exception as e:
            print(f"[wallet] reverse_pending lookup failed: {e}")
            return None
        if not res.data:
            return None
        row = res.data[0]
        if row.get("status") != "locked":
            # 已 released / reversed：不再重复操作
            return row

        now_iso = datetime.utcnow().isoformat()
        try:
            self.db.table("pending_payouts").update(
                {"status": "reversed", "released_at": now_iso}
            ).eq("id", row["id"]).execute()
        except Exception as e:
            print(f"[wallet] mark pending reversed failed: {e}")
            return row

        try:
            self._bump_balance(
                owner_kind=row["owner_kind"],
                owner_user_id=row.get("owner_user_id"),
                owner_merchant_id=row.get("owner_merchant_id"),
                currency=row.get("currency", DEFAULT_CURRENCY),
                pending_delta=-row["amount_cents"],
                total_payout_delta=-row["amount_cents"],
            )
        except Exception as e:
            print(f"[wallet] bump on reverse failed: {e}")

        try:
            self._write_ledger(
                order_id=order_id,
                owner_kind=row["owner_kind"],
                owner_user_id=row.get("owner_user_id"),
                owner_merchant_id=row.get("owner_merchant_id"),
                direction="debit",
                amount_cents=row["amount_cents"],
                currency=row.get("currency", DEFAULT_CURRENCY),
                reason="refund_reverse",
                metadata={"pendingPayoutId": row["id"], "note": reason},
            )
        except Exception as e:
            print(f"[wallet] write reverse ledger failed: {e}")
        return row

    # ------------------------------------------------------------------
    # Cron：3 天到期 → 释放到 available_cents
    # ------------------------------------------------------------------

    def release_due_pending(self) -> int:
        """把 release_at <= now 的 pending_payouts 状态置为 released，
        同时 pending_cents -= amount, available_cents += amount。"""
        now = datetime.utcnow()
        now_iso = now.isoformat()
        res = (
            self.db.table("pending_payouts")
            .select("*")
            .eq("status", "locked")
            .lte("release_at", now_iso)
            .execute()
        )
        rows = res.data or []
        count = 0
        for r in rows:
            try:
                self.db.table("pending_payouts").update(
                    {"status": "released", "released_at": now_iso}
                ).eq("id", r["id"]).execute()
                self._write_ledger(
                    order_id=r.get("order_id"),
                    owner_kind=r["owner_kind"],
                    owner_user_id=r.get("owner_user_id"),
                    owner_merchant_id=r.get("owner_merchant_id"),
                    direction="credit",
                    amount_cents=r["amount_cents"],
                    currency=r.get("currency", DEFAULT_CURRENCY),
                    reason="pending_release",
                    metadata={"pendingPayoutId": r["id"]},
                )
                # pending → available（净额：pending -, available +）
                self._bump_balance(
                    owner_kind=r["owner_kind"],
                    owner_user_id=r.get("owner_user_id"),
                    owner_merchant_id=r.get("owner_merchant_id"),
                    currency=r.get("currency", DEFAULT_CURRENCY),
                    pending_delta=-r["amount_cents"],
                    available_delta=r["amount_cents"],
                    last_release_at=now_iso,
                )
                count += 1
            except Exception as e:
                print(f"[wallet] release pending {r['id']} failed: {e}")
        return count

    # ------------------------------------------------------------------
    # 提现
    # ------------------------------------------------------------------

    def create_withdrawal(
        self,
        user_id: int,
        *,
        amount_cents: int,
        payout_account_id: Optional[int] = None,
        note: Optional[str] = None,
    ) -> Withdrawal:
        from app.services.kyc_service import kyc_service

        kyc = kyc_service.get(user_id)
        if not kyc or kyc.status != "approved":
            raise ValueError("需要先完成实名认证")

        # 解析放款账户：未传则取默认
        account_row = None
        if payout_account_id is not None:
            res = (
                self.db.table("payout_accounts")
                .select("*")
                .eq("id", payout_account_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            account_row = res.data[0] if res.data else None
        if account_row is None:
            res = (
                self.db.table("payout_accounts")
                .select("*")
                .eq("user_id", user_id)
                .eq("is_default", True)
                .limit(1)
                .execute()
            )
            account_row = res.data[0] if res.data else None
        if account_row is None:
            raise ValueError("请先绑定放款账户")

        bal = self.get_balance(user_id)
        if amount_cents > bal.availableCents:
            raise ValueError("可提现余额不足")

        payload = {
            "user_id": user_id,
            "payout_account_id": account_row["id"],
            "amount_cents": amount_cents,
            "currency": bal.currency,
            "status": "pending",
            "note": note,
        }
        ins = self.db.table("wallet_withdrawals").insert(payload).execute()
        if not ins.data:
            raise RuntimeError("创建提现失败")
        row = ins.data[0]

        # 立即扣可用余额（防止用户重复发起）
        self._bump_balance(
            owner_kind="user",
            owner_user_id=user_id,
            owner_merchant_id=None,
            currency=bal.currency,
            available_delta=-amount_cents,
        )
        self._write_ledger(
            order_id=None,
            owner_kind="user",
            owner_user_id=user_id,
            owner_merchant_id=None,
            direction="debit",
            amount_cents=amount_cents,
            currency=bal.currency,
            reason="withdrawal",
            metadata={"withdrawalId": row["id"]},
        )
        return self._format_withdrawal(row, account_row)

    def list_withdrawals(
        self,
        user_id: int,
        *,
        page: int = 1,
        page_size: int = 30,
    ) -> Tuple[List[Withdrawal], int]:
        q = (
            self.db.table("wallet_withdrawals")
            .select("*, payout_accounts(*)", count="exact")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
        )
        offset = (page - 1) * page_size
        q = q.range(offset, offset + page_size - 1)
        res = execute_with_retry(lambda: q.execute(), label="wallet.withdrawals")
        items: List[Withdrawal] = []
        for r in res.data or []:
            acct = r.get("payout_accounts")
            if isinstance(acct, list):
                acct = acct[0] if acct else None
            items.append(self._format_withdrawal(r, acct))
        return items, (res.count or 0)

    def admin_update_withdrawal(
        self,
        withdrawal_id: int,
        *,
        admin_user_id: int,
        status: str,
        reject_reason: Optional[str] = None,
    ) -> Withdrawal:
        res = (
            self.db.table("wallet_withdrawals")
            .select("*")
            .eq("id", withdrawal_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise ValueError("提现单不存在")
        wd = res.data[0]
        if wd["status"] in {"paid", "rejected"}:
            raise ValueError("提现单已结束")

        update = {
            "status": status,
            "processed_by": admin_user_id,
            "processed_at": datetime.utcnow().isoformat(),
        }
        if status == "rejected":
            update["reject_reason"] = reject_reason
            # 退还可用余额
            self._bump_balance(
                owner_kind="user",
                owner_user_id=wd["user_id"],
                owner_merchant_id=None,
                currency=wd.get("currency", DEFAULT_CURRENCY),
                available_delta=wd["amount_cents"],
            )
            self._write_ledger(
                order_id=None,
                owner_kind="user",
                owner_user_id=wd["user_id"],
                owner_merchant_id=None,
                direction="credit",
                amount_cents=wd["amount_cents"],
                currency=wd.get("currency", DEFAULT_CURRENCY),
                reason="withdrawal_reverse",
                metadata={"withdrawalId": withdrawal_id, "reason": reject_reason},
            )
        elif status == "paid":
            # 累计已提
            self._bump_balance(
                owner_kind="user",
                owner_user_id=wd["user_id"],
                owner_merchant_id=None,
                currency=wd.get("currency", DEFAULT_CURRENCY),
                total_withdrawn_delta=wd["amount_cents"],
            )

        self.db.table("wallet_withdrawals").update(update).eq(
            "id", withdrawal_id
        ).execute()
        full = (
            self.db.table("wallet_withdrawals")
            .select("*, payout_accounts(*)")
            .eq("id", withdrawal_id)
            .limit(1)
            .execute()
        )
        row = full.data[0] if full.data else wd
        acct = row.get("payout_accounts")
        if isinstance(acct, list):
            acct = acct[0] if acct else None
        return self._format_withdrawal(row, acct)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _resolve_owner(
        self,
        seller_user_id: Optional[int],
        seller_merchant_id: Optional[int],
    ) -> Tuple[Optional[int], Optional[int]]:
        """归一化：买手店订单 → 取 merchant.user_id 当作钱包归属。

        当前 PRD：merchant 名下的销售也累计到 owner.user 钱包（同一自然人），
        简化提现流程。后续如果买手店要独立结算，再启用 owner_kind='merchant'。"""
        if seller_user_id:
            return seller_user_id, None
        if seller_merchant_id:
            try:
                from app.services.store_merchant_service import store_merchant_service
                merchant = store_merchant_service.get_merchant_by_id(seller_merchant_id)
                if merchant and getattr(merchant, "userId", None):
                    return merchant.userId, None
            except Exception:
                pass
        return None, None

    def _write_ledger(
        self,
        *,
        order_id: Optional[int],
        owner_kind: str,
        owner_user_id: Optional[int],
        owner_merchant_id: Optional[int],
        direction: str,
        amount_cents: int,
        currency: str,
        reason: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.db.table("settlement_ledger").insert(
            {
                "order_id": order_id,
                "owner_kind": owner_kind,
                "owner_user_id": owner_user_id,
                "owner_merchant_id": owner_merchant_id,
                "direction": direction,
                "amount_cents": amount_cents,
                "currency": currency,
                "reason": reason,
                "metadata": metadata or {},
            }
        ).execute()

    def _bump_balance(
        self,
        *,
        owner_kind: str,
        owner_user_id: Optional[int],
        owner_merchant_id: Optional[int],
        currency: str,
        available_delta: int = 0,
        pending_delta: int = 0,
        total_payout_delta: int = 0,
        total_withdrawn_delta: int = 0,
        last_release_at: Optional[str] = None,
    ) -> None:
        q = (
            self.db.table("seller_balances")
            .select("*")
            .eq("owner_kind", owner_kind)
        )
        if owner_user_id is not None:
            q = q.eq("owner_user_id", owner_user_id)
        else:
            q = q.eq("owner_merchant_id", owner_merchant_id)
        existing = q.limit(1).execute()

        if existing.data:
            cur = existing.data[0]
            patch: Dict[str, Any] = {
                "updated_at": datetime.utcnow().isoformat(),
            }
            if available_delta:
                patch["available_cents"] = (cur.get("available_cents") or 0) + available_delta
            if pending_delta:
                patch["pending_cents"] = (cur.get("pending_cents") or 0) + pending_delta
            if total_payout_delta:
                patch["total_payout_cents"] = (cur.get("total_payout_cents") or 0) + total_payout_delta
            if total_withdrawn_delta:
                patch["total_withdrawn_cents"] = (cur.get("total_withdrawn_cents") or 0) + total_withdrawn_delta
            if last_release_at:
                patch["last_release_at"] = last_release_at
            self.db.table("seller_balances").update(patch).eq("id", cur["id"]).execute()
        else:
            self.db.table("seller_balances").insert(
                {
                    "owner_kind": owner_kind,
                    "owner_user_id": owner_user_id,
                    "owner_merchant_id": owner_merchant_id,
                    "available_cents": max(0, available_delta),
                    "pending_cents": max(0, pending_delta),
                    "total_payout_cents": max(0, total_payout_delta),
                    "total_withdrawn_cents": max(0, total_withdrawn_delta),
                    "currency": currency,
                    "last_release_at": last_release_at,
                }
            ).execute()

    @staticmethod
    def _format_withdrawal(
        row: Dict[str, Any], account: Optional[Dict[str, Any]]
    ) -> Withdrawal:
        summary = None
        if account:
            no = account.get("account_no") or ""
            last4 = no[-4:] if len(no) >= 4 else no
            atype = account.get("account_type")
            label_map = {"bank": "银行卡", "alipay": "支付宝", "wechat": "微信"}
            summary = f"{label_map.get(atype, atype)} · {account.get('holder_name') or ''} · **** {last4}"
        return Withdrawal(
            id=row["id"],
            userId=row["user_id"],
            payoutAccountId=row.get("payout_account_id"),
            amountCents=row["amount_cents"],
            currency=row.get("currency", DEFAULT_CURRENCY),
            status=row.get("status", "pending"),
            note=row.get("note"),
            rejectReason=row.get("reject_reason"),
            processedAt=row.get("processed_at"),
            createdAt=row.get("created_at"),
            payoutAccountSummary=summary,
        )


wallet_service = WalletService()
