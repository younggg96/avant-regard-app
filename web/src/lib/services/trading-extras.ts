/**
 * Web 端单品履历 + 价格基准 API 客户端。
 *
 * 对齐移动端 `frontend/src/services/tradingExtrasService.ts`（PRD 模块三）。
 * 单独成文件的原因和移动端一样：这两块只服务于单品详情页，
 * 塞进 listing.ts 会让那个文件继续膨胀。
 */

import { apiClient } from "../api-client";

// ============================================================================
// 履历（Provenance）
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
  productId: number,
): Promise<ProvenanceEvent[]> => {
  const res = await apiClient.get<{ events: ProvenanceEvent[] }>(
    `/api/listings/${productId}/provenance`,
  );
  return res?.events ?? [];
};

// ============================================================================
// 价格基准（PRD 3.3）
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

export const getPriceHistory = (params: {
  brand: string;
  categoryId?: number | null;
  size?: string;
  condition?: string;
  months?: number;
}) =>
  apiClient.get<PriceHistorySummary>("/api/listings/price-history", {
    brand: params.brand,
    categoryId: params.categoryId ?? undefined,
    size: params.size,
    condition: params.condition,
    months: params.months,
  });

type TranslateFn = (
  key: string,
  options?: Record<string, string | number>,
) => string;

const passthrough: TranslateFn = (key) => key;

export function formatProvenanceEvent(
  type: ProvenanceEventType,
  t?: TranslateFn,
): string {
  const tr = t ?? passthrough;
  const key = `trading.provenance.${type}`;
  const translated = tr(key);
  return translated !== key ? translated : type;
}
