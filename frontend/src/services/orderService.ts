/**
 * PRD 模块四 · 订单 / 出价 客户端 API。
 *
 * 后端入口：
 *   /api/orders/*   订单
 *   /api/offers/*   出价
 */
import { request } from "./http";
import i18n from "../i18n";

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
  /** 后端 `/api/orders/me` 系列接口附带的商品摘要;客户端用来渲染订单卡片
   * 上的封面 / 品牌 / 标题, 避免再 N 次 round trip 拉详情。可空。 */
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

// ---------------- Orders ----------------

export async function buyNow(
  productId: number,
  shippingAddress?: Record<string, unknown>,
): Promise<{ order: Order; hold: StockHold }> {
  return request<{ order: Order; hold: StockHold }>("/api/orders/buy-now", {
    method: "POST",
    body: JSON.stringify({ productId, shippingAddress }),
  });
}

/** 买家在 offer 成交后补填收货地址（仅 pending_payment 阶段可写）。 */
export async function setOrderShippingAddress(
  orderId: number,
  shippingAddress: Record<string, unknown>,
): Promise<Order> {
  return request<Order>(`/api/orders/${orderId}/shipping-address`, {
    method: "POST",
    body: JSON.stringify({ shippingAddress }),
  });
}

export async function payOrderMock(orderId: number): Promise<Order> {
  return request<Order>(`/api/orders/${orderId}/pay-mock`, { method: "POST" });
}

// ---------------- Payment (Stripe / Alipay / WeChat) ----------------

export type PaymentProviderId =
  | "alipay"
  | "wechat"
  | "stripe"
  | "mock";

export interface PaymentOption {
  provider: PaymentProviderId;
  name: string;
  iconKey: string;
}

export async function listPaymentOptions(
  orderId: number,
): Promise<{ items: PaymentOption[]; currency: string; amountCents: number }> {
  return request<{ items: PaymentOption[]; currency: string; amountCents: number }>(
    `/api/orders/${orderId}/payment-options`,
  );
}

export async function startPayment(
  orderId: number,
  provider?: PaymentProviderId,
): Promise<Order> {
  return request<Order>(`/api/orders/${orderId}/pay`, {
    method: "POST",
    body: JSON.stringify({ provider: provider ?? null }),
  });
}

export async function confirmPayment(orderId: number): Promise<Order> {
  return request<Order>(`/api/orders/${orderId}/pay/confirm`, {
    method: "POST",
  });
}

