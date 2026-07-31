/**
 * 用户信息服务 - 处理 user-info-controller 相关的 API 调用
 */

import { useAuthStore } from "../store/authStore";
import { config } from "../config/env";
import { compressBeforeUpload } from "../utils/imageCompression";

const EXPO_PUBLIC_API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

/** 头像/封面上传超时。压缩后通常几秒内完成；给足余量避免弱网误杀。 */
const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * Client-generated failure codes. UI should map these via
 * `getUserInfoErrorMessage` — never show the raw code to users.
 * Server-returned `message` strings pass through unchanged.
 */
export const UserInfoErrorCode = {
  NETWORK: "USER_INFO/NETWORK",
  REQUEST_FAILED: "USER_INFO/REQUEST_FAILED",
  UPLOAD_FAILED: "USER_INFO/UPLOAD_FAILED",
  UPLOAD_TIMEOUT: "USER_INFO/UPLOAD_TIMEOUT",
} as const;

const LEGACY_CLIENT_ERROR_KEYS: Record<string, string> = {
  [UserInfoErrorCode.NETWORK]: "common.networkError",
  [UserInfoErrorCode.REQUEST_FAILED]: "common.requestFailed",
  [UserInfoErrorCode.UPLOAD_FAILED]: "common.uploadFailed",
  [UserInfoErrorCode.UPLOAD_TIMEOUT]: "common.uploadTimeout",
  // Pre-i18n Chinese fallbacks still in older builds / in-flight requests
  "网络请求失败，请检查网络连接": "common.networkError",
  "网络错误，请重试": "common.networkError",
  "请求失败": "common.requestFailed",
  "上传失败": "common.uploadFailed",
  "上传超时，请重试": "common.uploadTimeout",
};

/**
 * Resolve a userInfoService error into a localized alert string.
 * Known client codes (and legacy Chinese fallbacks) map to `common.*`;
 * anything else (typically a server message) is shown as-is.
 */
export function getUserInfoErrorMessage(
  error: unknown,
  t: (key: string) => string,
  fallbackKey: string
): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return t(fallbackKey);
  }
  const i18nKey = LEGACY_CLIENT_ERROR_KEYS[error.message];
  if (i18nKey) return t(i18nKey);
  return error.message;
}

// API 响应包装类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 性别枚举
export type Gender = "MALE" | "FEMALE" | "OTHER";

// 用户信息类型
export interface UserInfo {
  userId: number;
  infoId: number;
  username: string;
  bio: string;
  location: string;
  avatarUrl: string;
  coverUrl?: string;
  primaryTitle?: string;
  preferredLanguage?: string;
  preferredTheme?: "system" | "light" | "dark";
}

// 用户完整资料类型（包含性别、年龄、偏好等）
export interface UserProfileInfo {
  userId: number;
  infoId: number;
  username: string;
  bio: string;
  location: string;
  avatarUrl: string;
  coverUrl?: string;
  gender: Gender;
  age: number;
  preference: string;
  followedBrandIds: number[];
    profileCompleted: boolean; // 是否已完善资料
  userType: string;
}

// 更新用户信息请求参数
export interface UpdateUserInfoParams {
  username?: string;
  bio?: string;
  location?: string;
  avatarUrl?: string;
  coverUrl?: string;
}

// 更新用户资料请求参数（注册后填写）
export interface UpdateUserProfileParams {
  username?: string;
  bio?: string;
  location?: string;
  avatarUrl?: string;
  coverUrl?: string;
  gender?: Gender;
  age?: number;
  preference?: string;
  followedBrandIds?: number[];
  profileCompleted?: boolean; // 是否已完善资料
}

// 用户隐私设置
export interface UserPrivacySettings {
  userId: number;
  hideFollowing: boolean;
  hideFollowers: boolean;
  hideLikes: boolean;
  hideWishlist: boolean;
}

// 更新隐私设置请求参数
export interface UpdatePrivacySettingsParams {
  hideFollowing?: boolean;
  hideFollowers?: boolean;
  hideLikes?: boolean;
  hideWishlist?: boolean;
}

