/**
 * Web 端卖家钱包 API 客户端。
 *
 * 对齐移动端 `frontend/src/services/walletService.ts`，后端入口 `/api/wallet/*`。
 *
 * 资金模型：买家确认收货 → 货款进 pendingCents 锁 3 天 → 释放到 availableCents
 * → 卖家发起提现。所以「可提现」和「总收入」永远不是一回事。
 */

import { apiClient } from "../api-client";

export type KYCStatus = "none" | "pending" | "approved" | "rejected";
export type WithdrawalStatus = "pending" | "processing" | "paid" | "rejected";

export interface SellerBalance {
  ownerKind: string;
  ownerUserId?: number | null;
  ownerMerchantId?: number | null;
  availableCents: number;
  pendingCents: number;
  totalPayoutCents: number;
  totalWithdrawnCents: number;
  currency: string;
  lastReleaseAt?: string | null;
  updatedAt?: string | null;
}

export interface WalletSummary {
  balance: SellerBalance;
  upcomingReleaseCents: number;
  pendingCount: number;
  kycStatus: KYCStatus;
  hasDefaultPayoutAccount: boolean;
}

export interface PendingPayoutItem {
  id: number;
  orderId: number;
  orderNo?: string | null;
  amountCents: number;
  grossAmountCents: number;
  commissionCents: number;
  currency: string;
  releaseAt: string;
  status: "locked" | "released" | "reversed";
  createdAt?: string | null;
}

export interface LedgerEntry {
  id: number;
  orderId?: number | null;
  direction: "credit" | "debit";
  amountCents: number;
  currency: string;
  reason: string;
  note?: string | null;
  createdAt?: string | null;
}

export interface Withdrawal {
  id: number;
  userId: number;
  payoutAccountId?: number | null;
  amountCents: number;
  currency: string;
  status: WithdrawalStatus;
  note?: string | null;
  rejectReason?: string | null;
  processedAt?: string | null;
  createdAt?: string | null;
  payoutAccountSummary?: string | null;
}

export interface WithdrawCreateParams {
  amountCents: number;
  payoutAccountId?: number;
  note?: string;
}

export type ConnectStatus =
  | "none"
  | "pending"
  | "active"
  | "restricted"
  | "disabled";

export interface ConnectAccountStatus {
  exists: boolean;
  status: ConnectStatus;
  stripeAccountId?: string | null;
  country?: string | null;
  defaultCurrency?: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsCurrentlyDue: string[];
  requirementsDisabledReason?: string | null;
}

export const walletService = {
  getSummary: () => apiClient.get<WalletSummary>("/api/wallet/me"),

  listPendingPayouts: () =>
    apiClient.get<{ items: PendingPayoutItem[] }>("/api/wallet/me/pending"),

  listLedger: (page = 1, pageSize = 30) =>
    apiClient.get<{ items: LedgerEntry[]; total: number }>(
      "/api/wallet/me/ledger",
      { page, pageSize },
    ),

  listMyWithdrawals: (page = 1, pageSize = 30) =>
    apiClient.get<{ items: Withdrawal[]; total: number }>(
      "/api/wallet/me/withdrawals",
      { page, pageSize },
    ),

  createWithdrawal: (body: WithdrawCreateParams) =>
    apiClient.post<Withdrawal>("/api/wallet/me/withdrawals", body),

  // ── Stripe Connect ────────────────────────────────────────────────────────

  getConnectStatus: () =>
    apiClient.get<ConnectAccountStatus>("/api/wallet/me/connect"),

  /**
   * 幂等创建 Connect 账号并签发一次性 onboarding URL。
   *
   * 不传 appScheme——那是给移动端跳板页决定跳回哪个 App variant 用的。
   * Web 上我们在新标签页打开 Stripe，用户回来后手动/自动 refresh 状态。
   */
  startConnectOnboarding: (body: { country?: string; email?: string } = {}) =>
    apiClient.post<{ url: string; account: ConnectAccountStatus }>(
      "/api/wallet/me/connect/onboard",
      body,
    ),

  refreshConnectStatus: () =>
    apiClient.post<ConnectAccountStatus>("/api/wallet/me/connect/refresh"),
};

// ============================================================================
// 展示辅助
// ============================================================================

type TranslateFn = (
  key: string,
  options?: Record<string, string | number>,
) => string;

const passthrough: TranslateFn = (key) => key;

export function formatLedgerReason(reason: string, t?: TranslateFn): string {
  const tr = t ?? passthrough;
  const key = `trading.wallet.ledger.${reason}`;
  const translated = tr(key);
  return translated !== key ? translated : reason;
}

export function formatWithdrawalStatus(
  status: WithdrawalStatus,
  t?: TranslateFn,
): string {
  const tr = t ?? passthrough;
  const key = `trading.wallet.withdrawalStatus.${status}`;
  const translated = tr(key);
  return translated !== key ? translated : status;
}

export function formatKycStatus(status: KYCStatus, t?: TranslateFn): string {
  const tr = t ?? passthrough;
  const key = `trading.kyc.status.${status}`;
  const translated = tr(key);
  return translated !== key ? translated : status;
}
