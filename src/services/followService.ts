/**
 * 关注服务 - 处理 follow-controller 相关的 API 调用
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

// 关注用户请求参数
export interface FollowUserParams {
  followerId: number;
  targetUserId: number;
}

// 关注的用户信息
export interface FollowingUser {
  userId: number;
  username: string;
  avatar: string;
  bio: string;
  location: string;
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

  console.log("request", url, config);
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

    const jsonResponse = await response.json();

    // 检查业务错误码
    if (
      jsonResponse &&
      typeof jsonResponse === "object" &&
      "code" in jsonResponse
    ) {
      const apiResponse = jsonResponse as ApiResponse<unknown>;
      if (apiResponse.code !== 0) {
        throw new Error(apiResponse.message || "请求失败");
      }
    }

    return jsonResponse as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("网络请求失败，请检查网络连接");
  }
}

// ==================== 用户关注 ====================

/**
 * 关注用户
 * POST /api/follow/user
 */
export async function followUser(params: FollowUserParams): Promise<void> {
  console.log("followUser called with params:", params);
  return request<void>("/api/follow/user", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 取消关注用户
 * DELETE /api/follow/user
 */
export async function unfollowUser(params: FollowUserParams): Promise<void> {
  console.log("unfollowUser called with params:", params);
  return request<void>("/api/follow/user", {
    method: "DELETE",
    body: JSON.stringify(params),
  });
}

/**
 * 获取用户关注的用户列表
 * GET /api/follow/users/{userId}/following-users
 */
export async function getFollowingUsers(
  userId: number
): Promise<FollowingUser[]> {
  console.log("getFollowingUsers called with userId:", userId);
  const response = await request<ApiResponse<FollowingUser[]>>(
    `/api/follow/users/${userId}/following-users`,
    {
      method: "GET",
    }
  );
  console.log("getFollowingUsers response:", JSON.stringify(response));
  return response.data || [];
}

/**
 * 获取用户的粉丝列表
 * GET /api/follow/users/{userId}/followers
 */
export async function getFollowers(userId: number): Promise<FollowingUser[]> {
  const response = await request<ApiResponse<FollowingUser[]>>(
    `/api/follow/users/${userId}/followers`,
    {
      method: "GET",
    }
  );
  return response.data;
}

// ==================== 用户关注统计 ====================

/**
 * 查询用户关注的用户人数
 * GET /api/follow/user/{userId}/following/count
 */
export async function getFollowingCount(userId: number): Promise<number> {
  const response = await request<ApiResponse<number>>(
    `/api/follow/user/${userId}/following/count`,
    {
      method: "GET",
    }
  );
  return response.data;
}

/**
 * 查询某个用户被关注的人数
 * GET /api/follow/user/{userId}/followers/count
 */
export async function getFollowersCount(userId: number): Promise<number> {
  const response = await request<ApiResponse<number>>(
    `/api/follow/user/${userId}/followers/count`,
    {
      method: "GET",
    }
  );
  return response.data;
}

// ==================== 关注状态查询 ====================

/**
 * 查询用户是否关注了某个用户
 * GET /api/follow/user/{followerId}/is-following/{targetUserId}
 */
export async function isFollowingUser(
  followerId: number,
  targetUserId: number
): Promise<boolean> {
  const response = await request<ApiResponse<boolean>>(
    `/api/follow/user/${followerId}/is-following/${targetUserId}`,
    {
      method: "GET",
    }
  );
  return response.data;
}

// ==================== 品牌关注 ====================

// 关注的品牌信息
export interface FollowingBrand {
  brandId: number;
  name: string;
  category: string;
  coverImage: string;
  country: string;
  followersCount: number;
}

// 关注品牌请求参数
export interface FollowBrandParams {
  userId: number;
  brandId: number;
}

/**
 * 关注品牌
 * POST /api/follow/brand
 */
export async function followBrand(params: FollowBrandParams): Promise<void> {
  return request<void>("/api/follow/brand", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 取消关注品牌
 * DELETE /api/follow/brand
 */
export async function unfollowBrand(params: FollowBrandParams): Promise<void> {
  return request<void>("/api/follow/brand", {
    method: "DELETE",
    body: JSON.stringify(params),
  });
}

/**
 * 批量关注品牌（选完喜欢的品牌后自动关注）
 * POST /api/follow/brand/batch
 */
export async function batchFollowBrands(
  userId: number,
  brandIds: number[]
): Promise<void> {
  return request<void>("/api/follow/brand/batch", {
    method: "POST",
    body: JSON.stringify({ userId, brandIds }),
  });
}

/**
 * 获取用户关注的品牌列表
 * GET /api/follow/users/{userId}/following-brands
 */
export async function getFollowingBrands(
  userId: number
): Promise<FollowingBrand[]> {
  const response = await request<ApiResponse<FollowingBrand[]>>(
    `/api/follow/users/${userId}/following-brands`,
    { method: "GET" }
  );
  return response.data || [];
}

/**
 * 获取品牌的关注者列表
 * GET /api/follow/brand/{brandId}/followers
 */
export async function getBrandFollowers(brandId: number): Promise<FollowingUser[]> {
  const response = await request<ApiResponse<FollowingUser[]>>(
    `/api/follow/brand/${brandId}/followers`,
    { method: "GET" }
  );
  return response.data || [];
}

/**
 * 获取品牌的关注者数量
 * GET /api/follow/brand/{brandId}/followers/count
 */
export async function getBrandFollowersCount(brandId: number): Promise<number> {
  const response = await request<ApiResponse<number>>(
    `/api/follow/brand/${brandId}/followers/count`,
    { method: "GET" }
  );
  return response.data;
}

/**
 * 检查用户是否关注了某个品牌
 * GET /api/follow/user/{userId}/is-following-brand/{brandId}
 */
export async function isFollowingBrand(
  userId: number,
  brandId: number
): Promise<boolean> {
  const response = await request<ApiResponse<boolean>>(
    `/api/follow/user/${userId}/is-following-brand/${brandId}`,
    { method: "GET" }
  );
  return response.data;
}

/**
 * 获取用户关注的品牌 ID 列表
 * GET /api/follow/user/{userId}/following-brand-ids
 */
export async function getFollowingBrandIds(
  userId: number
): Promise<number[]> {
  const response = await request<ApiResponse<number[]>>(
    `/api/follow/user/${userId}/following-brand-ids`,
    { method: "GET" }
  );
  return response.data || [];
}

// 导出 followService 对象
export const followService = {
  // 用户关注
  followUser,
  unfollowUser,
  getFollowingUsers,
  getFollowers,
  // 统计
  getFollowingCount,
  getFollowersCount,
  // 状态查询
  isFollowingUser,
  // 品牌关注
  followBrand,
  unfollowBrand,
  batchFollowBrands,
  getFollowingBrands,
  getBrandFollowers,
  getBrandFollowersCount,
  isFollowingBrand,
  getFollowingBrandIds,
};

export default followService;
