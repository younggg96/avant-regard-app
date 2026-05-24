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
 *
 * ⚠️ 这个函数按"源币种"原样展示，不会做汇率换算。如果想跟着用户
 * `preferred_currency` 偏好走（在 Settings → 币种 中切换），请改用
 * `useFormatPrice()`（src/utils/currency.ts）。新代码请优先用 hook 版本；
 * 这里保留是为了不一次性改掉 30+ 调用点。
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
// 商品
// ============================================================================

/**
 * 商品 / 单品状态。
 * Phase 1 起 PRD 把状态机改成 draft → reviewing → active → frozen → sold（含 rejected/offline）。
 * 旧大写值（PUBLISHED 等）保留 union 以兼容尚未升级的调用方；后端 trigger 会把它们映射到新值。
 */
export type ProductStatus =
  | "draft"
  | "reviewing"
  | "active"
  | "frozen"
  | "sold"
  | "rejected"
  | "offline"
  | "DRAFT"
  | "PUBLISHED"
  | "HIDDEN"
  | "SOLD_OUT";

/** PRD 模块一：5 档成色枚举。 */
export type ProductCondition = "BNWT" | "NEW_99" | "NEW_95" | "USED_8" | "FLAW";

export type SellerKind = "merchant" | "individual";

/** PRD 1.3 规范化 5 视角图。 */
export interface PhotoAngles {
  front?: string | null;
  back?: string | null;
  wash_label?: string | null;
  brand_label?: string | null;
  flaw?: string | null;
  extras?: string[];
}

export interface StoreProduct {
  id: number;
  storeId?: string | null;
  merchantId?: number | null;
  sellerKind?: SellerKind;
  sellerUserId?: number | null;
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
  // PRD 单品扩展
  size?: string | null;
  color?: string | null;
  condition?: ProductCondition | null;
  conditionNote?: string | null;
  originalShowId?: string | null;
  originalAcquiredAt?: string | null;
  acceptOffer?: boolean;
  photoAngles?: PhotoAngles | null;
  frozenUntil?: string | null;
  currentBuyerId?: number | null;
  soldAt?: string | null;
  rejectedReason?: string | null;
  likedByMe?: boolean | null;
  favoritedByMe?: boolean | null;
  wantedByMe?: boolean | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  // 「大家都在看」管理员策展 + 信息完整度评分（migration 065）
  isCurated?: boolean;
  curatedSortOrder?: number | null;
  completenessScore?: number;
  // PRD 单品 Phase 2
  styleName?: string | null;
  yearDecade?: string | null;
  accessoriesNote?: string | null;
  shipFromCountry?: string | null;
  shipFromState?: string | null;
  shipFromCity?: string | null;
  shippingFeeMode?: "cod" | "free";
  /** 平台抽佣率，单位 bps；100 = 1%。 */
  commissionRateBps?: number;
}

/** PRD 单品 Phase 2 年代选项。 */
export const YEAR_DECADE_OPTIONS = [
  "1950s",
  "1960s",
  "1970s",
  "1980s",
  "1990s",
  "2000s",
  "2010s",
  "2020s",
] as const;
export type YearDecade = (typeof YEAR_DECADE_OPTIONS)[number];

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
// 商品详情页 —— 富数据聚合接口
// ============================================================================

/** 卖家卡片：详情页顶部一块（avatar + name + level + 好评率 + 关注按钮）。 */
export interface ProductDetailSeller {
  userId: number;
  username: string;
  avatarUrl?: string | null;
  level: number;
  /** 好评率（0~1），可空表示无评价。 */
  positiveRate?: number | null;
  totalSales: number;
  joinedAt?: string | null;
  /** 当前在售件数（active 状态）。 */
  listingCount: number;
}

/** 关联的秀场（来自 store_products.original_show_id）。 */
export interface ProductDetailShow {
  id: string;
  brandName?: string | null;
  season?: string | null;
  year?: number | null;
  category?: string | null;
  title?: string | null;
  coverImage?: string | null;
}

/** 同卖家的「关联品牌」chip。 */
export interface ProductDetailRelatedBrand {
  name: string;
  listingCount: number;
  imageUrl?: string | null;
}

/** 双盲评价 + reviewer 信息（已 join 头像 / 用户名 / 等级）。 */
export interface ProductDetailReviewItem {
  id: number;
  rating: number;
  comment?: string | null;
  submittedAt?: string | null;
  reviewerUserId?: number | null;
  reviewerUsername?: string | null;
  reviewerAvatar?: string | null;
  reviewerLevel?: number;
}

