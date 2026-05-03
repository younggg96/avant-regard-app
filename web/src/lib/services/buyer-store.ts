/**
 * Web 端买手店 API 客户端 — 客户端组件专用。
 *
 * 对齐 frontend/src/services/buyerStoreService.ts 的契约，让 iOS / Android / Web
 * 三端共用同一套后端行为：
 *   - 全量拉取 / 分页 / 视口 / 附近 / 收藏 / 风格
 *
 * 服务端渲染走 `web/src/lib/api.ts`（带 Next.js fetch cache），客户端交互
 * （过滤、点击、收藏、视口请求）走这里（apiClient 自动带 token + 刷新）。
 */

import { apiClient } from "../api-client";
import type { BuyerStore } from "../api";

export type { BuyerStore };

export interface BuyerStoreFilterParams {
  country?: string;
  city?: string;
  brand?: string;
  style?: string;
  openOnly?: boolean;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
  /**
   * 是否把已入驻商家店铺排在前面；仅 `/api/buyer-stores` 接受，
   * `/buyer-stores/all` 永远走入驻优先，对 caller 透明.
   */
  withMerchantFirst?: boolean;
}

export interface BuyerStoreListResponse {
  stores: BuyerStore[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface ViewportStoreParams {
  ne_lat: number;
  ne_lng: number;
  sw_lat: number;
  sw_lng: number;
  country?: string;
  city?: string;
  brand?: string;
  style?: string;
  styles?: string[];
  openOnly?: boolean;
  hasPhone?: boolean;
  searchQuery?: string;
}

export interface NearbyStoreParams {
  latitude: number;
  longitude: number;
  radius?: number;
}

// Backend caps `pageSize` at 200; getAllStores pages through in chunks.
const STORE_PAGE_MAX = 200;

function cleanFilters(
  params: BuyerStoreFilterParams,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (params.country) out.country = params.country;
  if (params.city) out.city = params.city;
  if (params.brand) out.brand = params.brand;
  if (params.style) out.style = params.style;
  if (params.openOnly) out.openOnly = true;
  if (params.searchQuery) out.searchQuery = params.searchQuery;
  if (params.page) out.page = params.page;
  if (params.pageSize) out.pageSize = params.pageSize;
  if (params.withMerchantFirst) out.withMerchantFirst = true;
  return out;
}

export async function getStoresPaginated(
  filters: BuyerStoreFilterParams = {},
): Promise<BuyerStoreListResponse> {
  return apiClient.get<BuyerStoreListResponse>("/api/buyer-stores", {
    ...cleanFilters(filters),
    page: filters.page ?? 1,
    pageSize: Math.min(filters.pageSize ?? 50, STORE_PAGE_MAX),
  });
}

/**
 * 拉完所有匹配的门店。用于全量过滤（不需要视口）。后端 `/api/buyer-stores`
 * 单次最多返回 200 条，需要循环分页.
 *
 * 默认启用 `withMerchantFirst=true` —— 让地图底部卡片和列表都把已入驻商家店铺
 * 排在前面，并在 store 上带回 `hasMerchant` 字段给 UI 打徽章.
 */
export async function getAllStores(
  filters: BuyerStoreFilterParams = {},
): Promise<BuyerStore[]> {
  const withMerchantFirst = filters.withMerchantFirst ?? true;
  const first = await getStoresPaginated({
    ...filters,
    withMerchantFirst,
    page: 1,
    pageSize: STORE_PAGE_MAX,
  });
  const all: BuyerStore[] = [...first.stores];
  const total = first.total ?? all.length;

  for (let page = 2; all.length < total; page++) {
    const next = await getStoresPaginated({
      ...filters,
      withMerchantFirst,
      page,
      pageSize: STORE_PAGE_MAX,
    });
    if (!next.stores?.length) break;
    all.push(...next.stores);
    if (next.stores.length < STORE_PAGE_MAX) break;
  }
  return all;
}

/**
 * "查看全部买手店"专用：走 `/api/buyer-stores/all` —— 后端永远入驻优先 +
 * 每条带 `hasMerchant`，给 list 视图打"已入驻"徽章.
 *
 * 对齐 `frontend/src/services/buyerStoreService.ts#getAllBuyerStores`.
 */
export async function getAllBuyerStores(
  filters: BuyerStoreFilterParams = {},
): Promise<BuyerStoreListResponse> {
  return apiClient.get<BuyerStoreListResponse>("/api/buyer-stores/all", {
    ...cleanFilters(filters),
    page: filters.page ?? 1,
    pageSize: Math.min(filters.pageSize ?? 30, STORE_PAGE_MAX),
  });
}

export async function getStoresInViewport(
  params: ViewportStoreParams,
): Promise<BuyerStore[]> {
  const result = await apiClient.post<{ stores: BuyerStore[]; total: number }>(
    "/api/buyer-stores/viewport",
    params,
  );
  return result.stores;
}

export async function getNearbyStores(
  location: { latitude: number; longitude: number },
  radius = 100,
): Promise<BuyerStore[]> {
  const result = await apiClient.post<{ stores: BuyerStore[]; total: number }>(
    "/api/buyer-stores/nearby",
    { latitude: location.latitude, longitude: location.longitude, radius },
  );
  return result.stores;
}

export async function getStoreCountries(): Promise<string[]> {
  const data = await apiClient.get<{ countries: string[] }>(
    "/api/buyer-stores/countries",
  );
  return data.countries ?? [];
}

export async function getStoreCities(country?: string): Promise<string[]> {
  const query = country ? { country } : undefined;
  const data = await apiClient.get<{ cities: string[] }>(
    "/api/buyer-stores/cities",
    query,
  );
  return data.cities ?? [];
}

export async function getStoreStyles(): Promise<string[]> {
  const data = await apiClient.get<{ styles: string[] }>(
    "/api/buyer-stores/styles",
  );
  return data.styles ?? [];
}

// ---------- 收藏 ----------
// 后端收藏接口把 userId 放在 query string，而不是 body。

export async function favoriteStore(
  storeId: string,
  userId: number,
): Promise<void> {
  await apiClient.post<void>(
    `/api/buyer-stores/${encodeURIComponent(storeId)}/favorite?userId=${userId}`,
  );
}

export async function unfavoriteStore(
  storeId: string,
  userId: number,
): Promise<void> {
  await apiClient.delete<void>(
    `/api/buyer-stores/${encodeURIComponent(storeId)}/favorite?userId=${userId}`,
  );
}

export async function getUserFavoriteStoreIds(
  userId: number,
  page = 1,
  pageSize = 500,
): Promise<{ storeIds: string[]; total: number }> {
  return apiClient.get<{ storeIds: string[]; total: number }>(
    "/api/buyer-stores/favorites/user",
    { userId, page, pageSize },
  );
}

// ---------- 评论 ----------
//
// Buyer store comment APIs。商家后台「我去过」打卡评论列表与回复都走这里:
//   - 商家在打卡评论里回复 = 创建一条 parent_id != null 的评论
//   - 用户和商家用同一个表 buyer_store_comments,通过 user_id 区分
// 后端 Pydantic 已经校验 userId == current_user_id, 所以前端必须显式传.

export interface CreateBuyerStoreCommentParams {
  userId: number;
  content: string;
  parentId?: number;
  replyToUserId?: number;
}

export async function createBuyerStoreComment(
  storeId: string,
  params: CreateBuyerStoreCommentParams,
): Promise<unknown> {
  return apiClient.post(
    `/api/buyer-stores/${encodeURIComponent(storeId)}/comments`,
    params,
  );
}

export interface BuyerStoreCommentReply {
  id: number;
  storeId: string;
  parentId: number;
  userId: number;
  username: string;
  userAvatar?: string;
  replyToUserId?: number;
  replyToUsername?: string;
  content: string;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function getBuyerStoreCommentReplies(
  commentId: number,
): Promise<BuyerStoreCommentReply[]> {
  const data = await apiClient.get<{ replies: BuyerStoreCommentReply[] }>(
    `/api/buyer-stores/comments/${commentId}/replies`,
  );
  return data.replies ?? [];
}

export function hasValidCoordinates(
  store: BuyerStore,
): store is BuyerStore & {
  coordinates: { latitude: number; longitude: number };
} {
  return (
    store.coordinates != null &&
    store.coordinates.latitude !== 0 &&
    store.coordinates.longitude !== 0 &&
    !Number.isNaN(store.coordinates.latitude) &&
    !Number.isNaN(store.coordinates.longitude)
  );
}
