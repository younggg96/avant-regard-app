/**
 * PRD 模块 5 · 售后 / 鉴定 / 双盲互评 客户端 API。
 *
 * 注意（PDF p.10 设计修正）：
 *   售后默认走「联系客服」IM 入口，不走 DisputeOpenScreen 的表单流程。
 *   下面的 openDispute / withdrawDispute / adminListDisputes 等保留给后台
 *   仲裁队列使用；前端用户侧 UI 优先调 contactSupportForOrder。
 */
import { request } from "./http";

// ---------------- Customer Service (PDF p.10) ----------------

export async function contactSupportForOrder(
  orderId: number,
): Promise<{ conversationId: number; csUserId: number }> {
  return request<{ conversationId: number; csUserId: number }>(
    `/api/trading-support/contact-order/${orderId}`,
    { method: "POST" },
  );
}

/** 常见售后问题 key，与后端 `AFTERSALES_ISSUE_TEMPLATES` 保持一一对应。 */
export type AftersalesIssue =
  | "no_logistics_update"
  | "delivered_not_received"
  | "quality_issue"
  | "listing_delisted";

/**
 * 订单详情底部「售后」入口：选了一个常见问题后调用此 API。
 * 后端会在订单卡片之后再推一条文本，把诉求一并交给客服，避免多次问答。
 */
export async function contactSupportForOrderWithIssue(
  orderId: number,
  issue: AftersalesIssue,
): Promise<{ conversationId: number; csUserId: number; issue?: AftersalesIssue }> {
  return request<{
    conversationId: number;
    csUserId: number;
    issue?: AftersalesIssue;
  }>(`/api/trading-support/contact-order/${orderId}/aftersales`, {
    method: "POST",
    body: JSON.stringify({ issue }),
  });
}

export async function contactSupportForListing(
  productId: number,
): Promise<{ conversationId: number; csUserId: number }> {
  return request<{ conversationId: number; csUserId: number }>(
    `/api/trading-support/contact-listing/${productId}`,
    { method: "POST" },
  );
}

export async function contactSupportGeneral(): Promise<{
  conversationId: number;
  csUserId: number;
}> {
  return request<{ conversationId: number; csUserId: number }>(
    "/api/trading-support/contact",
    { method: "POST" },
  );
}

// ---------------- Disputes ----------------

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
  // 卖家响应（买家 / 卖家分流后新增）
  sellerResponse?: string | null;
  sellerResponseAction?: SellerResponseAction | null;
  sellerResponseAt?: string | null;
  sellerEvidencePhotos?: string[] | null;
  // 卖家售后列表 / 详情接口附带的订单 / 商品上下文
  orderNo?: string | null;
  productId?: number | null;
  productTitle?: string | null;
  productImage?: string | null;
  paidPriceCents?: number | null;
  currency?: string | null;
  buyerUserId?: number | null;
  sellerUserId?: number | null;
}

export async function openDispute(body: {
  orderId: number;
  reason: DisputeReason;
  description?: string;
  evidencePhotos?: string[];
}): Promise<Dispute> {
  return request<Dispute>("/api/disputes", {
    method: "POST",
    body: JSON.stringify({
      orderId: body.orderId,
      reason: body.reason,
      description: body.description,
      evidencePhotos: body.evidencePhotos ?? [],
    }),
  });
}

export async function withdrawDispute(id: number): Promise<Dispute> {
  return request<Dispute>(`/api/disputes/${id}/withdraw`, { method: "POST" });
}

export async function listDisputesForOrder(orderId: number): Promise<Dispute[]> {
  return request<Dispute[]>(`/api/disputes/orders/${orderId}`);
}

/**
 * 卖家端：拉取自己名下所有订单上买家提交的售后请求列表。
 * 可按 status 过滤（open / investigating / resolved_refund ...）。
 */
