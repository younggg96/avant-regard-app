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

// 关注的设计师信息
export interface FollowingDesigner {
  id: number;
  name: string;
  slug: string;
  designerUrl: string;
  showCount: number;
  totalImages: number;
  latestSeason: string;
  followerCount: number;
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
  const response = await request<ApiResponse<FollowingUser[]>>(
    `/api/follow/users/${userId}/following-users`,
    {
      method: "GET",
    }
  );
  return response.data;
}

// ==================== 设计师关注 ====================

/**
 * 关注设计师
 * POST /api/follow/designers/{designerId}
 */
export async function followDesigner(designerId: number): Promise<void> {
  const response = await request<ApiResponse<{}>>(
    `/api/follow/designers/${designerId}`,
    {
      method: "POST",
    }
  );
}

/**
 * 取消关注设计师
 * DELETE /api/follow/designers/{designerId}
 */
export async function unfollowDesigner(designerId: number): Promise<void> {
  const response = await request<ApiResponse<{}>>(
    `/api/follow/designers/${designerId}`,
    {
      method: "DELETE",
    }
  );
}

/**
 * 获取用户关注的设计师列表
 * GET /api/follow/users/{userId}/following-designers
 */
export async function getFollowingDesigners(
  userId: number
): Promise<FollowingDesigner[]> {
  const response = await request<ApiResponse<FollowingDesigner[]>>(
    `/api/follow/users/${userId}/following-designers`,
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
 * 查询用户关注的设计师人数
 * GET /api/follow/users/{userId}/following-designers/count
 */
export async function getFollowingDesignersCount(
  userId: number
): Promise<number> {
  const response = await request<ApiResponse<number>>(
    `/api/follow/users/${userId}/following-designers/count`,
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

/**
 * 查询用户是否关注了某个设计师
 * GET /api/follow/designer/{userId}/is-following/{designerId}
 */
export async function isFollowingDesigner(
  userId: number,
  designerId: number
): Promise<boolean> {
  const response = await request<ApiResponse<boolean>>(
    `/api/follow/designer/${userId}/is-following/${designerId}`,
    {
      method: "GET",
    }
  );
  return response.data;
}

/**
 * 查询设计师被关注的用户人数
 * GET /api/follow/designer/{designerId}/followers/count
 */
export async function getDesignerFollowersCount(
  designerId: number
): Promise<number> {
  const response = await request<ApiResponse<number>>(
    `/api/follow/designer/${designerId}/followers/count`,
    {
      method: "GET",
    }
  );
  return response.data;
}

// 导出 followService 对象
export const followService = {
  // 用户关注
  followUser,
  unfollowUser,
  getFollowingUsers,
  // 设计师关注
  followDesigner,
  unfollowDesigner,
  getFollowingDesigners,
  // 统计
  getFollowingCount,
  getFollowingDesignersCount,
  getFollowersCount,
  getDesignerFollowersCount,
  // 状态查询
  isFollowingUser,
  isFollowingDesigner,
};

export default followService;
