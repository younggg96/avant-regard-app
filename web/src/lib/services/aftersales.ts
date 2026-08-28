/**
 * Web 端售后 / 客服 / 双盲互评 API 客户端。
 *
 * 对齐移动端 `frontend/src/services/aftersalesService.ts`。
 *
 * 售后有两条入口：
 *   1. 「联系客服」——直接开一个 IM 会话，把订单卡片推给客服（推荐路径）；
 *   2. 结构化申诉表单——写入 disputes 表，卖家可在售后台响应，必要时转客服仲裁。
 *
 * 互评是双盲的：双方都提交后才互相可见，或到期自动公开。
 */

import { apiClient } from "../api-client";

// ============================================================================
// 客服
// ============================================================================

export interface SupportConversation {
  conversationId: number;
  csUserId: number;
}

/** 常见售后问题 key，与后端 `AFTERSALES_ISSUE_TEMPLATES` 一一对应。 */
export type AftersalesIssue =
  | "no_logistics_update"
  | "delivered_not_received"
  | "quality_issue"
  | "listing_delisted";

export const supportService = {
  contactForOrder: (orderId: number) =>
    apiClient.post<SupportConversation>(
      `/api/trading-support/contact-order/${orderId}`,
    ),

  /** 选定常见问题后联系客服，后端会把诉求一并推给客服，省去来回问答。 */
  contactForOrderWithIssue: (orderId: number, issue: AftersalesIssue) =>
    apiClient.post<SupportConversation & { issue?: AftersalesIssue }>(
      `/api/trading-support/contact-order/${orderId}/aftersales`,
      { issue },
    ),

  contactForListing: (productId: number) =>
    apiClient.post<SupportConversation>(
      `/api/trading-support/contact-listing/${productId}`,
    ),

  contactGeneral: () =>
    apiClient.post<SupportConversation>("/api/trading-support/contact"),
};

// ============================================================================
// 售后申诉
// ============================================================================

export type DisputeReason =
  | "not_as_described"
  | "damaged"
  | "not_received"
  | "fake"
  | "other"
  // 买家端售后请求原因（与订单详情「选择售后类型」一一对应）
  | "no_logistics_update"
  | "delivered_not_received"
  | "quality_issue"
  | "listing_delisted";

export type DisputeStatus =
  | "open"
  | "investigating"
  | "resolved_refund"
  | "resolved_release"
  | "withdrawn";

/** 卖家对买家售后请求的响应动作。 */
export type SellerResponseAction = "agree_refund" | "reject";

export interface Dispute {
  id: number;
  orderId: number;
  openerUserId: number;
  openerRole: "buyer" | "seller";
  reason: DisputeReason;
  description?: string | null;
  evidencePhotos: string[];
  status: DisputeStatus;
  csHandlerUserId?: number | null;
  csDecision?: string | null;
  resolvedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  // 卖家响应
  sellerResponse?: string | null;
  sellerResponseAction?: SellerResponseAction | null;
  sellerResponseAt?: string | null;
  sellerEvidencePhotos?: string[] | null;
  // 列表 / 详情接口附带的订单与商品上下文
  orderNo?: string | null;
  productId?: number | null;
  productTitle?: string | null;
  productImage?: string | null;
  paidPriceCents?: number | null;
  currency?: string | null;
  buyerUserId?: number | null;
  sellerUserId?: number | null;
}

export const disputeService = {
  openDispute: (body: {
    orderId: number;
    reason: DisputeReason;
    description?: string;
    evidencePhotos?: string[];
  }) =>
    apiClient.post<Dispute>("/api/disputes", {
      orderId: body.orderId,
      reason: body.reason,
      description: body.description,
      evidencePhotos: body.evidencePhotos ?? [],
    }),

  withdrawDispute: (id: number) =>
    apiClient.post<Dispute>(`/api/disputes/${id}/withdraw`),

  listForOrder: (orderId: number) =>
    apiClient.get<Dispute[]>(`/api/disputes/orders/${orderId}`),

  /** 卖家侧：自己名下订单上买家提交的售后请求。 */
  listSellerDisputes: (params?: {
    status?: DisputeStatus;
    page?: number;
    pageSize?: number;
  }) =>
    apiClient.get<{ items: Dispute[]; total: number }>("/api/disputes/seller", {
      status: params?.status,
      page: params?.page,
      pageSize: params?.pageSize,
    }),

  /**
   * 卖家响应买家售后请求。
   * - agree_refund：同意退款，订单直接退款，无需客服介入。
   * - reject：拒绝并申诉，记录说明与凭证后转交客服仲裁。
   */
  sellerRespond: (
    id: number,
    body: {
      action: SellerResponseAction;
      message?: string;
      evidencePhotos?: string[];
    },
  ) =>
    apiClient.post<Dispute>(`/api/disputes/${id}/seller-respond`, {
      action: body.action,
      message: body.message,
      evidencePhotos: body.evidencePhotos ?? [],
    }),
};

