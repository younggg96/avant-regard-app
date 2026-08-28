"use client";

/**
 * /me/plus — Plus 会员。
 *
 * 对齐移动端 `frontend/src/screens/Trading/PlusSubscribeScreen.tsx`。
 * 权益：更低的成交抽佣 + 档案库深度分析。
 *
 * subscribe 只是建一条待支付订阅并返回 clientSecret，真正扣款要走
 * 移动端的 Stripe PaymentSheet，所以 web 上创建完就交接回 App。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import {
  Button,
  ConfirmDialog,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/components/admin/ui";
import { PayInAppNotice } from "@/components/trading/PayInAppNotice";
import { plusService, type PlusPlan } from "@/lib/services/archive";
import { formatPriceCents } from "@/lib/services/store-product";

const PLANS: PlusPlan[] = ["monthly", "annual"];

export default function PlusPage() {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<PlusPlan>("annual");
  const [pendingPayment, setPendingPayment] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: status, isLoading, mutate } = useSWR("plus-status", () =>
    plusService.getStatus(),
  );

  if (isLoading) return <LoadingState />;

  const active = status?.isActive ?? false;
  const subscription = status?.subscription;

  const subscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      await plusService.subscribe(plan);
      setPendingPayment(true);
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!subscription) return;
    setBusy(true);
    setError(null);
    try {
      await plusService.cancel(subscription.id);
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusy(false);
      setCancelOpen(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("trading.plus.title")}
        description={t("trading.plus.desc")}
        actions={
          active ? <StatusBadge active>{t("trading.plus.active")}</StatusBadge> : null
        }
      />

      <section className="mb-8 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-5">
        <h2 className="font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("trading.plus.benefits")}
        </h2>
        <ul className="mt-3 space-y-2 font-label text-[13px] text-[color:var(--ink-muted)]">
          <li>
            {t("trading.plus.benefitCommission", {
              rate: ((status?.commissionRateBps ?? 100) / 100).toFixed(2),
            })}
          </li>
          <li>{t("trading.plus.benefitAnalytics")}</li>
          <li>{t("trading.plus.benefitPriority")}</li>
        </ul>
      </section>

      {active && subscription ? (
        <section className="rounded border border-[var(--border)] p-5">
          <dl className="grid gap-3 font-label text-[12px] sm:grid-cols-3">
            <div>
              <dt className="text-[color:var(--ink-muted)]">
                {t("trading.plus.currentPlan")}
              </dt>
              <dd className="mt-0.5 text-[var(--ink)]">
                {t(`trading.plus.plan_${subscription.plan}`, {
                  defaultValue: subscription.plan,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-[color:var(--ink-muted)]">
                {t("trading.plus.periodEnd")}
              </dt>
              <dd className="mt-0.5 text-[var(--ink)]">
                {subscription.periodEnd?.slice(0, 10)}
              </dd>
            </div>
            <div>
              <dt className="text-[color:var(--ink-muted)]">
                {t("trading.plus.autoRenew")}
              </dt>
              <dd className="mt-0.5 text-[var(--ink)]">
                {subscription.autoRenew ? t("common.yes") : t("common.no")}
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <Button
              variant="secondary"
              onClick={() => setCancelOpen(true)}
              disabled={busy}
            >
              {t("trading.plus.cancel")}
            </Button>
          </div>
        </section>
      ) : pendingPayment ? (
        <PayInAppNotice
          title={t("trading.plus.payInApp")}
          description={t("trading.plus.payInAppDesc")}
          onRefresh={() => mutate()}
        />
      ) : (
        <section>
          <div className="grid gap-3 sm:grid-cols-2">
            {PLANS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlan(p)}
                className={`rounded border p-5 text-left transition-colors ${
                  plan === p
                    ? "border-[var(--ink)] bg-[var(--canvas-raised)]"
                    : "border-[var(--border)] hover:border-[var(--ink-muted)]"
                }`}
              >
                <p className="font-label text-[13px] text-[var(--ink)]">
                  {t(`trading.plus.plan_${p}`)}
                </p>
                <p className="mt-1 font-label text-[11px] text-[color:var(--ink-muted)]">
                  {t(`trading.plus.planHint_${p}`)}
                </p>
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-4 font-label text-[12px] text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="mt-5">
            <Button onClick={subscribe} loading={busy}>
              {t("trading.plus.subscribe")}
            </Button>
          </div>
        </section>
      )}

      {error && active && (
        <p className="mt-4 font-label text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title={t("trading.plus.cancel")}
        message={t("trading.plus.cancelWarning", {
          date: subscription?.periodEnd?.slice(0, 10) ?? "",
          price: formatPriceCents(
            subscription?.priceCents ?? 0,
            subscription?.currency,
          ),
        })}
        loading={busy}
        onConfirm={cancel}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}
