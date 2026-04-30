/**
 * 商家商品系统服务（消费者侧调用）。
 *
 * 对应后端 `backend/app/api/routes/store_product.py` 下所有 `/api/store-merchants/*`
 * 新路由：店铺主页可配置项 / 入口卡片 / 商品分类 / 商品 / 商品点赞 / 商品评论。
 *
 * 只包消费者侧可能调用的接口；商家管理侧（创建/更新/删除 profile / entry-cards /
 * categories / products）由 Web 端 SaaS 调用，不在移动端包装 —— 避免 App 里混入
 * 商家 admin 逻辑，后续做清理时也好找。
 */

import { request } from "./http";

// ============================================================================
// 价格展示工具
// ============================================================================

/**
 * 把整数"分"转成人类可读的金额字符串。
 *
 * 约定：移动端展示永远精确到两位小数（`¥ 58.90` 而不是 `¥ 58.9`），
 * 这个约定是和后端对齐的 —— 后端只存 `price_cents`，前端完全掌握展示格式。
 *
 * 单位符号映射参考 `backend/app/schemas/store_product.py` 中 `currency` 字段，
 * 目前只支持 CNY，保留分支方便未来扩展。
 */
export const formatPrice = (
  priceCents: number | null | undefined,
  currency: string = "CNY"
): string => {
  if (priceCents == null || Number.isNaN(priceCents)) return "";
  const yuan = (priceCents / 100).toFixed(2);
  switch (currency) {
    case "CNY":
    default:
      return `¥ ${yuan}`;
    case "USD":
      return `$ ${yuan}`;
    case "JPY":
      return `¥ ${yuan}`;
  }
};

// ============================================================================
// 店铺主页卡片配置（StoreProfileCard 数据源）
// ============================================================================

