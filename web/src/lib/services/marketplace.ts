/**
 * Web 端交易大厅（marketplace）API 客户端。
 *
 * 对齐移动端 `frontend/src/services/storeProductService.ts` 里 `/api/marketplace/*`
 * 那一段。这是买家浏览 C2C 单品的入口，与 `/stores`（买手店）分属两条线。
 *
 * 多值筛选的传参约定是「逗号分隔的单个查询参数」而不是重复键，
 * 后端按 `,` split 解析，所以这里统一 join，不能直接把数组丢给 apiClient。
 */

import { apiClient } from "../api-client";
import type {
  Listing,
  ListingListResponse,
  ProductCondition,
  SellerKind,
} from "./listing";

export type MarketplaceSort = "newest" | "price_asc" | "price_desc" | "featured";

export interface MarketplaceFilter {
  q?: string;
  brands?: string[];
  categoryIds?: number[];
  /** PRD 6 大类名（外套/上衣/裤装/鞋履/包袋/配饰）。 */
  categoryKinds?: string[];
  sizes?: string[];
  colors?: string[];
  conditions?: ProductCondition[];
  sellerKind?: SellerKind;
  priceMinCents?: number;
  priceMaxCents?: number;
  sort?: MarketplaceSort;
  page?: number;
  pageSize?: number;
}

export interface PopularBrand {
  name: string;
  brandId: number | null;
  imageUrl: string | null;
  listingCount: number;
}

export type MarketplaceSuggestionType = "brand" | "product" | "show" | "keyword";

export interface MarketplaceSearchSuggestion {
  label: string;
  type: MarketplaceSuggestionType;
  query: string;
  brand?: string | null;
  brandId?: number | null;
  showId?: string | null;
  productId?: number | null;
  imageUrl?: string | null;
  listingCount?: number | null;
}

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

const joined = (values?: Array<string | number>) =>
  values && values.length > 0 ? values.join(",") : undefined;

export const marketplaceService = {
  search: (filter: MarketplaceFilter) =>
    apiClient.get<ListingListResponse>("/api/marketplace/listings", {
      q: filter.q || undefined,
      brand: joined(filter.brands),
      categoryId: joined(filter.categoryIds),
      category: joined(filter.categoryKinds),
      size: joined(filter.sizes),
      color: joined(filter.colors),
      condition: joined(filter.conditions),
      sellerKind: filter.sellerKind,
      priceMinCents: filter.priceMinCents,
      priceMaxCents: filter.priceMaxCents,
      sort: filter.sort,
      page: filter.page ?? 1,
      pageSize: filter.pageSize ?? 24,
    }),

  /** 搜索下拉建议：品牌 / 款式系列 / 秀场 / 单品标题。 */
  searchSuggestions: async (query: string, limit = 8) => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const res = await apiClient.get<{
      suggestions: MarketplaceSearchSuggestion[];
    }>("/api/marketplace/search-suggestions", { q: trimmed, limit });
    return res?.suggestions ?? [];
  },

  /**
   * 热门品牌。后端按在售数量取前 30 为候选池，再用当天日期做种子打乱，
   * 所以首屏每天不同、当天内刷新稳定。
   */
  popularBrands: async (limit = 8, rotate = true) => {
    const res = await apiClient.get<{ brands: PopularBrand[] }>(
      "/api/marketplace/popular-brands",
      { limit, rotate },
    );
    return res?.brands ?? [];
  },

  /** 管理员策展的「大家都在看」。 */
  curated: async (limit = 10) => {
    const res = await apiClient.get<{ products: Listing[] }>(
      "/api/marketplace/curated",
      { limit },
    );
    return res?.products ?? [];
  },

  allBrands: (
    params: { keyword?: string; page?: number; pageSize?: number } = {},
  ) =>
    apiClient.get<PlatformBrandListResponse>("/api/marketplace/all-brands", {
      keyword: params.keyword || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
    }),
};

// ============================================================================
// 单品详情富数据
// ============================================================================

export interface ProductDetailSeller {
  userId: number;
  username: string;
  avatarUrl?: string | null;
  level: number;
  /** 好评率 0~1，null 表示还没有评价。 */
  positiveRate?: number | null;
  totalSales: number;
  joinedAt?: string | null;
  listingCount: number;
}

export interface ProductDetailShow {
  id: string;
  brandName?: string | null;
  season?: string | null;
  year?: number | null;
  category?: string | null;
  title?: string | null;
  coverImage?: string | null;
}

export interface ProductDetailRelatedBrand {
  name: string;
  listingCount: number;
  imageUrl?: string | null;
}

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

export interface StoreProductRichDetail {
  product: Listing;
  seller: ProductDetailSeller | null;
  show: ProductDetailShow | null;
  relatedBrands: ProductDetailRelatedBrand[];
  relatedProducts: Listing[];
  sellerOtherProducts: Listing[];
  reviews: { items: ProductDetailReviewItem[]; total: number };
}

/**
 * 一次性拿商品 + 卖家卡 + 关联秀场 + 相关推荐 + 评价，避免详情页 N+1。
 * 任何子查询失败都不阻塞主体，对应字段回退到空 / null。
 */
export const getListingRichDetail = (productId: number) =>
  apiClient.get<StoreProductRichDetail>(
    `/api/store-merchants/products/${productId}/rich-detail`,
  );
