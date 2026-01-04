/**
 * 用户信息服务 - 处理 user-info-controller 相关的 API 调用
 */

import { useAuthStore } from "../store/authStore";
import { config } from "../config/env";

const EXPO_PUBLIC_API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

// API 响应包装类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 用户信息类型
export interface UserInfo {
  userId: number;
  infoId: number;
  username: string;
  bio: string;
  location: string;
  avatarUrl: string;
}

// 更新用户信息请求参数
export interface UpdateUserInfoParams {
  username?: string;
  bio?: string;
  location?: string;
  avatarUrl?: string;
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
          throw new Error(apiResponse.message || "请求失败");
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
    throw new Error("网络请求失败，请检查网络连接");
  }
}

// 文件上传请求方法
async function uploadRequest<T>(
  endpoint: string,
  formData: FormData
): Promise<T> {
  const url = `${EXPO_PUBLIC_API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    Accept: "*/*",
  };

  const token = useAuthStore.getState().getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method: "POST",
    headers,
    body: formData,
  };

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      let errorMessage = "上传失败";
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
          throw new Error(apiResponse.message || "上传失败");
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
    throw new Error("网络请求失败，请检查网络连接");
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
  const formData = new FormData();

  // 处理图片文件
  const filename = imageUri.split("/").pop() || "avatar.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append("file", {
    uri: imageUri,
    name: filename,
    type,
  } as any);

  return uploadRequest<UserInfo>(`/api/user-info/${userId}/avatar`, formData);
}

// 导出 userInfoService 对象
export const userInfoService = {
  getUserInfo,
  updateUserInfo,
  uploadAvatar,
};

export default userInfoService;
