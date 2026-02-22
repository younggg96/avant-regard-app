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
  coverImages?: string[];
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

// 通用请求方法
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${EXPO_PUBLIC_API_BASE_URL}${endpoint}`;
  console.log("url", url);

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
 * 获取品牌列表
 * GET /api/brands
 */
export const getBrands = async (
  params: BrandSearchParams = {}
): Promise<BrandListResponse> => {
  const queryParams = new URLSearchParams();

  if (params.keyword) queryParams.append("keyword", params.keyword);
  if (params.category) queryParams.append("category", params.category);
  if (params.page) queryParams.append("page", params.page.toString());
  if (params.pageSize) queryParams.append("pageSize", params.pageSize.toString());

  const queryString = queryParams.toString();
  const endpoint = `/api/brands${queryString ? `?${queryString}` : ""}`;

  return request<BrandListResponse>(endpoint, {
    method: "GET",
  });
};

/**
 * 搜索品牌
 * GET /api/brands/search
 */
export const searchBrands = async (
  keyword: string,
  limit: number = 20
): Promise<Brand[]> => {
  const result = await request<{ brands: Brand[]; total: number }>(
    `/api/brands/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`,
    { method: "GET" }
  );
  return result.brands;
};

/**
 * 通过 ID 获取品牌详情
 * GET /api/brands/{brandId}
 */
export const getBrandById = async (brandId: number): Promise<Brand | null> => {
  return request<Brand | null>(`/api/brands/${brandId}`, {
    method: "GET",
  });
};

/**
 * 通过名称获取品牌详情
 * GET /api/brands/by-name/{name}
 */
export const getBrandByName = async (name: string): Promise<Brand | null> => {
  return request<Brand | null>(
    `/api/brands/by-name/${encodeURIComponent(name)}`,
    { method: "GET" }
  );
};

/**
 * 获取品牌分类列表
 * GET /api/brands/categories
 */
export const getBrandCategories = async (): Promise<string[]> => {
  const result = await request<{ categories: string[] }>(
    `/api/brands/categories`,
    { method: "GET" }
  );
  return result.categories;
};

// 品牌提交参数
export interface SubmitBrandParams {
  name: string;
  category?: string;
  foundedYear?: string;
  founder?: string;
  country?: string;
  website?: string;
  coverImage?: string;
}

// 品牌提交记录
export interface BrandSubmission {
  id: number;
  userId: number;
  name: string;
  category?: string;
  foundedYear?: string;
  founder?: string;
  country?: string;
  website?: string;
  coverImage?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectReason?: string;
  reviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 提交品牌（需登录）
 * POST /api/brands/submit
 */
export const submitBrand = async (
  params: SubmitBrandParams
): Promise<BrandSubmission> => {
  return request<BrandSubmission>("/api/brands/submit", {
    method: "POST",
    body: JSON.stringify(params),
  });
};

/**
 * 获取当前用户的品牌提交记录
 * GET /api/brands/my-submissions
 */
export const getMySubmissions = async (): Promise<BrandSubmission[]> => {
  return request<BrandSubmission[]>("/api/brands/my-submissions", {
    method: "GET",
  });
};

/**
 * 用户上传品牌图片（需登录，等待审核）
 * POST /api/brands/{brandId}/images
 */
export const uploadBrandImage = async (
  brandId: number,
  imageUrl: string
): Promise<void> => {
  return request<void>(`/api/brands/${brandId}/images`, {
    method: "POST",
    body: JSON.stringify({ imageUrl }),
  });
};

// 导出服务对象
export const brandService = {
  getBrands,
  searchBrands,
  getBrandById,
  getBrandByName,
  getBrandCategories,
  submitBrand,
  getMySubmissions,
  uploadBrandImage,
};
