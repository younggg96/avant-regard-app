/**
 * 买手店数据服务
 * 管理买手店数据的获取、筛选和推荐功能
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

export interface BuyerStore {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  brands: string[];
  style: string[];
  isOpen: boolean;
  phone?: string[];
  hours?: string;
  rating?: number;
  description?: string;
  images?: string[];
  rest?: string;
  distance?: number; // 距离（附近店铺查询时返回）
}

// 买手店列表响应
export interface BuyerStoreListResponse {
  stores: BuyerStore[];
  total: number;
  page: number;
  pageSize: number;
}

// 筛选参数
export interface BuyerStoreFilterParams {
  country?: string;
  city?: string;
  brand?: string;
  style?: string;
  openOnly?: boolean;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

// 品牌推荐响应
export interface BrandRecommendation {
  stores: BuyerStore[];
  relatedBrands: string[];
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

  const requestConfig: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, requestConfig);
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
 * 获取所有买手店
 * GET /api/buyer-stores
 */
export const getAllStores = async (
  params: BuyerStoreFilterParams = {}
): Promise<BuyerStore[]> => {
  const result = await filterStores(params);
  return result;
};

/**
 * 根据ID获取买手店详情
 * GET /api/buyer-stores/{id}
 */
export const getStoreById = async (id: string): Promise<BuyerStore | null> => {
  return request<BuyerStore | null>(`/api/buyer-stores/${encodeURIComponent(id)}`, {
    method: "GET",
  });
};

/**
 * 根据条件筛选买手店
 * GET /api/buyer-stores
 */
export const filterStores = async (
  filters: BuyerStoreFilterParams
): Promise<BuyerStore[]> => {
  const queryParams = new URLSearchParams();

  if (filters.country) queryParams.append("country", filters.country);
  if (filters.city) queryParams.append("city", filters.city);
  if (filters.brand) queryParams.append("brand", filters.brand);
  if (filters.style) queryParams.append("style", filters.style);
  if (filters.openOnly) queryParams.append("openOnly", "true");
  if (filters.searchQuery) queryParams.append("searchQuery", filters.searchQuery);
  if (filters.page) queryParams.append("page", filters.page.toString());
  if (filters.pageSize) queryParams.append("pageSize", filters.pageSize.toString());

  const queryString = queryParams.toString();
  const endpoint = `/api/buyer-stores${queryString ? `?${queryString}` : ""}`;

  const result = await request<BuyerStoreListResponse>(endpoint, {
    method: "GET",
  });

  return result.stores;
};

/**
 * 获取所有国家列表
 * GET /api/buyer-stores/countries
 */
export const getAllCountries = async (): Promise<string[]> => {
  const result = await request<{ countries: string[] }>(
    `/api/buyer-stores/countries`,
    { method: "GET" }
  );
  return result.countries;
};

/**
 * 获取所有城市列表
 * GET /api/buyer-stores/cities
 */
export const getAllCities = async (country?: string): Promise<string[]> => {
  const queryParams = country ? `?country=${encodeURIComponent(country)}` : "";
  const result = await request<{ cities: string[] }>(
    `/api/buyer-stores/cities${queryParams}`,
    { method: "GET" }
  );
  return result.cities;
};

/**
 * 获取所有风格列表
 * GET /api/buyer-stores/styles
 */
export const getAllStyles = async (): Promise<string[]> => {
  const result = await request<{ styles: string[] }>(
    `/api/buyer-stores/styles`,
    { method: "GET" }
  );
  return result.styles;
};

/**
 * 根据品牌推荐买手店
 * GET /api/buyer-stores/by-brand/{brand}
 */
export const getStoresByBrand = async (brand: string): Promise<BuyerStore[]> => {
  const result = await request<{ stores: BuyerStore[]; total: number }>(
    `/api/buyer-stores/by-brand/${encodeURIComponent(brand)}`,
    { method: "GET" }
  );
  return result.stores;
};

/**
 * 获取品牌关联推荐
 * GET /api/buyer-stores/brand-recommendations/{brand}
 */
export const getBrandRecommendations = async (
  brand: string
): Promise<BrandRecommendation> => {
  const result = await request<{ stores: BuyerStore[]; relatedBrands: string[] }>(
    `/api/buyer-stores/brand-recommendations/${encodeURIComponent(brand)}`,
    { method: "GET" }
  );

  return {
    stores: result.stores,
    relatedBrands: result.relatedBrands,
  };
};

/**
 * 根据用户位置推荐附近的买手店
 * POST /api/buyer-stores/nearby
 */
export const getNearbyStores = async (
  userLocation: { latitude: number; longitude: number },
  radius: number = 50
): Promise<BuyerStore[]> => {
  const result = await request<{ stores: BuyerStore[]; total: number }>(
    `/api/buyer-stores/nearby`,
    {
      method: "POST",
      body: JSON.stringify({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        radius,
      }),
    }
  );

  return result.stores;
};

/**
 * 搜索买手店
 * GET /api/buyer-stores/search
 */
export const searchStores = async (
  keyword: string,
  limit: number = 20
): Promise<BuyerStore[]> => {
  const result = await request<{ stores: BuyerStore[]; total: number }>(
    `/api/buyer-stores/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`,
    { method: "GET" }
  );
  return result.stores;
};

// ==================== 管理员接口 ====================

export interface BuyerStoreCreateParams {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  brands?: string[];
  style?: string[];
  isOpen?: boolean;
  phone?: string[];
  hours?: string;
  rating?: number;
  description?: string;
  images?: string[];
  rest?: string;
}

export interface BuyerStoreUpdateParams {
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  brands?: string[];
  style?: string[];
  isOpen?: boolean;
  phone?: string[];
  hours?: string;
  rating?: number;
  description?: string;
  images?: string[];
  rest?: string;
}

/**
 * 创建买手店（管理员）
 * POST /api/buyer-stores
 */
export const createStore = async (
  store: BuyerStoreCreateParams
): Promise<BuyerStore> => {
  return request<BuyerStore>(`/api/buyer-stores`, {
    method: "POST",
    body: JSON.stringify(store),
  });
};

/**
 * 更新买手店（管理员）
 * PUT /api/buyer-stores/{id}
 */
export const updateStore = async (
  id: string,
  store: BuyerStoreUpdateParams
): Promise<BuyerStore> => {
  return request<BuyerStore>(`/api/buyer-stores/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(store),
  });
};

/**
 * 删除买手店（管理员）
 * DELETE /api/buyer-stores/{id}
 */
export const deleteStore = async (id: string): Promise<void> => {
  await request<null>(`/api/buyer-stores/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
};

/**
 * 批量创建买手店（管理员）
 * POST /api/buyer-stores/batch
 */
export const batchCreateStores = async (
  stores: BuyerStoreCreateParams[]
): Promise<{ count: number }> => {
  return request<{ count: number }>(`/api/buyer-stores/batch`, {
    method: "POST",
    body: JSON.stringify(stores),
  });
};

// 导出服务对象
export const buyerStoreService = {
  getAllStores,
  getStoreById,
  filterStores,
  getAllCountries,
  getAllCities,
  getAllStyles,
  getStoresByBrand,
  getBrandRecommendations,
  getNearbyStores,
  searchStores,
  createStore,
  updateStore,
  deleteStore,
  batchCreateStores,
};
