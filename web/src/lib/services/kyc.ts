/**
 * Web 端实名认证 + 收款账户 API 客户端。
 *
 * 对齐移动端 `frontend/src/services/kycService.ts`，后端入口 `/api/kyc/*`。
 *
 * 两条通道：
 *   - 中国大陆：姓名 + 身份证号二要素，同步返回结果（mode=id_two_factor）；
 *   - 海外：Stripe Identity 托管页，证件影像 + 活体自拍（mode=document_selfie），
 *     返回一个 url，web 上新开标签页让用户完成，回来再 refresh 状态。
 */

import { apiClient } from "../api-client";

export type KYCStatus = "none" | "pending" | "approved" | "rejected";

export type PayoutAccountType = "bank" | "alipay" | "wechat" | "stripe_connect";

export interface KYCRecord {
  id?: number | null;
  userId: number;
  realName?: string | null;
  idCardMasked?: string | null;
  idCardFrontUrl?: string | null;
  idCardBackUrl?: string | null;
  holderPhotoUrl?: string | null;
  contactPhone?: string | null;
  status: KYCStatus;
  rejectReason?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  /** 走哪条通道：aliyun（大陆二要素）/ stripe_identity（海外）/ mock_*。 */
  provider?: string | null;
  /** 海外会话式才有：核验出的证件国别（ISO 2 字母）。 */
  verifiedCountry?: string | null;
}

export type IdentitySessionMode = "id_two_factor" | "document_selfie";

export type IdentitySessionStatus =
  | "requires_input"
  | "processing"
  | "verified"
  | "canceled"
  | "requires_action";

export interface IdentitySession {
  mode: IdentitySessionMode;
  provider: string;
  status: IdentitySessionStatus;
  sessionId?: string | null;
  clientSecret?: string | null;
  /** 跳转式托管页 url，web 上用新标签页打开。 */
  url?: string | null;
  kycStatus: KYCStatus;
}

export interface KYCSubmitParams {
  realName: string;
  idCardNo: string;
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
  holderPhotoUrl?: string;
  contactPhone?: string;
}

export interface PayoutAccount {
  id: number;
  userId: number;
  accountType: PayoutAccountType;
  holderName: string;
  accountNoMasked: string;
  accountNoLast4?: string | null;
  bankName?: string | null;
  branchName?: string | null;
  isDefault: boolean;
  createdAt?: string | null;
}

export interface PayoutAccountCreateParams {
  accountType: PayoutAccountType;
  holderName: string;
  accountNo: string;
  bankName?: string;
  branchName?: string;
  isDefault?: boolean;
}

export const kycService = {
  getMyKyc: () => apiClient.get<KYCRecord>("/api/kyc/me"),

  submitKyc: (body: KYCSubmitParams) =>
    apiClient.post<KYCRecord>("/api/kyc/me", body),

  /** 二要素自动审核，通过即置 approved，失败保持 pending 并带 rejectReason。 */
  verifyIdentityAuto: (body: { realName: string; idCardNo: string }) =>
    apiClient.post<KYCRecord>("/api/kyc/me/verify-identity", body),

  /** 发起会话式实名。web 不传 appScheme（那是移动端跳板用的）。 */
  startIdentitySession: (body: { region: "CN" | "US"; email?: string }) =>
    apiClient.post<IdentitySession>("/api/kyc/me/identity-session", body),

  refreshIdentitySession: () =>
    apiClient.post<IdentitySession>("/api/kyc/me/identity-session/refresh"),

  verifyBankCard4: (body: {
    holderName: string;
    idCardNo: string;
    bankNo: string;
    phone: string;
  }) => apiClient.post<{ ok: boolean }>("/api/kyc/me/verify-bank-card", body),

  // ── 收款账户 ──────────────────────────────────────────────────────────────

  listPayoutAccounts: () =>
    apiClient.get<{ items: PayoutAccount[] }>("/api/kyc/me/payout-accounts"),

  createPayoutAccount: (body: PayoutAccountCreateParams) =>
    apiClient.post<PayoutAccount>("/api/kyc/me/payout-accounts", body),

  setDefaultPayoutAccount: (accountId: number) =>
    apiClient.post<{ ok: boolean }>(
      `/api/kyc/me/payout-accounts/${accountId}/default`,
    ),

  deletePayoutAccount: (accountId: number) =>
    apiClient.delete<{ ok: boolean }>(
      `/api/kyc/me/payout-accounts/${accountId}`,
    ),
};

export const PAYOUT_ACCOUNT_TYPES: PayoutAccountType[] = [
  "bank",
  "alipay",
  "wechat",
];

type TranslateFn = (
  key: string,
  options?: Record<string, string | number>,
) => string;

const passthrough: TranslateFn = (key) => key;

export function formatPayoutAccountType(
  type: PayoutAccountType,
  t?: TranslateFn,
): string {
  const tr = t ?? passthrough;
  const key = `trading.kyc.accountType.${type}`;
  const translated = tr(key);
  return translated !== key ? translated : type;
}
