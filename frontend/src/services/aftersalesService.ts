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
  | "other";

export type DisputeStatus =
  | "open"
  | "investigating"
  | "resolved_refund"
  | "resolved_release"
  | "withdrawn";

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
  visible: boolean;
  submittedAt?: string | null;
}

export async function submitTradeReview(body: {
  orderId: number;
  rating: number;
  payload?: Record<string, unknown>;
  comment?: string;
}): Promise<TradeReview> {
  return request<TradeReview>("/api/trade-reviews", {
    method: "POST",
    body: JSON.stringify(body),
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
