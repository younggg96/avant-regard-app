"use client";

/**
 * 卖家发货弹窗。
 *
 * 对齐移动端 OrderDetailScreen 里的发货 sheet：承运方 + 运单号必填，
 * 出库凭证选填但强烈建议——出现售后争议时这是卖家唯一的自证材料。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Button,
  FormDialog,
  FormField,
  TextInput,
} from "@/components/admin/ui";
import { MultiImagePicker } from "@/components/merchant/shared";
import { orderService } from "@/lib/services/order";

const MAX_PROOF_PHOTOS = 4;

export function ShipDialog({
  open,
  orderId,
  onClose,
  onShipped,
}: {
  open: boolean;
  orderId: number;
  onClose: () => void;
  onShipped: () => void;
}) {
  const { t } = useTranslation();
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCarrier("");
    setTrackingNo("");
    setImages([]);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!carrier.trim() || !trackingNo.trim()) {
      setError(t("trading.shipRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await orderService.shipOrder(orderId, {
        carrier: carrier.trim(),
        trackingNo: trackingNo.trim(),
        images,
      });
      onShipped();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog open={open} title={t("trading.shipOrder")} onClose={close}>
      <div className="grid gap-4">
        <FormField label={t("trading.carrier")} required>
          <TextInput
            value={carrier}
            onChange={setCarrier}
            placeholder={t("trading.carrierPlaceholder")}
          />
        </FormField>

        <FormField label={t("trading.trackingNo")} required>
          <TextInput
            value={trackingNo}
            onChange={setTrackingNo}
            placeholder={t("trading.trackingNoPlaceholder")}
          />
        </FormField>

        <FormField label={t("trading.shipProof")}>
          <MultiImagePicker
            value={images}
            onChange={setImages}
            max={MAX_PROOF_PHOTOS}
            height={88}
          />
          <p className="font-label text-[11px] text-[color:var(--ink-muted)]">
            {t("trading.shipProofHint")}
          </p>
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
            {t("trading.confirmShip")}
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}
