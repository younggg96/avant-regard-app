/**
 * 卖家钱包客户端 API。
 *
 * 后端入口（/api/wallet/* + /api/kyc/* 见 backend/app/api/routes/wallet.py）：
 *   - 钱包首屏：GET    /wallet/me
 *   - 待解冻列表：GET  /wallet/me/pending
 *   - 资金流水：GET    /wallet/me/ledger
 *   - 提现列表：GET    /wallet/me/withdrawals
 *   - 发起提现：POST   /wallet/me/withdrawals
 */
import { request } from "./http";
import i18n from "../i18n";

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

export interface WithdrawCreateBody {
  amountCents: number;
  payoutAccountId?: number;
  note?: string;
}

export async function getWalletSummary(): Promise<WalletSummary> {
  return request<WalletSummary>("/api/wallet/me");
}

export async function listPendingPayouts(): Promise<{ items: PendingPayoutItem[] }> {
  return request<{ items: PendingPayoutItem[] }>("/api/wallet/me/pending");
}

export async function listLedger(
  page = 1,
  pageSize = 30,
): Promise<{ items: LedgerEntry[]; total: number }> {
  return request<{ items: LedgerEntry[]; total: number }>(
    `/api/wallet/me/ledger?page=${page}&pageSize=${pageSize}`,
  );
}

export async function listMyWithdrawals(
  page = 1,
  pageSize = 30,
): Promise<{ items: Withdrawal[]; total: number }> {
  return request<{ items: Withdrawal[]; total: number }>(
    `/api/wallet/me/withdrawals?page=${page}&pageSize=${pageSize}`,
  );
}

export async function createWithdrawal(
  body: WithdrawCreateBody,
): Promise<Withdrawal> {
  return request<Withdrawal>("/api/wallet/me/withdrawals", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------------- Stripe Connect ----------------

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

export async function getConnectStatus(): Promise<ConnectAccountStatus> {
  return request<ConnectAccountStatus>("/api/wallet/me/connect");
}

/** 创建 Connect 账号(幂等)+ 拿一个一次性 Onboarding URL。
 * 前端用 expo-web-browser 的 openAuthSessionAsync 打开,完成后回调入参的 returnUrl。
 *
 * appScheme: 当前 App variant 的自定义 scheme(avantregard / avantregardna),
 *   传给后端跳板页, 让 Stripe → 跳板页 → 跳回当前 variant 的 App。 */
export async function startConnectOnboarding(
  body: { country?: string; email?: string; appScheme?: string } = {},
): Promise<{ url: string; account: ConnectAccountStatus }> {
  return request<{ url: string; account: ConnectAccountStatus }>(
    "/api/wallet/me/connect/onboard",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

/** 主动从 Stripe 拉一次状态(onboarding 跳回 App 后调一次,确认状态变 active)。 */
export async function refreshConnectStatus(): Promise<ConnectAccountStatus> {
  return request<ConnectAccountStatus>("/api/wallet/me/connect/refresh", {
    method: "POST",
  });
}

export function formatLedgerReason(reason: string): string {
  const key = `trading.wallet.ledger.${reason}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : reason;
}

export function formatWithdrawalStatus(status: WithdrawalStatus): string {
  const key = `trading.wallet.withdrawalStatus.${status}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : status;
}
