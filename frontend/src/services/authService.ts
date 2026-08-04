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

/**
 * Error thrown by {@link request} when an HTTP request fails or the backend
 * envelope `{code, message, data}` reports a non-zero code.
 *
 * Carries `status` (HTTP status, 0 = network/timeout) so callers can tell
 * apart "真的认证拒绝" (401/403) from "瞬时网络/服务端抖动" (0, 5xx). This is
 * critical for refresh-token flow: we MUST NOT log the user out on transient
 * errors.
 */
export class AuthRequestError extends Error {
  status: number;
  isTransient: boolean;
  constructor(message: string, status: number, isTransient: boolean) {
    super(message);
    this.name = "AuthRequestError";
    this.status = status;
    this.isTransient = isTransient;
  }
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

export interface ChangePasswordParams {
  userId: number;
  oldPassword: string;
  newPassword: string;
}

export interface RefreshTokenParams {
  refreshToken: string;
}

/** 后端/网关 transient 故障状态码。命中即可重试。 */
const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);

/** 通用请求方法 */
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

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (error) {
    // 网络错误 / DNS 失败 / 超时。视为可重试的瞬时错误，status=0。
    const message =
      error instanceof Error && error.message
        ? error.message
        : "网络请求失败，请检查网络连接";
    throw new AuthRequestError(message, 0, true);
  }

  const contentType = response.headers.get("content-type");

  if (!response.ok) {
    let errorMessage = "请求失败";
    if (contentType?.includes("application/json")) {
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.message ||
          errorData.error ||
          (typeof errorData.detail === "string"
            ? errorData.detail
            : Array.isArray(errorData.detail)
              ? // FastAPI 422 Pydantic 校验失败:
                // detail = [{ loc: ["body","code"], msg: "...", type: "..." }, ...]
                errorData.detail
                  .map((d: { loc?: unknown[]; msg?: string }) => {
                    const field =
                      Array.isArray(d.loc) && d.loc.length > 1
                        ? String(d.loc[d.loc.length - 1])
                        : "field";
                    return `${field}: ${d.msg || "invalid"}`;
                  })
                  .join("; ")
              : errorMessage);
      } catch {
        // body 不是 JSON 时退回到状态码描述
      }
    } else {
      try {
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}`;
      } catch {
        errorMessage = `HTTP ${response.status}`;
      }
    }
    // Some older backend builds mapped upstream 503 into HTTP 401 with the
    // 503 text in `detail`. Treat that as transient so we retry instead of
    // logging the user out.
    const isTransient =
      TRANSIENT_HTTP_STATUSES.has(response.status) ||
      /503|502|504|temporarily unavailable|service unavailable|bad gateway|gateway timeout/i.test(
        errorMessage
      );
    throw new AuthRequestError(errorMessage, response.status, isTransient);
  }

  if (contentType?.includes("application/json")) {
    const jsonResponse = await response.json();

    // 处理包装的 API 响应格式 { code, message, data }
    if (
      jsonResponse &&
      typeof jsonResponse === "object" &&
      "code" in jsonResponse
    ) {
      const apiResponse = jsonResponse as ApiResponse<T>;
      if (apiResponse.code !== 0) {
        const transient =
          apiResponse.code === 502 ||
          apiResponse.code === 503 ||
          apiResponse.code === 504;
        throw new AuthRequestError(
          apiResponse.message || "请求失败",
          response.status,
          transient
        );
      }
      if ("data" in apiResponse) {
        return apiResponse.data;
      }
    }

    return jsonResponse as T;
  }

  // 对于纯文本响应（如 "Code sent"）
  const text = await response.text();
  return text as unknown as T;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `request` 的带重试封装，仅对**瞬时错误**（网络层 / 5xx）退避重试。
 *
 * 关键用途是 token refresh：用户隔几天打开 app 时，无线唤醒/后端冷启动很容
 * 易让一次刷新失败。没有重试就会直接 logout 用户。注意我们**不**在 401/403
 * 上重试——那意味着 refresh token 真的失效了，重试也救不回来。
 */
async function requestWithRetry<T>(
  endpoint: string,
  options: RequestInit = {},
  retries = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await request<T>(endpoint, options);
    } catch (err) {
      lastError = err;
      const isTransient =
        err instanceof AuthRequestError && err.isTransient;
      if (!isTransient || attempt === retries) {
        throw err;
      }
      // 指数退避：500ms -> 1s -> 2s -> 4s
      await sleep(baseDelayMs * Math.pow(2, attempt));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new AuthRequestError("请求失败", 0, true);
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
 * 修改密码
 * POST /api/auth/change-password
 */
export async function changePassword(
  params: ChangePasswordParams
): Promise<string> {
  return request<string>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 刷新 Token
 * POST /api/auth/refresh
 * 使用 Supabase refresh token
 *
 * 使用 retry 版本：对瞬时网络/5xx 故障最多退避重试 3 次（总耗时 ~7.5s）。
 * 用户隔几天再开 app 时这层韧性非常关键，否则一次网络抖动就会把用户登出。
 * 注意：refresh token 真正失效（401/403）不会被重试。
 */
export async function refreshToken(
  params: RefreshTokenParams
): Promise<LoginResponse> {
  return requestWithRetry<LoginResponse>(
    "/api/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify(params),
    },
    3,
    500
  );
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
  changePassword,
  refreshToken,
  logout,
};

export default authService;
