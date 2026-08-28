/**
 * Web 端订单 / 出价 API 客户端。
 *
 * 对齐移动端 `frontend/src/services/orderService.ts`，后端入口：
 *   /api/orders/*   订单
 *   /api/offers/*   出价
 *
 * 金额约定：API 层统一用整数分（`priceCents` / `paidPriceCents`），
 * 展示时走 `formatPriceCents`。
 */

import { apiClient } from "../api-client";

// ============================================================================
// 枚举与类型
// ============================================================================

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "shipped"
  | "delivered"
  | "completed"
  | "settled"
  | "refunded_auto"
  | "refunded"
  | "disputed"
  | "resolved";

export type OfferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "countered"
  | "expired"
  | "withdrawn";

export interface OrderProductBrief {
  productId: number;
  title?: string | null;
  brand?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  coverImage?: string | null;
}

export interface Order {
  /** 列表接口附带的商品摘要，用于直接渲染订单卡片，避免 N 次详情请求。 */
  product?: OrderProductBrief | null;
  id: number;
  orderNo: string;
  productId: number;
  buyerUserId: number;
  sellerUserId?: number | null;
  sellerMerchantId?: number | null;
  offerId?: number | null;
  listingPriceCents: number;
  paidPriceCents: number;
  commissionRateBps: number;
  commissionCents: number;
  sellerPayoutCents: number;
  currency: string;
  shippingAddress?: Record<string, unknown> | null;
  shippingDueAt?: string | null;
  autoConfirmDueAt?: string | null;
  settlementDueAt?: string | null;
  status: OrderStatus;
  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  settledAt?: string | null;
  refundedAt?: string | null;
  cancelReason?: string | null;
  paymentProvider?: string | null;
  paymentIntentId?: string | null;
  paymentMetadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** 下单后对库存的锁定，`expiresAt` 到期未支付则自动释放。 */
export interface StockHold {
  id: number;
  productId: number;
  buyerUserId: number;
  expiresAt: string;
  releasedAt?: string | null;
  consumedAt?: string | null;
  createdAt?: string | null;
}

export interface Offer {
  id: number;
  productId: number;
  buyerUserId: number;
  sellerUserId?: number | null;
  sellerMerchantId?: number | null;
  priceCents: number;
  currency: string;
  message?: string | null;
  status: OfferStatus;
  parentOfferId?: number | null;
  expiresAt?: string | null;
  resolvedAt?: string | null;
  createdAt?: string | null;
}

export interface OfferProductBrief {
  productId: number;
  title?: string | null;
  brand?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  coverImage?: string | null;
}

export interface OfferUserBrief {
  userId: number;
  username?: string | null;
  avatarUrl?: string | null;
}

export type OfferAction = "accept" | "reject" | "counter" | "withdraw";

export interface OfferWithDetail extends Offer {
  product?: OfferProductBrief | null;
  buyer?: OfferUserBrief | null;
  seller?: OfferUserBrief | null;
  initiatorRole?: "buyer" | "seller";
  responderRole?: "buyer" | "seller";
  allowedActions?: OfferAction[];
}

export interface ProductOfferThread {
  /** 该买家对此商品的全部出价（含卖家还价），按时间升序。 */
  items: OfferWithDetail[];
  /** 当前仍 pending 的最新一条出价；没有进行中的议价时为 null。 */
  current: OfferWithDetail | null;
  /** 商品挂牌价（划线原价用）。 */
  listingPriceCents?: number | null;
  currency?: string | null;
}

export type PaymentProviderId = "alipay" | "wechat" | "stripe" | "mock";

export interface PaymentOption {
  provider: PaymentProviderId;
  name: string;
  iconKey: string;
}

export interface Shipment {
  id: number;
  orderId: number;
  carrier?: string | null;
  trackingNo?: string | null;
  images: string[];
  signedAt?: string | null;
  createdAt?: string | null;
  latestStatusCode?: string | null;
  latestDescription?: string | null;
  latestLocation?: string | null;
  latestEventAt?: string | null;
  providerSource?: string | null;
}

export type TrackingStatusCode =
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "returned";

export interface TrackingEvent {
  id: number;
  shipmentId: number;
  orderId: number;
  occurredAt: string;
  statusCode: TrackingStatusCode | string;
  description?: string | null;
  location?: string | null;
  source?: string;
  createdAt?: string | null;
}

export interface TrackingFeed {
  items: TrackingEvent[];
  latestStatusCode?: string | null;
  latestDescription?: string | null;
  latestLocation?: string | null;
  latestEventAt?: string | null;
  providerSource?: string | null;
}

export interface ConfirmReceiptSettlement {
  orderId: number;
  orderNo: string;
  grossAmountCents: number;
  commissionCents: number;
  commissionRateBps: number;
  sellerPayoutCents: number;
  currency: string;
  releaseAt?: string | null;
  completedAt?: string | null;
}

export interface ConfirmReceiptResult {
  order: Order;
  settlement: ConfirmReceiptSettlement;
}

export interface OrderListResponse {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrderListParams {
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
}

export interface OfferListParams {
  status?: OfferStatus;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// 订单
// ============================================================================

export const orderService = {
  /** 立即购买：创建 pending_payment 订单并锁定库存。 */
  buyNow: (productId: number, shippingAddress?: Record<string, unknown>) =>
    apiClient.post<{ order: Order; hold: StockHold }>("/api/orders/buy-now", {
      productId,
      shippingAddress,
    }),

  /** 出价成交后补填收货地址（仅 pending_payment 阶段可写）。 */
  setShippingAddress: (
    orderId: number,
    shippingAddress: Record<string, unknown>,
  ) =>
    apiClient.post<Order>(`/api/orders/${orderId}/shipping-address`, {
      shippingAddress,
    }),

  getOrder: (orderId: number) => apiClient.get<Order>(`/api/orders/${orderId}`),

  listMyOrders: (params: OrderListParams = {}) =>
    apiClient.get<OrderListResponse>("/api/orders/me", {
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
    }),

  listMySales: (params: OrderListParams = {}) =>
    apiClient.get<OrderListResponse>("/api/orders/me/sales", {
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
    }),

  /** 当前用户与某位用户之间的全部订单，按创建时间倒序（交易聊天用）。 */
  listOrdersWithUser: (counterpartUserId: number) =>
    apiClient.get<{ items: Order[] }>(`/api/orders/with/${counterpartUserId}`),

  // ── 支付 ──────────────────────────────────────────────────────────────────

  listPaymentOptions: (orderId: number) =>
    apiClient.get<{
      items: PaymentOption[];
      currency: string;
      amountCents: number;
    }>(`/api/orders/${orderId}/payment-options`),

  startPayment: (orderId: number, provider?: PaymentProviderId) =>
    apiClient.post<Order>(`/api/orders/${orderId}/pay`, {
      provider: provider ?? null,
    }),

  confirmPayment: (orderId: number) =>
    apiClient.post<Order>(`/api/orders/${orderId}/pay/confirm`),

  payOrderMock: (orderId: number) =>
    apiClient.post<Order>(`/api/orders/${orderId}/pay-mock`),

  // ── 履约 ──────────────────────────────────────────────────────────────────

  shipOrder: (
    orderId: number,
    body: { carrier: string; trackingNo: string; images: string[] },
  ) => apiClient.post<Order>(`/api/orders/${orderId}/ship`, body),

  getShipment: (orderId: number) =>
    apiClient.get<Shipment | null>(`/api/orders/${orderId}/shipment`),

  getTrackingEvents: (orderId: number) =>
    apiClient.get<TrackingFeed>(`/api/orders/${orderId}/tracking-events`),

  /** 买家主动确认签收（shipped → delivered）。 */
  signReceipt: (orderId: number) =>
    apiClient.post<Order>(`/api/orders/${orderId}/sign`),

  /**
   * 买家确认收货（delivered → completed）。
   * 额外返回结算明细，用于跳转「确认成功」页。
   */
  confirmOrder: (orderId: number) =>
    apiClient.post<ConfirmReceiptResult>(`/api/orders/${orderId}/confirm`),

  submitInspection: (
    orderId: number,
    body: {
      checkedItems: Record<string, boolean>;
      photos: string[];
      note?: string;
    },
  ) => apiClient.post<{ ok: boolean }>(`/api/orders/${orderId}/inspection`, body),
};

// ============================================================================
// 出价
// ============================================================================

export const offerService = {
  createOffer: (body: {
    productId: number;
    priceCents: number;
    message?: string;
  }) => apiClient.post<Offer>("/api/offers", body),

  acceptOffer: (offerId: number) =>
    apiClient.post<{ order: Order; hold: StockHold; offer: Offer }>(
      `/api/offers/${offerId}/accept`,
    ),

  rejectOffer: (offerId: number) =>
    apiClient.post<Offer>(`/api/offers/${offerId}/reject`),

  counterOffer: (offerId: number, body: { priceCents: number; message?: string }) =>
    apiClient.post<Offer>(`/api/offers/${offerId}/counter`, body),

  withdrawOffer: (offerId: number) =>
    apiClient.post<Offer>(`/api/offers/${offerId}/withdraw`),

  /** 我发出的出价。 */
  listMyOffers: (params: OfferListParams = {}) =>
    apiClient.get<{ items: OfferWithDetail[]; total: number }>(
      "/api/offers/me",
      { status: params.status, page: params.page, pageSize: params.pageSize },
    ),

  /** 我收到的出价（卖家侧）。 */
  listIncomingOffers: (params: OfferListParams = {}) =>
    apiClient.get<{ items: OfferWithDetail[]; total: number }>(
      "/api/offers/me/incoming",
      { status: params.status, page: params.page, pageSize: params.pageSize },
    ),

  /** 商品详情页的整条议价记录。 */
  listProductOffers: (productId: number) =>
    apiClient.get<ProductOfferThread>(`/api/offers/product/${productId}`),
};

// ============================================================================
// 展示辅助
// ============================================================================

type TranslateFn = (
  key: string,
  options?: Record<string, string | number>,
) => string;

const passthrough: TranslateFn = (key) => key;

/** 订单状态文案。传入 `useTranslation()` 的 `t` 以获得本地化结果。 */
export function formatOrderStatus(status: OrderStatus, t?: TranslateFn): string {
  const tr = t ?? passthrough;
  const key = `trading.orderStatus.${status}`;
  const translated = tr(key);
  return translated !== key ? translated : status;
}

/** 出价状态文案。 */
export function formatOfferStatus(status: OfferStatus, t?: TranslateFn): string {
  const tr = t ?? passthrough;
  const key = `trading.offerStatus.${status}`;
  const translated = tr(key);
  return translated !== key ? translated : status;
}

/**
 * 订单是否处于「已结束」阶段——用于决定卡片是否还展示操作按钮。
 */
export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return (
    status === "settled" ||
    status === "refunded" ||
    status === "refunded_auto" ||
    status === "resolved"
  );
}
