"use client";

/**
 * /me/after-sales — 卖家售后处理台。
 *
 * 对齐移动端 `frontend/src/screens/Trading/SellerAfterSalesScreen.tsx`。
 * 买家提交的售后请求在这里逐条响应，两条出口：
 *   - 同意退款 → 订单立即退款，不进客服流程；
 *   - 拒绝并申诉 → 记录说明与凭证，转交客服仲裁。
 *
 * 买家侧的提交入口在订单详情的 AfterSalesDialog，两边刻意分开：
 * 同一个人不会同时以两种身份处理同一笔售后。
 */

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import {
  Button,
  EmptyState,
  FilterChips,
  FormDialog,
  FormField,
  LoadingState,
  PageHeader,
  StatusBadge,
  TextInput,
} from "@/components/admin/ui";
import { MultiImagePicker } from "@/components/merchant/shared";
import {
  disputeService,
  formatDisputeReason,
  formatDisputeStatus,
  type Dispute,
  type DisputeStatus,
  type SellerResponseAction,
} from "@/lib/services/aftersales";
import { formatPriceCents } from "@/lib/services/store-product";

const MAX_EVIDENCE_PHOTOS = 4;

const FILTER_STATUSES: DisputeStatus[] = [
  "open",
  "investigating",
  "resolved_refund",
];

export default function SellerAfterSalesPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<DisputeStatus | undefined>();
  const [active, setActive] = useState<Dispute | null>(null);

  const { data, isLoading, mutate } = useSWR(
    ["seller-disputes", status ?? "all"],
    () => disputeService.listSellerDisputes({ status, pageSize: 50 }),
  );

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title={t("trading.sellerAfterSales")}
        description={t("trading.sellerAfterSalesDesc")}
      />

      <div className="mb-5">
        <FilterChips
          options={FILTER_STATUSES.map((s) => ({
            value: s,
            label: formatDisputeStatus(s, t),
          }))}
          value={status}
          onChange={setStatus}
          allLabel={t("trading.filterAll")}
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message={t("trading.emptySellerAfterSales")} />
      ) : (
        <div className="space-y-3">
          {items.map((dispute) => (
            <DisputeCard
              key={dispute.id}
              dispute={dispute}
              onRespond={() => setActive(dispute)}
            />
          ))}
        </div>
      )}

      <RespondDialog
        dispute={active}
        onClose={() => setActive(null)}
        onDone={() => {
          setActive(null);
          mutate();
        }}
      />
    </div>
  );
}