// ============================================================================
// 鉴定服务（PRD 模块 5）
// ============================================================================

export interface AuthenticationPackage {
  id: number;
  code: "standard" | "pro" | "expert" | string;
  name: string;
  priceCents: number;
  currency: string;
  slaHours: number;
  description?: string | null;
}

export type AuthOrderStatus =
  | "pending_payment"
  | "paid"
  | "reviewing"
  | "completed"
  | "canceled";

export type AuthResult = "pending" | "authentic" | "fake" | "inconclusive";

export interface AuthenticationOrder {
  id: number;
  orderNo: string;
  userId: number;
  packageId: number;
  packageCode?: string | null;
  productId?: number | null;
  brandName?: string | null;
  itemPhotos: string[];
  note?: string | null;
  priceCents: number;
  currency: string;
  status: AuthOrderStatus;
  result: AuthResult;
  expertUserId?: number | null;
  expertReport?: string | null;
  certificateUrl?: string | null;
  paymentProvider?: string | null;
  paymentIntentId?: string | null;
  clientSecret?: string | null;
  paidAt?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
}

export const authenticationService = {
  listPackages: () =>
    apiClient.get<AuthenticationPackage[]>("/api/authentication/packages"),

  /**
   * 下鉴定单。返回时状态是 pending_payment——web 上不接支付 SDK，
   * 提示用户去 App 内付款，和商品订单的处理保持一致。
   */
  createOrder: (body: {
    packageCode: string;
    productId?: number;
    brandName?: string;
    itemPhotos: string[];
    note?: string;
  }) => apiClient.post<AuthenticationOrder>("/api/authentication/orders", body),

  listMyOrders: () =>
    apiClient.get<{ items: AuthenticationOrder[]; total: number }>(
      "/api/authentication/orders/me",
    ),
};

// ============================================================================
// 交易互评
// ============================================================================

export interface TradeReview {
  id: number;
  orderId: number;
  reviewerUserId: number;
  reviewerRole: "buyer" | "seller";
  targetUserId: number;
  rating: number;
  payload?: Record<string, unknown> | null;
  comment?: string | null;
  photos?: string[] | null;
  visible: boolean;
  submittedAt?: string | null;
  autoClosedAt?: string | null;
  reviewerUsername?: string | null;
  reviewerAvatarUrl?: string | null;
}

export interface OrderReviewStatus {
  orderId: number;
  canReview: boolean;
  myReviewSubmitted: boolean;
  buyerReviewSubmitted: boolean;
  sellerReviewSubmitted: boolean;
  bothVisible: boolean;
}

export const reviewService = {
  submitReview: (body: {
    orderId: number;
    rating: number;
    payload?: Record<string, unknown>;
    comment?: string;
    photos?: string[];
  }) => apiClient.post<TradeReview>("/api/trade-reviews", body),

  getOrderReviewStatus: (orderId: number) =>
    apiClient.get<OrderReviewStatus>(
      `/api/trade-reviews/orders/${orderId}/status`,
    ),

  batchOrderReviewStatus: async (
    orderIds: number[],
  ): Promise<OrderReviewStatus[]> => {
    if (orderIds.length === 0) return [];
    return apiClient.post<OrderReviewStatus[]>("/api/trade-reviews/status/batch", {
      orderIds,
    });
  },

  listUserReviews: (userId: number) =>
    apiClient.get<{ items: TradeReview[]; total: number }>(
      `/api/trade-reviews/users/${userId}`,
    ),

  listOrderReviews: (orderId: number) =>
    apiClient.get<TradeReview[]>(`/api/trade-reviews/orders/${orderId}`),
};

// ============================================================================
// 展示辅助
// ============================================================================

type TranslateFn = (
  key: string,
  options?: Record<string, string | number>,
) => string;

const passthrough: TranslateFn = (key) => key;

export function formatDisputeStatus(
  status: DisputeStatus,
  t?: TranslateFn,
): string {
  const tr = t ?? passthrough;
  const key = `trading.disputeStatus.${status}`;
  const translated = tr(key);
  return translated !== key ? translated : status;
}

export function formatDisputeReason(
  reason: DisputeReason,
  t?: TranslateFn,
): string {
  const tr = t ?? passthrough;
  const key = `trading.disputeReason.${reason}`;
  const translated = tr(key);
  return translated !== key ? translated : reason;
}

/** 买家在订单详情里可选的售后原因，顺序与移动端一致。 */
export const BUYER_DISPUTE_REASONS: DisputeReason[] = [
  "no_logistics_update",
  "delivered_not_received",
  "quality_issue",
  "not_as_described",
  "damaged",
  "fake",
  "other",
];
