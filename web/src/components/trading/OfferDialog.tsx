"use client";

/**
 * 出价 / 还价弹窗。
 *
 * 对齐移动端 `frontend/src/screens/Trading/OfferModal.tsx`：同一个弹窗承担
 * 「买家首次出价」和「对某条出价还价」两种模式，靠 `counterOfferId` 区分。
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, FormDialog, FormField, TextInput } from "@/components/admin/ui";
import { offerService, type Offer } from "@/lib/services/order";
import {
  formatPriceCents,
  parsePriceInputToCents,
} from "@/lib/services/store-product";

export function OfferDialog({
  open,
  productId,
  listingPriceCents,
  currency = "CNY",
  counterOfferId,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  productId: number;
  listingPriceCents?: number | null;
  currency?: string;
  /** 传入则为还价模式，针对这条出价回价。 */
  counterOfferId?: number | null;
  onClose: () => void;
  onSubmitted?: (offer: Offer) => void;
}) {
  const { t } = useTranslation();
  const [priceInput, setPriceInput] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPriceInput("");
      setMessage("");
      setError(null);
    }
  }, [open]);

  const onSubmit = async () => {
    const priceCents = parsePriceInputToCents(priceInput);
    if (priceCents == null || priceCents <= 0) {
      setError(t("trading.offerInvalid"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const offer = counterOfferId
        ? await offerService.counterOffer(counterOfferId, {
            priceCents,
            message: message.trim() || undefined,
          })
        : await offerService.createOffer({
            productId,
            priceCents,
            message: message.trim() || undefined,
          });
      onSubmitted?.(offer);
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
      title={counterOfferId ? t("trading.counterOffer") : t("trading.makeOffer")}
      onClose={onClose}
    >
      {listingPriceCents != null && (
        <p className="mb-4 font-label text-[12px] text-[color:var(--ink-muted)]">
          {t("trading.listingPrice")}{" "}
          <span className="text-[var(--ink)]">
            {formatPriceCents(listingPriceCents, currency)}
          </span>
        </p>
      )}

      <div className="space-y-4">
        <FormField label={t("trading.offerPrice")} required>
          <TextInput
            value={priceInput}
            onChange={setPriceInput}
            placeholder={t("trading.offerPlaceholder")}
            type="number"
          />
        </FormField>
        <FormField label={t("trading.offerMessage")}>
          <TextInput
            value={message}
            onChange={setMessage}
            multiline
            rows={3}
          />
        </FormField>
      </div>

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
          {t("trading.submitOffer")}
        </Button>
      </div>
    </FormDialog>
  );
}
