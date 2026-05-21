/**
 * PRD 模块三 · 履历 / 价格基准 / 多收藏夹 客户端 API。
 *
 * 拆到独立文件，避免 storeProductService.ts 继续膨胀。
 */
import { request } from "./http";

// ============================================================================
// Provenance
// ============================================================================

export type ProvenanceEventType =
  | "origin_show"
  | "merchant_acquired"
  | "collector_owned"
  | "on_sale_now"
  | "sold"
  | "resale";

export interface ProvenanceEvent {
  id: number;
  productId: number;
  eventType: ProvenanceEventType;
  actorKind: "brand" | "merchant" | "user" | "system";
  actorUserId?: number | null;
  actorMerchantId?: number | null;
  actorBrandId?: number | null;
  occurredAt?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
}

export const getProductProvenance = async (
  productId: number
): Promise<ProvenanceEvent[]> => {
  const res = await request<{ events: ProvenanceEvent[] }>(
    `/api/listings/${productId}/provenance`,
    { method: "GET" }
  );
  return res?.events ?? [];
};

// ============================================================================
// Price history (PRD 3.3 基准柱状图)
// ============================================================================

export interface PriceHistoryBucket {
  bucketLabel: string;
  count: number;
  avgPriceCents: number;
}

export interface PriceHistorySummary {
  brand?: string | null;
  sampleSize: number;
  minPriceCents: number;
  maxPriceCents: number;
  medianPriceCents: number;
  p25PriceCents: number;
  p75PriceCents: number;
  buckets: PriceHistoryBucket[];
}

export interface PriceHistoryQuery {
  brand: string;
  categoryId?: number | null;
  size?: string;
  condition?: string;
  months?: number;
}

export const getPriceHistory = async (
  q: PriceHistoryQuery
): Promise<PriceHistorySummary> => {
  const qs = new URLSearchParams();
  qs.append("brand", q.brand);
  if (q.categoryId != null) qs.append("categoryId", String(q.categoryId));
  if (q.size) qs.append("size", q.size);
  if (q.condition) qs.append("condition", q.condition);
  if (q.months) qs.append("months", String(q.months));
  return request<PriceHistorySummary>(
    `/api/listings/price-history?${qs.toString()}`,
    { method: "GET" }
  );
};

// ============================================================================
// User Collections (PRD 3.4 多收藏夹)
// ============================================================================

export interface UserCollection {
  id: number;
  userId: number;
  name: string;
  description?: string | null;
  visibility: "private" | "public";
  coverProductId?: number | null;
  sortOrder: number;
  itemCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export const listMyCollections = async (): Promise<UserCollection[]> => {
  const res = await request<{ collections: UserCollection[] }>(
    `/api/users/me/collections`,
    { method: "GET" }
  );
  return res?.collections ?? [];
};

export const createCollection = async (data: {
  name: string;
  description?: string;
  visibility?: "private" | "public";
}): Promise<UserCollection> => {
  return request<UserCollection>(`/api/users/me/collections`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateCollection = async (
  collectionId: number,
  data: Partial<{
    name: string;
    description: string;
    visibility: "private" | "public";
    coverProductId: number | null;
    sortOrder: number;
  }>
): Promise<UserCollection> => {
  return request<UserCollection>(`/api/users/me/collections/${collectionId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deleteCollection = async (collectionId: number): Promise<void> => {
  await request<null>(`/api/users/me/collections/${collectionId}`, {
    method: "DELETE",
  });
};

export const addProductToCollection = async (
  collectionId: number,
  productId: number
): Promise<void> => {
  await request<null>(
    `/api/users/me/collections/${collectionId}/items/${productId}`,
    { method: "POST" }
  );
};

export const removeProductFromCollection = async (
  collectionId: number,
  productId: number
): Promise<void> => {
  await request<null>(
    `/api/users/me/collections/${collectionId}/items/${productId}`,
    { method: "DELETE" }
  );
};
