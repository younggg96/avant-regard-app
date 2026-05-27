/**
 * 管理员服务 - 处理所有管理员相关的 API 调用
 */

import { useAuthStore } from "../store/authStore";
import { config } from "../config/env";
import { Post } from "./postService";

const EXPO_PUBLIC_API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

// 管理员评论类型（包含帖子信息）
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

// 评论分页响应
export interface CommentsPageResponse {
  comments: AdminComment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 社区类型
export type CommunityCategory = "GENERAL" | "FASHION" | "LIFESTYLE" | "BEAUTY" | "CULTURE";

// 社区数据
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

// 创建社区请求
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

// 更新社区请求
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

// 社区帖子分页响应
export interface CommunityPostsResponse {
  posts: Post[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 批量删除结果
export interface BatchDeleteResult {
  successCount: number;
  failCount: number;
}

// 广播通知请求
export interface BroadcastNotificationParams {
  title: string;
  message: string;
  actionData?: Record<string, unknown>;
}

// 广播通知响应
export interface BroadcastNotificationResult {
  successCount: number;
  failCount: number;
  totalUsers: number;
}

// API 响应包装类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 通用请求方法 - 默认携带 token
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

  // 自动添加 Authorization header（如果已登录）
  const token = useAuthStore.getState().getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
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

        // 检查业务错误码
        if (apiResponse.code !== 0) {
          throw new Error(apiResponse.message || "请求失败");
        }

        // 返回 data 字段（如果存在）
        if ("data" in apiResponse) {
          return apiResponse.data;
        }
      }

