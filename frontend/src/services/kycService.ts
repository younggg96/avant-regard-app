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
