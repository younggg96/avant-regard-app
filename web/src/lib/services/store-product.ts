/**
 * Web 端商家商品系统 API 客户端。
 *
 * 对齐后端 `backend/app/api/routes/store_product.py`，覆盖 4 组资源：
 *   - StoreProfileConfig   ：店铺主页卡片配置（买手店 Tab 首屏 StoreProfileCard）
 *   - StoreEntryCard       ：入口卡片（CategoryCards 上的"分类/折扣/活动/新品"）
 *   - StoreProductCategory ：商品分类（上衣 / 裤子 / 男装 / 女装 …）
 *   - StoreProduct         ：商品（SKU 级）
 *
 * 为什么单独一个文件而不是塞到 `store-merchant.ts`：
 *   - 那个已经 420 行，再加 4 组资源会膨胀到 700+；
 *   - 4 组资源虽然挂在 `/api/store-merchants/*` 前缀下，但业务意义（商品系统）
 *     和入驻认证/Banner/公告/活动/折扣 是两条不同主线，解耦有助于阅读；
 *   - 移动端的 `frontend/src/services/storeProductService.ts` 也已经按同样的
 *     边界拆出；Web 跟齐保持一致。
 *
 * 金额约定：API 层统一用整数 `priceCents`（分），前端展示时 `(cents/100).toFixed(2)`。
 */

import { apiClient } from "../api-client";

// ============================================================================
// 枚举
// ============================================================================

/**
 * 单品交易态。
 *
 * 后端自 migration 057 起改成小写枚举（draft → reviewing → active → frozen →
 * sold，外加 rejected / offline 两个辅助态），API 返回的就是这些值。大写值是
 * 迁移前的旧词汇，DB 上还留着 normalize_store_product_status trigger 兜底，
 * 所以这里保留成可接受的别名，读到之后一律先 normalizeProductStatus。
 */
export type CanonicalProductStatus =
  | "draft"
  | "reviewing"
  | "active"
  | "frozen"
  | "sold"
  | "rejected"
  | "offline";

/** @deprecated 迁移前的状态词汇，仅用于兼容存量数据。 */
export type LegacyProductStatus = "DRAFT" | "PUBLISHED" | "HIDDEN" | "SOLD_OUT";

export type ProductStatus = CanonicalProductStatus | LegacyProductStatus;

const LEGACY_STATUS_MAP: Record<LegacyProductStatus, CanonicalProductStatus> = {
  DRAFT: "draft",
  PUBLISHED: "active",
  HIDDEN: "offline",
  SOLD_OUT: "sold",
};

export function normalizeProductStatus(
  status: ProductStatus | null | undefined,
): CanonicalProductStatus {
  if (!status) return "draft";
  return (
    LEGACY_STATUS_MAP[status as LegacyProductStatus] ??
    (status as CanonicalProductStatus)
  );
}

/**
 * 只有 active 的单品能下单或出价——与后端 `acquire_hold` 的校验保持一致，
 * 否则用户点了「立即购买」才收到「商品当前不可购买」。
 */
export function isProductPurchasable(status: ProductStatus): boolean {
  return normalizeProductStatus(status) === "active";
}

export type EntryCardType =
  | "CLASSIFICATION"
  | "DISCOUNT"
  | "EVENT"
  | "NEW_ARRIVAL";
export type EntryCardStatus = "PUBLISHED" | "HIDDEN";

// ============================================================================
// 店铺主页配置（StoreProfileCard 数据源）
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

export interface StoreProfileConfigUpsertParams {
  logoImage?: string | null;
  coverImage?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  tags?: string[];
}

// ============================================================================
// 入口卡片
// ============================================================================

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
  status: EntryCardStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface StoreEntryCardCreateParams {
  cardType: EntryCardType;
  label: string;
  labelEn?: string;
  imageUrl: string;
  targetCategoryId?: number | null;
  sortOrder?: number;
  status?: EntryCardStatus;
}

export type StoreEntryCardUpdateParams = Partial<StoreEntryCardCreateParams>;

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
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface StoreProductCategoryCreateParams {
  name: string;
  coverImage?: string;
  sortOrder?: number;
}

export type StoreProductCategoryUpdateParams =
  Partial<StoreProductCategoryCreateParams>;

// ============================================================================
// 商品
// ============================================================================

