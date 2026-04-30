/**
 * Thin read-only API client for the Avant Regard backend.
 *
 * Design notes:
 *  - Unwraps the `{ code, message, data }` envelope used by the FastAPI backend
 *    (see frontend/src/services/postService.ts for the mobile-side mirror).
 *  - No auth tokens: the web surface is anonymous / read-only for v1.
 *  - Uses Next.js fetch caching with a short revalidate window so server
 *    components stay fresh without hammering the backend.
 */

import { config } from "./config";
import type {
  ApiEnvelope,
  FeedResponse,
  Post,
  UserInfo,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  revalidate?: number | false;
  tags?: string[];
  signal?: AbortSignal;
}

async function request<T>(
  endpoint: string,
  { revalidate = 60, tags, signal }: RequestOptions = {},
): Promise<T> {
  const url = `${config.apiBaseUrl}${endpoint}`;
  const init: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
    },
    signal,
    next: revalidate === false ? { tags } : { revalidate, tags },
  };

  const response = await fetch(url, init);
  if (!response.ok) {
    throw new ApiError(response.status, `GET ${endpoint} → HTTP ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  if (
    json &&
    typeof json === "object" &&
    "code" in (json as Record<string, unknown>)
  ) {
    const envelope = json as ApiEnvelope<T>;
    if (envelope.code !== 0) {
      throw new ApiError(200, envelope.message || "API error");
    }
    return envelope.data;
  }
  return json as T;
}

// ---------- Feed / Discover ----------

export interface GetFeedParams {
  limit?: number;
  skip?: number;
  excludeIds?: number[];
}

export async function getFeed(params: GetFeedParams = {}): Promise<FeedResponse> {
  const { limit = 30, skip = 0, excludeIds } = params;
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  query.set("skip", String(skip));
  if (excludeIds?.length) query.set("exclude_ids", excludeIds.join(","));
  return request<FeedResponse>(`/api/posts/feed?${query.toString()}`, {
    revalidate: 30,
    tags: ["discover-feed"],
  });
}

// ---------- Posts ----------

export async function getPost(postId: number | string): Promise<Post> {
  return request<Post>(`/api/posts/${postId}`, {
    revalidate: 60,
    tags: [`post-${postId}`],
  });
}

export async function getUserPosts(
  userId: number | string,
  status: "PUBLISHED" | "DRAFT" = "PUBLISHED",
): Promise<Post[]> {
  return request<Post[]>(
    `/api/posts/user/${userId}?status=${status}`,
    { revalidate: 60, tags: [`user-posts-${userId}`] },
  );
}

// ---------- Communities ----------

export interface Community {
  id: number;
  name: string;
  slug: string;
  description: string;
  iconUrl: string;
  coverUrl: string;
  category: "GENERAL" | "FASHION" | "LIFESTYLE" | "BEAUTY" | "CULTURE";
  isOfficial: boolean;
  isActive: boolean;
  memberCount: number;
  postCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityListResponse {
  popular: Community[];
  following: Community[];
  all: Community[];
}

export async function getCommunities(): Promise<CommunityListResponse> {
  return request<CommunityListResponse>(`/api/communities`, {
    revalidate: 120,
    tags: ["communities"],
  });
}

export async function getCommunityBySlug(slug: string): Promise<Community> {
  return request<Community>(
    `/api/communities/slug/${encodeURIComponent(slug)}`,
    { revalidate: 120, tags: [`community-${slug}`] },
  );
}

export async function getCommunityPosts(
  communityId: number | string,
): Promise<Post[]> {
  return request<Post[]>(`/api/posts/community/${communityId}`, {
    revalidate: 60,
    tags: [`community-posts-${communityId}`],
  });
}

// ---------- Brands ----------

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
  contributorName?: string;
  latestSeason?: string;
  vogueSlug?: string;
  vogueUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface BrandListResponse {
  brands: Brand[];
  total: number;
  page: number;
  pageSize: number;
}

// Backend enforces `pageSize ∈ [1, 200]` on `/api/brands`; requesting more
// than 200 returns HTTP 422. Callers needing the full list should use
// `getAllBrands()` which pages through in chunks of BRAND_PAGE_MAX.
const BRAND_PAGE_MAX = 200;

export async function getBrands(params: {
  keyword?: string;
  category?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<BrandListResponse> {
  const qs = new URLSearchParams();
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.category) qs.set("category", params.category);
  qs.set("page", String(params.page ?? 1));
  qs.set(
    "pageSize",
    String(Math.min(params.pageSize ?? 50, BRAND_PAGE_MAX)),
  );
  return request<BrandListResponse>(`/api/brands?${qs.toString()}`, {
    revalidate: 300,
    tags: ["brands"],
  });
}

/**
 * Fetch ALL brands (paginated internally at BRAND_PAGE_MAX per request).
 *
 * Used by `/archive/brands` which needs every brand up-front for the A–Z
 * index. Stops either when the running count hits `total` or when a page
 * returns fewer items than requested (safety net against misreported totals).
 */
export async function getAllBrands(
  params: { keyword?: string; category?: string } = {},
): Promise<BrandListResponse> {
  const first = await getBrands({ ...params, page: 1, pageSize: BRAND_PAGE_MAX });
  const all = [...first.brands];
  const total = first.total;

  for (let page = 2; all.length < total; page++) {
    const next = await getBrands({ ...params, page, pageSize: BRAND_PAGE_MAX });
    if (next.brands.length === 0) break;
    all.push(...next.brands);
    if (next.brands.length < BRAND_PAGE_MAX) break;
  }

  return { brands: all, total, page: 1, pageSize: all.length };
}

export async function getBrandById(
  brandId: number | string,
): Promise<Brand | null> {
  return request<Brand | null>(`/api/brands/${brandId}`, {
    revalidate: 300,
    tags: [`brand-${brandId}`],
  });
}

export async function getBrandPosts(
  brandId: number | string,
  limit = 50,
): Promise<Post[]> {
  return request<Post[]>(`/api/posts/brand/id/${brandId}?limit=${limit}`, {
    revalidate: 60,
    tags: [`brand-posts-${brandId}`],
  });
}

// ---------- Shows ----------

export interface Show {
  id: number | string;
  brand: string;
  season: string;
  title?: string;
  coverImage?: string;
  showUrl?: string;
  year?: number;
  category?: string;
  description?: string;
  designer?: string;
}

interface ShowListResponse {
  shows: Show[];
  total: number;
  page?: number;
  pageSize?: number;
}

export async function getShows(params: {
  keyword?: string;
  brand?: string;
  year?: number;
  category?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<ShowListResponse> {
  const qs = new URLSearchParams();
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.brand) qs.set("brand", params.brand);
  if (params.year) qs.set("year", String(params.year));
  if (params.category) qs.set("category", params.category);
  qs.set("page", String(params.page ?? 1));
  qs.set("pageSize", String(params.pageSize ?? 60));
  return request<ShowListResponse>(`/api/shows?${qs.toString()}`, {
    revalidate: 300,
    tags: ["shows"],
  });
}

export async function getShowById(
  showId: number | string,
): Promise<Show | null> {
  return request<Show | null>(
    `/api/shows/${encodeURIComponent(String(showId))}`,
    { revalidate: 300, tags: [`show-${showId}`] },
  );
}

export async function getShowsByBrand(brandName: string): Promise<Show[]> {
  // Backend returns { shows, total } for this route; tolerate both shapes.
  const data = await request<Show[] | ShowListResponse>(
    `/api/shows/by-brand/${encodeURIComponent(brandName)}`,
    { revalidate: 300, tags: [`shows-by-brand-${brandName}`] },
  );
  return Array.isArray(data) ? data : data.shows;
}

export async function getShowPosts(
  showId: number | string,
): Promise<Post[]> {
  return request<Post[]>(
    `/api/posts/show/${encodeURIComponent(String(showId))}`,
    { revalidate: 60, tags: [`show-posts-${showId}`] },
  );
}

// ---------- Buyer stores ----------

export interface BuyerStore {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  coordinates?: { latitude: number; longitude: number } | null;
  brands: string[];
  style: string[];
  isOpen: boolean;
  phone?: string[];
  hours?: string;
  rating?: number;
  description?: string;
  images?: string[];
  rest?: string;
  favoriteCount?: number;
  /**
   * 该店铺是否已有认证商家入驻 —— 仅 `withMerchantFirst=true` / `/buyer-stores/all`
   * 路径回填；其它端点保持 undefined，渲染侧一律当 `=== true` 才视为已入驻.
   */
  hasMerchant?: boolean;
}

interface StoreListResponse {
  stores: BuyerStore[];
  total: number;
  page?: number;
  pageSize?: number;
}

// Backend enforces `pageSize ∈ [1, 200]` on `/api/buyer-stores`; use
// `getAllStores()` when you need every store for the global map view.
const STORE_PAGE_MAX = 200;

export async function getStores(params: {
  country?: string;
  city?: string;
  brand?: string;
  style?: string;
  openOnly?: boolean;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<StoreListResponse> {
  const qs = new URLSearchParams();
  if (params.country) qs.set("country", params.country);
  if (params.city) qs.set("city", params.city);
  if (params.brand) qs.set("brand", params.brand);
  if (params.style) qs.set("style", params.style);
  if (params.openOnly) qs.set("openOnly", "true");
  if (params.searchQuery) qs.set("searchQuery", params.searchQuery);
  qs.set("page", String(params.page ?? 1));
  qs.set(
    "pageSize",
    String(Math.min(params.pageSize ?? 50, STORE_PAGE_MAX)),
  );
  return request<StoreListResponse>(`/api/buyer-stores?${qs.toString()}`, {
    revalidate: 300,
    tags: ["buyer-stores"],
  });
}

export const STORE_MAX_PAGE_SIZE = STORE_PAGE_MAX;

export async function getStoreById(
  storeId: string,
): Promise<BuyerStore | null> {
  return request<BuyerStore | null>(
    `/api/buyer-stores/${encodeURIComponent(storeId)}`,
    { revalidate: 300, tags: [`store-${storeId}`] },
  );
}

export async function getStoreCountries(): Promise<string[]> {
  const data = await request<{ countries: string[] }>(
    `/api/buyer-stores/countries`,
    { revalidate: 600, tags: ["store-countries"] },
  );
  return data.countries || [];
}

export async function getStoreCities(country?: string): Promise<string[]> {
  const qs = country ? `?country=${encodeURIComponent(country)}` : "";
  const data = await request<{ cities: string[] }>(
    `/api/buyer-stores/cities${qs}`,
    { revalidate: 600, tags: ["store-cities", country ?? "all"] },
  );
  return data.cities || [];
}

// ---------- Users ----------

export async function getUserInfo(userId: number | string): Promise<UserInfo> {
  return request<UserInfo>(`/api/user-info/${userId}`, {
    revalidate: 120,
    tags: [`user-info-${userId}`],
  });
}

export async function getUserLevel(
  userId: number | string,
): Promise<number> {
  try {
    const data = await request<{ userId: number; currentLevel: number }>(
      `/api/levels/users/${userId}/summary`,
      { revalidate: 120, tags: [`user-level-${userId}`] },
    );
    return data.currentLevel ?? 0;
  } catch {
    return 0;
  }
}

export async function getUserFollowerCount(
  userId: number | string,
): Promise<number> {
  const data = await request<{ count: number } | number>(
    `/api/follow/user/${userId}/followers/count`,
    { revalidate: 120 },
  );
  return typeof data === "number" ? data : data.count ?? 0;
}

export async function getUserFollowingCount(
  userId: number | string,
): Promise<number> {
  const data = await request<{ count: number } | number>(
    `/api/follow/user/${userId}/following/count`,
    { revalidate: 120 },
  );
  return typeof data === "number" ? data : data.count ?? 0;
}
