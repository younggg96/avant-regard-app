"use client";

/**
 * 结算页的收货地址选择器。
 *
 * 对齐移动端 `frontend/src/components/AddressPickerSheet.tsx`：列出地址簿条目，
 * 选中即回传；地址簿为空时直接内嵌新增表单，避免把用户从结算流程里赶去 /me/addresses
 * 再走回来。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { Check } from "lucide-react";

import { Button, FormDialog, LoadingState } from "@/components/admin/ui";
import {
  AddressFields,
  EMPTY_ADDRESS_DRAFT,
  draftToCreateParams,
  isAddressDraftValid,
  type AddressDraft,
} from "@/components/trading/AddressFields";
import { addressService, type UserAddress } from "@/lib/services/address";

export function AddressPickerDialog({
  open,
  selectedId,
  onClose,
  onSelect,
}: {
  open: boolean;
  selectedId?: number | null;
  onClose: () => void;
  onSelect: (address: UserAddress) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR(
    open ? "my-addresses" : null,
    () => addressService.listMyAddresses(),
  );

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_ADDRESS_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addresses = data ?? [];
  const showForm = creating || (!isLoading && addresses.length === 0);

  const onCreate = async () => {
    if (!isAddressDraftValid(draft)) {
      setError(t("trading.addressRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await addressService.createAddress(
        draftToCreateParams(draft),
      );
      await mutate();
      setCreating(false);
      setDraft(EMPTY_ADDRESS_DRAFT);
      onSelect(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      title={t("trading.selectAddress")}
      onClose={onClose}
    >
      {isLoading ? (
        <LoadingState />
      ) : showForm ? (
        <>
          <AddressFields draft={draft} onChange={setDraft} />
          {error && (
            <p className="mt-3 font-label text-[12px] text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            {addresses.length > 0 && (
              <Button variant="secondary" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </Button>
            )}
            <Button onClick={onCreate} loading={saving}>
              {t("common.save")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <ul className="space-y-2">
            {addresses.map((address) => {
              const active = address.id === selectedId;
              return (
                <li key={address.id}>
                  <button
                    onClick={() => onSelect(address)}
                    className={`flex w-full items-start gap-3 rounded border p-3 text-left transition-colors ${
                      active
                        ? "border-[var(--ink)] bg-[var(--canvas-raised)]"
                        : "border-[var(--border)] hover:bg-[var(--canvas-raised)]"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-label text-[13px] font-semibold text-[var(--ink)]">
                          {address.receiverName}
                        </span>
                        <span className="font-label text-[12px] text-[color:var(--ink-muted)]">
                          {address.phone}
                        </span>
                        {address.isDefault && (
                          <span className="rounded-full bg-[var(--ink)] px-2 py-0.5 font-label text-[10px] text-[var(--canvas)]">
                            {t("trading.defaultBadge")}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block font-label text-[12px] leading-relaxed text-[color:var(--ink-muted)]">
                        {address.fullText}
                      </span>
                    </span>
                    {active && (
                      <Check size={16} className="mt-0.5 shrink-0 text-[var(--ink)]" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => setCreating(true)}>
              {t("trading.addAddress")}
            </Button>
          </div>
        </>
      )}
    </FormDialog>
  );
}
