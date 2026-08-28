"use client";

/**
 * /me/payout-accounts — 收款账户。
 *
 * 对齐移动端 `frontend/src/screens/Trading/PayoutAccountsScreen.tsx`，两套并存：
 *   - 国内：银行卡 / 支付宝 / 微信，账号存在我们这边（脱敏展示）；
 *   - 海外：Stripe Connect Express，KYC 与银行信息都由 Stripe 托管，
 *     我们只拿一个账号状态。
 *
 * Connect 的 onboarding 回跳地址是后端配的、指向移动端跳板页的，
 * web 上没法自动跳回来，所以这里在新标签页打开，并在窗口重新获得焦点时
 * 主动同步一次状态。
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import {
  Button,
  ConfirmDialog,
  EmptyState,
  FormDialog,
  FormField,
  LoadingState,
  PageHeader,
  StatusBadge,
  TextInput,
} from "@/components/admin/ui";
import {
  formatPayoutAccountType,
  kycService,
  PAYOUT_ACCOUNT_TYPES,
  type PayoutAccount,
  type PayoutAccountType,
} from "@/lib/services/kyc";
import { walletService } from "@/lib/services/wallet";

export default function PayoutAccountsPage() {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PayoutAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR("payout-accounts", () =>
    kycService.listPayoutAccounts(),
  );

  const accounts = data?.items ?? [];

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(false);
    }
  };

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
          title={t("trading.wallet.payoutAccounts")}
          description={t("trading.kyc.payoutAccountsDesc")}
          actions={
            <Button onClick={() => setCreating(true)}>
              {t("trading.kyc.addAccount")}
            </Button>
          }
        />
      </div>

      {error && (
        <p className="mb-4 font-label text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isLoading ? (
        <LoadingState />
      ) : accounts.length === 0 ? (
        <EmptyState message={t("trading.kyc.emptyAccounts")} />
      ) : (
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-label text-[13px] text-[var(--ink)]">
                    {account.holderName} · {account.accountNoMasked}
                  </p>
                  {account.isDefault && (
                    <StatusBadge active>{t("trading.defaultBadge")}</StatusBadge>
                  )}
                </div>
                <p className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
                  {formatPayoutAccountType(account.accountType, t)}
                  {account.bankName && ` · ${account.bankName}`}
                </p>
              </div>
              <div className="flex gap-2">
                {!account.isDefault && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      run(() => kycService.setDefaultPayoutAccount(account.id))
                    }
                  >
                    {t("trading.setDefault")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() => setDeleteTarget(account)}
                >
                  {t("common.delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConnectSection />

      <AddAccountDialog
        open={creating}
        onClose={() => setCreating(false)}
        onDone={() => mutate()}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("trading.kyc.confirmDeleteAccount")}
        message={deleteTarget?.accountNoMasked}
        loading={busy}
        onConfirm={() => {
          const target = deleteTarget;
          if (!target) return;
          run(() => kycService.deletePayoutAccount(target.id)).then(() =>
            setDeleteTarget(null),
          );
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ConnectSection() {
  const { t } = useTranslation();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: status, mutate } = useSWR("connect-status", () =>
    walletService.getConnectStatus(),
  );

  // 用户在新标签页完成 Stripe 托管流程后回到这里，主动同步一次状态。
  useEffect(() => {
    const onFocus = () => {
      walletService
        .refreshConnectStatus()
        .then((next) => mutate(next, { revalidate: false }))
        .catch(() => undefined);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [mutate]);

  const startOnboarding = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await walletService.startConnectOnboarding();
      window.open(res.url, "_blank", "noopener,noreferrer");
      mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setStarting(false);
    }
  };

  return (
    <section className="mt-8 rounded border border-[var(--border)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-label text-[13px] font-semibold text-[var(--ink)]">
            {t("trading.kyc.connectTitle")}
          </h2>
          <p className="mt-1 font-label text-[12px] leading-relaxed text-[color:var(--ink-muted)]">
            {t("trading.kyc.connectDesc")}
          </p>
        </div>
        {status && (
          <StatusBadge active={status.status === "active"}>
            {t(`trading.kyc.connectStatus.${status.status}`)}
          </StatusBadge>
        )}
      </div>

      {status && status.requirementsCurrentlyDue.length > 0 && (
        <p className="mt-3 font-label text-[11px] text-[color:var(--ink-muted)]">
          {t("trading.kyc.connectRequirements", {
            items: status.requirementsCurrentlyDue.join(", "),
          })}
        </p>
      )}

      {error && (
        <p className="mt-3 font-label text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={startOnboarding} loading={starting}>
          {status?.exists
            ? t("trading.kyc.continueOnboarding")
            : t("trading.kyc.startOnboarding")}
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            walletService
              .refreshConnectStatus()
              .then((next) => mutate(next, { revalidate: false }))
          }
        >
          {t("trading.refreshStatus")}
        </Button>
      </div>

      <p className="mt-3 font-label text-[11px] text-[color:var(--ink-muted)]">
        {t("trading.kyc.connectNewTabHint")}
      </p>
    </section>
  );
}

function AddAccountDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [accountType, setAccountType] = useState<PayoutAccountType>("bank");
  const [holderName, setHolderName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setAccountType("bank");
    setHolderName("");
    setAccountNo("");
    setBankName("");
    setBranchName("");
    setIsDefault(true);
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!holderName.trim() || !accountNo.trim()) {
      setError(t("trading.kyc.accountRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await kycService.createPayoutAccount({
        accountType,
        holderName: holderName.trim(),
        accountNo: accountNo.trim(),
        bankName: bankName.trim() || undefined,
        branchName: branchName.trim() || undefined,
        isDefault,
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
    <FormDialog open={open} title={t("trading.kyc.addAccount")} onClose={close}>
      <div className="grid gap-4">
        <FormField label={t("trading.kyc.accountTypeLabel")} required>
          <div className="flex flex-wrap gap-1.5">
            {PAYOUT_ACCOUNT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setAccountType(type)}
                className={`rounded-full border px-3 py-1 font-label text-[12px] transition-colors ${
                  accountType === type
                    ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                    : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
                }`}
              >
                {formatPayoutAccountType(type, t)}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label={t("trading.kyc.holderName")} required>
          <TextInput value={holderName} onChange={setHolderName} />
        </FormField>

        <FormField label={t("trading.kyc.accountNo")} required>
          <TextInput value={accountNo} onChange={setAccountNo} />
        </FormField>

        {accountType === "bank" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("trading.kyc.bankName")}>
              <TextInput value={bankName} onChange={setBankName} />
            </FormField>
            <FormField label={t("trading.kyc.branchName")}>
              <TextInput value={branchName} onChange={setBranchName} />
            </FormField>
          </div>
        )}

        <label className="flex items-center gap-2 font-label text-[13px]">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          {t("trading.setDefault")}
        </label>

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
            {t("common.save")}
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}
