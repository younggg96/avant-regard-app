/**
 * 买手店数据服务
 * 管理买手店数据的获取、筛选和推荐功能
 *
 * HTTP 底座统一走 `./http.ts`，享受瞬时 5xx 退避重试、401 刷新、统一信封解包。
 */

import { request } from "./http";

/**
 * 个人「贡献」列表一次性拉取的最大条数。
 * 后端 submissions 接口已取消硬上限，这里用足够大的值覆盖绝大多数用户，
 * 避免贡献 > 100 时被旧的 pageSize=100 截断。
 */
export const CONTRIBUTION_PAGE_SIZE = 1000;

export interface BuyerStore {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  } | null;
  brands: string[];
  style: string[];
  isOpen: boolean;
  phone?: string[];
  hours?: string;
  rating?: number;
  description?: string;
  images?: string[];
  rest?: string;
  distance?: number;
  favoriteCount?: number;
  /**
   * 是否有认证商家入驻 —— 由后端 `withMerchantFirst=true` 路径 / `/buyer-stores/all`
   * 路径回填。其他接口不保证这个字段，因此标记为可选；渲染侧一律当成
   * `hasMerchant === true` 才视为已入驻。
   */
  hasMerchant?: boolean;
}

export function hasValidCoordinates(
  store: BuyerStore
): store is BuyerStore & { coordinates: { latitude: number; longitude: number } } {
  return (
    store.coordinates != null &&
    store.coordinates.latitude !== 0 &&
    store.coordinates.longitude !== 0 &&
    !isNaN(store.coordinates.latitude) &&
    !isNaN(store.coordinates.longitude)
  );
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
  /**
   * 是否把已入驻商家店铺排在前面。
   * 仅 `/api/buyer-stores` 路径支持；`/buyer-stores/all` 永远走优先排序，
   * 对 caller 透明。
   */
  withMerchantFirst?: boolean;
}

// 品牌推荐响应
export interface BrandRecommendation {
  stores: BuyerStore[];
  relatedBrands: string[];
}

// 地图视口查询参数
export interface ViewportStoreParams {
  ne_lat: number;
  ne_lng: number;
  sw_lat: number;
  sw_lng: number;
  country?: string;
  city?: string;
  brand?: string;
  style?: string;
  styles?: string[];
  openOnly?: boolean;
  hasPhone?: boolean;
  searchQuery?: string;
}

/**
 * 获取所有买手店（自动分页，拉满整张目录后返回）。
 *
 * 注意 / 坑点：
 * - 这个函数会**忽略 caller 传入的 `pageSize`**，内部硬编码 `PAGE_SIZE = 200`
 *   并循环拉取直到 `result.stores.length < PAGE_SIZE` 才停手。也就是说
 *   "我只要前 N 家" 这种用例用 `getAllStores({ pageSize: N })` 是达不到
 *   目的的，反而会触发 `page=1&pageSize=200` + `page=2&pageSize=200` +…
 *   的连续请求。冷启动网络拥塞时极易把下载槽全占完。
 * - 只需要一页数据（比如首屏的"店铺选择条" / "Home 精选" 这种） 请直接
 *   使用 `getStoresPaginated({ page: 1, pageSize: 20 })`，不要用这个函数。
 * - 仅在真正需要"离线全量缓存 / 地图视口外兜底 / 批处理"时才用这个函数。
 *
 * 终止条件：**只看本页是否返回了一个完整页（PAGE_SIZE 条）**。
 * 不要再用 `allStores.length >= result.total` 提前退出，因为后端
 *   - page == 1 时用 `count="planned"`（PostgREST 规划器估算，本身就可能偏差）
 *   - page >= 2 时完全不带 count，`total` 直接是 0
 * 之前条件 `allStores.length >= result.total` 在 page 2 时永远成立（400 >= 0），
 * 导致整张目录被截断到最多 400 家，城市排序靠后的店（如 "纽约 New York"）
 * 永远拉不到，从而地图上没有对应 marker。
 *
 * 加 `MAX_PAGES` 是为了万一后端坏掉返回稳定 PAGE_SIZE 条，不至于死循环把
 * 客户端流量打爆。
 *
 * GET /api/buyer-stores
 */
