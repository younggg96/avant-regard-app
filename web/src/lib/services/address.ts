/**
 * Web 端收货地址簿 API 客户端。
 *
 * 对齐移动端 `frontend/src/services/addressService.ts`，后端入口 `/api/me/addresses`。
 *
 * 与订单的关系：结算页通过地址选择器挑一条地址，把快照传给 buyNow /
 * setShippingAddress。订单上的 shippingAddress 是「下单瞬间快照」，
 * 与地址簿条目解耦——事后改地址簿不会影响已下单的订单。
 */

import { apiClient } from "../api-client";

export interface UserAddress {
  id: number;
  receiverName: string;
  phone: string;
  country?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  detail?: string | null;
  fullText: string;
  postalCode?: string | null;
  label?: string | null;
  isDefault: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface UserAddressCreateParams {
  receiverName: string;
  phone: string;
  country?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  detail?: string | null;
  fullText?: string | null;
  postalCode?: string | null;
  label?: string | null;
  isDefault?: boolean;
}

export type UserAddressUpdateParams = Partial<UserAddressCreateParams>;

export const addressService = {
  listMyAddresses: async (): Promise<UserAddress[]> => {
    const res = await apiClient.get<{ items: UserAddress[] }>(
      "/api/me/addresses",
    );
    return res?.items ?? [];
  },

  getDefaultAddress: async (): Promise<UserAddress | null> => {
    const res = await apiClient.get<UserAddress | null>(
      "/api/me/addresses/default",
    );
    return res ?? null;
  },

  createAddress: (payload: UserAddressCreateParams) =>
    apiClient.post<UserAddress>("/api/me/addresses", payload),

  updateAddress: (id: number, payload: UserAddressUpdateParams) =>
    apiClient.put<UserAddress>(`/api/me/addresses/${id}`, payload),

  setDefaultAddress: (id: number) =>
    apiClient.post<UserAddress>(`/api/me/addresses/${id}/default`),

  deleteAddress: (id: number) =>
    apiClient.delete<void>(`/api/me/addresses/${id}`),
};

/**
 * 把地址簿条目转成订单需要的收货地址快照。
 * 后端只认这几个字段，多余字段会被忽略。
 */
export function toShippingAddressSnapshot(
  address: UserAddress,
): Record<string, unknown> {
  return {
    receiverName: address.receiverName,
    phone: address.phone,
    country: address.country ?? null,
    province: address.province ?? null,
    city: address.city ?? null,
    district: address.district ?? null,
    detail: address.detail ?? null,
    fullText: address.fullText,
    postalCode: address.postalCode ?? null,
  };
}

/** 从订单的 shippingAddress JSON 里安全地读一个字符串字段。 */
export function readAddressField(
  address: Record<string, unknown> | null | undefined,
  key: string,
): string {
  if (!address) return "";
  const value = address[key];
  return typeof value === "string" ? value : "";
}

/** 订单收货地址的单行展示文本。 */
export function formatShippingAddress(
  address: Record<string, unknown> | null | undefined,
): string {
  if (!address) return "";
  const full = readAddressField(address, "fullText");
  if (full) return full;
  return ["country", "province", "city", "district", "detail"]
    .map((key) => readAddressField(address, key))
    .filter(Boolean)
    .join(" ");
}
