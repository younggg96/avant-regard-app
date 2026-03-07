/**
 * 认证服务 - 使用 Supabase Auth
 */

import { config } from "../config/env";

const EXPO_PUBLIC_API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

// API 响应包装类型
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 响应类型定义
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

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

// 请求参数类型定义
export interface LoginParams {
  phone: string;
  password: string;
}

export interface LoginSmsParams {
  phone: string;
  code: string;
  username?: string; // 首次登录时可设置用户名
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

export interface AppleLoginParams {
  identityToken: string;
  fullName?: string;
  email?: string;
}

export interface RefreshTokenParams {
  refreshToken: string;
}

// 通用请求方法
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${EXPO_PUBLIC_API_BASE_URL}${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    // 处理非 JSON 响应
    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      let errorMessage = "请求失败";

      if (contentType?.includes("application/json")) {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } else {
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}`;
      }

      throw new Error(errorMessage);
    }

    // 处理成功响应
    if (contentType?.includes("application/json")) {
      const jsonResponse = await response.json();

      // 处理包装的 API 响应格式 { code, message, data }
      if (
        jsonResponse &&
        typeof jsonResponse === "object" &&
        "code" in jsonResponse
      ) {
        const apiResponse = jsonResponse as ApiResponse<T>;

        // 检查业务错误码
        if (apiResponse.code !== 0) {
          throw new Error(apiResponse.message || "请求失败");
        }

        // 返回 data 字段（如果存在）
        if ("data" in apiResponse) {
          return apiResponse.data;
        }
      }

      // 如果不是包装格式，直接返回
      return jsonResponse as T;
    }

    // 对于纯文本响应（如 "Code sent"）
    const text = await response.text();
    return text as unknown as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("网络请求失败，请检查网络连接");
  }
}

/**
 * 密码登录
 * POST /api/auth/login
 */
export async function login(params: LoginParams): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 短信验证码登录（自动注册）
 * POST /api/auth/login-sms
 * 如果用户不存在会自动创建账号
 */
export async function loginSms(params: LoginSmsParams): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login-sms", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 用户注册（带密码）
 * POST /api/auth/register
 */
export async function register(params: RegisterParams): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 邮箱密码登录
 * POST /api/auth/login-email
 */
export async function loginEmail(
  params: EmailLoginParams
): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login-email", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 邮箱验证码登录（自动注册）
 * POST /api/auth/login-email-otp
 */
export async function loginEmailOtp(
  params: EmailLoginOtpParams
): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login-email-otp", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 邮箱注册
 * POST /api/auth/register-email
 */
export async function registerEmail(
  params: EmailRegisterParams
): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/register-email", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 发送邮箱验证码
 * POST /api/auth/email/send
 */
export async function sendEmailOtp(
  params: SendEmailOtpParams
): Promise<string> {
  return request<string>("/api/auth/email/send", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 邮箱重置密码
 * POST /api/auth/forget-password-email
 */
export async function forgetPasswordEmail(
  params: EmailForgetPasswordParams
): Promise<string> {
  return request<string>("/api/auth/forget-password-email", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * Apple 登录
 * POST /api/auth/login-apple
 */
export async function loginApple(
  params: AppleLoginParams
): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login-apple", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 发送短信验证码
 * POST /api/auth/sms/send
 * 使用 Supabase Phone Auth 发送 OTP
 */
export async function sendSms(params: SendSmsParams): Promise<string> {
  console.log("sendSms", params);
  return request<string>("/api/auth/sms/send", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 忘记密码/重置密码
 * POST /api/auth/forget-password
 */
export async function forgetPassword(
  params: ForgetPasswordParams
): Promise<string> {
  return request<string>("/api/auth/forget-password", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 刷新 Token
 * POST /api/auth/refresh
 * 使用 Supabase refresh token
 */
export async function refreshToken(
  params: RefreshTokenParams
): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 登出
 * POST /api/auth/logout
 */
export async function logout(): Promise<void> {
  return request<void>("/api/auth/logout", {
    method: "POST",
  });
}

// 导出 authService 对象
export const authService = {
  login,
  loginSms,
  loginEmail,
  loginEmailOtp,
  registerEmail,
  sendEmailOtp,
  forgetPasswordEmail,
  loginApple,
  register,
  sendSms,
  forgetPassword,
  refreshToken,
  logout,
};

export default authService;
