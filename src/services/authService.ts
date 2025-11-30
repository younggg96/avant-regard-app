/**
 * 认证服务 - 处理所有认证相关的 API 调用
 */

const API_BASE_URL = "http://42.193.122.67:8080";

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
  admin: boolean;
  userType: string;
  accessToken: string;
  refreshToken: string;
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
}

export interface RegisterParams {
  phone: string;
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

export interface RefreshTokenParams {
  refreshToken: string;
}

// 通用请求方法
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

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
      if (jsonResponse && typeof jsonResponse === 'object' && 'code' in jsonResponse) {
        const apiResponse = jsonResponse as ApiResponse<T>;
        
        // 检查业务错误码
        if (apiResponse.code !== 0) {
          throw new Error(apiResponse.message || "请求失败");
        }
        
        // 返回 data 字段（如果存在）
        if ('data' in apiResponse) {
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
 * 短信验证码登录
 * POST /api/auth/login-sms
 */
export async function loginSms(params: LoginSmsParams): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login-sms", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 用户注册
 * POST /api/auth/register
 */
export async function register(params: RegisterParams): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 发送短信验证码
 * POST /api/auth/sms/send
 */
export async function sendSms(params: SendSmsParams): Promise<string> {
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
 */
export async function refreshToken(
  params: RefreshTokenParams
): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// 导出 authService 对象
export const authService = {
  login,
  loginSms,
  register,
  sendSms,
  forgetPassword,
  refreshToken,
};

export default authService;