function DisputeCard({
  dispute,
  onRespond,
}: {
  dispute: Dispute;
  onRespond: () => void;
}) {
  const { t } = useTranslation();

  const responded = !!dispute.sellerResponseAction;
  const canRespond =
    (dispute.status === "open" || dispute.status === "investigating") &&
    !responded &&
    dispute.openerRole === "buyer";

  return (
    <article className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-4">
      <div className="flex gap-4">
        <div className="size-16 shrink-0 overflow-hidden rounded bg-[var(--canvas-raised)]">
          {dispute.productImage && (
            <Image
              src={dispute.productImage}
              alt={dispute.productTitle ?? ""}
              width={64}
              height={64}
              className="size-full object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="font-label text-[13px] text-[var(--ink)]">
              {dispute.productTitle ?? `#${dispute.productId}`}
            </p>
            <StatusBadge active={dispute.status === "open"}>
              {formatDisputeStatus(dispute.status, t)}
            </StatusBadge>
          </div>

          {dispute.orderNo && (
            <p className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
              {t("trading.orderNo")} {dispute.orderNo}
            </p>
          )}

          {dispute.paidPriceCents != null && (
            <p className="mt-1 font-serif text-[14px] text-[var(--ink)]">
              {formatPriceCents(dispute.paidPriceCents, dispute.currency ?? "CNY")}
            </p>
          )}
        </div>
      </div>

      <dl className="mt-3 space-y-1 font-label text-[12px]">
        <div className="flex gap-2">
          <dt className="text-[color:var(--ink-muted)]">
            {t("trading.disputeReasonLabel")}
          </dt>
          <dd className="text-[var(--ink)]">
            {formatDisputeReason(dispute.reason, t)}
          </dd>
        </div>
      </dl>

      {dispute.description && (
        <p className="mt-2 font-label text-[12px] leading-relaxed text-[color:var(--ink-muted)]">
          {dispute.description}
        </p>
      )}

      {dispute.evidencePhotos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {dispute.evidencePhotos.map((url) => (
            <Image
              key={url}
              src={url}
              alt=""
              width={56}
              height={56}
              className="size-14 rounded object-cover"
            />
          ))}
        </div>
      )}

      {responded && (
        <div className="mt-3 rounded bg-[var(--canvas-raised)] p-3">
          <p className="font-label text-[12px] font-semibold text-[var(--ink)]">
            {t("trading.myResponse")}:{" "}
            {dispute.sellerResponseAction === "agree_refund"
              ? t("trading.actionAgreeRefund")
              : t("trading.actionReject")}
          </p>
          {dispute.sellerResponse && (
            <p className="mt-1 font-label text-[12px] text-[color:var(--ink-muted)]">
              {dispute.sellerResponse}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Link
          href={`/me/orders/${dispute.orderId}`}
          className="inline-flex items-center justify-center rounded border border-[var(--border)] px-3 py-1.5 font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
        >
          {t("trading.orderDetail")}
        </Link>
        {canRespond && (
          <Button size="sm" onClick={onRespond}>
            {t("trading.respond")}
          </Button>
        )}
      </div>
    </article>
  );
}

function RespondDialog({
  dispute,
  onClose,
  onDone,
}: {
  dispute: Dispute | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [action, setAction] = useState<SellerResponseAction>("agree_refund");
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const close = () => {
    setAction("agree_refund");
    setMessage("");
    setPhotos([]);
    setError(null);
    setConfirming(false);
    onClose();
  };

  const submit = async () => {
    if (!dispute) return;
    if (action === "reject" && !message.trim()) {
      setError(t("trading.responseMessageRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await disputeService.sellerRespond(dispute.id, {
        action,
        message: message.trim() || undefined,
        evidencePhotos: photos,
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
    <FormDialog
      open={!!dispute}
      title={t("trading.respondTitle")}
      onClose={close}
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <ActionOption
            selected={action === "agree_refund"}
            title={t("trading.actionAgreeRefund")}
            hint={t("trading.actionAgreeRefundHint")}
            onSelect={() => {
              setAction("agree_refund");
              setConfirming(false);
            }}
          />
          <ActionOption
            selected={action === "reject"}
            title={t("trading.actionReject")}
            hint={t("trading.actionRejectHint")}
            onSelect={() => {
              setAction("reject");
              setConfirming(false);
            }}
          />
        </div>

        <FormField
          label={
            action === "reject"
              ? t("trading.responseMessageRejectLabel")
              : t("trading.responseMessageLabel")
          }
          required={action === "reject"}
        >
          <TextInput
            value={message}
            onChange={setMessage}
            multiline
            rows={4}
            placeholder={t("trading.responseMessagePlaceholder")}
          />
        </FormField>

        <FormField label={t("trading.responseEvidence")}>
          <MultiImagePicker
            value={photos}
            onChange={setPhotos}
            max={MAX_EVIDENCE_PHOTOS}
            height={88}
          />
        </FormField>

        {error && (
          <p className="font-label text-[12px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {confirming ? (
          <div className="rounded border border-[var(--border)] bg-[var(--canvas-raised)] p-3">
            <p className="font-label text-[12px] text-[var(--ink)]">
              {action === "agree_refund"
                ? t("trading.agreeRefundConfirm", {
                    orderNo: dispute?.orderNo ?? "",
                  })
                : t("trading.rejectConfirm")}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={submit} loading={submitting}>
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => setConfirming(true)}>
              {t("common.submit")}
            </Button>
          </div>
        )}
      </div>
    </FormDialog>
  );
}

function ActionOption({
  selected,
  title,
  hint,
  onSelect,
}: {
  selected: boolean;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded border p-3 text-left transition-colors ${
        selected
          ? "border-[var(--ink)] bg-[var(--canvas-raised)]"
          : "border-[var(--border)] hover:border-[var(--ink-muted)]"
      }`}
    >
      <p className="font-label text-[13px] text-[var(--ink)]">{title}</p>
      <p className="mt-1 font-label text-[11px] leading-relaxed text-[color:var(--ink-muted)]">
        {hint}
      </p>
    </button>
  );
}