export interface StoreProduct {
  id: number;
  storeId: string;
  merchantId?: number | null;
  /** 买手店商品为 "merchant"，C2C 个人卖家单品为 "individual"。 */
  sellerKind?: "merchant" | "individual";
  /** 个人卖家的 userId；买手店商品为空，此时卖家要经 merchantId 反查。 */
  sellerUserId?: number | null;
  /** 卖家是否接受议价；false 时商品详情只出「立即购买」。 */
  acceptOffer?: boolean;
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
  /** 当前登录用户是否已点喜欢；服务端在 userId 存在时才回填. */
  likedByMe?: boolean | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

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

// ============================================================================
// 响应类型
// ============================================================================

interface EntryCardListResponse {
  cards: StoreEntryCard[];
  total: number;
}

interface ProductCategoryListResponse {
  categories: StoreProductCategory[];
  total: number;
}

interface ProductListResponse {
  products: StoreProduct[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================================
// 商品评论
// ============================================================================

export interface ProductComment {
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

interface ProductCommentListResponse {
  comments: ProductComment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductCommentCreateParams {
  content: string;
  parentId?: number;
  replyToUserId?: number;
}

// ============================================================================
// Service
// ============================================================================

export const storeProductService = {
  // ── Profile config ──────────────────────────────────────────────────────
  /** 公开接口 —— 获取主页卡片配置（未配置返回 null）。 */
  getProfileConfig: (storeId: string) =>
    apiClient.get<StoreProfileConfig | null>(
      `/api/store-merchants/store/${encodeURIComponent(storeId)}/profile-config`,
    ),

  /** 商家 upsert 主页卡片配置。 */
  upsertProfileConfig: (
    merchantId: number,
    data: StoreProfileConfigUpsertParams,
  ) =>
    apiClient.put<StoreProfileConfig>(
      `/api/store-merchants/${merchantId}/profile-config`,
      data,
    ),

  // ── Entry cards ─────────────────────────────────────────────────────────
  /** 公开接口 —— 列出 PUBLISHED 的入口卡片（给消费者端 CategoryCards 使用）. */
  listPublicEntryCards: (storeId: string) =>
    apiClient.get<EntryCardListResponse>(
      `/api/store-merchants/store/${encodeURIComponent(storeId)}/entry-cards`,
    ),

  /**
   * 商家后台：列出自家店铺全部入口卡片（包括 HIDDEN）。
   * 和公开接口 `/store/{id}/entry-cards` 的差别在 include_hidden=True。
   */
  listMerchantEntryCards: (merchantId: number) =>
    apiClient.get<EntryCardListResponse>(
      `/api/store-merchants/${merchantId}/entry-cards`,
    ),

  createEntryCard: (merchantId: number, data: StoreEntryCardCreateParams) =>
    apiClient.post<StoreEntryCard>(
      `/api/store-merchants/${merchantId}/entry-cards`,
      data,
    ),

  updateEntryCard: (cardId: number, data: StoreEntryCardUpdateParams) =>
    apiClient.put<StoreEntryCard>(
      `/api/store-merchants/entry-cards/${cardId}`,
      data,
    ),

  deleteEntryCard: (cardId: number) =>
    apiClient.delete<void>(`/api/store-merchants/entry-cards/${cardId}`),

  // ── Product categories ──────────────────────────────────────────────────
  /** 公开接口 —— 列出店铺分类（withCount=true 可顺带回填商品数）。 */
  listCategories: (storeId: string, withCount = false) =>
    apiClient.get<ProductCategoryListResponse>(
      `/api/store-merchants/store/${encodeURIComponent(storeId)}/product-categories`,
      { withCount },
    ),

  createCategory: (
    merchantId: number,
    data: StoreProductCategoryCreateParams,
  ) =>
    apiClient.post<StoreProductCategory>(
      `/api/store-merchants/${merchantId}/product-categories`,
      data,
    ),

  updateCategory: (
    categoryId: number,
    data: StoreProductCategoryUpdateParams,
  ) =>
    apiClient.put<StoreProductCategory>(
      `/api/store-merchants/product-categories/${categoryId}`,
      data,
    ),

  deleteCategory: (categoryId: number) =>
    apiClient.delete<void>(
      `/api/store-merchants/product-categories/${categoryId}`,
    ),

  // ── Products ────────────────────────────────────────────────────────────
  /**
   * 商家后台：列出自家店铺下商品（含 DRAFT / HIDDEN / SOLD_OUT）。
   * 公开端点是 `/store/{id}/products`，只返 PUBLISHED。
   */
  listMerchantProducts: (
    merchantId: number,
    params?: { status?: ProductStatus | ""; categoryId?: number; page?: number; pageSize?: number },
  ) =>
    apiClient.get<ProductListResponse>(
      `/api/store-merchants/${merchantId}/products`,
      {
        status: params?.status ?? "",
        categoryId: params?.categoryId,
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
      },
    ),

  /**
   * 公开接口 —— 列出店铺下 PUBLISHED 商品，支持按分类 / 新品 / 折扣 / 关键字过滤.
   * 消费者侧（/stores/[id]）商品网格用这个.
   */
  listPublicProducts: (
    storeId: string,
    params?: {
      categoryId?: number;
      isNew?: boolean;
      hasDiscount?: boolean;
      searchQuery?: string;
      page?: number;
      pageSize?: number;
    },
  ) =>
    apiClient.get<ProductListResponse>(
      `/api/store-merchants/store/${encodeURIComponent(storeId)}/products`,
      {
        categoryId: params?.categoryId,
        isNew: params?.isNew,
        hasDiscount: params?.hasDiscount,
        searchQuery: params?.searchQuery,
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
      },
    ),

  getProduct: (productId: number) =>
    apiClient.get<StoreProduct>(`/api/store-merchants/products/${productId}`),

  createProduct: (merchantId: number, data: StoreProductCreateParams) =>
    apiClient.post<StoreProduct>(
      `/api/store-merchants/${merchantId}/products`,
      data,
    ),

  updateProduct: (productId: number, data: StoreProductUpdateParams) =>
    apiClient.put<StoreProduct>(
      `/api/store-merchants/products/${productId}`,
      data,
    ),

  deleteProduct: (productId: number) =>
    apiClient.delete<void>(`/api/store-merchants/products/${productId}`),

  // ── Product likes ──────────────────────────────────────────────────────
  likeProduct: (productId: number) =>
    apiClient.post<{ liked: boolean }>(
      `/api/store-merchants/products/${productId}/like`,
    ),

  unlikeProduct: (productId: number) =>
    apiClient.delete<{ liked: boolean }>(
      `/api/store-merchants/products/${productId}/like`,
    ),

  checkProductLiked: (productId: number) =>
    apiClient.get<{ liked: boolean }>(
      `/api/store-merchants/products/${productId}/like/check`,
    ),

  // ── Product comments ───────────────────────────────────────────────────
  listProductComments: (
    productId: number,
    params?: { page?: number; pageSize?: number },
  ) =>
    apiClient.get<ProductCommentListResponse>(
      `/api/store-merchants/products/${productId}/comments`,
      { page: params?.page ?? 1, pageSize: params?.pageSize ?? 20 },
    ),

  createProductComment: (productId: number, data: ProductCommentCreateParams) =>
    apiClient.post<ProductComment>(
      `/api/store-merchants/products/${productId}/comments`,
      data,
    ),

  deleteProductComment: (commentId: number) =>
    apiClient.delete<void>(`/api/store-merchants/product-comments/${commentId}`),

  likeProductComment: (commentId: number) =>
    apiClient.post<{ liked: boolean }>(
      `/api/store-merchants/product-comments/${commentId}/like`,
    ),

  unlikeProductComment: (commentId: number) =>
    apiClient.delete<{ liked: boolean }>(
      `/api/store-merchants/product-comments/${commentId}/like`,
    ),
};

// ============================================================================
// 展示常量
// ============================================================================

export const PRODUCT_STATUS_LABEL: Record<CanonicalProductStatus, string> = {
  draft: "草稿",
  reviewing: "审核中",
  active: "已上架",
  frozen: "已锁定",
  sold: "已售出",
  rejected: "已驳回",
  offline: "已下架",
};

export const ENTRY_CARD_TYPE_LABEL: Record<EntryCardType, string> = {
  CLASSIFICATION: "分类",
  DISCOUNT: "折扣",
  EVENT: "活动",
  NEW_ARRIVAL: "新品",
};

export const ENTRY_CARD_STATUS_LABEL: Record<EntryCardStatus, string> = {
  PUBLISHED: "已发布",
  HIDDEN: "已隐藏",
};

// ============================================================================
// 工具函数
// ============================================================================

/** 整数分 → `¥ 5,890` / `¥ 58.90`。 */
export function formatPriceCents(
  cents: number | null | undefined,
  currency: string = "CNY",
): string {
  if (cents == null || Number.isNaN(cents)) return "";
  const symbol = currency === "USD" ? "$" : "¥";
  if (cents % 100 === 0) {
    return `${symbol} ${Math.round(cents / 100).toLocaleString("zh-CN")}`;
  }
  return `${symbol} ${(cents / 100).toFixed(2)}`;
}

/** 用户输入 "58.9" / "58" → 5890 分；无效则返回 null。 */
export function parsePriceInputToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}