// 通用请求方法
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${EXPO_PUBLIC_API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "*/*",
    ...((options.headers as Record<string, string>) || {}),
  };

  const token = useAuthStore.getState().getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      let errorMessage: string = UserInfoErrorCode.REQUEST_FAILED;
      if (contentType?.includes("application/json")) {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } else {
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}`;
      }
      throw new Error(errorMessage);
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
          throw new Error(
            apiResponse.message || UserInfoErrorCode.REQUEST_FAILED
          );
        }

        if ("data" in apiResponse) {
          return apiResponse.data;
        }
      }

      return jsonResponse as T;
    }

    const text = await response.text();
    return text as unknown as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(UserInfoErrorCode.NETWORK);
  }
}

// 文件上传请求方法（带超时 abort，避免沙漏永久卡住）
async function uploadRequest<T>(
  endpoint: string,
  formData: FormData,
  timeoutMs: number = UPLOAD_TIMEOUT_MS
): Promise<T> {
  const url = `${EXPO_PUBLIC_API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    Accept: "*/*",
  };

  const token = useAuthStore.getState().getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      let errorMessage: string = UserInfoErrorCode.UPLOAD_FAILED;
      if (contentType?.includes("application/json")) {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } else {
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    if (contentType?.includes("application/json")) {
      const jsonResponse = await response.json();

      if (
        jsonResponse &&
        typeof jsonResponse === "object" &&
        "code" in jsonResponse
      ) {
        const apiResponse = jsonResponse as ApiResponse<T>;

        if (apiResponse.code !== 0) {
          throw new Error(
            apiResponse.message || UserInfoErrorCode.UPLOAD_FAILED
          );
        }

        if ("data" in apiResponse) {
          return apiResponse.data;
        }
      }

      return jsonResponse as T;
    }

    const text = await response.text();
    return text as unknown as T;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(UserInfoErrorCode.UPLOAD_TIMEOUT);
      }
      throw error;
    }
    throw new Error(UserInfoErrorCode.NETWORK);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 获取用户个人资料
 * GET /api/user-info/{userId}
 */
export async function getUserInfo(userId: number): Promise<UserInfo> {
  return request<UserInfo>(`/api/user-info/${userId}`, {
    method: "GET",
  });
}

/**
 * 更新用户个人资料
 * PUT /api/user-info/{userId}
 */
export async function updateUserInfo(
  userId: number,
  params: UpdateUserInfoParams
): Promise<UserInfo> {
  return request<UserInfo>(`/api/user-info/${userId}`, {
    method: "PUT",
    body: JSON.stringify(params),
  });
}

/**
 * 上传用户头像
 * POST /api/user-info/{userId}/avatar
 * @param userId 用户ID
 * @param imageUri 图片本地URI
 */
export async function uploadAvatar(
  userId: number,
  imageUri: string
): Promise<UserInfo> {
  const prepared = await compressBeforeUpload(imageUri);
  const formData = new FormData();

  formData.append("file", {
    uri: prepared.uri,
    name: prepared.filename,
    type: prepared.mimeType,
  } as any);

  return uploadRequest<UserInfo>(`/api/user-info/${userId}/avatar`, formData);
}

/**
 * 上传用户背景图
 * POST /api/user-info/{userId}/cover
 * @param userId 用户ID
 * @param imageUri 图片本地URI
 */
export async function uploadCover(
  userId: number,
  imageUri: string
): Promise<UserInfo> {
  const prepared = await compressBeforeUpload(imageUri);
  const formData = new FormData();

  formData.append("file", {
    uri: prepared.uri,
    name: prepared.filename,
    type: prepared.mimeType,
  } as any);

  return uploadRequest<UserInfo>(`/api/user-info/${userId}/cover`, formData);
}

/**
 * 更新用户完整资料（注册成功后填写）
 * PUT /api/user-info/{userId}/profile
 * @param userId 用户ID
 * @param params 用户资料参数（性别/年龄/偏好/地区/可能喜欢的设计师等）
 */
export async function updateUserProfile(
  userId: number,
  params: UpdateUserProfileParams
): Promise<UserProfileInfo> {
  return request<UserProfileInfo>(`/api/user-info/${userId}/profile`, {
    method: "PUT",
    body: JSON.stringify(params),
  });
}

/**
 * 获取用户完整资料
 * GET /api/user-info/{userId}/profile
 * @param userId 用户ID
 */
export async function getUserProfile(userId: number): Promise<UserProfileInfo> {
  return request<UserProfileInfo>(`/api/user-info/${userId}/profile`, {
    method: "GET",
  });
}

/**
 * 获取用户类型（轻量接口，不依赖 user_info 表）
 * GET /api/user-info/{userId}/user-type
 */
export async function getUserType(
  userId: number
): Promise<{ userId: number; isAdmin: boolean; userType: string }> {
  return request<{ userId: number; isAdmin: boolean; userType: string }>(
    `/api/user-info/${userId}/user-type`,
    { method: "GET" }
  );
}

