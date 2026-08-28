/**
 * Web 端 My Archive（个人档案库）+ Plus 订阅 API 客户端。
 *
 * 对齐移动端 `frontend/src/services/archivePlusService.ts`。
 *
 * Archive 是「我拥有过的单品」台账：订单确认收货后可一键转入，也可手动录入。
 * 转售时从档案直接生成一条 listing 草稿，省掉重复填写。
 * 深度分析（成交价 / 年份分布）是 Plus 会员权益，非会员只拿 preview。
 */

import { apiClient } from "../api-client";

export interface ArchiveItem {
  id: number;
  userId: number;
  productId?: number | null;
  orderId?: number | null;
  title?: string | null;
  brandName?: string | null;
  size?: string | null;
  color?: string | null;
  condition?: string | null;
  originalShowId?: string | null;
  acquiredPriceCents?: number | null;
  currency: string;
  photos: string[];
  acquiredAt?: string | null;
  note?: string | null;
  relistedProductId?: number | null;
  relistedAt?: string | null;
  source?: "order" | "manual" | "imported";
  storageLocation?: string | null;
  isCurrentlyOwned?: boolean;
  createdAt?: string | null;
}

export type ArchiveHoldingStatus =
  | "owned"
  | "lent"
  | "transferred"
  | "resold"
  | "returned";

export interface ArchiveHoldingRecord {
  id: number;
  archiveItemId: number;
  userId: number;
  heldFrom?: string | null;
  heldTo?: string | null;
  status: ArchiveHoldingStatus;
  note?: string | null;
  counterpartUserId?: number | null;
  counterpartName?: string | null;
  relatedProductId?: number | null;
  relatedOrderId?: number | null;
  createdAt?: string | null;
}

export interface ArchiveAnalytics {
  totalItems: number;
  totalAcquiredCents: number;
  brandBreakdown: Record<string, number>;
  yearBreakdown: Record<string, number>;
  avgPriceCents: number;
}

export interface ArchiveAnalyticsPreview {
  totalItems: number;
  brandBreakdown: Record<string, number>;
  locked: boolean;
}

export interface ArchiveManualCreateParams {
  title: string;
  brandName?: string;
  size?: string;
  color?: string;
  condition?: string;
  acquiredPriceCents?: number;
  currency?: string;
  photos?: string[];
  acquiredAt?: string;
  note?: string;
  storageLocation?: string;
  originalShowId?: string;
}

export const archiveService = {
  list: (params: { page?: number; pageSize?: number } = {}) =>
    apiClient.get<{ items: ArchiveItem[]; total: number }>(
      "/api/archive/items",
      { page: params.page, pageSize: params.pageSize },
    ),

  create: (body: ArchiveManualCreateParams) =>
    apiClient.post<ArchiveItem>("/api/archive/items", body),

  getAnalytics: () => apiClient.get<ArchiveAnalytics>("/api/archive/analytics"),

  getAnalyticsPreview: () =>
    apiClient.get<ArchiveAnalyticsPreview>("/api/archive/analytics-preview"),

  getByOrder: async (orderId: number) => {
    const res = await apiClient.get<{ item: ArchiveItem | null }>(
      `/api/archive/from-order/${orderId}`,
    );
    return res.item ?? null;
  },

  transferFromOrder: (orderId: number) =>
    apiClient.post<ArchiveItem>(`/api/archive/from-order/${orderId}`),

  listHoldings: (archiveId: number) =>
    apiClient.get<ArchiveHoldingRecord[]>(
      `/api/archive/items/${archiveId}/holdings`,
    ),

  createHolding: (
    archiveId: number,
    body: {
      heldFrom?: string;
      heldTo?: string;
      status?: ArchiveHoldingStatus;
      note?: string;
      counterpartName?: string;
      relatedProductId?: number;
      relatedOrderId?: number;
    },
  ) =>
    apiClient.post<ArchiveHoldingRecord>(
      `/api/archive/items/${archiveId}/holdings`,
      body,
    ),

  /** 从档案生成一条转售 listing 草稿，返回新 listing 的 id。 */
  resell: (
    archiveId: number,
    overrides: {
      priceCents?: number;
      condition?: string;
      description?: string;
      acceptOffer?: boolean;
    },
  ) =>
    apiClient.post<{ id: number }>(
      `/api/archive/items/${archiveId}/resell`,
      overrides,
    ),
};

// ============================================================================
// Plus 订阅
// ============================================================================

export type PlusPlan = "monthly" | "annual";

export interface PlusSubscription {
  id: number;
  userId: number;
  plan: string;
  periodStart: string;
  periodEnd: string;
  priceCents: number;
  currency: string;
  source: string;
  paymentIntentId?: string | null;
  /** 仅 source=stripe 且首次 subscribe 时返回，用于拉起支付。 */
  clientSecret?: string | null;
  status: string;
  autoRenew: boolean;
  createdAt?: string | null;
}

export interface PlusStatus {
  isActive: boolean;
  subscription?: PlusSubscription | null;
  commissionRateBps: number;
}

export const plusService = {
  getStatus: () => apiClient.get<PlusStatus>("/api/plus/status"),

  subscribe: (plan: PlusPlan) =>
    apiClient.post<PlusSubscription>("/api/plus/subscribe", { plan }),

  cancel: (subId: number) =>
    apiClient.post<PlusSubscription>(
      `/api/plus/subscriptions/${subId}/cancel`,
    ),
};
