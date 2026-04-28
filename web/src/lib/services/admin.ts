/**
 * Admin API service for the web admin panel.
 *
 * Thin wrappers around `apiClient` — all auth, envelope unwrapping,
 * and 401 refresh logic is handled by the shared client.
 */

import { apiClient } from "../api-client";

// ─── Shared types ───────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items?: T[];
}

// ─── Posts ───────────────────────────────────────────────────────────────────

export interface AdminPost {
  id: number;
  userId: number;
  username: string;
  userAvatar?: string;
  title: string;
  content?: string;
  images?: string[];
  coverImage?: string;
  postType: string;
  status: string;
  auditStatus?: string;
  grade?: string;
  likeCount: number;
  commentCount: number;
  favoriteCount: number;
  viewCount?: number;
  communityId?: number;
  communityName?: string;
  createdAt: string;
  updatedAt?: string;
  rating?: number;
  brandName?: string;
  season?: string;
}

export interface AllPostsParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  auditStatus?: string;
  postType?: string;
}

export interface AllPostsResponse {
  posts: AdminPost[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ReportedPostItem {
  report: {
    id: number;
    reporterId: number;
    reporterName: string;
    reason: string;
    description: string;
    status: string;
    createdAt: string;
  };
  post: AdminPost | null;
}

export interface ReportedPostsResponse {
  items: ReportedPostItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const postsApi = {
  getAll: (params: AllPostsParams = {}) =>
    apiClient.get<AllPostsResponse>("/api/admin/posts/all", {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      keyword: params.keyword,
      status: params.status,
      auditStatus: params.auditStatus,
      postType: params.postType,
    }),

  getReported: (page = 1, pageSize = 20) =>
    apiClient.get<ReportedPostsResponse>("/api/admin/posts/reported", { page, pageSize }),

  getPending: () => apiClient.get<AdminPost[]>("/api/admin/posts/pending"),

  approve: (postId: number, remark?: string) =>
    apiClient.post<void>(
      `/api/admin/posts/${postId}/approve${remark ? `?remark=${encodeURIComponent(remark)}` : ""}`,
    ),

  reject: (postId: number, remark?: string) =>
    apiClient.post<void>(
      `/api/admin/posts/${postId}/reject${remark ? `?remark=${encodeURIComponent(remark)}` : ""}`,
    ),

  delete: (postId: number) => apiClient.delete<void>(`/api/admin/posts/${postId}`),

  regrade: (postId: number) => apiClient.post<void>(`/api/admin/posts/${postId}/regrade`),

  batchRegrade: (postIds?: number[], ungradedOnly = false) =>
    apiClient.post<{ triggered: number }>("/api/admin/posts/batch-regrade", {
      postIds: postIds ?? null,
      ungradedOnly,
    }),
};

// ─── Comments ────────────────────────────────────────────────────────────────

export interface AdminComment {
  id: number;
  postId: number;
  postTitle: string;
  userId: number;
  username: string;
  content: string;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentsPageResponse {
  comments: AdminComment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const commentsApi = {
  getAll: (page = 1, pageSize = 20) =>
    apiClient.get<CommentsPageResponse>("/api/admin/comments", { page, pageSize }),

  getByPost: (postId: number) =>
    apiClient.get<AdminComment[]>(`/api/admin/comments/post/${postId}`),

  getByUser: (userId: number) =>
    apiClient.get<AdminComment[]>(`/api/admin/comments/user/${userId}`),

  delete: (commentId: number) =>
    apiClient.delete<void>(`/api/admin/comments/${commentId}`),
};

// ─── Users ───────────────────────────────────────────────────────────────────

export interface UserTitle {
  id: number;
  userId: number;
  title: string;
  isPrimary: boolean;
  grantedBy?: number;
  createdAt?: string;
}

export interface AdminUserMerchant {
  storeId: string;
  status: string;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  phone: string;
  status: string;
  userType: string;
  isAdmin: boolean;
  avatarUrl: string;
  bio?: string;
  location?: string;
  gender?: string;
  age?: number;
  createdAt: string;
  titles?: UserTitle[];
  postCount?: number;
  followerCount?: number;
  followingCount?: number;
  merchant?: AdminUserMerchant;
  /** 等级系统 migration 038 引入;  0 表示未达 Lv1. */
  currentLevel?: number;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export const usersApi = {
  getAll: (keyword?: string, page = 1, pageSize = 20) =>
    apiClient.get<AdminUserListResponse>("/api/admin/users", { keyword, page, pageSize }),

  delete: (userId: number) =>
    apiClient.delete<void>(`/api/auth/admin/users/${userId}`),

  getTitles: (userId: number) =>
    apiClient.get<UserTitle[]>(`/api/admin/users/${userId}/titles`),

  addTitle: (userId: number, title: string) =>
    apiClient.post<UserTitle>(`/api/admin/users/${userId}/titles`, { title }),

  removeTitle: (titleId: number) =>
    apiClient.delete<void>(`/api/admin/titles/${titleId}`),
};

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface AdminReport {
  id: number;
  reporterId: number;
  reporterName: string;
  targetType: "POST" | "COMMENT" | "MESSAGE" | "USER";
  targetId: number;
  reason: string;
  description: string;
  status: "PENDING" | "REVIEWED" | "RESOLVED" | "DISMISSED";
  createdAt: string;
}

export interface AdminReportListResponse {
  reports: AdminReport[];
  total: number;
  page: number;
  pageSize: number;
}

export const reportsApi = {
  getAll: (status?: string, page = 1, pageSize = 20) =>
    apiClient.get<AdminReportListResponse>("/api/admin/reports", { status, page, pageSize }),

  updateStatus: (reportId: number, status: string) =>
    apiClient.put<void>(`/api/admin/reports/${reportId}`, { status }),

  deleteChatMessage: (messageId: number) =>
    apiClient.delete<{ messageId: number; senderId: number; conversationId: number }>(
      `/api/admin/chat/messages/${messageId}`,
    ),
};

// ─── Blocks ──────────────────────────────────────────────────────────────────

export interface AdminBlock {
  id: number;
  blockerId: number;
  blockerName: string;
  blockedId: number;
  blockedName: string;
  createdAt: string;
}

export interface AdminBlockListResponse {
  blocks: AdminBlock[];
  total: number;
  page: number;
  pageSize: number;
}

export const blocksApi = {
  getAll: (page = 1, pageSize = 20) =>
    apiClient.get<AdminBlockListResponse>("/api/admin/blocks", { page, pageSize }),
};

// ─── Communities ─────────────────────────────────────────────────────────────

export type CommunityCategory = "GENERAL" | "FASHION" | "LIFESTYLE" | "BEAUTY" | "CULTURE";

export interface AdminCommunity {
  id: number;
  name: string;
  slug: string;
  description: string;
  iconUrl: string;
  coverUrl: string;
  category: CommunityCategory;
  isOfficial: boolean;
  isActive: boolean;
  memberCount: number;
  postCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommunityParams {
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  coverUrl?: string;
  category?: CommunityCategory;
  isOfficial?: boolean;
  sortOrder?: number;
}

export interface UpdateCommunityParams {
  name?: string;
  description?: string;
  iconUrl?: string;
  coverUrl?: string;
  category?: CommunityCategory;
  isOfficial?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CommunityPostsResponse {
  posts: AdminPost[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const communitiesApi = {
  getAll: (includeInactive = true) =>
    apiClient.get<AdminCommunity[]>("/api/admin/communities", { include_inactive: includeInactive }),

  getDetail: (id: number) =>
    apiClient.get<AdminCommunity>(`/api/admin/communities/${id}`),

  create: (params: CreateCommunityParams) =>
    apiClient.post<AdminCommunity>("/api/admin/communities", params),

  update: (id: number, params: UpdateCommunityParams) =>
    apiClient.put<AdminCommunity>(`/api/admin/communities/${id}`, params),

  delete: (id: number) =>
    apiClient.delete<void>(`/api/admin/communities/${id}`),

  getPosts: (communityId: number, page = 1, pageSize = 20) =>
    apiClient.get<CommunityPostsResponse>(`/api/admin/communities/${communityId}/posts`, {
      page,
      pageSize,
    }),

  deletePost: (communityId: number, postId: number) =>
    apiClient.delete<void>(`/api/admin/communities/${communityId}/posts/${postId}`),

  batchDeletePosts: (communityId: number, postIds: number[]) =>
    apiClient.post<{ successCount: number; failCount: number }>(
      `/api/admin/communities/${communityId}/posts/batch-delete`,
      { postIds },
    ),
};

// ─── Brand submissions ───────────────────────────────────────────────────────

export interface AdminBrandSubmission {
  id: number;
  userId: number;
  username: string;
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

export const brandSubmissionsApi = {
  getPending: () =>
    apiClient.get<AdminBrandSubmission[]>("/api/admin/brand-submissions/pending"),

  approve: (id: number) =>
    apiClient.post<void>(`/api/admin/brand-submissions/${id}/approve`),

  reject: (id: number, reason?: string) =>
    apiClient.post<void>(
      `/api/admin/brand-submissions/${id}/reject${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`,
    ),
};

// ─── Brands ──────────────────────────────────────────────────────────────────

export interface AdminBrand {
  id: number;
  name: string;
  category?: string;
  foundedYear?: string;
  founder?: string;
  country?: string;
  website?: string;
  coverImage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminBrandListResponse {
  brands: AdminBrand[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpdateBrandParams {
  name?: string;
  category?: string;
  foundedYear?: string;
  founder?: string;
  country?: string;
  website?: string;
}

export interface AdminBrandImage {
  id: number;
  brandId: number;
  brandName?: string;
  imageUrl: string;
  sortOrder: number;
  status: string;
  isSelected?: boolean;
  uploadedBy?: number;
  createdAt?: string;
}

export const brandsApi = {
  getAll: (keyword?: string, page = 1, pageSize = 50) =>
    apiClient.get<AdminBrandListResponse>("/api/admin/brands", { keyword, page, pageSize }),

  update: (id: number, params: UpdateBrandParams) =>
    apiClient.put<AdminBrand>(`/api/admin/brands/${id}`, params),

  delete: (id: number) =>
    apiClient.delete<void>(`/api/admin/brands/${id}`),

  getImages: (brandId: number) =>
    apiClient.get<{ images: AdminBrandImage[]; total: number }>(`/api/admin/brands/${brandId}/images`),

  uploadImage: (brandId: number, imageUrl: string) =>
    apiClient.post<AdminBrandImage>(`/api/admin/brands/${brandId}/images`, { imageUrl }),

  getPendingImages: () =>
    apiClient.get<{ images: AdminBrandImage[]; total: number }>("/api/admin/brand-images/pending"),

  approveImage: (imageId: number) =>
    apiClient.post<AdminBrandImage>(`/api/admin/brand-images/${imageId}/approve`),

  rejectImage: (imageId: number) =>
    apiClient.post<AdminBrandImage>(`/api/admin/brand-images/${imageId}/reject`),

  deleteImage: (imageId: number) =>
    apiClient.delete<void>(`/api/admin/brand-images/${imageId}`),

  toggleImageSelected: (imageId: number, selected: boolean) =>
    apiClient.post<AdminBrandImage>(`/api/admin/brand-images/${imageId}/toggle-select`, { selected }),
};

// ─── Shows ───────────────────────────────────────────────────────────────────

export interface AdminShow {
  id: number;
  brandName: string;
  season: string;
  title?: string;
  description?: string;
  coverImage?: string;
  status: string;
  imageCount?: number;
  category?: string;
  year?: number;
  createdAt: string;
  updatedAt?: string;
  submittedBy?: number;
  submitterName?: string;
}

export const showsApi = {
  getAll: (params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) =>
    apiClient.get<{ shows: AdminShow[]; total: number; page: number; pageSize: number }>(
      "/api/shows/admin/all",
      params,
    ),

  getPending: () =>
    apiClient.get<{ shows: AdminShow[]; total: number }>("/api/shows/admin/pending"),

  create: (data: Partial<AdminShow>) =>
    apiClient.post<AdminShow>("/api/shows/admin/create", data),

  update: (id: number, data: Partial<AdminShow>) =>
    apiClient.put<AdminShow>(`/api/shows/admin/${id}`, data),

  delete: (id: number) =>
    apiClient.delete<void>(`/api/shows/admin/${id}`),

  approve: (id: number) =>
    apiClient.post<void>(`/api/shows/admin/${id}/approve`),

  reject: (id: number, reason?: string) =>
    apiClient.post<void>(
      `/api/shows/admin/${id}/reject${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`,
    ),
};

// ─── Stores ──────────────────────────────────────────────────────────────────

export interface AdminStore {
  id: number;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  website?: string;
  coverImage?: string;
  latitude?: number;
  longitude?: number;
  brands?: string[];
  styles?: string[];
  openingHours?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const storesApi = {
  getAll: (params?: {
    keyword?: string;
    country?: string;
    city?: string;
    page?: number;
    pageSize?: number;
  }) => apiClient.get<{ stores: AdminStore[]; total: number; page: number; pageSize: number }>(
    "/api/buyer-stores",
    params,
  ),

  create: (data: Partial<AdminStore>) =>
    apiClient.post<AdminStore>("/api/buyer-stores", data),

  update: (id: number, data: Partial<AdminStore>) =>
    apiClient.put<AdminStore>(`/api/buyer-stores/${id}`, data),

  delete: (id: number) =>
    apiClient.delete<void>(`/api/buyer-stores/${id}`),

  getCountries: () => apiClient.get<string[]>("/api/buyer-stores/countries"),
  getCities: () => apiClient.get<string[]>("/api/buyer-stores/cities"),
};

// ─── Banners ─────────────────────────────────────────────────────────────────

export interface AdminBanner {
  id: number;
  imageUrl: string;
  linkType: "NONE" | "POST" | "BRAND" | "SHOW" | "EXTERNAL";
  linkValue?: string;
  sortOrder: number;
  isActive: boolean;
  title?: string;
  createdAt: string;
  updatedAt?: string;
}

export const bannersApi = {
  getAll: () =>
    apiClient.get<AdminBanner[]>("/api/banners/admin/list"),

  create: (data: Partial<AdminBanner>) =>
    apiClient.post<AdminBanner>("/api/banners/admin", data),

  update: (id: number, data: Partial<AdminBanner>) =>
    apiClient.put<AdminBanner>(`/api/banners/admin/${id}`, data),

  delete: (id: number) =>
    apiClient.delete<void>(`/api/banners/admin/${id}`),

  toggleStatus: (id: number) =>
    apiClient.post<AdminBanner>(`/api/banners/admin/${id}/toggle`),
};

// ─── Broadcast ───────────────────────────────────────────────────────────────

export interface BroadcastParams {
  title: string;
  message: string;
  actionData?: Record<string, unknown>;
}

export interface BroadcastResult {
  successCount: number;
  failCount: number;
  totalUsers: number;
}

export const broadcastApi = {
  send: (params: BroadcastParams) =>
    apiClient.post<BroadcastResult>("/api/admin/notifications/broadcast", params),
};

// ─── Customer service ────────────────────────────────────────────────────────

export interface AutoReplyConfig {
  enabled: boolean;
  message: string;
  email: string;
}

export const customerServiceApi = {
  getAutoReply: () =>
    apiClient.get<AutoReplyConfig>("/api/admin/cs-auto-reply"),

  updateAutoReply: (config: AutoReplyConfig) =>
    apiClient.put<AutoReplyConfig>("/api/admin/cs-auto-reply", config),
};

// ─── Recommend config ────────────────────────────────────────────────────────

export interface PoolRatios {
  core: number;
  discovery: number;
  random: number;
}

export interface RecommendConfig {
  pool_ratios: PoolRatios;
  core_pool: { grades: string[] };
  discovery_pool: { enabled: boolean };
  random_pool: { grades: string[] };
  cold_start: { days: number; grades: string[] };
}

export const recommendApi = {
  getConfig: () =>
    apiClient.get<RecommendConfig>("/api/admin/recommend-config"),

  updateConfig: (config: RecommendConfig) =>
    apiClient.put<RecommendConfig>("/api/admin/recommend-config", config),
};

// ─── Maintenance ─────────────────────────────────────────────────────────────

export interface MaintenanceConfig {
  enabled: boolean;
  message: string;
}

export const maintenanceApi = {
  getConfig: () =>
    apiClient.get<MaintenanceConfig>("/api/admin/maintenance"),

  updateConfig: (params: { enabled: boolean; message?: string }) =>
    apiClient.put<MaintenanceConfig>("/api/admin/maintenance", params),
};

// ─── Growth stats ────────────────────────────────────────────────────────────

export interface GrowthPoint {
  date: string;
  users: number;
  posts: number;
  comments: number;
  totalUsers: number;
}

export interface GrowthStatsResponse {
  days: number;
  series: GrowthPoint[];
}

export interface DemographicsResponse {
  gender: Record<string, number>;
  ageBrackets: Record<string, number>;
  regions: { name: string; count: number }[];
}

export const statsApi = {
  getGrowth: (days = 30) =>
    apiClient.get<GrowthStatsResponse>("/api/admin/stats/growth", { days }),

  getDemographics: () =>
    apiClient.get<DemographicsResponse>("/api/admin/stats/demographics"),
};

// ─── File upload ─────────────────────────────────────────────────────────────

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiClient.post<{ url: string }>("/api/files/upload-image", formData);
  return res.url;
}