/**
 * 搜索用户（支持用户名模糊搜索和用户ID精确搜索）
 * GET /api/user-info/search
 * @param keyword 搜索关键词
 * @param limit 返回数量限制
 */
export async function searchUsers(
  keyword: string,
  limit: number = 20
): Promise<UserInfo[]> {
  return request<UserInfo[]>(
    `/api/user-info/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`,
    {
      method: "GET",
    }
  );
}

/**
 * 获取用户隐私设置
 * GET /api/user-info/{userId}/privacy
 * @param userId 用户ID
 */
export async function getPrivacySettings(
  userId: number
): Promise<UserPrivacySettings> {
  return request<UserPrivacySettings>(`/api/user-info/${userId}/privacy`, {
    method: "GET",
  });
}

/**
 * 更新用户隐私设置
 * PUT /api/user-info/{userId}/privacy
 * @param userId 用户ID
 * @param params 隐私设置参数
 */
export async function updatePrivacySettings(
  userId: number,
  params: UpdatePrivacySettingsParams
): Promise<UserPrivacySettings> {
  return request<UserPrivacySettings>(`/api/user-info/${userId}/privacy`, {
    method: "PUT",
    body: JSON.stringify(params),
  });
}

// 贡献榜用户类型
export interface ContributionUser {
  rank: number;
  userId: number;
  username: string;
  avatarUrl: string;
  contributionCount: number;
}

/**
 * 获取 Archive 贡献榜
 * GET /api/user-info/contribution-leaderboard
 */
export async function getContributionLeaderboard(
  limit: number = 20
): Promise<ContributionUser[]> {
  return request<ContributionUser[]>(
    `/api/user-info/contribution-leaderboard?limit=${limit}`,
    { method: "GET" }
  );
}

/**
 * 更新用户语言偏好
 * PUT /api/user-info/{userId}/language
 */
export async function updateLanguagePreference(
  userId: number,
  language: string
): Promise<UserInfo> {
  return request<UserInfo>(`/api/user-info/${userId}/language`, {
    method: "PUT",
    body: JSON.stringify({ language }),
  });
}

/**
 * 更新用户主题偏好
 * PUT /api/user-info/{userId}/theme
 */
export async function updateThemePreference(
  userId: number,
  theme: "system" | "light" | "dark"
): Promise<UserInfo> {
  return request<UserInfo>(`/api/user-info/${userId}/theme`, {
    method: "PUT",
    body: JSON.stringify({ theme }),
  });
}

/**
 * Self-service account deletion (Apple Guideline 5.1.1(v))
 * DELETE /api/user-info/{userId}/account
 */
export async function deleteAccount(userId: number): Promise<void> {
  return request<void>(`/api/user-info/${userId}/account`, {
    method: "DELETE",
  });
}

// 用户头衔类型
export interface UserTitle {
  id: number;
  userId: number;
  title: string;
  isPrimary: boolean;
  createdAt?: string;
}

/**
 * 获取用户头衔列表
 * GET /api/user-info/{userId}/titles
 */
export async function getUserTitles(userId: number): Promise<UserTitle[]> {
  return request<UserTitle[]>(`/api/user-info/${userId}/titles`, {
    method: "GET",
  });
}

/**
 * 设置主头衔
 * PUT /api/user-info/{userId}/titles/{titleId}/set-primary
 */
export async function setPrimaryTitle(
  userId: number,
  titleId: number
): Promise<void> {
  return request<void>(
    `/api/user-info/${userId}/titles/${titleId}/set-primary`,
    { method: "PUT" }
  );
}

/**
 * 取消主头衔展示
 * PUT /api/user-info/{userId}/titles/clear-primary
 */
export async function clearPrimaryTitle(userId: number): Promise<void> {
  return request<void>(`/api/user-info/${userId}/titles/clear-primary`, {
    method: "PUT",
  });
}

// 导出 userInfoService 对象
export const userInfoService = {
  getUserInfo,
  updateUserInfo,
  uploadAvatar,
  uploadCover,
  updateUserProfile,
  getUserProfile,
  searchUsers,
  getPrivacySettings,
  updatePrivacySettings,
  updateLanguagePreference,
  getContributionLeaderboard,
  deleteAccount,
  getUserTitles,
  setPrimaryTitle,
  clearPrimaryTitle,
  updateThemePreference,
};

export default userInfoService;