export interface StoreProfileConfig {
  storeId: string;
  merchantId?: number | null;
  logoImage?: string | null;
  coverImage?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  tags: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * GET /api/store-merchants/store/{storeId}/profile-config
 *
 * 商家未配置时后端返回 null —— 这里原样透传给 caller，由 caller 决定走
 * Mock 兜底还是展示空态。
 */
export const getStoreProfileConfig = async (
  storeId: string
): Promise<StoreProfileConfig | null> => {
  return request<StoreProfileConfig | null>(
    `/api/store-merchants/store/${encodeURIComponent(storeId)}/profile-config`,
    { method: "GET" }
  );
};

// ============================================================================
// 入口卡片（CategoryCards 数据源）
// ============================================================================

export type EntryCardType =
  | "CLASSIFICATION"  // 分类入口：点击进入分类商品列表
  | "DISCOUNT"        // 折扣入口：点击进入折扣商品列表
  | "EVENT"           // 活动入口：点击进入活动列表
  | "NEW_ARRIVAL";    // 新品入口：点击进入 is_new=TRUE 的商品列表

export interface StoreEntryCard {
  id: number;
  storeId: string;
  merchantId?: number | null;
  cardType: EntryCardType;
  label: string;
  labelEn?: string | null;
  imageUrl: string;
  targetCategoryId?: number | null;
  sortOrder: number;
  status: "PUBLISHED" | "HIDDEN";
}

/**
 * GET /api/store-merchants/store/{storeId}/entry-cards
 * 只返回 PUBLISHED 的卡片，按 sort_order。
 */
export const getStoreEntryCards = async (
  storeId: string
): Promise<StoreEntryCard[]> => {
  const result = await request<{ cards: StoreEntryCard[]; total: number }>(
    `/api/store-merchants/store/${encodeURIComponent(storeId)}/entry-cards`,
    { method: "GET" }
  );
  return result.cards || [];
};

// ============================================================================
// 商品分类
// ============================================================================

export interface StoreProductCategory {
  id: number;
  storeId: string;
  merchantId?: number | null;
  name: string;
  coverImage?: string | null;
  sortOrder: number;
  productCount?: number | null;
}

/**
 * GET /api/store-merchants/store/{storeId}/product-categories
 */
export const getStoreProductCategories = async (
  storeId: string,
  withCount: boolean = false
): Promise<StoreProductCategory[]> => {
  const query = withCount ? "?withCount=true" : "";
  const result = await request<{
    categories: StoreProductCategory[];
    total: number;
  }>(
    `/api/store-merchants/store/${encodeURIComponent(storeId)}/product-categories${query}`,
    { method: "GET" }
  );
  return result.categories || [];
};

// ============================================================================
// 商品
// ============================================================================

export type ProductStatus = "DRAFT" | "PUBLISHED" | "HIDDEN" | "SOLD_OUT";

export interface StoreProduct {
  id: number;
  storeId: string;
  merchantId?: number | null;
  categoryId?: number | null;
  categoryName?: string | null;
  title: string;
  description?: string | null;
  brand?: string | null;
  images: string[];
  priceCents: number;
  currency: string;
  discountPriceCents?: number | null;
  hasDiscount: boolean;
  isNew: boolean;
  tags: string[];
  likeCount: number;
  commentCount: number;
  viewCount: number;
  status: ProductStatus;
  likedByMe?: boolean | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface StoreProductListResponse {
  products: StoreProduct[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductListParams {
  storeId: string;
  categoryId?: number | null;
  isNew?: boolean;
  hasDiscount?: boolean;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

/**
 * GET /api/store-merchants/store/{storeId}/products
 *
 * 同一接口覆盖 4 种消费者列表视图：
 *   - 全部单品：不传筛选
 *   - 分类下的单品：传 categoryId
 *   - 折扣商品：hasDiscount=true
 *   - 新品：isNew=true
 */
export const getStoreProducts = async (
  params: ProductListParams
): Promise<StoreProductListResponse> => {
  const { storeId, ...rest } = params;
  const qs = new URLSearchParams();
  if (rest.categoryId != null) qs.append("categoryId", String(rest.categoryId));
  if (rest.isNew) qs.append("isNew", "true");
  if (rest.hasDiscount) qs.append("hasDiscount", "true");
  if (rest.searchQuery) qs.append("searchQuery", rest.searchQuery);
  qs.append("page", String(rest.page ?? 1));
  qs.append("pageSize", String(rest.pageSize ?? 20));
  return request<StoreProductListResponse>(
    `/api/store-merchants/store/${encodeURIComponent(storeId)}/products?${qs.toString()}`,
    { method: "GET" }
  );
};

/** GET /api/store-merchants/products/{productId} */
export const getStoreProductDetail = async (
  productId: number
): Promise<StoreProduct> => {
  return request<StoreProduct>(`/api/store-merchants/products/${productId}`, {
    method: "GET",
  });
};

// ============================================================================
// 商品点赞（喜欢）
// ============================================================================

/** POST /api/store-merchants/products/{productId}/like */
export const likeStoreProduct = async (productId: number): Promise<void> => {
  await request<{ liked: boolean }>(
    `/api/store-merchants/products/${productId}/like`,
    { method: "POST" }
  );
};

/** DELETE /api/store-merchants/products/{productId}/like */
export const unlikeStoreProduct = async (productId: number): Promise<void> => {
  await request<{ liked: boolean }>(
    `/api/store-merchants/products/${productId}/like`,
    { method: "DELETE" }
  );
};

/** GET /api/store-merchants/products/{productId}/like/check */
export const checkStoreProductLiked = async (
  productId: number
): Promise<boolean> => {
  const result = await request<{ liked: boolean }>(
    `/api/store-merchants/products/${productId}/like/check`,
    { method: "GET" }
  );
  return !!result?.liked;
};

/** GET /api/store-merchants/user/liked-products */
export const listMyLikedStoreProducts = async (
  page: number = 1,
  pageSize: number = 20
): Promise<StoreProductListResponse> => {
  return request<StoreProductListResponse>(
    `/api/store-merchants/user/liked-products?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

// ============================================================================
// 商品评论
// ============================================================================

export interface StoreProductComment {
  id: number;
  productId: number;
  userId?: number | null;
  username?: string | null;
  userAvatar?: string | null;
  parentId?: number | null;
  replyToUserId?: number | null;
  replyToUsername?: string | null;
  content: string;
  likeCount: number;
  replyCount: number;
  likedByMe?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ProductCommentListResponse {
  comments: StoreProductComment[];
  total: number;
  page: number;
  pageSize: number;
}

/** GET /api/store-merchants/products/{productId}/comments */
export const getStoreProductComments = async (
  productId: number,
  page: number = 1,
  pageSize: number = 20
): Promise<ProductCommentListResponse> => {
  return request<ProductCommentListResponse>(
    `/api/store-merchants/products/${productId}/comments?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

/** POST /api/store-merchants/products/{productId}/comments */
export const createStoreProductComment = async (
  productId: number,
  data: { content: string; parentId?: number; replyToUserId?: number }
): Promise<StoreProductComment> => {
  return request<StoreProductComment>(
    `/api/store-merchants/products/${productId}/comments`,
    { method: "POST", body: JSON.stringify(data) }
  );
};

/** DELETE /api/store-merchants/product-comments/{commentId} */
export const deleteStoreProductComment = async (
  commentId: number
): Promise<void> => {
  await request<null>(`/api/store-merchants/product-comments/${commentId}`, {
    method: "DELETE",
  });
};

/** GET /api/store-merchants/product-comments/{commentId}/replies */
export const getStoreProductCommentReplies = async (
  commentId: number
): Promise<StoreProductComment[]> => {
  const result = await request<{ replies: StoreProductComment[] }>(
    `/api/store-merchants/product-comments/${commentId}/replies`,
    { method: "GET" }
  );
  return result.replies || [];
};

/** POST /api/store-merchants/product-comments/{commentId}/like */
export const likeStoreProductComment = async (
  commentId: number
): Promise<void> => {
  await request<{ liked: boolean }>(
    `/api/store-merchants/product-comments/${commentId}/like`,
    { method: "POST" }
  );
};

/** DELETE /api/store-merchants/product-comments/{commentId}/like */
export const unlikeStoreProductComment = async (
  commentId: number
): Promise<void> => {
  await request<{ liked: boolean }>(
    `/api/store-merchants/product-comments/${commentId}/like`,
    { method: "DELETE" }
  );
};
