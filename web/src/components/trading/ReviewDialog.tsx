"use client";

/**
 * 交易评价弹窗。
 *
 * 移动端 `TradeReviewScreen` 是三步向导（评分 → 维度 → 图片），web 上压成
 * 一个弹窗：星级 + 文字。评价是双盲的，双方都提交后才互相可见。
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";

import { Button, FormDialog, FormField, TextInput } from "@/components/admin/ui";
import { reviewService } from "@/lib/services/aftersales";

export function ReviewDialog({
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
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRating(5);
      setComment("");
      setError(null);
    }
  }, [open]);

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await reviewService.submitReview({
        orderId,
        rating,
        comment: comment.trim() || undefined,
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
    <FormDialog open={open} title={t("trading.reviewTitle")} onClose={onClose}>
      <div className="space-y-4">
        <FormField label={t("trading.rating")} required>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value}`}
                className="p-0.5 text-[var(--ink)] transition-opacity hover:opacity-70"
              >
                <Star
                  size={22}
                  fill={value <= rating ? "currentColor" : "none"}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
        </FormField>

        <FormField label={t("trading.reviewComment")}>
          <TextInput
            value={comment}
            onChange={setComment}
            multiline
            rows={4}
          />
        </FormField>
      </div>

      <p className="mt-3 font-label text-[12px] text-[color:var(--ink-muted)]">
        {t("trading.reviewsHidden")}
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
          {t("trading.submitReview")}
        </Button>
      </div>
    </FormDialog>
  );
}