export async function shipOrder(
  orderId: number,
  body: { carrier: string; trackingNo: string; images: string[] },
): Promise<Order> {
  return request<Order>(`/api/orders/${orderId}/ship`, {
    method: "POST",
    body: JSON.stringify(body),
  });
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

export async function getOrderShipment(
  orderId: number,
): Promise<Shipment | null> {
  return request<Shipment | null>(`/api/orders/${orderId}/shipment`);
}

/** 买家主动确认签收 (shipped → delivered). */
export async function signOrderReceipt(orderId: number): Promise<Order> {
  return request<Order>(`/api/orders/${orderId}/sign`, { method: "POST" });
}

// ---------------- 物流轨迹 ----------------

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

export async function getOrderTrackingEvents(
  orderId: number,
): Promise<TrackingFeed> {
  return request<TrackingFeed>(`/api/orders/${orderId}/tracking-events`);
}

/** Admin / Mock provider 手动注入事件（dev 联调用）. */
export async function adminInjectTrackingEvent(
  orderId: number,
  body: {
    occurredAt: string;
    statusCode: TrackingStatusCode;
    description?: string;
    location?: string;
    source?: string;
  },
): Promise<TrackingEvent | { deduped: true }> {
  return request<TrackingEvent | { deduped: true }>(
    `/api/admin/orders/${orderId}/tracking-events`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
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

/** 买家确认收货：delivered → completed。
 * 与单纯的状态机推进相比，本接口额外返回结算明细，前端用于跳「确认成功」页。 */
export async function confirmOrder(orderId: number): Promise<ConfirmReceiptResult> {
  return request<ConfirmReceiptResult>(`/api/orders/${orderId}/confirm`, {
    method: "POST",
  });
}

export async function submitInspection(
  orderId: number,
  body: {
    checkedItems: Record<string, boolean>;
    photos: string[];
    note?: string;
  },
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/orders/${orderId}/inspection`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listMyOrders(params: {
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ items: Order[]; total: number; page: number; pageSize: number }> {
  const q = new URLSearchParams();
  if (params.status) q.append("status", params.status);
  if (params.page) q.append("page", String(params.page));
  if (params.pageSize) q.append("pageSize", String(params.pageSize));
  return request<{ items: Order[]; total: number; page: number; pageSize: number }>(
    `/api/orders/me?${q.toString()}`,
  );
}

export async function listMySales(params: {
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ items: Order[]; total: number; page: number; pageSize: number }> {
  const q = new URLSearchParams();
  if (params.status) q.append("status", params.status);
  if (params.page) q.append("page", String(params.page));
  if (params.pageSize) q.append("pageSize", String(params.pageSize));
  return request<{ items: Order[]; total: number; page: number; pageSize: number }>(
    `/api/orders/me/sales?${q.toString()}`,
  );
}

export async function getOrder(orderId: number): Promise<Order> {
  return request<Order>(`/api/orders/${orderId}`);
}

/**
 * 列出当前用户与某位用户之间的全部订单（任一方为买卖关系），按创建时间倒序。
 * 交易聊天 header 下的「订单信息」区块用：默认最新、可切换历史订单。
 */
export async function listOrdersWithUser(
  counterpartUserId: number,
): Promise<{ items: Order[] }> {
  return request<{ items: Order[] }>(
    `/api/orders/with/${counterpartUserId}`,
  );
}

// ---------------- Offers ----------------

export async function createOffer(body: {
  productId: number;
  priceCents: number;
  message?: string;
}): Promise<Offer> {
  return request<Offer>("/api/offers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function acceptOffer(
  offerId: number,
): Promise<{ order: Order; hold: StockHold; offer: Offer }> {
  return request<{ order: Order; hold: StockHold; offer: Offer }>(
    `/api/offers/${offerId}/accept`,
    { method: "POST" },
  );
}

export async function rejectOffer(offerId: number): Promise<Offer> {
  return request<Offer>(`/api/offers/${offerId}/reject`, { method: "POST" });
}

export async function counterOffer(
  offerId: number,
  body: { priceCents: number; message?: string },
): Promise<Offer> {
  return request<Offer>(`/api/offers/${offerId}/counter`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function withdrawOffer(offerId: number): Promise<Offer> {
  return request<Offer>(`/api/offers/${offerId}/withdraw`, { method: "POST" });
}

export async function listMyOffers(params: {
  status?: OfferStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ items: OfferWithDetail[]; total: number }> {
  const q = new URLSearchParams();
  if (params.status) q.append("status", params.status);
  if (params.page) q.append("page", String(params.page));
  if (params.pageSize) q.append("pageSize", String(params.pageSize));
  return request<{ items: OfferWithDetail[]; total: number }>(
    `/api/offers/me?${q.toString()}`,
  );
}

export interface ProductOfferThread {
  /** 该买家对此商品的全部出价（含卖家 counter），按时间升序。 */
  items: OfferWithDetail[];
  /** 当前仍 pending 的最新一条出价；没有进行中的议价时为 null。 */
  current: OfferWithDetail | null;
  /** 商品挂牌价（划线原价用）。 */
  listingPriceCents?: number | null;
  currency?: string | null;
}

/**
 * 买家在商品详情页查看与该商品的整条议价记录。
 * 用于把展示价更新为「收到的 offer 价」并保留原价划线，以及展开「出价记录」。
 */
export async function listProductOffers(
  productId: number,
): Promise<ProductOfferThread> {
  return request<ProductOfferThread>(`/api/offers/product/${productId}`);
}

export async function listIncomingOffers(params: {
  status?: OfferStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ items: OfferWithDetail[]; total: number }> {
  const q = new URLSearchParams();
  if (params.status) q.append("status", params.status);
  if (params.page) q.append("page", String(params.page));
  if (params.pageSize) q.append("pageSize", String(params.pageSize));
  return request<{ items: OfferWithDetail[]; total: number }>(
    `/api/offers/me/incoming?${q.toString()}`,
  );
}

// ---------------- Admin / 售后 ----------------

/**
 * 客服在聊天里点 `order_status` 卡片上的「退款」按钮时调用。
 * 仅 admin / CS 账号可调；后端会自动把 pending_payouts 反向冲账。
 */
export async function adminRefundOrder(
  orderId: number,
  reason?: string,
): Promise<Order> {
  return request<Order>(`/api/admin/orders/${orderId}/refund`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

// ---------------- Admin / Scheduler ----------------

export async function adminRunScheduler(): Promise<{
  holdsExpired: number;
  offersExpired: number;
  ordersRefunded: number;
  ordersAutoConfirmed: number;
  ordersSettled: number;
}> {
  return request<{
    holdsExpired: number;
    offersExpired: number;
    ordersRefunded: number;
    ordersAutoConfirmed: number;
    ordersSettled: number;
  }>("/api/admin/orders/scheduler/run", { method: "POST" });
}

// ---------------- Helpers ----------------

export function formatOrderStatus(status: OrderStatus): string {
  const key = `trading.orderStatus.${status}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : status;
}

export function formatOfferStatus(status: OfferStatus): string {
  const key = `trading.offerStatus.${status}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : status;
}
