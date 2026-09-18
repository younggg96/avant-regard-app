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
  /**
   * photos 的子集：其中由 AI 生成（三视图）而非实拍的那些。
   *
   * 展示单品照片的地方都要据此标注 —— 侧面和背面往往是模型根据正面推测的，
   * 当成实物照看会误导判断。由服务端反查生成记录得出，不是客户端自报。
   */
  aiPhotos?: string[];
  acquiredAt?: string | null;
  note?: string | null;
  relistedProductId?: number | null;
  relistedAt?: string | null;
  source?: "order" | "manual" | "imported";
  storageLocation?: string | null;
  isCurrentlyOwned?: boolean;
  /** public = 出现在「世界」档案 feed、他人可打开详情页；private = 仅本人可见。 */
  visibility?: ArchiveVisibility;
  /**
   * false = 他人只看到 AI 三视图。实拍由服务端剔除，不会出现在响应里，
   * 所以非本人拿到的 photos 本身就已经是过滤后的结果。
   */
  showRealPhotos?: boolean;
  createdAt?: string | null;
}

export type ArchiveVisibility = "public" | "private";

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

// ---------------- 世界（浏览他人档案） ----------------

export interface ArchiveAuthor {
  id: number;
  username: string;
  avatarUrl?: string | null;
}

export interface WorldArchiveItem extends ArchiveItem {
  author?: ArchiveAuthor | null;
  /** 影子帖子上的互动数，让档案卡片能和帖子卡片显示同样的点赞数。 */
  likeCount?: number;
  commentCount?: number;
}

/** 公开档案 feed：所有 visibility=public 的藏品，包括本人的。 */
export async function listWorldArchive(params?: {
  page?: number;
  pageSize?: number;
}): Promise<{ items: WorldArchiveItem[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.page) q.append("page", String(params.page));
  if (params?.pageSize) q.append("pageSize", String(params.pageSize));
  return request<{ items: WorldArchiveItem[]; total: number }>(
    `/api/archive/world?${q.toString()}`,
  );
}

/** 藏品详情：本人的任何条目 + 他人的公开条目；看不到时后端返回 404。 */
/**
 * 公开可见的流转摘要。完整的持有记录只给本人 —— 每条都带着交易对手的姓名和
 * 订单号，那是第三方信息。这里汇总成「几任持有者 · 哪年入藏」，能说明流转深度
 * 又不指向任何具体的人。
 */
export interface ArchiveProvenanceSummary {
  holderCount: number;
  acquiredYear?: string | null;
}

export interface ArchiveItemDetail extends ArchiveItem {
  author?: ArchiveAuthor | null;
  isOwner: boolean;
  provenance?: ArchiveProvenanceSummary | null;
  /**
   * 档案在 posts 表里的「影子帖子」id（migration 092）。
   *
   * 点赞 / 收藏 / 评论没有多态层，全都以 post_id 为键，所以档案的互动挂在这条
   * 影子帖子上，直接复用 /api/posts/{id}/like 等既有接口和前端组件。
   * 影子帖子的 status 恒为 HIDDEN，不会出现在任何帖子流里。
   *
   * 为 null 说明后端还没建起这条记录（092 未执行），此时必须隐藏整个互动区：
   * 拿着 undefined 去调接口只会得到一个看起来成功、实际没落库的点赞。
   */
  postId?: number | null;
  likeCount?: number;
  favoriteCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  isFavorited?: boolean;
}

export async function getArchiveItem(
  archiveId: number,
): Promise<ArchiveItemDetail> {
  return request<ArchiveItemDetail>(`/api/archive/items/${archiveId}`);
}

/** 本人切换藏品「公开 / 仅自己可见」。 */
export async function updateArchiveVisibility(
  archiveId: number,
  visibility: ArchiveVisibility,
): Promise<ArchiveItem> {
  return request<ArchiveItem>(
    `/api/archive/items/${archiveId}/visibility`,
    { method: "PATCH", body: JSON.stringify({ visibility }) },
  );
}

/** 本人切换「实拍是否对他人展示」。没有 AI 三视图时后端会拒绝关闭。 */
export async function updateArchivePhotoDisplay(
  archiveId: number,
  showRealPhotos: boolean,
): Promise<ArchiveItem> {
  return request<ArchiveItem>(
    `/api/archive/items/${archiveId}/photo-display`,
    { method: "PATCH", body: JSON.stringify({ showRealPhotos }) },
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
