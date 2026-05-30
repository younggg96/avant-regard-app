/**
 * 实名认证 + 放款账户客户端 API。
 *
 *   - GET   /kyc/me                    我的实名信息
 *   - POST  /kyc/me                    提交实名（首次或重新提交）
 *   - GET   /kyc/me/payout-accounts    放款账户列表
 *   - POST  /kyc/me/payout-accounts    绑定新账户
 *   - POST  /kyc/me/payout-accounts/{id}/default  设默认
 *   - DELETE /kyc/me/payout-accounts/{id}         删除
 */
import { request } from "./http";

export type KYCStatus = "none" | "pending" | "approved" | "rejected";
export type PayoutAccountType =
  | "bank"
  | "alipay"
  | "wechat"
  | "stripe_connect";

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
  /** 走哪条通道:aliyun(中国大陆二要素) / stripe_identity(海外证件+自拍) / mock_*。 */
  provider?: string | null;
  /** 海外会话式才有:核验出的证件国别(ISO 2 字母)。 */
  verifiedCountry?: string | null;
}

/** 会话式实名(海外证件 + 活体自拍)句柄。 */
export type IdentitySessionMode = "id_two_factor" | "document_selfie";
export type IdentitySessionStatus =
  | "requires_input"
  | "processing"
  | "verified"
  | "canceled"
  | "requires_action";

export interface IdentitySession {
  /** id_two_factor → 中国大陆走二要素表单;document_selfie → 海外托管页。 */
  mode: IdentitySessionMode;
  provider: string;
  status: IdentitySessionStatus;
  sessionId?: string | null;
  clientSecret?: string | null;
  /** 跳转式托管页 url,用 expo-web-browser 打开。 */
  url?: string | null;
  kycStatus: KYCStatus;
}

export interface KYCSubmitBody {
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

export interface PayoutAccountCreateBody {
  accountType: PayoutAccountType;
  holderName: string;
  accountNo: string;
  bankName?: string;
  branchName?: string;
  isDefault?: boolean;
}

export async function getMyKyc(): Promise<KYCRecord> {
  return request<KYCRecord>("/api/kyc/me");
}

export async function submitKyc(body: KYCSubmitBody): Promise<KYCRecord> {
  return request<KYCRecord>("/api/kyc/me", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * 二要素自动审核(姓名 + 身份证号)。
 * 通过即把 KYC.status 设为 approved,失败保持 pending 并带 rejectReason。
 */
export async function verifyIdentityAuto(body: {
  realName: string;
  idCardNo: string;
}): Promise<KYCRecord> {
  return request<KYCRecord>("/api/kyc/me/verify-identity", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * 发起会话式实名(海外证件 + 活体自拍)。
 *   - region=CN → 返回 mode='id_two_factor',前端走二要素表单;
 *   - region=US/海外 → 返回 mode='document_selfie' + 托管页 url,
 *     前端用 expo-web-browser 打开,完成后调 refreshIdentitySession 同步。
 * appScheme: 当前 App variant 自定义 scheme,透传给托管页跳板。
 */
export async function startIdentitySession(body: {
  region: "CN" | "US";
  appScheme?: string;
  email?: string;
}): Promise<IdentitySession> {
  return request<IdentitySession>("/api/kyc/me/identity-session", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** 从托管页跳回 App 后主动拉一次会话状态(防 webhook 延迟)。 */
export async function refreshIdentitySession(): Promise<IdentitySession> {
  return request<IdentitySession>("/api/kyc/me/identity-session/refresh", {
    method: "POST",
  });
}

/**
 * 银行卡四要素校验。绑卡前先调,通过才允许 createPayoutAccount。
 */
export async function verifyBankCard4(body: {
  holderName: string;
  idCardNo: string;
  bankNo: string;
  phone: string;
}): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/kyc/me/verify-bank-card", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listPayoutAccounts(): Promise<{ items: PayoutAccount[] }> {
  return request<{ items: PayoutAccount[] }>("/api/kyc/me/payout-accounts");
}

export async function createPayoutAccount(
  body: PayoutAccountCreateBody,
): Promise<PayoutAccount> {
  return request<PayoutAccount>("/api/kyc/me/payout-accounts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function setDefaultPayoutAccount(
  accountId: number,
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(
    `/api/kyc/me/payout-accounts/${accountId}/default`,
    { method: "POST" },
  );
}

export async function deletePayoutAccount(
  accountId: number,
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/kyc/me/payout-accounts/${accountId}`, {
    method: "DELETE",
  });
}
