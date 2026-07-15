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
 * 目前支持 CNY / USD。
 */
export const formatPrice = (
  priceCents: number | null | undefined,
  currency: string = "CNY"
): string => {
  if (priceCents == null || Number.isNaN(priceCents)) return "";
  const amount = (priceCents / 100).toFixed(2);
  switch (currency) {
    case "CNY":
    default:
      return `¥ ${amount}`;
    case "USD":
      return `$ ${amount}`;
    case "JPY":
      return `¥ ${amount}`;
  }
};

/**
 * 商家后台编辑商品时把"元"输入转换为整数"分"。
 *
 * 接受 "5"、"5.0"、"5.99" 这种宽松输入；负数 / NaN / 空串 → null（让 caller
 * 决定是阻止提交还是按"未填"处理）。和 Web 版 `parsePriceInputToCents` 行为一致.
 */
export const parsePriceInputToCents = (input: string): number | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
};

/**
 * 编辑场景：从已存的整数 cents 反向回填表单输入框（避免 "5" 被 toFixed 成 "5.00"）。
 */
export const centsToPriceInput = (cents: number | null | undefined): string => {
  if (cents == null || Number.isNaN(cents)) return "";
  if (cents % 100 === 0) return String(Math.round(cents / 100));
  return (cents / 100).toFixed(2);
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
// 品牌图集（Brand Collections，migration 057）
// ============================================================================

export interface StoreBrandCollection {
  id: number;
  storeId: string;
  merchantId?: number | null;
  brandName: string;
  coverImage: string;
  description?: string | null;
  sortOrder: number;
  status: "PUBLISHED" | "HIDDEN";
  /** 该品牌下 PUBLISHED 商品数（服务端回填） */
  productCount?: number | null;
}

/**
 * GET /api/store-merchants/store/{storeId}/brand-collections
 * 公开：只返回 PUBLISHED 的品牌图集卡片，含 productCount。
 */
export const getStoreBrandCollections = async (
  storeId: string
): Promise<StoreBrandCollection[]> => {
  const result = await request<{
    collections: StoreBrandCollection[];
    total: number;
  }>(
    `/api/store-merchants/store/${encodeURIComponent(storeId)}/brand-collections`,
    { method: "GET" }
  );
  return result.collections || [];
};

/**
 * GET /api/store-merchants/{merchantId}/brand-collections
 * 商家后台：含 HIDDEN。
 */
export const getMerchantBrandCollections = async (
  merchantId: number
): Promise<StoreBrandCollection[]> => {
  const result = await request<{
    collections: StoreBrandCollection[];
    total: number;
  }>(`/api/store-merchants/${merchantId}/brand-collections`, {
    method: "GET",
  });
  return result.collections || [];
};

export interface BrandCollectionCreateParams {
  brandName: string;
  coverImage: string;
  description?: string;
  sortOrder?: number;
  status?: "PUBLISHED" | "HIDDEN";
}

export type BrandCollectionUpdateParams = Partial<BrandCollectionCreateParams>;

/** POST /api/store-merchants/{merchantId}/brand-collections */
export const createBrandCollection = async (
  merchantId: number,
  params: BrandCollectionCreateParams
): Promise<StoreBrandCollection> => {
  return request<StoreBrandCollection>(
    `/api/store-merchants/${merchantId}/brand-collections`,
    { method: "POST", body: JSON.stringify(params) }
  );
};

/** PUT /api/store-merchants/brand-collections/{collectionId} */
export const updateBrandCollection = async (
  collectionId: number,
  params: BrandCollectionUpdateParams
): Promise<StoreBrandCollection> => {
  return request<StoreBrandCollection>(
    `/api/store-merchants/brand-collections/${collectionId}`,
    { method: "PUT", body: JSON.stringify(params) }
  );
};

/** DELETE /api/store-merchants/brand-collections/{collectionId} */
export const deleteBrandCollection = async (
  collectionId: number
): Promise<void> => {
  await request<null>(
    `/api/store-merchants/brand-collections/${collectionId}`,
    { method: "DELETE" }
  );
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
  wantCount: number;
  favoriteCount: number;
  status: ProductStatus;
  likedByMe?: boolean | null;
  favoritedByMe?: boolean | null;
  wantedByMe?: boolean | null;
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
  /** 品牌精确筛选（大小写不敏感）——品牌图集展开时用 */
  brand?: string;
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
  if (rest.brand) qs.append("brand", rest.brand);
  if (rest.searchQuery) qs.append("searchQuery", rest.searchQuery);
  qs.append("page", String(rest.page ?? 1));
  qs.append("pageSize", String(rest.pageSize ?? 20));
  return request<StoreProductListResponse>(
    `/api/store-merchants/store/${encodeURIComponent(storeId)}/products?${qs.toString()}`,
    { method: "GET" }
  );
};

/** GET /api/store-merchants/products/search — global product search */
export const searchProductsGlobal = async (
  query: string,
  page: number = 1,
  pageSize: number = 20
): Promise<StoreProductListResponse> => {
  return request<StoreProductListResponse>(
    `/api/store-merchants/products/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`,
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
// 商家后台 - 商品 CRUD
// ============================================================================
//
// 与上面公开端点最大的差别：
//   1) `listMerchantProducts` 走 `/api/store-merchants/{merchantId}/products`，
//      会把 DRAFT / HIDDEN / SOLD_OUT 也带回来，给商家做审视；
//   2) Create / Update / Delete 都需要登录商家本人（后端 `_assert_merchant_owns`）。
//
// 之前 mobile 端只暴露消费者侧，商家管理依赖 Web 后台；现在补齐让 App 端商家
// 也能在路上发布 / 上下架。

export interface StoreProductCreateParams {
  categoryId?: number | null;
  title: string;
  description?: string;
  brand?: string;
  images?: string[];
  priceCents: number;
  currency?: string;
  discountPriceCents?: number | null;
  isNew?: boolean;
  tags?: string[];
  status?: ProductStatus;
}

export type StoreProductUpdateParams = Partial<StoreProductCreateParams>;

export interface MerchantProductListParams {
  status?: ProductStatus | "";
  categoryId?: number | null;
  page?: number;
  pageSize?: number;
}

/**
 * GET /api/store-merchants/{merchantId}/products
 * 商家后台列表（包含全部状态）。
 */
export const listMerchantStoreProducts = async (
  merchantId: number,
  params: MerchantProductListParams = {}
): Promise<StoreProductListResponse> => {
  const qs = new URLSearchParams();
  if (params.status) qs.append("status", params.status);
  if (params.categoryId != null) qs.append("categoryId", String(params.categoryId));
  qs.append("page", String(params.page ?? 1));
  qs.append("pageSize", String(params.pageSize ?? 20));
  return request<StoreProductListResponse>(
    `/api/store-merchants/${merchantId}/products?${qs.toString()}`,
    { method: "GET" }
  );
};

/** POST /api/store-merchants/{merchantId}/products */
export const createMerchantStoreProduct = async (
  merchantId: number,
  data: StoreProductCreateParams
): Promise<StoreProduct> => {
  return request<StoreProduct>(`/api/store-merchants/${merchantId}/products`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/** PUT /api/store-merchants/products/{productId} */
export const updateMerchantStoreProduct = async (
  productId: number,
  data: StoreProductUpdateParams
): Promise<StoreProduct> => {
  return request<StoreProduct>(`/api/store-merchants/products/${productId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

/** DELETE /api/store-merchants/products/{productId} */
export const deleteMerchantStoreProduct = async (
  productId: number
): Promise<void> => {
  await request<null>(`/api/store-merchants/products/${productId}`, {
    method: "DELETE",
  });
};

// ============================================================================
// 商家后台 - 商品分类 CRUD
// ============================================================================
//
// 商品创建时 categoryId 只能引用已存在的分类，所以管理界面要顺带提供
// 「快速新增 / 删除分类」的能力。这里封装的是商家端写操作，公开列表见上面
// `getStoreProductCategories`.

export interface StoreProductCategoryCreateParams {
  name: string;
  coverImage?: string;
  sortOrder?: number;
}

export type StoreProductCategoryUpdateParams =
  Partial<StoreProductCategoryCreateParams>;

/** POST /api/store-merchants/{merchantId}/product-categories */
export const createMerchantProductCategory = async (
  merchantId: number,
  data: StoreProductCategoryCreateParams
): Promise<StoreProductCategory> => {
  return request<StoreProductCategory>(
    `/api/store-merchants/${merchantId}/product-categories`,
    { method: "POST", body: JSON.stringify(data) }
  );
};

/** PUT /api/store-merchants/product-categories/{categoryId} */
export const updateMerchantProductCategory = async (
  categoryId: number,
  data: StoreProductCategoryUpdateParams
): Promise<StoreProductCategory> => {
  return request<StoreProductCategory>(
    `/api/store-merchants/product-categories/${categoryId}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
};

/** DELETE /api/store-merchants/product-categories/{categoryId} */
export const deleteMerchantProductCategory = async (
  categoryId: number
): Promise<void> => {
  await request<null>(
    `/api/store-merchants/product-categories/${categoryId}`,
    { method: "DELETE" }
  );
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
// 商品「收藏」(Save / Bookmark)
// ============================================================================
//
// 与 like / want 平行的一组幂等接口：独立表 + 独立计数；UI 上 bookmark 图标
// 触发 favorite，profile「我收藏的商品」走 listMyFavoritedStoreProducts。

/** POST /api/store-merchants/products/{productId}/favorite */
export const favoriteStoreProduct = async (productId: number): Promise<void> => {
  await request<{ favorited: boolean }>(
    `/api/store-merchants/products/${productId}/favorite`,
    { method: "POST" }
  );
};

/** DELETE /api/store-merchants/products/{productId}/favorite */
export const unfavoriteStoreProduct = async (productId: number): Promise<void> => {
  await request<{ favorited: boolean }>(
    `/api/store-merchants/products/${productId}/favorite`,
    { method: "DELETE" }
  );
};

/** GET /api/store-merchants/products/{productId}/favorite/check */
export const checkStoreProductFavorited = async (
  productId: number
): Promise<boolean> => {
  const result = await request<{ favorited: boolean }>(
    `/api/store-merchants/products/${productId}/favorite/check`,
    { method: "GET" }
  );
  return !!result?.favorited;
};

/** GET /api/store-merchants/user/favorited-products */
export const listMyFavoritedStoreProducts = async (
  page: number = 1,
  pageSize: number = 20
): Promise<StoreProductListResponse> => {
  return request<StoreProductListResponse>(
    `/api/store-merchants/user/favorited-products?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

// ============================================================================
// 商品「想要」(愿望单)
// ============================================================================
//
// 与点赞/喜欢对称的一组幂等接口；前端先做乐观态再发请求，失败回滚。
// 后端在 want_count 上用 RPC 维护，重复 POST 不会让计数超出。

/** POST /api/store-merchants/products/{productId}/want */
export const wantStoreProduct = async (productId: number): Promise<void> => {
  await request<{ wanted: boolean }>(
    `/api/store-merchants/products/${productId}/want`,
    { method: "POST" }
  );
};

/** DELETE /api/store-merchants/products/{productId}/want */
export const unwantStoreProduct = async (productId: number): Promise<void> => {
  await request<{ wanted: boolean }>(
    `/api/store-merchants/products/${productId}/want`,
    { method: "DELETE" }
  );
};

/** GET /api/store-merchants/products/{productId}/want/check */
export const checkStoreProductWanted = async (
  productId: number
): Promise<boolean> => {
  const result = await request<{ wanted: boolean }>(
    `/api/store-merchants/products/${productId}/want/check`,
    { method: "GET" }
  );
  return !!result?.wanted;
};

/** GET /api/store-merchants/user/wanted-products */
export const listMyWantedStoreProducts = async (
  page: number = 1,
  pageSize: number = 20
): Promise<StoreProductListResponse> => {
  return request<StoreProductListResponse>(
    `/api/store-merchants/user/wanted-products?page=${page}&pageSize=${pageSize}`,
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
