/**
 * 关注服务 - 处理 follow-controller 相关的 API 调用
 */

import { useAuthStore } from "../store/authStore";

const API_BASE_URL = "http://42.193.122.67:8080";

// API 响应包装类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 关注用户请求参数
export interface FollowUserParams {
  followerId: number;
  followingId: number;
}

// 关注设计师请求参数
export interface FollowDesignerParams {
  userId: number;
  designerId: number;
}

// 通用请求方法
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

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
      if (jsonResponse && typeof jsonResponse === 'object' && 'code' in jsonResponse) {
        const apiResponse = jsonResponse as ApiResponse<T>;
        
        if (apiResponse.code !== 0) {
          throw new Error(apiResponse.message || "请求失败");
        }
        
        if ('data' in apiResponse) {
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

// ==================== 设计师关注 ====================

/**
 * 关注设计师
 * POST /api/follow/designer
 */
export async function followDesigner(
  params: FollowDesignerParams
): Promise<void> {
  return request<void>("/api/follow/designer", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 取消关注设计师
 * DELETE /api/follow/designer
 */
export async function unfollowDesigner(
  params: FollowDesignerParams
): Promise<void> {
  return request<void>("/api/follow/designer", {
    method: "DELETE",
    body: JSON.stringify(params),
  });
}

// ==================== 用户关注统计 ====================

/**
 * 查询用户关注的用户人数
 * GET /api/follow/user/{userId}/following/count
 */
export async function getFollowingCount(userId: number): Promise<number> {
  return request<number>(`/api/follow/user/${userId}/following/count`, {
    method: "GET",
  });
}

/**
 * 查询用户关注的设计师人数
 * GET /api/follow/user/{userId}/following-designers/count
 */
export async function getFollowingDesignersCount(
  userId: number
): Promise<number> {
  return request<number>(
    `/api/follow/user/${userId}/following-designers/count`,
    {
      method: "GET",
    }
  );
}

/**
 * 查询某个用户被关注的人数
 * GET /api/follow/user/{userId}/followers/count
 */
export async function getFollowersCount(userId: number): Promise<number> {
  return request<number>(`/api/follow/user/${userId}/followers/count`, {
    method: "GET",
  });
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
  return request<boolean>(
    `/api/follow/user/${followerId}/is-following/${targetUserId}`,
    {
      method: "GET",
    }
  );
}

/**
 * 查询用户是否关注了某个设计师
 * GET /api/follow/designer/{userId}/is-following/{designerId}
 */
export async function isFollowingDesigner(
  userId: number,
  designerId: number
): Promise<boolean> {
  return request<boolean>(
    `/api/follow/designer/${userId}/is-following/${designerId}`,
    {
      method: "GET",
    }
  );
}

/**
 * 查询设计师被关注的用户人数
 * GET /api/follow/designer/{designerId}/followers/count
 */
export async function getDesignerFollowersCount(
  designerId: number
): Promise<number> {
  return request<number>(`/api/follow/designer/${designerId}/followers/count`, {
    method: "GET",
  });
}

// 导出 followService 对象
export const followService = {
  // 用户关注
  followUser,
  unfollowUser,
  // 设计师关注
  followDesigner,
  unfollowDesigner,
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