export const getAllStores = async (
  params: BuyerStoreFilterParams = {}
): Promise<BuyerStore[]> => {
  const PAGE_SIZE = 200; // API 最大支持 200
  const MAX_PAGES = 100; // 安全阀：最多拉 20k 条，足够覆盖业务量
  let allStores: BuyerStore[] = [];

  for (let currentPage = 1; currentPage <= MAX_PAGES; currentPage++) {
    const result = await getStoresPaginated({
      ...params,
      page: currentPage,
      pageSize: PAGE_SIZE,
    });

    allStores = [...allStores, ...result.stores];

    if (result.stores.length < PAGE_SIZE) break;
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
  if (filters.withMerchantFirst) queryParams.append("withMerchantFirst", "true");
  queryParams.append("page", (filters.page || 1).toString());
  queryParams.append("pageSize", (filters.pageSize || 20).toString());

  const queryString = queryParams.toString();
  const endpoint = `/api/buyer-stores?${queryString}`;

  return request<BuyerStoreListResponse>(endpoint, {
    method: "GET",
  });
};

/**
 * "查看全部买手店" 页专用：永远走入驻优先排序。
 * GET /api/buyer-stores/all
 *
 * 和 `getStoresPaginated({ withMerchantFirst: true })` 的语义一致，
 * 但返回的每个 store 一定带 `hasMerchant` 字段，可用于 UI 打徽章。
 */
export const getAllBuyerStores = async (
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
  queryParams.append("pageSize", (filters.pageSize || 30).toString());

  const endpoint = `/api/buyer-stores/all?${queryParams.toString()}`;
  return request<BuyerStoreListResponse>(endpoint, { method: "GET" });
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
 * 获取地图视口范围内的买手店
 * POST /api/buyer-stores/viewport
 */
export const getStoresInViewport = async (
  params: ViewportStoreParams
): Promise<BuyerStore[]> => {
  const result = await request<{ stores: BuyerStore[]; total: number }>(
    `/api/buyer-stores/viewport`,
    {
      method: "POST",
      body: JSON.stringify(params),
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
 * 获取指定用户已通过审核的买手店提交（公开接口）
 * GET /api/buyer-stores/submissions/user/{userId}
 */
export const getSubmissionsByUser = async (
  userId: number,
  page: number = 1,
  pageSize: number = 20
): Promise<{ stores: UserSubmittedStore[]; total: number }> => {
  return request<{ stores: UserSubmittedStore[]; total: number }>(
    `/api/buyer-stores/submissions/user/${userId}?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

/**
 * 删除自己的买手店提交（仅限 PENDING/REJECTED）
 * DELETE /api/buyer-stores/submissions/{submissionId}
 */
export const deleteMyStoreSubmission = async (
  submissionId: number
): Promise<void> => {
  await request<null>(
    `/api/buyer-stores/submissions/${submissionId}`,
    { method: "DELETE" }
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

/**
 * 批量审核用户提交的买手店（管理员）
 * PUT /api/buyer-stores/submissions/batch-review
 */
export const batchReviewSubmissions = async (
  data: {
    submissionIds: number[];
    status: "APPROVED" | "REJECTED";
    rejectReason?: string;
  }
): Promise<{ success: number; failed: number; failedIds: number[] }> => {
  return request<{ success: number; failed: number; failedIds: number[] }>(
    `/api/buyer-stores/submissions/batch-review`,
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
  likedByMe?: boolean;
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

// ==================== 用户买手店动态接口 ====================

export interface UserStoreActivityStore {
  storeId: string;
  storeName: string;
  storeCity: string;
  storeCountry: string;
  storeImage?: string;
}

export interface UserFavoritedStore extends UserStoreActivityStore {
  createdAt: string;
}

export interface UserStoreCommentItem extends UserStoreActivityStore {
  commentId: number;
  content: string;
  likeCount: number;
  createdAt: string;
}

export interface UserStoreRatingItem extends UserStoreActivityStore {
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserStoreActivity {
  favorites: UserFavoritedStore[];
  favoritesTotal: number;
  comments: UserStoreCommentItem[];
  commentsTotal: number;
  ratings: UserStoreRatingItem[];
  ratingsTotal: number;
}

/**
 * 获取当前用户的买手店动态（收藏、评论、评分）
 * GET /api/buyer-stores/user/activity
 */
export const getUserStoreActivity = async (): Promise<UserStoreActivity> => {
  return request<UserStoreActivity>(`/api/buyer-stores/user/activity`, {
    method: "GET",
  });
};

// ==================== 买手店详情扩展接口 ====================

export interface BuyerStoreDetail extends BuyerStore {
  averageRating?: number;
  ratingCount: number;
  commentCount: number;
  favoriteCount: number;
  isFavorited: boolean;
  userRating?: number;
  contributorName?: string;
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
  getStoresInViewport,
  searchStores,
  createStore,
  updateStore,
  deleteStore,
  batchCreateStores,
  // 用户提交
  submitStore,
  getMySubmissions,
  deleteMyStoreSubmission,
  getSubmissionsByUser,
  getPendingSubmissions,
  reviewSubmission,
  batchReviewSubmissions,
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
  // 用户动态
  getUserStoreActivity,
};
