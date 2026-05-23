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

export interface Order {
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

export async function confirmOrder(orderId: number): Promise<Order> {
  return request<Order>(`/api/orders/${orderId}/confirm`, { method: "POST" });
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
