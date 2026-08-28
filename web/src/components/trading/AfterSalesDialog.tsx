"use client";

/**
 * 买家申请售后弹窗。
 *
 * 对齐移动端 `DisputeOpenScreen`：选原因 + 补充说明。移动端还能传凭证图片，
 * web 上暂不做上传（凭证走客服会话补充），所以这里只提交 reason + description。
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, FormDialog, FormField, TextInput } from "@/components/admin/ui";
import {
  BUYER_DISPUTE_REASONS,
  disputeService,
  formatDisputeReason,
  type DisputeReason,
} from "@/lib/services/aftersales";

export function AfterSalesDialog({
  open,
  orderId,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  orderId: number;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<DisputeReason>(BUYER_DISPUTE_REASONS[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason(BUYER_DISPUTE_REASONS[0]);
      setDescription("");
      setError(null);
    }
  }, [open]);

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await disputeService.openDispute({
        orderId,
        reason,
        description: description.trim() || undefined,
      });
      onSubmitted?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      title={t("trading.afterSalesTitle")}
      onClose={onClose}
    >
      <div className="space-y-4">
        <FormField label={t("trading.selectReason")} required>
          <div className="flex flex-wrap gap-1.5 font-label text-[12px]">
            {BUYER_DISPUTE_REASONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setReason(option)}
                className={`rounded-full border px-3 py-1 transition-colors ${
                  reason === option
                    ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                    : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
                }`}
              >
                {formatDisputeReason(option, t)}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label={t("trading.describeIssue")}>
          <TextInput
            value={description}
            onChange={setDescription}
            multiline
            rows={4}
          />
        </FormField>
      </div>

      <p className="mt-3 font-label text-[12px] text-[color:var(--ink-muted)]">
        {t("trading.afterSalesHint")}
      </p>

      {error && (
        <p className="mt-3 font-label text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button onClick={onSubmit} loading={submitting}>
          {t("trading.submitRequest")}
        </Button>
      </div>
    </FormDialog>
  );
}
