"use client";

/**
 * /me/wallet — 卖家钱包总览。
 *
 * 对齐移动端 `frontend/src/screens/Trading/MyWalletScreen.tsx`。
 *
 * 这里最需要讲清楚的是「可提现」与「待解冻」的区别：买家确认收货后货款先锁
 * 一段时间（防退款/纠纷），到期才释放到可提现余额。所以两个数字并列展示，
 * 待解冻列表逐条给出释放时间，避免卖家以为钱少了。
 */

import Link from "next/link";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import { EmptyState, LoadingState, PageHeader } from "@/components/admin/ui";
import { formatKycStatus, walletService } from "@/lib/services/wallet";
import { formatPriceCents } from "@/lib/services/store-product";

export default function WalletPage() {
  const { t } = useTranslation();

  const { data: summary, isLoading } = useSWR("wallet-summary", () =>
    walletService.getSummary(),
  );

  const { data: pending } = useSWR("wallet-pending", () =>
    walletService.listPendingPayouts(),
  );

  if (isLoading) return <LoadingState />;
  if (!summary) {
    return (
      <p className="font-label text-[13px] text-[color:var(--ink-muted)]">
        {t("common.loadFailed")}
      </p>
    );
  }

  const { balance } = summary;
  const currency = balance.currency || "CNY";
  const kycApproved = summary.kycStatus === "approved";
  const canWithdraw =
    kycApproved &&
    summary.hasDefaultPayoutAccount &&
    balance.availableCents > 0;

  return (
    <div>
      <PageHeader
        title={t("trading.wallet.title")}
        description={t("trading.wallet.desc")}
      />

      <section className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-6">
        <p className="font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("trading.wallet.available")}
        </p>
        <p className="mt-1 font-serif text-3xl font-semibold text-[var(--ink)]">
          {formatPriceCents(balance.availableCents, currency)}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4 font-label text-[12px] sm:grid-cols-4">
          <Stat
            label={t("trading.wallet.pending")}
            value={formatPriceCents(balance.pendingCents, currency)}
          />
          <Stat
            label={t("trading.wallet.upcomingRelease")}
            value={formatPriceCents(summary.upcomingReleaseCents, currency)}
          />
          <Stat
            label={t("trading.wallet.totalPayout")}
            value={formatPriceCents(balance.totalPayoutCents, currency)}
          />
          <Stat
            label={t("trading.wallet.totalWithdrawn")}
            value={formatPriceCents(balance.totalWithdrawnCents, currency)}
          />
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/me/wallet/withdrawals"
            className={`inline-flex items-center justify-center rounded px-4 py-2 font-label text-[13px] transition-opacity ${
              canWithdraw
                ? "bg-[var(--ink)] text-[var(--canvas)] hover:opacity-80"
                : "pointer-events-none border border-[var(--border)] text-[color:var(--ink-muted)] opacity-50"
            }`}
          >
            {t("trading.wallet.withdraw")}
          </Link>
          <NavLink
            href="/me/wallet/ledger"
            label={t("trading.wallet.ledgerTitle")}
          />
          <NavLink
            href="/me/wallet/withdrawals"
            label={t("trading.wallet.withdrawalHistory")}
          />
          <NavLink
            href="/me/payout-accounts"
            label={t("trading.wallet.payoutAccounts")}
          />
        </div>
      </section>

      {/* 提现前置条件没满足时，直接把缺什么和去哪补说清楚。 */}
      {!canWithdraw && (
        <section className="mt-4 rounded border border-[var(--border)] p-4">
          <p className="font-label text-[12px] font-semibold text-[var(--ink)]">
            {t("trading.wallet.withdrawBlocked")}
          </p>
          <ul className="mt-2 space-y-1 font-label text-[12px] text-[color:var(--ink-muted)]">
            {!kycApproved && (
              <li>
                {t("trading.wallet.needKyc", {
                  status: formatKycStatus(summary.kycStatus, t),
                })}{" "}
                <Link href="/me/kyc" className="underline hover:text-[var(--ink)]">
                  {t("trading.kyc.title")}
                </Link>
              </li>
            )}
            {!summary.hasDefaultPayoutAccount && (
              <li>
                {t("trading.wallet.needPayoutAccount")}{" "}
                <Link
                  href="/me/payout-accounts"
                  className="underline hover:text-[var(--ink)]"
                >
                  {t("trading.wallet.payoutAccounts")}
                </Link>
              </li>
            )}
            {balance.availableCents <= 0 && (
              <li>{t("trading.wallet.needBalance")}</li>
            )}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("trading.wallet.pendingList", { count: summary.pendingCount })}
        </h2>
        {!pending || pending.items.length === 0 ? (
          <EmptyState message={t("trading.wallet.emptyPending")} />
        ) : (
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {pending.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/me/orders/${item.orderId}`}
                    className="font-label text-[13px] text-[var(--ink)] hover:underline"
                  >
                    {item.orderNo ?? `#${item.orderId}`}
                  </Link>
                  <p className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
                    {t("trading.wallet.releaseAt", {
                      date: item.releaseAt.replace("T", " ").slice(0, 16),
                    })}
                  </p>
                </div>
                <p className="shrink-0 font-serif text-[15px] text-[var(--ink)]">
                  {formatPriceCents(item.amountCents, item.currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[color:var(--ink-muted)]">{label}</dt>
      <dd className="mt-0.5 font-serif text-[15px] text-[var(--ink)]">
        {value}
      </dd>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded border border-[var(--border)] px-4 py-2 font-label text-[13px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
    >
      {label}
    </Link>
  );
}