export async function listSellerDisputes(params?: {
  status?: DisputeStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ items: Dispute[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<{ items: Dispute[]; total: number }>(
    `/api/disputes/seller${suffix}`,
  );
}

/**
 * 卖家端：对买家售后请求做出响应。
 * - agree_refund: 同意退款 → 订单直接退款，无需客服介入。
 * - reject:       拒绝并申诉 → 记录说明 + 凭证，转交客服仲裁。
 */
export async function sellerRespondDispute(
  id: number,
  body: {
    action: SellerResponseAction;
    message?: string;
    evidencePhotos?: string[];
  },
): Promise<Dispute> {
  return request<Dispute>(`/api/disputes/${id}/seller-respond`, {
    method: "POST",
    body: JSON.stringify({
      action: body.action,
      message: body.message,
      evidencePhotos: body.evidencePhotos ?? [],
    }),
  });
}

export async function adminListDisputes(): Promise<{
  items: Dispute[];
  total: number;
}> {
  return request<{ items: Dispute[]; total: number }>(
    "/api/admin/disputes/queue",
  );
}

export async function adminTakeDispute(id: number): Promise<Dispute> {
  return request<Dispute>(`/api/admin/disputes/${id}/take`, { method: "POST" });
}

export async function adminResolveDispute(
  id: number,
  body: { decision: "resolved_refund" | "resolved_release"; note?: string },
): Promise<Dispute> {
  return request<Dispute>(`/api/admin/disputes/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------------- Authentication ----------------

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
  /** 仅 stripe 支付且 createAuthOrder 时返回, 用于拉 PaymentSheet。 */
  clientSecret?: string | null;
  paidAt?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
}

export async function listAuthPackages(): Promise<AuthenticationPackage[]> {
  return request<AuthenticationPackage[]>("/api/authentication/packages");
}

export async function createAuthOrder(body: {
  packageCode: string;
  productId?: number;
  brandName?: string;
  itemPhotos: string[];
  note?: string;
}): Promise<AuthenticationOrder> {
  return request<AuthenticationOrder>("/api/authentication/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function payAuthOrderMock(
  id: number,
): Promise<AuthenticationOrder> {
  return request<AuthenticationOrder>(
    `/api/authentication/orders/${id}/pay-mock`,
    { method: "POST" },
  );
}

export async function listMyAuthOrders(): Promise<{
  items: AuthenticationOrder[];
  total: number;
}> {
  return request<{ items: AuthenticationOrder[]; total: number }>(
    "/api/authentication/orders/me",
  );
}

// ---------------- Trade reviews ----------------

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

/** 导航到 TradeReview 时的通用参数（附带商品摘要）。 */
export function buildTradeReviewParams(order: {
  id: number;
  productId: number;
  product?: {
    title?: string | null;
    coverImage?: string | null;
  } | null;
}) {
  return {
    orderId: order.id,
    productId: order.productId,
    productTitle: order.product?.title ?? undefined,
    productCover: order.product?.coverImage ?? undefined,
  };
}

export async function submitTradeReview(body: {
  orderId: number;
  rating: number;
  payload?: Record<string, unknown>;
  comment?: string;
  photos?: string[];
}): Promise<TradeReview> {
  return request<TradeReview>("/api/trade-reviews", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getOrderReviewStatus(
  orderId: number,
): Promise<OrderReviewStatus> {
  return request<OrderReviewStatus>(
    `/api/trade-reviews/orders/${orderId}/status`,
  );
}

export async function batchOrderReviewStatus(
  orderIds: number[],
): Promise<OrderReviewStatus[]> {
  if (orderIds.length === 0) return [];
  return request<OrderReviewStatus[]>("/api/trade-reviews/status/batch", {
    method: "POST",
    body: JSON.stringify({ orderIds }),
  });
}

export async function listUserReviews(userId: number): Promise<{
  items: TradeReview[];
  total: number;
}> {
  return request<{ items: TradeReview[]; total: number }>(
    `/api/trade-reviews/users/${userId}`,
  );
}

export async function listOrderReviews(orderId: number): Promise<TradeReview[]> {
  return request<TradeReview[]>(`/api/trade-reviews/orders/${orderId}`);
}