      // 如果不是包装格式，直接返回
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

// ==================== 帖子管理（全量） ====================

export interface AllPostsParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  auditStatus?: string;
  postType?: string;
}

export interface AllPostsResponse {
  posts: Post[];
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
  post: Post | null;
}

export interface ReportedPostsResponse {
  items: ReportedPostItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getAllPosts(
  params: AllPostsParams = {}
): Promise<AllPostsResponse> {
  const qs = new URLSearchParams();
  qs.append("page", String(params.page ?? 1));
  qs.append("pageSize", String(params.pageSize ?? 20));
  if (params.keyword) qs.append("keyword", params.keyword);
  if (params.status) qs.append("status", params.status);
  if (params.auditStatus) qs.append("auditStatus", params.auditStatus);
  if (params.postType) qs.append("postType", params.postType);
  return request<AllPostsResponse>(`/api/admin/posts/all?${qs.toString()}`, {
    method: "GET",
  });
}

export async function getReportedPosts(
  page: number = 1,
  pageSize: number = 20
): Promise<ReportedPostsResponse> {
  return request<ReportedPostsResponse>(
    `/api/admin/posts/reported?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
}

// ==================== 帖子审核 ====================

/**
 * 获取待审核帖子列表
 * GET /api/admin/posts/pending
 */
export async function getPendingPosts(): Promise<Post[]> {
  return request<Post[]>("/api/admin/posts/pending", {
    method: "GET",
  });
}

/**
 * 审核通过帖子
 * POST /api/admin/posts/{postId}/approve
 * @param postId 帖子ID
 * @param remark 可选备注
 */
export async function approvePost(
  postId: number,
  remark?: string
): Promise<void> {
  const query = remark ? `?remark=${encodeURIComponent(remark)}` : "";
  return request<void>(`/api/admin/posts/${postId}/approve${query}`, {
    method: "POST",
  });
}

/**
 * 审核拒绝帖子
 * POST /api/admin/posts/{postId}/reject
 * @param postId 帖子ID
 * @param remark 可选备注（拒绝原因）
 */
export async function rejectPost(
  postId: number,
  remark?: string
): Promise<void> {
  const query = remark ? `?remark=${encodeURIComponent(remark)}` : "";
  return request<void>(`/api/admin/posts/${postId}/reject${query}`, {
    method: "POST",
  });
}

/**
 * 管理员删除帖子
 * DELETE /api/admin/posts/{postId}
 * @param postId 帖子ID
 */
export async function deletePost(postId: number): Promise<void> {
  return request<void>(`/api/admin/posts/${postId}`, {
    method: "DELETE",
  });
}

// ==================== 帖子评级 ====================

export async function regradePost(postId: number): Promise<void> {
  return request<void>(`/api/admin/posts/${postId}/regrade`, {
    method: "POST",
  });
}

export async function batchRegradePosts(
  postIds?: number[],
  ungradedOnly?: boolean
): Promise<{ triggered: number }> {
  return request<{ triggered: number }>("/api/admin/posts/batch-regrade", {
    method: "POST",
    body: JSON.stringify({
      postIds: postIds || null,
      ungradedOnly: ungradedOnly ?? false,
    }),
  });
}

// ==================== 用户管理 ====================

/**
 * 删除用户及其所有关联数据
 * DELETE /api/auth/admin/users/{userId}
 * @param userId 用户ID
 */
export async function deleteUser(userId: number): Promise<void> {
  return request<void>(`/api/auth/admin/users/${userId}`, {
    method: "DELETE",
  });
}

// ==================== 评论管理 ====================

/**
 * 获取所有评论（分页）
 * GET /api/admin/comments
 * @param page 页码
 * @param pageSize 每页数量
 */
export async function getAllComments(
  page: number = 1,
  pageSize: number = 20
): Promise<CommentsPageResponse> {
  return request<CommentsPageResponse>(
    `/api/admin/comments?page=${page}&pageSize=${pageSize}`,
    {
      method: "GET",
    }
  );
}

/**
 * 获取指定帖子的所有评论
 * GET /api/admin/comments/post/{postId}
 * @param postId 帖子ID
 */
export async function getCommentsByPost(
  postId: number
): Promise<AdminComment[]> {
  return request<AdminComment[]>(`/api/admin/comments/post/${postId}`, {
    method: "GET",
  });
}

/**
 * 获取指定用户的所有评论
 * GET /api/admin/comments/user/{userId}
 * @param userId 用户ID
 */
export async function getCommentsByUser(
  userId: number
): Promise<AdminComment[]> {
  return request<AdminComment[]>(`/api/admin/comments/user/${userId}`, {
    method: "GET",
  });
}

/**
 * 管理员删除评论
 * DELETE /api/admin/comments/{commentId}
 * @param commentId 评论ID
 */
export async function deleteComment(commentId: number): Promise<void> {
  return request<void>(`/api/admin/comments/${commentId}`, {
    method: "DELETE",
  });
}

// ==================== 社区管理 ====================

/**
 * 获取所有社区（管理员）
 * GET /api/admin/communities
 * @param includeInactive 是否包含未激活的社区
 */
export async function getAllCommunities(
  includeInactive: boolean = true
): Promise<AdminCommunity[]> {
  return request<AdminCommunity[]>(
    `/api/admin/communities?include_inactive=${includeInactive}`,
    {
      method: "GET",
    }
  );
}

/**
 * 获取社区详情（管理员）
 * GET /api/admin/communities/{communityId}
 * @param communityId 社区ID
 */
export async function getCommunityDetail(
  communityId: number
): Promise<AdminCommunity> {
  return request<AdminCommunity>(`/api/admin/communities/${communityId}`, {
    method: "GET",
  });
}

/**
 * 创建社区（管理员）
 * POST /api/admin/communities
 * @param params 创建参数
 */
export async function createCommunity(
  params: CreateCommunityParams
): Promise<AdminCommunity> {
  return request<AdminCommunity>("/api/admin/communities", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 更新社区（管理员）
 * PUT /api/admin/communities/{communityId}
 * @param communityId 社区ID
 * @param params 更新参数
 */
export async function updateCommunity(
  communityId: number,
  params: UpdateCommunityParams
): Promise<AdminCommunity> {
  return request<AdminCommunity>(`/api/admin/communities/${communityId}`, {
    method: "PUT",
    body: JSON.stringify(params),
  });
}

/**
 * 删除社区（管理员）
 * DELETE /api/admin/communities/{communityId}
 * @param communityId 社区ID
 */
export async function deleteCommunity(communityId: number): Promise<void> {
  return request<void>(`/api/admin/communities/${communityId}`, {
    method: "DELETE",
  });
}

// ==================== 社区帖子管理 ====================

/**
 * 获取社区内的帖子（管理员）
 * GET /api/admin/communities/{communityId}/posts
 * @param communityId 社区ID
 * @param page 页码
 * @param pageSize 每页数量
 */
export async function getCommunityPosts(
  communityId: number,
  page: number = 1,
  pageSize: number = 20
): Promise<CommunityPostsResponse> {
  return request<CommunityPostsResponse>(
    `/api/admin/communities/${communityId}/posts?page=${page}&pageSize=${pageSize}`,
    {
      method: "GET",
    }
  );
}

/**
 * 删除社区内的帖子（管理员）
 * DELETE /api/admin/communities/{communityId}/posts/{postId}
 * @param communityId 社区ID
 * @param postId 帖子ID
 */
export async function deleteCommunityPost(
  communityId: number,
  postId: number
): Promise<void> {
  return request<void>(
    `/api/admin/communities/${communityId}/posts/${postId}`,
    {
      method: "DELETE",
    }
  );
}

/**
 * 批量删除社区内的帖子（管理员）
 * POST /api/admin/communities/{communityId}/posts/batch-delete
 * @param communityId 社区ID
 * @param postIds 帖子ID数组
 */
export async function batchDeleteCommunityPosts(
  communityId: number,
  postIds: number[]
): Promise<BatchDeleteResult> {
  return request<BatchDeleteResult>(
    `/api/admin/communities/${communityId}/posts/batch-delete`,
    {
      method: "POST",
      body: JSON.stringify({ postIds }),
    }
  );
}

// ==================== 品牌提交审核 ====================

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

/**
 * GET /api/admin/brand-submissions/pending
 */
export async function getPendingBrandSubmissions(): Promise<
  AdminBrandSubmission[]
> {
  return request<AdminBrandSubmission[]>(
    "/api/admin/brand-submissions/pending",
    { method: "GET" }
  );
}

/**
 * POST /api/admin/brand-submissions/{id}/approve
 */
export async function approveBrandSubmission(id: number): Promise<void> {
  return request<void>(`/api/admin/brand-submissions/${id}/approve`, {
    method: "POST",
  });
}

/**
 * POST /api/admin/brand-submissions/{id}/reject
 */
export async function rejectBrandSubmission(
  id: number,
  reason?: string
): Promise<void> {
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  return request<void>(`/api/admin/brand-submissions/${id}/reject${query}`, {
    method: "POST",
  });
}

// ==================== 品牌管理 ====================

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

/**
 * GET /api/admin/brands
 */
export async function getAdminBrands(
  keyword?: string,
  page: number = 1,
  pageSize: number = 50
): Promise<AdminBrandListResponse> {
  const params = new URLSearchParams();
  if (keyword) params.append("keyword", keyword);
  params.append("page", page.toString());
  params.append("pageSize", pageSize.toString());
  return request<AdminBrandListResponse>(
    `/api/admin/brands?${params.toString()}`,
    { method: "GET" }
  );
}

/**
 * PUT /api/admin/brands/{id}
 */
export async function updateAdminBrand(
  id: number,
  params: UpdateBrandParams
): Promise<AdminBrand> {
  return request<AdminBrand>(`/api/admin/brands/${id}`, {
    method: "PUT",
    body: JSON.stringify(params),
  });
}

/**
 * DELETE /api/admin/brands/{id}
 */
export async function deleteAdminBrand(id: number): Promise<void> {
  return request<void>(`/api/admin/brands/${id}`, {
    method: "DELETE",
  });
}

// ==================== 品牌图片审核 ====================

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

export async function getPendingBrandImages(): Promise<{ images: AdminBrandImage[]; total: number }> {
  return request<{ images: AdminBrandImage[]; total: number }>(
    "/api/admin/brand-images/pending",
    { method: "GET" }
  );
}

export async function approveBrandImage(imageId: number): Promise<AdminBrandImage> {
  return request<AdminBrandImage>(`/api/admin/brand-images/${imageId}/approve`, {
    method: "POST",
  });
}

export async function rejectBrandImage(imageId: number): Promise<AdminBrandImage> {
  return request<AdminBrandImage>(`/api/admin/brand-images/${imageId}/reject`, {
    method: "POST",
  });
}

export async function deleteBrandImage(imageId: number): Promise<void> {
  return request<void>(`/api/admin/brand-images/${imageId}`, {
    method: "DELETE",
  });
}

export async function adminUploadBrandImage(brandId: number, imageUrl: string): Promise<AdminBrandImage> {
  return request<AdminBrandImage>(`/api/admin/brands/${brandId}/images`, {
    method: "POST",
    body: JSON.stringify({ imageUrl }),
  });
}

export async function getBrandImagesAdmin(brandId: number): Promise<{ images: AdminBrandImage[]; total: number }> {
  return request<{ images: AdminBrandImage[]; total: number }>(
    `/api/admin/brands/${brandId}/images`,
    { method: "GET" }
  );
}

export async function toggleBrandImageSelected(imageId: number, selected: boolean): Promise<AdminBrandImage> {
  return request<AdminBrandImage>(`/api/admin/brand-images/${imageId}/toggle-select`, {
    method: "POST",
    body: JSON.stringify({ selected }),
  });
}

// ==================== 用户头衔管理 ====================

export interface UserTitle {
  id: number;
  userId: number;
  title: string;
  isPrimary: boolean;
  grantedBy?: number;
  createdAt?: string;
}

export async function getUserTitlesAdmin(
  userId: number
): Promise<UserTitle[]> {
  return request<UserTitle[]>(`/api/admin/users/${userId}/titles`, {
    method: "GET",
  });
}

export async function addUserTitle(
  userId: number,
  title: string
): Promise<UserTitle> {
  return request<UserTitle>(`/api/admin/users/${userId}/titles`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function removeUserTitle(titleId: number): Promise<void> {
  return request<void>(`/api/admin/titles/${titleId}`, {
    method: "DELETE",
  });
}

// ==================== 用户列表 ====================

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
  /** 等级系统 migration 038; 0 表示未达 Lv1. */
  currentLevel?: number;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * GET /api/admin/users
 */
export async function getAdminUsers(
  keyword?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<AdminUserListResponse> {
  const params = new URLSearchParams();
  if (keyword) params.append("keyword", keyword);
  params.append("page", page.toString());
  params.append("pageSize", pageSize.toString());
  return request<AdminUserListResponse>(
    `/api/admin/users?${params.toString()}`,
    { method: "GET" }
  );
}

// ==================== 举报管理 ====================

/**
 * 管理员删除聊天消息
 * DELETE /api/admin/chat/messages/{messageId}
 */
export async function adminDeleteChatMessage(
  messageId: number
): Promise<{ messageId: number; senderId: number; conversationId: number }> {
  return request<{ messageId: number; senderId: number; conversationId: number }>(
    `/api/admin/chat/messages/${messageId}`,
    { method: "DELETE" }
  );
}

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

/**
 * GET /api/admin/reports
 */
export async function getAdminReports(
  status?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<AdminReportListResponse> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  params.append("page", page.toString());
  params.append("pageSize", pageSize.toString());
  return request<AdminReportListResponse>(
    `/api/admin/reports?${params.toString()}`,
    { method: "GET" }
  );
}

/**
 * PUT /api/admin/reports/{id}
 */
export async function updateReportStatus(
  reportId: number,
  status: string
): Promise<void> {
  return request<void>(`/api/admin/reports/${reportId}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

// ==================== 屏蔽关系 ====================

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

/**
 * GET /api/admin/blocks
 */
export async function getAdminBlocks(
  page: number = 1,
  pageSize: number = 20
): Promise<AdminBlockListResponse> {
  const params = new URLSearchParams();
  params.append("page", page.toString());
  params.append("pageSize", pageSize.toString());
  return request<AdminBlockListResponse>(
    `/api/admin/blocks?${params.toString()}`,
    { method: "GET" }
  );
}

// ==================== 广播通知 ====================

/**
 * 向所有用户发送广播通知（管理员）
 * POST /api/admin/notifications/broadcast
 * @param params 广播通知参数
 */
export async function broadcastNotification(
  params: BroadcastNotificationParams
): Promise<BroadcastNotificationResult> {
  return request<BroadcastNotificationResult>(
    "/api/admin/notifications/broadcast",
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
}

// ==================== 客服自动回复 ====================

export interface AutoReplyConfig {
  enabled: boolean;
  message: string;
  email: string;
}

export async function getAutoReplyConfig(): Promise<AutoReplyConfig> {
  return request<AutoReplyConfig>("/api/admin/cs-auto-reply", {
    method: "GET",
  });
}

export async function updateAutoReplyConfig(
  config: AutoReplyConfig
): Promise<AutoReplyConfig> {
  return request<AutoReplyConfig>("/api/admin/cs-auto-reply", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

// ==================== 维护模式 ====================

export interface MaintenanceConfig {
  enabled: boolean;
  message: string;
}

export interface UpdateMaintenanceConfigParams {
  enabled: boolean;
  /** 可选：留空则保留已有文案 */
  message?: string;
}

export async function getMaintenanceConfig(): Promise<MaintenanceConfig> {
  return request<MaintenanceConfig>("/api/admin/maintenance", {
    method: "GET",
  });
}

export async function updateMaintenanceConfig(
  params: UpdateMaintenanceConfigParams
): Promise<MaintenanceConfig> {
  return request<MaintenanceConfig>("/api/admin/maintenance", {
    method: "PUT",
    body: JSON.stringify(params),
  });
}

// ==================== 功能开关 ====================

export interface FeatureFlagsConfig {
  lotteryEnabled: boolean;
}

export interface UpdateFeatureFlagsParams {
  lotteryEnabled?: boolean;
}

export async function getFeatureFlagsAdmin(): Promise<FeatureFlagsConfig> {
  return request<FeatureFlagsConfig>("/api/admin/feature-flags", {
    method: "GET",
  });
}

export async function updateFeatureFlagsAdmin(
  params: UpdateFeatureFlagsParams
): Promise<FeatureFlagsConfig> {
  return request<FeatureFlagsConfig>("/api/admin/feature-flags", {
    method: "PUT",
    body: JSON.stringify(params),
  });
}

// ==================== 推荐算法配置 ====================

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

export async function getRecommendConfig(): Promise<RecommendConfig> {
  return request<RecommendConfig>("/api/admin/recommend-config", {
    method: "GET",
  });
}

export async function updateRecommendConfig(
  config: RecommendConfig
): Promise<RecommendConfig> {
  return request<RecommendConfig>("/api/admin/recommend-config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

// ==================== 聊天审计 (admin 监控用,只读) ====================
//
// 与 chatService 中给普通用户用的接口刻意分开,避免不小心把 admin 权限的
// 接口路径直接漏到客户端。这里只暴露列表 / 详情 / 搜索三个查询动作,删除
// 仍走已有的 adminDeleteChatMessage。

export interface AdminChatParticipant {
  id: number;
  username: string;
  avatarUrl: string;
  email?: string;
  phone?: string;
  joinedAt?: string;
  lastReadAt?: string;
}

export interface AdminChatConversation {
  id: number;
  participants: AdminChatParticipant[];
  lastMessageText: string | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  messageCount: number;
}

export interface AdminChatConversationListResponse {
  conversations: AdminChatConversation[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderAvatar: string;
  content: string;
  messageType: string;
  createdAt: string;
  isDeleted: boolean;
}

export interface AdminChatConversationDetail {
  conversation: {
    id: number;
    participants: AdminChatParticipant[];
    lastMessageText: string | null;
    lastMessageAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  messages: AdminChatMessage[];
  hasMore: boolean;
}

export interface AdminChatSearchMessage extends AdminChatMessage {
  participants: AdminChatParticipant[];
}

export interface AdminChatSearchResponse {
  messages: AdminChatSearchMessage[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * GET /api/admin/chat/conversations
 * 列出会话, 可选按用户名/邮箱/手机号关键字或 userId 过滤。
 */
export async function getAdminChatConversations(opts: {
  keyword?: string;
  userId?: number;
  page?: number;
  pageSize?: number;
}): Promise<AdminChatConversationListResponse> {
  const params = new URLSearchParams();
  if (opts.keyword) params.append("keyword", opts.keyword);
  if (opts.userId !== undefined) params.append("userId", String(opts.userId));
  params.append("page", String(opts.page ?? 1));
  params.append("pageSize", String(opts.pageSize ?? 20));
  return request<AdminChatConversationListResponse>(
    `/api/admin/chat/conversations?${params.toString()}`,
    { method: "GET" }
  );
}

/**
 * GET /api/admin/chat/conversations/{id}
 * 拉某会话的参与者 + 消息历史(admin 视角, 含已软删).
 */
export async function getAdminChatConversationDetail(
  conversationId: number,
  opts: { beforeId?: number; limit?: number } = {}
): Promise<AdminChatConversationDetail> {
  const params = new URLSearchParams();
  if (opts.beforeId !== undefined)
    params.append("beforeId", String(opts.beforeId));
  if (opts.limit !== undefined) params.append("limit", String(opts.limit));
  const qs = params.toString();
  return request<AdminChatConversationDetail>(
    `/api/admin/chat/conversations/${conversationId}${qs ? `?${qs}` : ""}`,
    { method: "GET" }
  );
}

/**
 * GET /api/admin/chat/messages/search
 * 按内容关键字搜消息(仅 text 类型).
 */
export async function searchAdminChatMessages(
  keyword: string,
  page: number = 1,
  pageSize: number = 20
): Promise<AdminChatSearchResponse> {
  const params = new URLSearchParams();
  params.append("keyword", keyword);
  params.append("page", String(page));
  params.append("pageSize", String(pageSize));
  return request<AdminChatSearchResponse>(
    `/api/admin/chat/messages/search?${params.toString()}`,
    { method: "GET" }
  );
}

// 导出 adminService 对象
export const adminService = {
  // 帖子管理
  getAllPosts,
  getReportedPosts,
  // 帖子审核
  getPendingPosts,
  approvePost,
  rejectPost,
  deletePost,
  // 帖子评级
  regradePost,
  batchRegradePosts,
  // 用户管理
  getAdminUsers,
  deleteUser,
  // 头衔管理
  getUserTitlesAdmin,
  addUserTitle,
  removeUserTitle,
  // 举报管理
  getAdminReports,
  updateReportStatus,
  adminDeleteChatMessage,
  // 屏蔽关系
  getAdminBlocks,
  // 评论管理
  getAllComments,
  getCommentsByPost,
  getCommentsByUser,
  deleteComment,
  // 社区管理
  getAllCommunities,
  getCommunityDetail,
  createCommunity,
  updateCommunity,
  deleteCommunity,
  // 社区帖子管理
  getCommunityPosts,
  deleteCommunityPost,
  batchDeleteCommunityPosts,
  // 品牌提交审核
  getPendingBrandSubmissions,
  approveBrandSubmission,
  rejectBrandSubmission,
  // 品牌管理
  getAdminBrands,
  updateAdminBrand,
  deleteAdminBrand,
  // 品牌图片审核
  getPendingBrandImages,
  approveBrandImage,
  rejectBrandImage,
  deleteBrandImage,
  adminUploadBrandImage,
  getBrandImagesAdmin,
  toggleBrandImageSelected,
  // 广播通知
  broadcastNotification,
  // 客服自动回复
  getAutoReplyConfig,
  updateAutoReplyConfig,
  // 推荐算法配置
  getRecommendConfig,
  updateRecommendConfig,
  // 维护模式
  getMaintenanceConfig,
  updateMaintenanceConfig,
  // 聊天审计
  getAdminChatConversations,
  getAdminChatConversationDetail,
  searchAdminChatMessages,
};

export default adminService;
