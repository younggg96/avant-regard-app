/**
 * 社区服务
 */
import { config } from "../config/env";
import { useAuthStore } from "../store/authStore";

const EXPO_PUBLIC_API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

// API 响应包装类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 社区分类
export type CommunityCategory = "GENERAL" | "FASHION" | "LIFESTYLE" | "BEAUTY" | "CULTURE";

// 社区类型
export interface Community {
  id: number;
  name: string;
  slug: string;
  description: string;
  iconUrl: string;
  coverUrl: string;
  category: CommunityCategory;
  isOfficial: boolean;
  isActive: boolean;
  memberCount: number;
  postCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  isFollowing?: boolean;
}

// 社区列表响应
export interface CommunityListResponse {
  popular: Community[];
  following: Community[];
  all: Community[];
}

// 社区统计
export interface CommunityStats {
  memberCount: number;
  postCount: number;
  todayPostCount: number;
  weekPostCount: number;
}

// 通用请求方法 - 默认携带 token，支持自动刷新
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry: boolean = false
): Promise<T> {
  const url = `${EXPO_PUBLIC_API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "*/*",
    ...((options.headers as Record<string, string>) || {}),
  };

  // 自动添加 Authorization header（如果已登录）
  const authStore = useAuthStore.getState();
  let token = authStore.getAccessToken();

  // 如果 token 即将过期，先刷新
  if (
    token &&
    authStore.isTokenExpiringSoon &&
    authStore.isTokenExpiringSoon()
  ) {
    await authStore.refreshTokens();
    token = authStore.getAccessToken();
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const requestConfig: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, requestConfig);
    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      // 如果是 401 错误且不是重试请求，尝试刷新 token 后重试
      if (
        response.status === 401 &&
        !isRetry &&
        authStore.tokens?.refreshToken
      ) {
        const refreshSuccess = await authStore.refreshTokens();
        if (refreshSuccess) {
          return request<T>(endpoint, options, true);
        }
      }

      let errorMessage = "请求失败";

      if (contentType?.includes("application/json")) {
        const errorData = await response.json();
        errorMessage =
          errorData.detail ||
          errorData.message ||
          errorData.error ||
          errorMessage;
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

/**
 * 获取社区列表（热门、关注、全部）
 */
export async function getCommunities(): Promise<CommunityListResponse> {
  return request<CommunityListResponse>("/api/communities", {
    method: "GET",
  });
}

/**
 * 获取热门社区
 */
export async function getPopularCommunities(limit: number = 5): Promise<Community[]> {
  return request<Community[]>(`/api/communities/popular?limit=${limit}`, {
    method: "GET",
  });
}

/**
 * 获取我关注的社区
 */
export async function getFollowingCommunities(): Promise<Community[]> {
  return request<Community[]>("/api/communities/following", {
    method: "GET",
  });
}

/**
 * 获取社区详情
 */
export async function getCommunityById(communityId: number): Promise<Community> {
  return request<Community>(`/api/communities/${communityId}`, {
    method: "GET",
  });
}

/**
 * 通过 slug 获取社区详情
 */
export async function getCommunityBySlug(slug: string): Promise<Community> {
  return request<Community>(`/api/communities/slug/${slug}`, {
    method: "GET",
  });
}

/**
 * 获取社区统计信息
 */
export async function getCommunityStats(communityId: number): Promise<CommunityStats> {
  return request<CommunityStats>(`/api/communities/${communityId}/stats`, {
    method: "GET",
  });
}

/**
 * 关注社区
 */
export async function followCommunity(communityId: number): Promise<void> {
  return request<void>(`/api/communities/${communityId}/follow`, {
    method: "POST",
  });
}

/**
 * 取消关注社区
 */
export async function unfollowCommunity(communityId: number): Promise<void> {
  return request<void>(`/api/communities/${communityId}/follow`, {
    method: "DELETE",
  });
}

/**
 * 搜索社区
 */
export async function searchCommunities(keyword: string, limit: number = 20): Promise<Community[]> {
  return request<Community[]>(
    `/api/communities/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`,
    {
      method: "GET",
    }
  );
}

// 导出 communityService 对象
export const communityService = {
  getCommunities,
  getPopularCommunities,
  getFollowingCommunities,
  getCommunityById,
  getCommunityBySlug,
  getCommunityStats,
  followCommunity,
  unfollowCommunity,
  searchCommunities,
};

export default communityService;
