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
 * 获取所有买手店（自动分页获取全部数据）
 * GET /api/buyer-stores
 */
export const getAllStores = async (
  params: BuyerStoreFilterParams = {}
): Promise<BuyerStore[]> => {
  const PAGE_SIZE = 200; // API 最大支持 200
  let allStores: BuyerStore[] = [];
  let currentPage = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await getStoresPaginated({
      ...params,
      page: currentPage,
      pageSize: PAGE_SIZE,
    });

    allStores = [...allStores, ...result.stores];

    // 检查是否还有更多数据
    if (result.stores.length < PAGE_SIZE || allStores.length >= result.total) {
      hasMore = false;
    } else {
      currentPage++;
    }
  }

  return allStores;
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
 * 分页获取买手店列表（返回完整分页信息）
 * GET /api/buyer-stores
 */
export const getStoresPaginated = async (
  filters: BuyerStoreFilterParams = {}
): Promise<BuyerStoreListResponse> => {
  const queryParams = new URLSearchParams();

  if (filters.country) queryParams.append("country", filters.country);
  if (filters.city) queryParams.append("city", filters.city);
  if (filters.brand) queryParams.append("brand", filters.brand);
  if (filters.style) queryParams.append("style", filters.style);
  if (filters.openOnly) queryParams.append("openOnly", "true");
  if (filters.searchQuery) queryParams.append("searchQuery", filters.searchQuery);
  queryParams.append("page", (filters.page || 1).toString());
  queryParams.append("pageSize", (filters.pageSize || 20).toString());

  const queryString = queryParams.toString();
  const endpoint = `/api/buyer-stores?${queryString}`;

  return request<BuyerStoreListResponse>(endpoint, {
    method: "GET",
  });
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

// ==================== 用户提交买手店接口 ====================

export interface UserSubmittedStoreCreate {
  name: string;
  address: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  brands?: string[];
  style?: string[];
  phone?: string[];
  hours?: string;
  description?: string;
  images?: string[];
}

export interface UserSubmittedStore {
  id: number;
  userId: number;
  username: string;
  userAvatar?: string;
  name: string;
  address: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  brands: string[];
  style: string[];
  phone: string[];
  hours?: string;
  description?: string;
  images: string[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectReason?: string;
  reviewedBy?: number;
  reviewedAt?: string;
  approvedStoreId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 提交买手店
 * POST /api/buyer-stores/submit
 */
export const submitStore = async (
  data: UserSubmittedStoreCreate
): Promise<UserSubmittedStore> => {
  return request<UserSubmittedStore>(`/api/buyer-stores/submit`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * 获取我提交的买手店列表
 * GET /api/buyer-stores/submissions/my
 */
export const getMySubmissions = async (
  page: number = 1,
  pageSize: number = 20
): Promise<{ stores: UserSubmittedStore[]; total: number }> => {
  return request<{ stores: UserSubmittedStore[]; total: number }>(
    `/api/buyer-stores/submissions/my?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

/**
 * 获取待审核的买手店列表（管理员）
 * GET /api/buyer-stores/submissions/pending
 */
export const getPendingSubmissions = async (
  page: number = 1,
  pageSize: number = 20
): Promise<{ stores: UserSubmittedStore[]; total: number }> => {
  return request<{ stores: UserSubmittedStore[]; total: number }>(
    `/api/buyer-stores/submissions/pending?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

/**
 * 审核用户提交的买手店（管理员）
 * PUT /api/buyer-stores/submissions/{id}/review
 */
export const reviewSubmission = async (
  submissionId: number,
  data: {
    status: "APPROVED" | "REJECTED";
    rejectReason?: string;
    storeId?: string;
  }
): Promise<UserSubmittedStore> => {
  return request<UserSubmittedStore>(
    `/api/buyer-stores/submissions/${submissionId}/review`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
};

// ==================== 买手店评论接口 ====================

export interface StoreCommentReply {
  id: number;
  storeId: string;
  parentId: number;
  userId: number;
  username: string;
  userAvatar?: string;
  replyToUserId?: number;
  replyToUsername?: string;
  content: string;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreComment {
  id: number;
  storeId: string;
  userId: number;
  username: string;
  userAvatar?: string;
  content: string;
  likeCount: number;
  replyCount: number;
  replies: StoreCommentReply[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 获取评论提示建议
 * GET /api/buyer-stores/comment-suggestions
 */
export const getCommentSuggestions = async (): Promise<string[]> => {
  const result = await request<{ suggestions: string[] }>(
    `/api/buyer-stores/comment-suggestions`,
    { method: "GET" }
  );
  return result.suggestions;
};

/**
 * 获取买手店评论列表
 * GET /api/buyer-stores/{storeId}/comments
 */
export const getStoreComments = async (
  storeId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ comments: StoreComment[]; total: number }> => {
  return request<{ comments: StoreComment[]; total: number }>(
    `/api/buyer-stores/${encodeURIComponent(storeId)}/comments?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

/**
 * 发表买手店评论
 * POST /api/buyer-stores/{storeId}/comments
 */
export const createStoreComment = async (
  storeId: string,
  data: {
    userId: number;
    content: string;
    parentId?: number;
    replyToUserId?: number;
  }
): Promise<StoreComment> => {
  return request<StoreComment>(
    `/api/buyer-stores/${encodeURIComponent(storeId)}/comments`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
};

/**
 * 删除买手店评论
 * DELETE /api/buyer-stores/comments/{commentId}
 */
export const deleteStoreComment = async (
  commentId: number,
  userId: number
): Promise<void> => {
  return request<void>(
    `/api/buyer-stores/comments/${commentId}?userId=${userId}`,
    { method: "DELETE" }
  );
};

/**
 * 点赞买手店评论
 * POST /api/buyer-stores/comments/{commentId}/like
 */
export const likeStoreComment = async (
  commentId: number,
  userId: number
): Promise<void> => {
  return request<void>(
    `/api/buyer-stores/comments/${commentId}/like?userId=${userId}`,
    { method: "POST" }
  );
};

/**
 * 取消点赞买手店评论
 * DELETE /api/buyer-stores/comments/{commentId}/like
 */
export const unlikeStoreComment = async (
  commentId: number,
  userId: number
): Promise<void> => {
  return request<void>(
    `/api/buyer-stores/comments/${commentId}/like?userId=${userId}`,
    { method: "DELETE" }
  );
};

/**
 * 获取评论的所有回复
 * GET /api/buyer-stores/comments/{commentId}/replies
 */
export const getCommentReplies = async (
  commentId: number
): Promise<StoreCommentReply[]> => {
  const result = await request<{ replies: StoreCommentReply[] }>(
    `/api/buyer-stores/comments/${commentId}/replies`,
    { method: "GET" }
  );
  return result.replies;
};

// ==================== 买手店评分接口 ====================

export interface StoreRating {
  id: number;
  storeId: string;
  userId: number;
  username: string;
  userAvatar?: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreRatingStats {
  storeId: string;
  averageRating: number;
  ratingCount: number;
  fiveStarCount: number;
  fourStarCount: number;
  threeStarCount: number;
  twoStarCount: number;
  oneStarCount: number;
}

/**
 * 给买手店评分
 * POST /api/buyer-stores/{storeId}/rate
 */
export const rateStore = async (
  storeId: string,
  userId: number,
  rating: number
): Promise<StoreRating> => {
  return request<StoreRating>(
    `/api/buyer-stores/${encodeURIComponent(storeId)}/rate`,
    {
      method: "POST",
      body: JSON.stringify({ userId, rating }),
    }
  );
};

/**
 * 获取买手店评分统计
 * GET /api/buyer-stores/{storeId}/rating
 */
export const getStoreRatingStats = async (
  storeId: string
): Promise<StoreRatingStats> => {
  return request<StoreRatingStats>(
    `/api/buyer-stores/${encodeURIComponent(storeId)}/rating`,
    { method: "GET" }
  );
};

/**
 * 获取用户对买手店的评分
 * GET /api/buyer-stores/{storeId}/rating/user
 */
export const getUserStoreRating = async (
  storeId: string,
  userId: number
): Promise<StoreRating | null> => {
  return request<StoreRating | null>(
    `/api/buyer-stores/${encodeURIComponent(storeId)}/rating/user?userId=${userId}`,
    { method: "GET" }
  );
};

// ==================== 买手店收藏接口 ====================

/**
 * 收藏买手店
 * POST /api/buyer-stores/{storeId}/favorite
 */
export const favoriteStore = async (
  storeId: string,
  userId: number
): Promise<void> => {
  return request<void>(
    `/api/buyer-stores/${encodeURIComponent(storeId)}/favorite?userId=${userId}`,
    { method: "POST" }
  );
};

/**
 * 取消收藏买手店
 * DELETE /api/buyer-stores/{storeId}/favorite
 */
export const unfavoriteStore = async (
  storeId: string,
  userId: number
): Promise<void> => {
  return request<void>(
    `/api/buyer-stores/${encodeURIComponent(storeId)}/favorite?userId=${userId}`,
    { method: "DELETE" }
  );
};

/**
 * 检查是否已收藏买手店
 * GET /api/buyer-stores/{storeId}/favorite/check
 */
export const checkFavoriteStatus = async (
  storeId: string,
  userId: number
): Promise<boolean> => {
  const result = await request<{ isFavorited: boolean }>(
    `/api/buyer-stores/${encodeURIComponent(storeId)}/favorite/check?userId=${userId}`,
    { method: "GET" }
  );
  return result.isFavorited;
};

/**
 * 获取用户收藏的买手店ID列表
 * GET /api/buyer-stores/favorites/user
 */
export const getUserFavoriteStores = async (
  userId: number,
  page: number = 1,
  pageSize: number = 20
): Promise<{ storeIds: string[]; total: number }> => {
  return request<{ storeIds: string[]; total: number }>(
    `/api/buyer-stores/favorites/user?userId=${userId}&page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

// ==================== 买手店详情扩展接口 ====================

export interface BuyerStoreDetail extends BuyerStore {
  averageRating?: number;
  ratingCount: number;
  commentCount: number;
  favoriteCount: number;
  isFavorited: boolean;
  userRating?: number;
}

/**
 * 获取买手店详情（含社区数据）
 * GET /api/buyer-stores/{storeId}/detail
 */
export const getStoreDetail = async (
  storeId: string,
  userId?: number
): Promise<BuyerStoreDetail> => {
  const params = userId ? `?userId=${userId}` : "";
  return request<BuyerStoreDetail>(
    `/api/buyer-stores/${encodeURIComponent(storeId)}/detail${params}`,
    { method: "GET" }
  );
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
  // 用户提交
  submitStore,
  getMySubmissions,
  getPendingSubmissions,
  reviewSubmission,
  // 评论
  getCommentSuggestions,
  getStoreComments,
  createStoreComment,
  deleteStoreComment,
  likeStoreComment,
  unlikeStoreComment,
  getCommentReplies,
  // 评分
  rateStore,
  getStoreRatingStats,
  getUserStoreRating,
  // 收藏
  favoriteStore,
  unfavoriteStore,
  checkFavoriteStatus,
  getUserFavoriteStores,
  // 详情
  getStoreDetail,
};
