/**
 * PRD 模块四 · 用户常用地址簿客户端 API。
 *
 * 后端入口:/api/me/addresses
 *
 * 与订单的关系:Checkout / OfferModal 等需要发货地址的场景,通过 AddressPickerSheet
 * 选一条地址,把 (receiverName, phone, fullText) 传给 buyNow / acceptOffer。
 * 订单 shipping_address_json 是「下单瞬间快照」,跟地址簿条目解耦。
 */
import { request } from "./http";

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

export interface UserAddressCreate {
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

export type UserAddressUpdate = Partial<UserAddressCreate>;

export async function listMyAddresses(): Promise<UserAddress[]> {
  const res = await request<{ items: UserAddress[] }>("/api/me/addresses");
  return res?.items ?? [];
}

export async function getDefaultAddress(): Promise<UserAddress | null> {
  const res = await request<UserAddress | null>("/api/me/addresses/default");
  return res ?? null;
}

export async function createAddress(
  payload: UserAddressCreate,
): Promise<UserAddress> {
  return request<UserAddress>("/api/me/addresses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAddress(
  id: number,
  payload: UserAddressUpdate,
): Promise<UserAddress> {
  return request<UserAddress>(`/api/me/addresses/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function setDefaultAddress(id: number): Promise<UserAddress> {
  return request<UserAddress>(`/api/me/addresses/${id}/default`, {
    method: "POST",
  });
}

export async function deleteAddress(id: number): Promise<void> {
  await request(`/api/me/addresses/${id}`, { method: "DELETE" });
}
