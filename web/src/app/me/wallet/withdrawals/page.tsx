"use client";

/**
 * /me/wallet/withdrawals — 提现记录 + 发起提现。
 *
 * 合并了移动端的 WithdrawRequestScreen 与 WithdrawalHistoryScreen：
 * web 上有横向空间，把「发起」做成弹窗、记录直接列在下面，比两个页面顺手。
 *
 * 前置条件（实名通过 + 有默认收款账户 + 有可提现余额）由后端强校验，
 * 这里同样先拦一次并给出去哪补的指引，避免用户填完才被拒。
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import {
  Button,
  EmptyState,
  FormDialog,
  FormField,
  LoadingState,
  Pagination,
  PageHeader,
  StatusBadge,
  TextInput,
} from "@/components/admin/ui";
import { kycService } from "@/lib/services/kyc";
import {
  formatWithdrawalStatus,
  walletService,
} from "@/lib/services/wallet";
import {
  formatPriceCents,
  parsePriceInputToCents,
} from "@/lib/services/store-product";

const PAGE_SIZE = 30;

export default function WithdrawalsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: summary, mutate: mutateSummary } = useSWR(
    "wallet-summary",
    () => walletService.getSummary(),
  );

  const { data, isLoading, mutate } = useSWR(["withdrawals", page], () =>
    walletService.listMyWithdrawals(page, PAGE_SIZE),
  );

  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const availableCents = summary?.balance.availableCents ?? 0;
  const currency = summary?.balance.currency ?? "CNY";
  const canWithdraw =
    summary?.kycStatus === "approved" &&
    summary.hasDefaultPayoutAccount &&
    availableCents > 0;

  return (
    <div>
      <Link
        href="/me/wallet"
        className="font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
      >
        ← {t("trading.wallet.title")}
      </Link>
      <div className="mt-4">
        <PageHeader
          title={t("trading.wallet.withdrawalHistory")}
          description={t("trading.wallet.availableNow", {
            amount: formatPriceCents(availableCents, currency),
          })}
          actions={
            <Button onClick={() => setDialogOpen(true)} disabled={!canWithdraw}>
              {t("trading.wallet.withdraw")}
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message={t("trading.wallet.emptyWithdrawals")} />
      ) : (
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {items.map((w) => (
            <li key={w.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="font-serif text-[15px] text-[var(--ink)]">
                  {formatPriceCents(w.amountCents, w.currency)}
                </p>
                <p className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
                  {w.createdAt?.replace("T", " ").slice(0, 16)}
                  {w.payoutAccountSummary && ` · ${w.payoutAccountSummary}`}
                </p>
                {w.rejectReason && (
                  <p className="mt-1 font-label text-[11px] text-red-600 dark:text-red-400">
                    {w.rejectReason}
                  </p>
                )}
              </div>
              <StatusBadge active={w.status === "paid"}>
                {formatWithdrawalStatus(w.status, t)}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <WithdrawDialog
        open={dialogOpen}
        availableCents={availableCents}
        currency={currency}
        onClose={() => setDialogOpen(false)}
        onDone={() => {
          mutate();
          mutateSummary();
        }}
      />
    </div>
  );
}

function WithdrawDialog({
  open,
  availableCents,
  currency,
  onClose,
  onDone,
}: {
  open: boolean;
  availableCents: number;
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [amountInput, setAmountInput] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: accounts } = useSWR(open ? "payout-accounts" : null, () =>
    kycService.listPayoutAccounts(),
  );

  const options = accounts?.items ?? [];
  const selectedId =
    accountId ?? options.find((a) => a.isDefault)?.id ?? options[0]?.id ?? null;

  const amountCents = parsePriceInputToCents(amountInput);

  const close = () => {
    setAmountInput("");
    setAccountId(null);
    setNote("");
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!amountCents || amountCents <= 0) {
      setError(t("trading.wallet.invalidAmount"));
      return;
    }
    if (amountCents > availableCents) {
      setError(t("trading.wallet.exceedsAvailable"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await walletService.createWithdrawal({
        amountCents,
        payoutAccountId: selectedId ?? undefined,
        note: note.trim() || undefined,
      });
      onDone();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog open={open} title={t("trading.wallet.withdraw")} onClose={close}>
      <div className="grid gap-4">
        <FormField label={t("trading.wallet.amount")} required>
          <TextInput
            value={amountInput}
            onChange={setAmountInput}
            placeholder={t("trading.wallet.amountPlaceholder")}
          />
          <button
            type="button"
            onClick={() => setAmountInput(String(availableCents / 100))}
            className="font-label text-[11px] text-[color:var(--ink-muted)] underline hover:text-[var(--ink)]"
          >
            {t("trading.wallet.withdrawAll", {
              amount: formatPriceCents(availableCents, currency),
            })}
          </button>
        </FormField>

        <FormField label={t("trading.wallet.payoutAccount")} required>
          <div className="grid gap-2">
            {options.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => setAccountId(account.id)}
                className={`rounded border p-3 text-left transition-colors ${
                  selectedId === account.id
                    ? "border-[var(--ink)] bg-[var(--canvas-raised)]"
                    : "border-[var(--border)] hover:border-[var(--ink-muted)]"
                }`}
              >
                <p className="font-label text-[13px] text-[var(--ink)]">
                  {account.holderName} · {account.accountNoMasked}
                </p>
                {account.bankName && (
                  <p className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
                    {account.bankName}
                  </p>
                )}
              </button>
            ))}
            {options.length === 0 && (
              <Link
                href="/me/payout-accounts"
                className="font-label text-[12px] underline text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
              >
                {t("trading.wallet.needPayoutAccount")}
              </Link>
            )}
          </div>
        </FormField>

        <FormField label={t("trading.wallet.note")}>
          <TextInput value={note} onChange={setNote} />
        </FormField>

        {error && (
          <p className="font-label text-[12px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} loading={submitting}>
            {t("common.submit")}
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}
