/**
 * Web 端 C2C 单品（listing）API 客户端。
 *
 * 对齐移动端 `frontend/src/services/storeProductService.ts` 里 `/api/listings`
 * 与 `/api/sellers/*` 两段，和 `store-product.ts` 里的买手店商品是两条线：
 *   - 买手店走 `/api/store-merchants/{merchantId}/products`，只有商家能调；
 *   - 单品走 `/api/listings`，个人卖家（sellerKind=individual）也能调，
 *     并采用 draft → reviewing → active → frozen → sold 状态机。
 *
 * 状态切换刻意不做成 PATCH status：提交审核 / 上下架各有独立端点，
 * 免得绕过后端的完整度与实名校验。
 */

import { apiClient } from "../api-client";
import type { ProductStatus, StoreProduct } from "./store-product";

export type SellerKind = "merchant" | "individual";

/** PRD 模块一：成色枚举。 */
export type ProductCondition = "BNWT" | "NEW_99" | "NEW_95" | "USED_8" | "FLAW";

export type ShippingFeeMode = "cod" | "free";

/**
 * PRD 1.3 规范化 7 视角图。
 *
 * 领标 / 洗标各拆正反两张，避免只拍到一面漏掉成分与产地信息。
 * 7 个槽位都是提交审核的硬性前置条件。
 */
export interface PhotoAngles {
  front?: string | null;
  back?: string | null;
  wash_label?: string | null;
  wash_label_back?: string | null;
  brand_label?: string | null;
  brand_label_back?: string | null;
  flaw?: string | null;
  extras?: string[];
}

/** 单品比买手店商品多一批 PRD 字段，用扩展而不是改 StoreProduct 以免影响商家侧。 */
export interface Listing extends StoreProduct {
  categoryKind?: string | null;
  size?: string | null;
  color?: string | null;
  condition?: ProductCondition | null;
  conditionNote?: string | null;
  photoAngles?: PhotoAngles | null;
  originalShowId?: string | null;
  originalAcquiredAt?: string | null;
  styleName?: string | null;
  accessoriesNote?: string | null;
  shipFromCountry?: string | null;
  shipFromState?: string | null;
  shipFromCity?: string | null;
  shippingFeeMode?: ShippingFeeMode | null;
  /** 审核驳回原因，status=rejected 时有值。 */
  rejectedReason?: string | null;
  /** 被买家锁定（frozen）到什么时候。 */
  frozenUntil?: string | null;
  soldAt?: string | null;
  wantCount?: number;
  favoriteCount?: number;
  completenessScore?: number;
  /** 平台抽佣率，单位 bps；100 = 1%。 */
  commissionRateBps?: number;
}

export interface ListingListResponse {
  products: Listing[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListingPatchParams {
  categoryId?: number | null;
  /** PRD 6 大类名（外套/上衣/裤装/鞋履/包袋/配饰），交易大厅按此筛选。 */
  categoryKind?: string | null;
  title?: string;
  description?: string;
  brand?: string;
  images?: string[];
  priceCents?: number;
  currency?: string;
  discountPriceCents?: number | null;
  isNew?: boolean;
  tags?: string[];
  size?: string;
  color?: string;
  condition?: ProductCondition;
  conditionNote?: string;
  originalShowId?: string | null;
  originalAcquiredAt?: string | null;
  acceptOffer?: boolean;
  photoAngles?: PhotoAngles;
  styleName?: string | null;
  accessoriesNote?: string | null;
  shipFromCountry?: string | null;
  shipFromState?: string | null;
  shipFromCity?: string | null;
  shippingFeeMode?: ShippingFeeMode;
}

export interface ListingCreateParams extends ListingPatchParams {
  title: string;
  priceCents: number;
  sellerKind: SellerKind;
}

export type ListingsStatusSummary = Record<
  "active" | "draft" | "reviewing" | "sold" | "offline" | "rejected" | "frozen",
  number
>;

export interface SellerProfile {
  userId: number;
  displayName?: string | null;
  bio?: string | null;
  idVerified: boolean;
  idVerifiedAt?: string | null;
  creditScore: number;
  responseAvgMinutes?: number | null;
  totalSales: number;
  totalGmvCents: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export const listingService = {
  /** 创建草稿。第一步保存后拿到 id，之后都走 patch。 */
  create: (data: ListingCreateParams) =>
    apiClient.post<Listing>("/api/listings", data),

  /** 分步保存，向导每一步 next 时调一次。 */
  patch: (productId: number, data: ListingPatchParams) =>
    apiClient.patch<Listing>(`/api/listings/${productId}`, data),

  get: (productId: number) =>
    apiClient.get<Listing>(`/api/store-merchants/products/${productId}`),

  submitForReview: (productId: number) =>
    apiClient.post<Listing>(`/api/listings/${productId}/submit`),

  /** 状态切换（active ↔ offline 等），后端校验哪些跃迁合法。 */
  transition: (productId: number, target: ProductStatus, reason?: string) =>
    apiClient.post<Listing>(`/api/listings/${productId}/transition`, {
      target,
      reason,
    }),

  batchOffline: (productIds: number[]) =>
    apiClient.post<{ updated: number }>("/api/listings/batch/offline", {
      productIds,
    }),

  /** 只能批量删草稿 / 已驳回的单品。 */
  batchDelete: (productIds: number[]) =>
    apiClient.post<{ deleted: number }>("/api/listings/batch/delete", {
      productIds,
    }),

  // ── 卖家库存 ──────────────────────────────────────────────────────────────

  getMySummary: () =>
    apiClient.get<ListingsStatusSummary>("/api/sellers/me/listings/summary"),

  listMine: (params: {
    status?: ProductStatus | "";
    sellerKind?: SellerKind | "";
    page?: number;
    pageSize?: number;
  }) =>
    apiClient.get<ListingListResponse>("/api/sellers/me/listings", {
      status: params.status || undefined,
      sellerKind: params.sellerKind || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
    }),

  listUserPublic: (
    userId: number,
    params: {
      status?: "active" | "sold";
      page?: number;
      pageSize?: number;
    } = {},
  ) =>
    apiClient.get<ListingListResponse>(`/api/sellers/${userId}/listings`, {
      status: params.status ?? "active",
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
    }),

  // ── 卖家档案 ──────────────────────────────────────────────────────────────

  getMyProfile: () =>
    apiClient.get<SellerProfile | null>("/api/sellers/me/profile"),

  upsertMyProfile: (data: { displayName?: string; bio?: string }) =>
    apiClient.put<SellerProfile>("/api/sellers/me/profile", data),

  getPublicProfile: (userId: number) =>
    apiClient.get<SellerProfile | null>(`/api/sellers/${userId}/profile`),
};

// ============================================================================
// 抽佣
// ============================================================================

/**
 * 单品发布抽佣率：1%（=100 bps）。
 *
 * 与 backend migration 063 的 `orders.commission_rate_bps DEFAULT 100` 对齐。
 */
export const PLATFORM_COMMISSION_BPS = 100;

/** 扣除抽佣后的预计到手价（分）。 */
export function calculateExpectedPayout(
  priceCents: number,
  rateBps: number = PLATFORM_COMMISSION_BPS,
): number {
  if (!priceCents) return 0;
  const rate = Math.max(0, Math.min(rateBps, 10_000)) / 10_000;
  return Math.round(priceCents * (1 - rate));
}
