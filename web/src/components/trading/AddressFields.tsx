"use client";

/**
 * 收货地址表单字段，地址簿与结算页共用。
 *
 * 对齐移动端 `frontend/src/components/trading/TradingFormShared.tsx` 里的
 * `ShippingAddressFields`：字段集合、必填项和拼接 `fullText` 的规则保持一致，
 * 否则同一个账号在 App 和 Web 上存出来的地址格式会不一样。
 */

import { FormField, TextInput, Toggle } from "@/components/admin/ui";
import { useTranslation } from "react-i18next";
import type {
  UserAddress,
  UserAddressCreateParams,
} from "@/lib/services/address";

export interface AddressDraft {
  receiverName: string;
  phone: string;
  country: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  postalCode: string;
  label: string;
  isDefault: boolean;
}

export const EMPTY_ADDRESS_DRAFT: AddressDraft = {
  receiverName: "",
  phone: "",
  country: "",
  province: "",
  city: "",
  district: "",
  detail: "",
  postalCode: "",
  label: "",
  isDefault: false,
};

export function addressToDraft(address: UserAddress): AddressDraft {
  return {
    receiverName: address.receiverName ?? "",
    phone: address.phone ?? "",
    country: address.country ?? "",
    province: address.province ?? "",
    city: address.city ?? "",
    district: address.district ?? "",
    detail: address.detail ?? "",
    postalCode: address.postalCode ?? "",
    label: address.label ?? "",
    isDefault: address.isDefault ?? false,
  };
}

/** 收货人、手机号、详细地址为必填，与后端校验一致。 */
export function isAddressDraftValid(draft: AddressDraft): boolean {
  return Boolean(
    draft.receiverName.trim() && draft.phone.trim() && draft.detail.trim(),
  );
}

export function draftToCreateParams(
  draft: AddressDraft,
): UserAddressCreateParams {
  const fullText = [
    draft.country,
    draft.province,
    draft.city,
    draft.district,
    draft.detail,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

  return {
    receiverName: draft.receiverName.trim(),
    phone: draft.phone.trim(),
    country: draft.country.trim() || null,
    province: draft.province.trim() || null,
    city: draft.city.trim() || null,
    district: draft.district.trim() || null,
    detail: draft.detail.trim() || null,
    fullText,
    postalCode: draft.postalCode.trim() || null,
    label: draft.label.trim() || null,
    isDefault: draft.isDefault,
  };
}

export function AddressFields({
  draft,
  onChange,
  showDefaultToggle = true,
}: {
  draft: AddressDraft;
  onChange: (draft: AddressDraft) => void;
  showDefaultToggle?: boolean;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("trading.receiverName")} required>
          <TextInput
            value={draft.receiverName}
            onChange={(v) => set("receiverName", v)}
          />
        </FormField>
        <FormField label={t("trading.phone")} required>
          <TextInput
            value={draft.phone}
            onChange={(v) => set("phone", v)}
            type="tel"
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("trading.country")}>
          <TextInput value={draft.country} onChange={(v) => set("country", v)} />
        </FormField>
        <FormField label={t("trading.province")}>
          <TextInput
            value={draft.province}
            onChange={(v) => set("province", v)}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("trading.city")}>
          <TextInput value={draft.city} onChange={(v) => set("city", v)} />
        </FormField>
        <FormField label={t("trading.district")}>
          <TextInput
            value={draft.district}
            onChange={(v) => set("district", v)}
          />
        </FormField>
      </div>

      <FormField label={t("trading.detailAddress")} required>
        <TextInput
          value={draft.detail}
          onChange={(v) => set("detail", v)}
          multiline
          rows={2}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("trading.postalCode")}>
          <TextInput
            value={draft.postalCode}
            onChange={(v) => set("postalCode", v)}
          />
        </FormField>
        <FormField label={t("trading.addressLabel")}>
          <TextInput value={draft.label} onChange={(v) => set("label", v)} />
        </FormField>
      </div>

      {showDefaultToggle && (
        <Toggle
          checked={draft.isDefault}
          onChange={(v) => set("isDefault", v)}
          label={t("trading.setDefault")}
        />
      )}
    </div>
  );
}
