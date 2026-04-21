/**
 * Web auth service.
 *
 * Mirror of [frontend/src/services/authService.ts](../../../frontend/src/services/authService.ts)
 * with Apple login removed (per scope decision: web supports only
 * email + phone with password/OTP).
 *
 * Kept as a lightweight, token-less fetch wrapper. Authenticated calls live
 * in [api-client.ts](../api-client.ts). Auth endpoints are always anonymous
 * except `change-password` (which the caller must compose with Bearer).
 */

import { config } from "../config";

interface ApiEnvelope<T> {
  code: number;
  message?: string;
  data: T;
}

// ---------- Response types ----------

export interface LoginResponse {
  userId: number;
  username: string;
  phone: string;
  is_admin: boolean;
  userType: string;
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

// ---------- Request param types ----------

export interface LoginParams {
  phone: string;
  password: string;
}

export interface LoginSmsParams {
  phone: string;
  code: string;
  username?: string;
}

export interface RegisterParams {
  phone: string;
  username: string;
  password: string;
  code: string;
}

export interface SendSmsParams {
  phone: string;
}

export interface ForgetPasswordParams {
  phone: string;
  password: string;
  code: string;
}

export interface EmailLoginParams {
  email: string;
  password: string;
}

export interface EmailLoginOtpParams {
  email: string;
  code: string;
  username?: string;
}

export interface EmailRegisterParams {
  email: string;
  username: string;
  password: string;
  code: string;
}

export interface SendEmailOtpParams {
  email: string;
}

export interface EmailForgetPasswordParams {
  email: string;
  password: string;
  code: string;
}

export interface ChangePasswordParams {
  userId: number;
  oldPassword: string;
  newPassword: string;
}

export interface RefreshTokenParams {
  refreshToken: string;
}

// ---------- Transport ----------

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${config.apiBaseUrl}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
      ...options.headers,
    },
  });

  const contentType = res.headers.get("content-type");

  if (!res.ok) {
    let message = "请求失败";
    if (contentType?.includes("application/json")) {
      try {
        const err = (await res.json()) as { detail?: string; message?: string };
        message = err.detail || err.message || message;
      } catch {
        /* ignore parse errors */
      }
    } else {
      const text = await res.text();
      message = text || `HTTP ${res.status}`;
    }
    throw new Error(message);
  }

  if (contentType?.includes("application/json")) {
    const json = (await res.json()) as unknown;
    if (
      json &&
      typeof json === "object" &&
      "code" in (json as Record<string, unknown>)
    ) {
      const envelope = json as ApiEnvelope<T>;
      if (envelope.code !== 0) {
        throw new Error(envelope.message || "请求失败");
      }
      return envelope.data;
    }
    return json as T;
  }

  const text = await res.text();
  return text as unknown as T;
}

// ---------- Phone (SMS) ----------

export function sendSms(params: SendSmsParams): Promise<string> {
  return request<string>("/api/auth/sms/send", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function loginWithPassword(params: LoginParams): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function loginSms(params: LoginSmsParams): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login-sms", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function register(params: RegisterParams): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function forgetPassword(params: ForgetPasswordParams): Promise<string> {
  return request<string>("/api/auth/forget-password", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ---------- Email ----------

export function sendEmailOtp(params: SendEmailOtpParams): Promise<string> {
  return request<string>("/api/auth/email/send", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function loginEmail(params: EmailLoginParams): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login-email", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function loginEmailOtp(
  params: EmailLoginOtpParams,
): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login-email-otp", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function registerEmail(
  params: EmailRegisterParams,
): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/register-email", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function forgetPasswordEmail(
  params: EmailForgetPasswordParams,
): Promise<string> {
  return request<string>("/api/auth/forget-password-email", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ---------- Token lifecycle ----------

export function refreshToken(
  params: RefreshTokenParams,
): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function logout(accessToken: string): Promise<void> {
  return request<void>("/api/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ---------- Password management (authenticated) ----------

export function changePassword(
  params: ChangePasswordParams,
  accessToken: string,
): Promise<string> {
  return request<string>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(params),
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export const authService = {
  sendSms,
  loginWithPassword,
  loginSms,
  register,
  forgetPassword,
  sendEmailOtp,
  loginEmail,
  loginEmailOtp,
  registerEmail,
  forgetPasswordEmail,
  refreshToken,
  logout,
  changePassword,
};
