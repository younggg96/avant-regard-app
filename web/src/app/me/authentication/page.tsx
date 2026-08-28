"use client";

/**
 * /me/authentication — 鉴定服务（PRD 模块 5）。
 *
 * 对齐移动端 `frontend/src/screens/Trading/AuthenticationScreen.tsx`：
 * 选套餐 → 上传商品照片 → 下单 → 等专家报告。
 *
 * 下单后订单停在 pending_payment，扣款走移动端的 Stripe PaymentSheet，
 * 所以这里创建完就交接回 App，和商品订单、Plus 订阅一个处理方式。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import {
  Button,
  EmptyState,
  FormField,
  LoadingState,
  PageHeader,
  StatusBadge,
  TextInput,
} from "@/components/admin/ui";
import { MultiImagePicker } from "@/components/merchant/shared";
import { PayInAppNotice } from "@/components/trading/PayInAppNotice";
import { authenticationService } from "@/lib/services/aftersales";
import { formatPriceCents } from "@/lib/services/store-product";

const MAX_PHOTOS = 6;

export default function AuthenticationPage() {
  const { t } = useTranslation();
  const [packageCode, setPackageCode] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingPayment, setAwaitingPayment] = useState(false);

  const { data: packages, isLoading } = useSWR("auth-packages", () =>
    authenticationService.listPackages(),
  );

  const { data: orders, mutate: mutateOrders } = useSWR("auth-orders", () =>
    authenticationService.listMyOrders(),
  );

  const selectedCode = packageCode ?? packages?.[0]?.code ?? null;

  const submit = async () => {
    if (!selectedCode) {
      setError(t("trading.authentication.selectPackageFirst"));
      return;
    }
    if (photos.length === 0) {
      setError(t("trading.authentication.photoRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await authenticationService.createOrder({
        packageCode: selectedCode,
        itemPhotos: photos,
        brandName: brandName.trim() || undefined,
        note: note.trim() || undefined,
      });
      setPhotos([]);
      setBrandName("");
      setNote("");
      setAwaitingPayment(true);
      await mutateOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("trading.authentication.title")}
        description={t("trading.authentication.desc")}
      />

      {awaitingPayment && (
        <div className="mb-8">
          <PayInAppNotice
            title={t("trading.authentication.payInApp")}
            description={t("trading.authentication.payInAppDesc")}
            onRefresh={() => mutateOrders()}
          />
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("trading.authentication.selectPackage")}
        </h2>
        {isLoading ? (
          <LoadingState />
        ) : !packages || packages.length === 0 ? (
          <EmptyState message={t("trading.authentication.noPackages")} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {packages.map((pkg) => (
              <button
                key={pkg.code}
                type="button"
                onClick={() => setPackageCode(pkg.code)}
                className={`rounded border p-4 text-left transition-colors ${
                  selectedCode === pkg.code
                    ? "border-[var(--ink)] bg-[var(--canvas-raised)]"
                    : "border-[var(--border)] hover:border-[var(--ink-muted)]"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-label text-[13px] text-[var(--ink)]">
                    {pkg.name}
                  </p>
                  <p className="font-serif text-[16px] font-semibold text-[var(--ink)]">
                    {formatPriceCents(pkg.priceCents, pkg.currency)}
                  </p>
                </div>
                <p className="mt-1 font-label text-[11px] text-[color:var(--ink-muted)]">
                  {t("trading.authentication.sla", { hours: pkg.slaHours })}
                </p>
                {pkg.description && (
                  <p className="mt-2 font-label text-[12px] leading-relaxed text-[color:var(--ink-muted)]">
                    {pkg.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8 grid max-w-2xl gap-5">
        <FormField label={t("trading.authentication.photos")} required>
          <MultiImagePicker
            value={photos}
            onChange={setPhotos}
            max={MAX_PHOTOS}
            height={96}
          />
          <p className="font-label text-[11px] text-[color:var(--ink-muted)]">
            {t("trading.authentication.photosHint")}
          </p>
        </FormField>

        <FormField label={t("trading.publish.brand")}>
          <TextInput value={brandName} onChange={setBrandName} />
        </FormField>

        <FormField label={t("trading.authentication.note")}>
          <TextInput
            value={note}
            onChange={setNote}
            multiline
            rows={3}
            placeholder={t("trading.authentication.notePlaceholder")}
          />
        </FormField>

        {error && (
          <p className="font-label text-[12px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div>
          <Button onClick={submit} loading={submitting}>
            {t("trading.authentication.submit")}
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("trading.authentication.myOrders")}
        </h2>
        {!orders || orders.items.length === 0 ? (
          <EmptyState message={t("trading.authentication.emptyOrders")} />
        ) : (
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {orders.items.map((order) => (
              <li key={order.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-label text-[13px] text-[var(--ink)]">
                    {order.orderNo}
                  </p>
                  <div className="flex items-center gap-2">
                    <StatusBadge active={order.status === "completed"}>
                      {t(`trading.authentication.status.${order.status}`, {
                        defaultValue: order.status,
                      })}
                    </StatusBadge>
                    <StatusBadge active={order.result === "authentic"}>
                      {t(`trading.authentication.result.${order.result}`, {
                        defaultValue: order.result,
                      })}
                    </StatusBadge>
                  </div>
                </div>
                <p className="mt-1 font-label text-[11px] text-[color:var(--ink-muted)]">
                  {formatPriceCents(order.priceCents, order.currency)}
                  {order.createdAt &&
                    ` · ${order.createdAt.replace("T", " ").slice(0, 16)}`}
                </p>
                {order.expertReport && (
                  <p className="mt-2 font-label text-[12px] leading-relaxed text-[color:var(--ink-muted)]">
                    {order.expertReport}
                  </p>
                )}
                {order.certificateUrl && (
                  <a
                    href={order.certificateUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block font-label text-[12px] underline text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
                  >
                    {t("trading.authentication.certificate")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
