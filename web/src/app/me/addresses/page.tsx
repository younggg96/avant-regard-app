"use client";

/**
 * /me/addresses — 收货地址簿。
 *
 * 对齐移动端 `frontend/src/screens/AddressBookScreen.tsx`：列表 + 新增/编辑弹窗，
 * 支持设为默认与删除。结算页通过 AddressPickerDialog 复用同一份数据。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { Pencil, Star, Trash2 } from "lucide-react";

import {
  Button,
  ConfirmDialog,
  EmptyState,
  FormDialog,
  LoadingState,
  PageHeader,
} from "@/components/admin/ui";
import {
  AddressFields,
  EMPTY_ADDRESS_DRAFT,
  addressToDraft,
  draftToCreateParams,
  isAddressDraftValid,
  type AddressDraft,
} from "@/components/trading/AddressFields";
import { addressService, type UserAddress } from "@/lib/services/address";

export default function AddressBookPage() {
  const { t } = useTranslation();
  const { data, isLoading, mutate } = useSWR("my-addresses", () =>
    addressService.listMyAddresses(),
  );

  const [editing, setEditing] = useState<UserAddress | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_ADDRESS_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserAddress | null>(null);
  const [deleting, setDeleting] = useState(false);

  const addresses = data ?? [];

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY_ADDRESS_DRAFT);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (address: UserAddress) => {
    setEditing(address);
    setDraft(addressToDraft(address));
    setError(null);
    setDialogOpen(true);
  };

  const onSave = async () => {
    if (!isAddressDraftValid(draft)) {
      setError(t("trading.addressRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = draftToCreateParams(draft);
      if (editing) {
        await addressService.updateAddress(editing.id, payload);
      } else {
        await addressService.createAddress(payload);
      }
      setDialogOpen(false);
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const onSetDefault = async (address: UserAddress) => {
    await addressService.setDefaultAddress(address.id);
    await mutate();
  };

  const onDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await addressService.deleteAddress(pendingDelete.id);
      setPendingDelete(null);
      await mutate();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("trading.addressBook")}
        actions={<Button onClick={openCreate}>{t("trading.addAddress")}</Button>}
      />

      {isLoading ? (
        <LoadingState />
      ) : addresses.length === 0 ? (
        <EmptyState message={t("trading.emptyAddresses")} />
      ) : (
        <ul className="space-y-3">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-label text-[14px] font-semibold text-[var(--ink)]">
                      {address.receiverName}
                    </span>
                    <span className="font-label text-[13px] text-[color:var(--ink-muted)]">
                      {address.phone}
                    </span>
                    {address.isDefault && (
                      <span className="rounded-full bg-[var(--ink)] px-2 py-0.5 font-label text-[11px] text-[var(--canvas)]">
                        {t("trading.defaultBadge")}
                      </span>
                    )}
                    {address.label && (
                      <span className="rounded-full border border-[var(--border)] px-2 py-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
                        {address.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 font-label text-[13px] leading-relaxed text-[color:var(--ink-muted)]">
                    {address.fullText}
                    {address.postalCode ? ` · ${address.postalCode}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {!address.isDefault && (
                    <button
                      onClick={() => onSetDefault(address)}
                      title={t("trading.setDefault")}
                      className="rounded p-1.5 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                    >
                      <Star size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(address)}
                    title={t("common.edit")}
                    className="rounded p-1.5 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setPendingDelete(address)}
                    title={t("common.delete")}
                    className="rounded p-1.5 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={dialogOpen}
        title={editing ? t("common.edit") : t("trading.addAddress")}
        onClose={() => setDialogOpen(false)}
      >
        <AddressFields draft={draft} onChange={setDraft} />
        {error && (
          <p className="mt-3 font-label text-[12px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialogOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onSave} loading={saving}>
            {t("common.save")}
          </Button>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("trading.confirmDeleteAddress")}
        message={pendingDelete?.fullText}
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
