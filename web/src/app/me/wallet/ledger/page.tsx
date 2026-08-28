"use client";

/**
 * /me/wallet/ledger — 资金流水。
 *
 * 对齐移动端 `frontend/src/screens/Trading/WalletLedgerScreen.tsx`。
 * credit / debit 用正负号与颜色区分，`reason` 走 i18n 映射，
 * 后端新增 reason 时未翻译的会原样透出而不是显示空白。
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import {
  EmptyState,
  LoadingState,
  Pagination,
  PageHeader,
} from "@/components/admin/ui";
import { formatLedgerReason, walletService } from "@/lib/services/wallet";
import { formatPriceCents } from "@/lib/services/store-product";

const PAGE_SIZE = 30;

export default function WalletLedgerPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useSWR(["wallet-ledger", page], () =>
    walletService.listLedger(page, PAGE_SIZE),
  );

  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div>
      <Link
        href="/me/wallet"
        className="font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
      >
        ← {t("trading.wallet.title")}
      </Link>
      <div className="mt-4">
        <PageHeader title={t("trading.wallet.ledgerTitle")} />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message={t("trading.wallet.emptyLedger")} />
      ) : (
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {items.map((entry) => {
            const credit = entry.direction === "credit";
            return (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-label text-[13px] text-[var(--ink)]">
                    {formatLedgerReason(entry.reason, t)}
                  </p>
                  <p className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
                    {entry.createdAt?.replace("T", " ").slice(0, 16)}
                    {entry.orderId != null && ` · #${entry.orderId}`}
                  </p>
                  {entry.note && (
                    <p className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
                      {entry.note}
                    </p>
                  )}
                </div>
                <p
                  className={`shrink-0 font-serif text-[15px] ${
                    credit
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-[var(--ink)]"
                  }`}
                >
                  {credit ? "+" : "−"}
                  {formatPriceCents(entry.amountCents, entry.currency)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
