/**
 * 秀场服务 - 处理所有秀场相关的 API 调用
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

// 秀场类型
export interface Show {
  id: number;
  brand: string;
  season: string;
  title?: string;
  coverImage?: string;
  showUrl?: string;
  year?: number;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 秀场列表响应
export interface ShowListResponse {
  shows: Show[];
  total: number;
  page: number;
  pageSize: number;
}

// 秀场搜索参数
export interface ShowSearchParams {
  keyword?: string;
  brand?: string;
  year?: number;
  category?: string;
  page?: number;
  pageSize?: number;
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

/**
 * 获取秀场列表
 * GET /api/shows
 */
export const getShows = async (
  params: ShowSearchParams = {}
): Promise<ShowListResponse> => {
  const queryParams = new URLSearchParams();

  if (params.keyword) queryParams.append("keyword", params.keyword);
  if (params.brand) queryParams.append("brand", params.brand);
  if (params.year) queryParams.append("year", params.year.toString());
  if (params.category) queryParams.append("category", params.category);
  if (params.page) queryParams.append("page", params.page.toString());
  if (params.pageSize) queryParams.append("pageSize", params.pageSize.toString());

  const queryString = queryParams.toString();
  const endpoint = `/api/shows${queryString ? `?${queryString}` : ""}`;

  return request<ShowListResponse>(endpoint, {
    method: "GET",
  });
};

/**
 * 搜索秀场
 * GET /api/shows/search
 */
export const searchShows = async (
  keyword: string,
  limit: number = 50
): Promise<Show[]> => {
  const result = await request<{ shows: Show[]; total: number }>(
    `/api/shows/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`,
    { method: "GET" }
  );
  return result.shows;
};

/**
 * 获取某品牌的所有秀场
 * GET /api/shows/by-brand/{brandName}
 */
export const getShowsByBrand = async (brandName: string): Promise<Show[]> => {
  const result = await request<{ shows: Show[]; total: number }>(
    `/api/shows/by-brand/${encodeURIComponent(brandName)}`,
    { method: "GET" }
  );
  return result.shows;
};

/**
 * 通过 ID 获取秀场详情
 * GET /api/shows/{showId}
 */
export const getShowById = async (showId: number): Promise<Show | null> => {
  return request<Show | null>(`/api/shows/${showId}`, {
    method: "GET",
  });
};

/**
 * 通过 URL 获取秀场详情
 * GET /api/shows/by-url
 */
export const getShowByUrl = async (showUrl: string): Promise<Show | null> => {
  return request<Show | null>(
    `/api/shows/by-url?url=${encodeURIComponent(showUrl)}`,
    { method: "GET" }
  );
};

/**
 * 获取秀场年份列表
 * GET /api/shows/years
 */
export const getShowYears = async (): Promise<number[]> => {
  const result = await request<{ years: number[] }>(`/api/shows/years`, {
    method: "GET",
  });
  return result.years;
};

/**
 * 获取秀场类别列表
 * GET /api/shows/categories
 */
export const getShowCategories = async (): Promise<string[]> => {
  const result = await request<{ categories: string[] }>(
    `/api/shows/categories`,
    { method: "GET" }
  );
  return result.categories;
};

// 导出服务对象
export const showService = {
  getShows,
  searchShows,
  getShowsByBrand,
  getShowById,
  getShowByUrl,
  getShowYears,
  getShowCategories,
};