export interface ProductDetailReviews {
  items: ProductDetailReviewItem[];
  total: number;
}

export interface StoreProductRichDetail {
  product: StoreProduct;
  seller: ProductDetailSeller | null;
  show: ProductDetailShow | null;
  relatedBrands: ProductDetailRelatedBrand[];
  relatedProducts: StoreProduct[];
  reviews: ProductDetailReviews;
}

/**
 * GET /api/store-merchants/products/{productId}/rich-detail
 *
 * 一次性返回商品 + 卖家卡 + 关联秀场 + 同卖家关联品牌 + 相关推荐 + 评价。
 * 避免详情页 N+1。任何子查询失败都不会阻塞主体，对应字段会回退到空 / null。
 */
export const getStoreProductRichDetail = async (
  productId: number
): Promise<StoreProductRichDetail> => {
  return request<StoreProductRichDetail>(
    `/api/store-merchants/products/${productId}/rich-detail`,
    { method: "GET" }
  );
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

/** GET /api/store-merchants/user/favorited-products
 *
 * 可选参数:
 *   - collectionId : 仅返回该收藏夹下的商品
 *   - onlyDefault  : 仅返回未分组的"默认收藏" (与 collectionId 互斥)
 */
export const listMyFavoritedStoreProducts = async (
  page: number = 1,
  pageSize: number = 20,
  options: { collectionId?: number; onlyDefault?: boolean } = {}
): Promise<StoreProductListResponse> => {
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("pageSize", String(pageSize));
  if (options.collectionId != null) {
    qs.set("collectionId", String(options.collectionId));
  } else if (options.onlyDefault) {
    qs.set("onlyDefault", "true");
  }
  return request<StoreProductListResponse>(
    `/api/store-merchants/user/favorited-products?${qs.toString()}`,
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

// ============================================================================
// PRD Phase 1: 单品发布 / 卖家管理 / 审核（统一 /api/listings 入口）
// ============================================================================
//
// 与上面 store-merchants 入口的区别：
//   - 接受 sellerKind=individual，C2C 个人卖家也能调；
//   - 采用 PRD 状态机：draft → reviewing → active → frozen → sold；
//   - 提交审核 / 状态切换走 dedicated 端点，避免 patch status 绕过校验。

export interface ListingPatchBody {
  categoryId?: number | null;
  title?: string;
  description?: string;
  brand?: string;
  images?: string[];
  priceCents?: number;
  currency?: string;
  discountPriceCents?: number | null;
  isNew?: boolean;
  tags?: string[];
  size?: string;
  color?: string;
  condition?: ProductCondition;
  conditionNote?: string;
  originalShowId?: string | null;
  originalAcquiredAt?: string | null;
  acceptOffer?: boolean;
  photoAngles?: PhotoAngles;
  // PRD 单品 Phase 2
  styleName?: string | null;
  yearDecade?: string | null;
  accessoriesNote?: string | null;
  shipFromCountry?: string | null;
  shipFromState?: string | null;
  shipFromCity?: string | null;
  shippingFeeMode?: "cod" | "free";
}

export interface ListingCreateBody extends ListingPatchBody {
  title: string;
  priceCents: number;
  sellerKind: SellerKind;
}

/** POST /api/listings — 创建草稿。 */
export const createListing = async (
  data: ListingCreateBody
): Promise<StoreProduct> => {
  return request<StoreProduct>(`/api/listings`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/** PATCH /api/listings/{id} — 分步保存。 */
export const patchListing = async (
  productId: number,
  data: ListingPatchBody
): Promise<StoreProduct> => {
  return request<StoreProduct>(`/api/listings/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

/** POST /api/listings/{id}/submit — 提交审核。 */
export const submitListingForReview = async (
  productId: number
): Promise<StoreProduct> => {
  return request<StoreProduct>(`/api/listings/${productId}/submit`, {
    method: "POST",
  });
};

/** POST /api/listings/{id}/transition — 状态切换（active↔offline 等）。 */
export const transitionListing = async (
  productId: number,
  target: ProductStatus,
  reason?: string
): Promise<StoreProduct> => {
  return request<StoreProduct>(`/api/listings/${productId}/transition`, {
    method: "POST",
    body: JSON.stringify({ target, reason }),
  });
};

/** POST /api/listings/batch/offline — 批量下架。 */
export const batchOfflineListings = async (
  productIds: number[]
): Promise<{ updated: number }> => {
  return request<{ updated: number }>(`/api/listings/batch/offline`, {
    method: "POST",
    body: JSON.stringify({ productIds }),
  });
};

/** POST /api/listings/batch/delete — 批量删除草稿/已拒。 */
export const batchDeleteListings = async (
  productIds: number[]
): Promise<{ deleted: number }> => {
  return request<{ deleted: number }>(`/api/listings/batch/delete`, {
    method: "POST",
    body: JSON.stringify({ productIds }),
  });
};

// ============================================================================
// PRD Phase 2: Marketplace 交易大厅（公开查询，含富过滤器）
// ============================================================================

/**
 * Marketplace 大厅查询的过滤器。
 *
 * 全部多值维度都支持数组（OR 语义）；保留旧的单值字段是为了兼容历史
 * 调用方（`BrandDetailScreen.loadBrandListings` 等）。新代码请优先使用
 * 复数字段（`brands` / `categoryIds` / `sizes` / `colors` / `conditions`）。
 *
 * 此外按 PRD 6 大类（外套/上衣/裤装/鞋履/包袋/配饰）筛选时使用
 * ``categoryKinds``，后端会反查 ``store_product_categories.name`` 命中
 * 的分类 ID 后再过滤。
 */
export interface MarketplaceFilter {
  q?: string;
  /** @deprecated 用 `brands` 替代 */
  brand?: string;
  brands?: string[];
  /** @deprecated 用 `categoryIds` 替代 */
  categoryId?: number | null;
  categoryIds?: number[];
  /** PRD 6 大类名称数组（外套/上衣/裤装/鞋履/包袋/配饰） */
  categoryKinds?: string[];
  /** @deprecated 用 `sizes` 替代 */
  size?: string;
  sizes?: string[];
  /** @deprecated 用 `colors` 替代 */
  color?: string;
  colors?: string[];
  /** @deprecated 用 `conditions` 替代 */
  condition?: ProductCondition;
  conditions?: ProductCondition[];
  sellerKind?: SellerKind;
  priceMinCents?: number;
  priceMaxCents?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "featured";
  page?: number;
  pageSize?: number;
}

export interface PopularBrand {
  name: string;
  brandId: number | null;
  imageUrl: string | null;
  listingCount: number;
}

export type MarketplaceSearchSuggestionType =
  | "brand"
  | "product"
  | "show"
  | "keyword";

export interface MarketplaceSearchSuggestion {
  label: string;
  type: MarketplaceSearchSuggestionType;
  query: string;
  brand?: string | null;
  brandId?: number | null;
  showId?: string | null;
  productId?: number | null;
  imageUrl?: string | null;
  listingCount?: number | null;
}

/**
 * GET /api/marketplace/search-suggestions?q=Rick&limit=8
 *
 * 交易大厅搜索下拉建议：品牌 / 款式系列 / 秀场 / 单品标题。
 */
export const getMarketplaceSearchSuggestions = async (
  query: string,
  limit: number = 8,
): Promise<MarketplaceSearchSuggestion[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const qs = new URLSearchParams({
    q: trimmed,
    limit: String(limit),
  });
  const res = await request<{ suggestions: MarketplaceSearchSuggestion[] }>(
    `/api/marketplace/search-suggestions?${qs.toString()}`,
    { method: "GET" },
  );
  return res?.suggestions ?? [];
};

/**
 * GET /api/marketplace/popular-brands?limit=N&rotate=true
 *
 * 交易大厅顶部「热门品牌」横滑列表。按当前在售单品数量降序取前 30 名为
 * 候选池，再按当天 UTC 日期为种子打乱后取前 ``limit``。这样保证每天首屏顺序
 * 不同，但当天内多次刷新顺序一致。
 */
export const getPopularBrands = async (
  limit: number = 6,
  rotate: boolean = true
): Promise<PopularBrand[]> => {
  const qs = new URLSearchParams({
    limit: String(limit),
    rotate: rotate ? "true" : "false",
  });
  const res = await request<{ brands: PopularBrand[] }>(
    `/api/marketplace/popular-brands?${qs.toString()}`,
    { method: "GET" }
  );
  return res?.brands ?? [];
};

// ============================================================================
// 「大家都在看」管理员策展（migration 065）
// ============================================================================

/**
 * GET /api/marketplace/curated?limit=N
 *
 * 管理员标记的「大家都在看」单品列表。按 ``curated_sort_order`` asc 排序，
 * 仅返回 active 状态。前端展示在 marketplace 顶部，与「热门品牌」并列。
 */
export const getCuratedProducts = async (
  limit: number = 10
): Promise<StoreProduct[]> => {
  const qs = new URLSearchParams({ limit: String(limit) });
  const res = await request<{ products: StoreProduct[] }>(
    `/api/marketplace/curated?${qs.toString()}`,
    { method: "GET" }
  );
  return res?.products ?? [];
};

/**
 * PUT /api/admin/listings/{productId}/curated
 *
 * 管理员把单品标记 / 取消「大家都在看」。
 *   - isCurated=true 时，sortOrder 可选；不传自动追加到末尾。
 *   - isCurated=false 时，sortOrder 会被清空。
 */
export const adminSetListingCurated = async (
  productId: number,
  isCurated: boolean,
  sortOrder?: number | null
): Promise<StoreProduct> => {
  return request<StoreProduct>(`/api/admin/listings/${productId}/curated`, {
    method: "PUT",
    body: JSON.stringify({
      isCurated,
      sortOrder: sortOrder ?? null,
    }),
  });
};

// ============================================================================
// 平台所有「录入品牌」列表（marketplace 顶部「更多」展开模态框用）
// ============================================================================

export interface PlatformBrand {
  brandId: number | null;
  name: string;
  imageUrl: string | null;
  category?: string | null;
  country?: string | null;
  listingCount: number;
}

export interface PlatformBrandListResponse {
  brands: PlatformBrand[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * GET /api/marketplace/all-brands
 *
 * 平台所有已录入品牌的分页列表，含每个品牌的在售单品数。
 * 用于 marketplace 顶部「更多」按钮展开的全品牌网格。
 */
export const getAllPlatformBrands = async (
  params: { keyword?: string; page?: number; pageSize?: number } = {}
): Promise<PlatformBrandListResponse> => {
  const qs = new URLSearchParams();
  if (params.keyword) qs.append("keyword", params.keyword);
  qs.append("page", String(params.page ?? 1));
  qs.append("pageSize", String(params.pageSize ?? 50));
  return request<PlatformBrandListResponse>(
    `/api/marketplace/all-brands?${qs.toString()}`,
    { method: "GET" }
  );
};

/** 把数组+单值字段合并成一份去重后的数组（保留入参顺序）。 */
const mergeMultiField = <T,>(arr?: T[], single?: T | null): T[] => {
  const out: T[] = [];
  const seen = new Set<string>();
  const push = (v: T | null | undefined) => {
    if (v == null) return;
    const key = typeof v === "string" ? v : JSON.stringify(v);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };
  (arr ?? []).forEach(push);
  push(single ?? undefined);
  return out;
};

export const searchMarketplace = async (
  filter: MarketplaceFilter
): Promise<StoreProductListResponse> => {
  const qs = new URLSearchParams();
  if (filter.q) qs.append("q", filter.q);

  const brands = mergeMultiField(filter.brands, filter.brand);
  if (brands.length) qs.append("brand", brands.join(","));

  const categoryIds = mergeMultiField(filter.categoryIds, filter.categoryId);
  if (categoryIds.length) qs.append("categoryId", categoryIds.join(","));
  if (filter.categoryKinds?.length)
    qs.append("category", filter.categoryKinds.join(","));

  const sizes = mergeMultiField(filter.sizes, filter.size);
  if (sizes.length) qs.append("size", sizes.join(","));

  const colors = mergeMultiField(filter.colors, filter.color);
  if (colors.length) qs.append("color", colors.join(","));

  const conditions = mergeMultiField(filter.conditions, filter.condition);
  if (conditions.length) qs.append("condition", conditions.join(","));

  if (filter.sellerKind) qs.append("sellerKind", filter.sellerKind);
  if (filter.priceMinCents != null)
    qs.append("priceMinCents", String(filter.priceMinCents));
  if (filter.priceMaxCents != null)
    qs.append("priceMaxCents", String(filter.priceMaxCents));
  if (filter.sort) qs.append("sort", filter.sort);
  qs.append("page", String(filter.page ?? 1));
  qs.append("pageSize", String(filter.pageSize ?? 20));
  return request<StoreProductListResponse>(
    `/api/marketplace/listings?${qs.toString()}`,
    { method: "GET" }
  );
};

/** GET /api/sellers/me/listings — 当前用户的卖家库存。 */
export type ListingsStatusSummary = Record<
  | "active"
  | "draft"
  | "reviewing"
  | "sold"
  | "offline"
  | "rejected"
  | "frozen",
  number
>;

export const getMyListingsSummary = async (): Promise<ListingsStatusSummary> => {
  return request<ListingsStatusSummary>(`/api/sellers/me/listings/summary`, {
    method: "GET",
  });
};

export const listMyListings = async (params: {
  status?: ProductStatus | "";
  sellerKind?: SellerKind | "";
  page?: number;
  pageSize?: number;
}): Promise<StoreProductListResponse> => {
  const qs = new URLSearchParams();
  if (params.status) qs.append("status", params.status);
  if (params.sellerKind) qs.append("sellerKind", params.sellerKind);
  qs.append("page", String(params.page ?? 1));
  qs.append("pageSize", String(params.pageSize ?? 20));
  return request<StoreProductListResponse>(
    `/api/sellers/me/listings?${qs.toString()}`,
    { method: "GET" }
  );
};

/** GET /api/sellers/{userId}/listings — 他人主页「在售」tab。 */
export const listUserPublicListings = async (
  userId: number,
  params: {
    status?: Extract<ProductStatus, "active" | "sold">;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<StoreProductListResponse> => {
  const qs = new URLSearchParams();
  qs.append("status", params.status ?? "active");
  qs.append("page", String(params.page ?? 1));
  qs.append("pageSize", String(params.pageSize ?? 20));
  return request<StoreProductListResponse>(
    `/api/sellers/${userId}/listings?${qs.toString()}`,
    { method: "GET" },
  );
};

// ============================================================================
// 卖家档案（PRD 3.2 信用浮层数据源）
// ============================================================================

export interface SellerProfile {
  userId: number;
  displayName?: string | null;
  bio?: string | null;
  idVerified: boolean;
  idVerifiedAt?: string | null;
  creditScore: number;
  responseAvgMinutes?: number | null;
  totalSales: number;
  totalGmvCents: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export const getMySellerProfile = async (): Promise<SellerProfile | null> => {
  return request<SellerProfile | null>(`/api/sellers/me/profile`, { method: "GET" });
};

export const upsertMySellerProfile = async (data: {
  displayName?: string;
  bio?: string;
}): Promise<SellerProfile> => {
  return request<SellerProfile>(`/api/sellers/me/profile`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const getSellerProfilePublic = async (
  userId: number
): Promise<SellerProfile | null> => {
  return request<SellerProfile | null>(`/api/sellers/${userId}/profile`, {
    method: "GET",
  });
};

// ============================================================================
// 管理员审核
// ============================================================================

export interface AdminProductListParams {
  status?: ProductStatus | "";
  q?: string;
  sellerKind?: SellerKind | "";
  page?: number;
  pageSize?: number;
}

export const adminListAllProducts = async (
  params: AdminProductListParams = {}
): Promise<StoreProductListResponse> => {
  const qs = new URLSearchParams();
  if (params.status) qs.append("status", params.status);
  if (params.q) qs.append("q", params.q);
  if (params.sellerKind) qs.append("sellerKind", params.sellerKind);
  qs.append("page", String(params.page ?? 1));
  qs.append("pageSize", String(params.pageSize ?? 20));
  return request<StoreProductListResponse>(
    `/api/admin/listings?${qs.toString()}`,
    { method: "GET" }
  );
};

export const adminCreateProduct = async (
  data: StoreProductCreateParams & { sellerKind?: SellerKind }
): Promise<StoreProduct> => {
  return request<StoreProduct>(`/api/admin/listings`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const adminUpdateProduct = async (
  productId: number,
  data: StoreProductUpdateParams & { status?: ProductStatus }
): Promise<StoreProduct> => {
  return request<StoreProduct>(`/api/admin/listings/${productId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const adminDeleteProduct = async (
  productId: number
): Promise<void> => {
  await request<null>(`/api/admin/listings/${productId}`, {
    method: "DELETE",
  });
};

export const adminListReviewingListings = async (
  page: number = 1,
  pageSize: number = 50
): Promise<StoreProductListResponse> => {
  return request<StoreProductListResponse>(
    `/api/admin/listings/reviewing?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

export const adminReviewListing = async (
  productId: number,
  decision: "approved" | "rejected",
  reason?: string
): Promise<StoreProduct> => {
  return request<StoreProduct>(`/api/admin/listings/${productId}/review`, {
    method: "POST",
    body: JSON.stringify({ decision, reason }),
  });
};

// ============================================================================
// PRD 1.4 智能定价：服务端返回的品牌历史价格区间 + 1% 抽佣
// ============================================================================

/** 后端返回的品牌价格区间（P25 / P50 / P75，单位：分）。 */
export interface BrandPriceRange {
  brand: string;
  condition: ProductCondition | string | null;
  sampleSize: number;
  lowCents: number;
  medianCents: number;
  highCents: number;
  minCents: number;
  maxCents: number;
  /** "history": 真实历史样本；"fallback": 无样本占位 */
  source: "history" | "fallback";
}

/**
 * GET /api/marketplace/brand-price-range?brand=...&condition=...
 *
 * 拉取品牌（+ 可选成色）的历史价格区间。
 * 无历史样本时返回 source: "fallback" 占位，让前端走兜底文案。
 */
export const getBrandPriceRange = async (
  brand: string,
  condition?: ProductCondition | null
): Promise<BrandPriceRange> => {
  const qs = new URLSearchParams({ brand });
  if (condition) qs.set("condition", condition);
  return request<BrandPriceRange>(
    `/api/marketplace/brand-price-range?${qs.toString()}`,
    { method: "GET" }
  );
};

export interface PriceSuggestion {
  low: number; // cents
  high: number; // cents
}

/**
 * 离线兜底：服务端区间拉不到时仅按 condition 给一个粗糙范围。
 * Phase 2 起优先 await `getBrandPriceRange`；仅在请求失败或 source=fallback 时
 * 用此函数补一个保守的默认值。
 */
export const suggestPriceRange = (
  _brand: string | null | undefined,
  condition: ProductCondition | null | undefined,
  basePriceCents: number
): PriceSuggestion => {
  if (!basePriceCents || basePriceCents <= 0) return { low: 0, high: 0 };
  const conditionFactor: Record<ProductCondition, number> = {
    BNWT: 1.0,
    NEW_99: 0.85,
    NEW_95: 0.72,
    USED_8: 0.55,
    FLAW: 0.35,
  };
  const factor = condition ? conditionFactor[condition] : 0.7;
  const center = Math.round(basePriceCents * factor);
  return {
    low: Math.round(center * 0.8),
    high: Math.round(center * 1.2),
  };
};

/**
 * PRD 单品发布抽佣率：1%（=100 bps）。
 *
 * 与 backend migration 063 中 ``orders.commission_rate_bps DEFAULT 100`` 对齐，
 * 同时也是 ``store_products.commission_rate_bps`` 的默认值（migration 066）。
 */
export const PLATFORM_COMMISSION_BPS = 100;

/**
 * 计算扣除 1% 抽佣后的预计到手价（cents）。
 * 调用方可显式传入 rateBps 覆盖默认（如未来 Plus 订阅或后端动态下发）。
 */
export const calculateExpectedPayout = (
  priceCents: number,
  rateBps: number = PLATFORM_COMMISSION_BPS
): number => {
  if (!priceCents) return 0;
  const rate = Math.max(0, Math.min(rateBps, 10_000)) / 10_000;
  return Math.round(priceCents * (1 - rate));
};

// ============================================================================
// PRD 1.6 草稿数量 / 客服联系
// ============================================================================

export interface DraftCountResponse {
  count: number;
  limit: number;
}

/** GET /api/sellers/me/drafts/count — 当前用户的 individual 草稿数量 + 上限。 */
export const getMyDraftCount = async (): Promise<DraftCountResponse> => {
  return request<DraftCountResponse>(`/api/sellers/me/drafts/count`, {
    method: "GET",
  });
};

export interface SupportContactInfo {
  weekdayHours: string;
  weekendHours: string;
  timezone: string;
  wechatId?: string | null;
  email?: string | null;
  notice?: string | null;
}

/** GET /api/marketplace/support-contact — 找不到品牌 / 秀场时引导联系小客服。 */
export const getSupportContact = async (): Promise<SupportContactInfo> => {
  return request<SupportContactInfo>(`/api/marketplace/support-contact`, {
    method: "GET",
  });
};
