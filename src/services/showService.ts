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

/**
 * 获取请求头
 */
const getHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  const token = useAuthStore.getState().token;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * 获取秀场列表
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

  const url = `${EXPO_PUBLIC_API_BASE_URL}/shows?${queryParams.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("获取秀场列表失败");
  }

  const result: ApiResponse<ShowListResponse> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || "获取秀场列表失败");
  }

  return result.data;
};

/**
 * 搜索秀场
 */
export const searchShows = async (
  keyword: string,
  limit: number = 50
): Promise<Show[]> => {
  const url = `${EXPO_PUBLIC_API_BASE_URL}/shows/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("搜索秀场失败");
  }

  const result: ApiResponse<{ shows: Show[]; total: number }> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || "搜索秀场失败");
  }

  return result.data.shows;
};

/**
 * 获取某品牌的所有秀场
 */
export const getShowsByBrand = async (brandName: string): Promise<Show[]> => {
  const url = `${EXPO_PUBLIC_API_BASE_URL}/shows/by-brand/${encodeURIComponent(brandName)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("获取品牌秀场失败");
  }

  const result: ApiResponse<{ shows: Show[]; total: number }> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || "获取品牌秀场失败");
  }

  return result.data.shows;
};

/**
 * 通过 ID 获取秀场详情
 */
export const getShowById = async (showId: number): Promise<Show | null> => {
  const url = `${EXPO_PUBLIC_API_BASE_URL}/shows/${showId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("获取秀场详情失败");
  }

  const result: ApiResponse<Show | null> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || "获取秀场详情失败");
  }

  return result.data;
};

/**
 * 通过 URL 获取秀场详情
 */
export const getShowByUrl = async (showUrl: string): Promise<Show | null> => {
  const url = `${EXPO_PUBLIC_API_BASE_URL}/shows/by-url?url=${encodeURIComponent(showUrl)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("获取秀场详情失败");
  }

  const result: ApiResponse<Show | null> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || "获取秀场详情失败");
  }

  return result.data;
};

/**
 * 获取秀场年份列表
 */
export const getShowYears = async (): Promise<number[]> => {
  const url = `${EXPO_PUBLIC_API_BASE_URL}/shows/years`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("获取年份列表失败");
  }

  const result: ApiResponse<{ years: number[] }> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || "获取年份列表失败");
  }

  return result.data.years;
};

/**
 * 获取秀场类别列表
 */
export const getShowCategories = async (): Promise<string[]> => {
  const url = `${EXPO_PUBLIC_API_BASE_URL}/shows/categories`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("获取类别列表失败");
  }

  const result: ApiResponse<{ categories: string[] }> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || "获取类别列表失败");
  }

  return result.data.categories;
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
