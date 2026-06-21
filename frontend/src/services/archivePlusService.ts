/**
 * PRD 模块 6 & 8 · My Archive / Plus 客户端 API。
 */
import { request } from "./http";

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

export interface ArchiveHoldingRecord {
  id: number;
  archiveItemId: number;
  userId: number;
  heldFrom?: string | null;
  heldTo?: string | null;
  status: "owned" | "lent" | "transferred" | "resold" | "returned";
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

export async function listArchive(params?: {
  page?: number;
  pageSize?: number;
}): Promise<{ items: ArchiveItem[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.page) q.append("page", String(params.page));
  if (params?.pageSize) q.append("pageSize", String(params.pageSize));
  return request<{ items: ArchiveItem[]; total: number }>(
    `/api/archive/items?${q.toString()}`,
  );
}

export async function getArchiveAnalytics(): Promise<ArchiveAnalytics> {
  return request<ArchiveAnalytics>("/api/archive/analytics");
}

export async function getArchiveAnalyticsPreview(): Promise<ArchiveAnalyticsPreview> {
  return request<ArchiveAnalyticsPreview>("/api/archive/analytics-preview");
}

// PDF p.21 · 独立上传 MY ARCHIVE
export interface ArchiveManualCreatePayload {
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

export async function createArchiveItem(
  body: ArchiveManualCreatePayload,
): Promise<ArchiveItem> {
  return request<ArchiveItem>("/api/archive/items", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// 将已购入订单转入 MY ARCHIVE
export async function getArchiveItemByOrder(
  orderId: number,
): Promise<ArchiveItem | null> {
  const res = await request<{ item: ArchiveItem | null }>(
    `/api/archive/from-order/${orderId}`,
  );
  return res.item ?? null;
}

export async function transferOrderToArchive(
  orderId: number,
): Promise<ArchiveItem> {
  return request<ArchiveItem>(`/api/archive/from-order/${orderId}`, {
    method: "POST",
  });
}

// PDF p.22 · 持有记录
export async function listArchiveHoldings(
  archiveId: number,
): Promise<ArchiveHoldingRecord[]> {
  return request<ArchiveHoldingRecord[]>(
    `/api/archive/items/${archiveId}/holdings`,
  );
}

export async function createArchiveHolding(
  archiveId: number,
  body: {
    heldFrom?: string;
    heldTo?: string;
    status?: "owned" | "lent" | "transferred" | "resold" | "returned";
    note?: string;
    counterpartName?: string;
    relatedProductId?: number;
    relatedOrderId?: number;
  },
): Promise<ArchiveHoldingRecord> {
  return request<ArchiveHoldingRecord>(
    `/api/archive/items/${archiveId}/holdings`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function resellFromArchive(
  archiveId: number,
  overrides: {
    priceCents?: number;
    condition?: string;
    description?: string;
    acceptOffer?: boolean;
  },
): Promise<{ id: number }> {
  return request<{ id: number }>(
    `/api/archive/items/${archiveId}/resell`,
    { method: "POST", body: JSON.stringify(overrides) },
  );
}

// ---------------- Plus ----------------

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
  /** 仅 source=stripe 且首次 subscribe 调用时返回, 用于拉 Stripe PaymentSheet。 */
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

export async function getPlusStatus(): Promise<PlusStatus> {
  return request<PlusStatus>("/api/plus/status");
}

export async function subscribePlus(plan: PlusPlan): Promise<PlusSubscription> {
  return request<PlusSubscription>("/api/plus/subscribe", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

export async function confirmPlusMock(
  subId: number,
): Promise<PlusSubscription> {
  return request<PlusSubscription>(
    `/api/plus/subscriptions/${subId}/confirm-mock`,
    { method: "POST" },
  );
}

export async function cancelPlus(subId: number): Promise<PlusSubscription> {
  return request<PlusSubscription>(
    `/api/plus/subscriptions/${subId}/cancel`,
    { method: "POST" },
  );
}
