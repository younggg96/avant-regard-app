/**
 * 品牌服务 - 处理所有品牌相关的 API 调用
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

// 品牌类型
export interface Brand {
  id: number;
  name: string;
  category?: string;
  foundedYear?: string;
  founder?: string;
  country?: string;
  website?: string;
  coverImage?: string;
  latestSeason?: string;
  vogueSlug?: string;
  vogueUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 品牌列表响应
export interface BrandListResponse {
  brands: Brand[];
  total: number;
  page: number;
  pageSize: number;
}

// 品牌搜索参数
export interface BrandSearchParams {
  keyword?: string;
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
 * 获取品牌列表
 */
export const getBrands = async (
  params: BrandSearchParams = {}
): Promise<BrandListResponse> => {
  const queryParams = new URLSearchParams();

  if (params.keyword) queryParams.append("keyword", params.keyword);
  if (params.category) queryParams.append("category", params.category);
  if (params.page) queryParams.append("page", params.page.toString());
  if (params.pageSize) queryParams.append("pageSize", params.pageSize.toString());

  const url = `${EXPO_PUBLIC_API_BASE_URL}/brands?${queryParams.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("获取品牌列表失败");
  }

  const result: ApiResponse<BrandListResponse> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || "获取品牌列表失败");
  }

  return result.data;
};

/**
 * 搜索品牌
 */
export const searchBrands = async (
  keyword: string,
  limit: number = 20
): Promise<Brand[]> => {
  const url = `${EXPO_PUBLIC_API_BASE_URL}/brands/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("搜索品牌失败");
  }

  const result: ApiResponse<{ brands: Brand[]; total: number }> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || "搜索品牌失败");
  }

  return result.data.brands;
};

/**
 * 通过 ID 获取品牌详情
 */
export const getBrandById = async (brandId: number): Promise<Brand | null> => {
  const url = `${EXPO_PUBLIC_API_BASE_URL}/brands/${brandId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("获取品牌详情失败");
  }

  const result: ApiResponse<Brand | null> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || "获取品牌详情失败");
  }

  return result.data;
};

/**
 * 通过名称获取品牌详情
 */
export const getBrandByName = async (name: string): Promise<Brand | null> => {
  const url = `${EXPO_PUBLIC_API_BASE_URL}/brands/by-name/${encodeURIComponent(name)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("获取品牌详情失败");
  }

  const result: ApiResponse<Brand | null> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || "获取品牌详情失败");
  }

  return result.data;
};

/**
 * 获取品牌分类列表
 */
export const getBrandCategories = async (): Promise<string[]> => {
  const url = `${EXPO_PUBLIC_API_BASE_URL}/brands/categories`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("获取分类列表失败");
  }

  const result: ApiResponse<{ categories: string[] }> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || "获取分类列表失败");
  }

  return result.data.categories;
};

// 导出服务对象
export const brandService = {
  getBrands,
  searchBrands,
  getBrandById,
  getBrandByName,
  getBrandCategories,
};
