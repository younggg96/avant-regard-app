/**
 * 帖子服务 - 处理所有帖子相关的 API 调用
 */

import { useAuthStore } from "../store/authStore";
import { config } from "../config/env";
import { PostStatus } from "./userPostService";

const EXPO_PUBLIC_API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

// API 响应包装类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 帖子类型
// 注意：论坛帖子使用 ARTICLES 类型，通过 community_id 来区分
export type PostType = "OUTFIT" | "DAILY_SHARE" | "ITEM_REVIEW" | "ARTICLES";

// 审核状态
export type AuditStatus = "PENDING" | "APPROVED" | "REJECTED";

// 帖子响应类型
export interface Post {
  id: number;
  userId: number;
  username: string;
  avatarUrl?: string;  // 作者头像 URL
  postType: PostType;
  status: PostStatus;
  auditStatus?: AuditStatus;
  title: string;
  contentText: string;
  imageUrls: string[];
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  // 单品评价专用字段
  productName?: string;
  brandName?: string;
  rating?: number;
  // 关联秀场 ID 列表（支持关联多个秀场，ID 可能是整数或字符串）
  showIds?: (number | string)[];
  // 关联品牌 ID 列表（支持关联多个品牌）
  brandIds?: number[];
  // 论坛帖子专用字段
  communityId?: number;
  communityName?: string;
  communitySlug?: string;
  // 当前用户交互状态
  likedByMe?: boolean;
  favoritedByMe?: boolean;
}

// 创建帖子请求参数
export interface CreatePostParams {
  userId: number;
  postType: PostType;
  postStatus: PostStatus;
  title: string;
  contentText?: string;
  imageUrls: string[];
  // 单品评价专用字段
  productName?: string;
  brandName?: string;
  rating?: number;
  // 关联秀场 ID 列表（支持关联多个秀场，ID 可能是整数或字符串）
  showIds?: (number | string)[];
  // 关联品牌 ID 列表（支持关联多个品牌）
  brandIds?: number[];
  // 论坛帖子专用字段
  communityId?: number;
}

// 更新帖子请求参数
export interface UpdatePostParams {
  userId: number;
  postType: PostType;
  status: PostStatus;
  title: string;
  contentText: string;
  imageUrls: string[];
  // 单品评价专用字段
  productName?: string;
  brandName?: string;
  rating?: number;
  // 关联秀场 ID 列表（支持关联多个秀场，ID 可能是整数或字符串）
  showIds?: (number | string)[];
  // 关联品牌 ID 列表（支持关联多个品牌）
  brandIds?: number[];
  // 论坛帖子专用字段
  communityId?: number;
}

// 通用请求方法 - 默认携带 token，支持自动刷新
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry: boolean = false
): Promise<T> {
  const url = `${EXPO_PUBLIC_API_BASE_URL}${endpoint}`;
  console.log("request", url, options);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "*/*",
    ...((options.headers as Record<string, string>) || {}),
  };

  // 自动添加 Authorization header（如果已登录）
  // 优先检查并刷新即将过期的 token
  const authStore = useAuthStore.getState();
  let token = authStore.getAccessToken();

  // 如果 token 即将过期，先刷新
  if (
    token &&
    authStore.isTokenExpiringSoon &&
    authStore.isTokenExpiringSoon()
  ) {
    console.log("Token expiring soon, refreshing before request...");
    await authStore.refreshTokens();
    token = authStore.getAccessToken();
  }

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
      // 如果是 401 错误且不是重试请求，尝试刷新 token 后重试
      if (
        response.status === 401 &&
        !isRetry &&
        authStore.tokens?.refreshToken
      ) {
        console.log("Got 401, attempting token refresh...");
        const refreshSuccess = await authStore.refreshTokens();
        if (refreshSuccess) {
          // 刷新成功，重试请求
          return request<T>(endpoint, options, true);
        }
      }

      let errorMessage = "请求失败";

      if (contentType?.includes("application/json")) {
        const errorData = await response.json();
        errorMessage =
          errorData.detail ||
          errorData.message ||
          errorData.error ||
          errorMessage;
      } else {
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}`;
      }

      throw new Error(errorMessage);
    }

    if (contentType?.includes("application/json")) {
      const jsonResponse = await response.json();
      console.log("response: JSON", jsonResponse);

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

// 文件上传请求方法 - 支持自动刷新 token
async function uploadRequest<T>(
  endpoint: string,
  formData: FormData,
  isRetry: boolean = false
): Promise<T> {
  const url = `${EXPO_PUBLIC_API_BASE_URL}${endpoint}`;
  console.log("Upload request URL:", url);

  const headers: Record<string, string> = {
    Accept: "*/*",
  };

  // 自动刷新即将过期的 token
  const authStore = useAuthStore.getState();
  let token = authStore.getAccessToken();

  if (
    token &&
    authStore.isTokenExpiringSoon &&
    authStore.isTokenExpiringSoon()
  ) {
    console.log("Token expiring soon, refreshing before upload...");
    await authStore.refreshTokens();
    token = authStore.getAccessToken();
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    console.log("Upload request has auth token");
  } else {
    console.warn("Upload request missing auth token!");
  }

  const config: RequestInit = {
    method: "POST",
    headers,
    body: formData,
  };

  try {
    console.log("Starting upload...");
    const response = await fetch(url, config);
    console.log("Upload response status:", response.status);
    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      // 如果是 401 错误且不是重试请求，尝试刷新 token 后重试
      if (
        response.status === 401 &&
        !isRetry &&
        authStore.tokens?.refreshToken
      ) {
        console.log("Upload got 401, attempting token refresh...");
        const refreshSuccess = await authStore.refreshTokens();
        if (refreshSuccess) {
          return uploadRequest<T>(endpoint, formData, true);
        }
      }

      let errorMessage = `上传失败 (${response.status})`;
      if (contentType?.includes("application/json")) {
        const errorData = await response.json();
        console.error(
          "Upload error (JSON):",
          JSON.stringify(errorData, null, 2)
        );
        errorMessage =
          errorData.detail ||
          errorData.message ||
          errorData.error ||
          errorMessage;
      } else {
        const text = await response.text();
        console.error("Upload error (text):", text);
        errorMessage = text || errorMessage;
      }
      throw new Error(errorMessage);
    }

    if (contentType?.includes("application/json")) {
      const jsonResponse = await response.json();
      console.log("upload response:", jsonResponse);

      if (
        jsonResponse &&
        typeof jsonResponse === "object" &&
        "code" in jsonResponse
      ) {
        const apiResponse = jsonResponse as ApiResponse<T>;
        if (apiResponse.code !== 0) {
          throw new Error(apiResponse.message || "上传失败");
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
    console.error("Upload catch error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("上传失败，请检查网络连接");
  }
}

// ==================== 图片上传 ====================

/**
 * 上传单张图片
 * POST /api/files/upload-image
 * @param imageUri 本地图片 URI
 * @returns 上传后的图片 URL
 */
export async function uploadImage(imageUri: string): Promise<string> {
  console.log("uploadImage called with URI:", imageUri);
  const formData = new FormData();

  // Extract filename from URI
  let filename = imageUri.split("/").pop() || "image.jpg";

  // Check for file extension
  const match = /\.(\w+)$/.exec(filename);
  let type: string;

  if (match) {
    const ext = match[1].toLowerCase();
    // Map common extensions to MIME types
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      heic: "image/heic",
    };
    type = mimeTypes[ext] || "image/jpeg";
  } else {
    // No extension found - assume JPEG (ImageManipulator default)
    type = "image/jpeg";
    filename = `${filename}.jpg`;
  }

  console.log("Upload file info:", {
    filename,
    type,
    uri: imageUri.substring(0, 100),
  });

  formData.append("file", {
    uri: imageUri,
    name: filename,
    type,
  } as any);

  // 返回上传后的图片 URL
  // API 响应格式: { code: 0, message: "string", data: { url: "string" } }
  const result = await uploadRequest<{ url: string }>(
    "/api/files/upload-image",
    formData
  );

  if (result && typeof result === "object" && "url" in result) {
    return result.url;
  }
  throw new Error("图片上传返回格式错误");
}

/**
 * 批量上传图片
 * @param imageUris 本地图片 URI 数组
 * @param onProgress 进度回调 (已完成数量, 总数)
 * @returns 上传后的图片 URL 数组
 */
export async function uploadImages(
  imageUris: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> {
  const urls: string[] = [];
  const total = imageUris.length;

  for (let i = 0; i < total; i++) {
    const url = await uploadImage(imageUris[i]);
    urls.push(url);
    onProgress?.(i + 1, total);
  }

  return urls;
}

// ==================== 帖子 CRUD ====================

/**
 * 获取帖子列表
 * GET /api/posts
 * @param limit 返回数量限制，默认 50
 */
export async function getPosts(limit: number = 50): Promise<Post[]> {
  return request<Post[]>(`/api/posts?limit=${limit}`, {
    method: "GET",
  });
}

/**
 * 获取单个帖子详情
 * GET /api/posts/{postId}
 */
export async function getPostById(postId: number): Promise<Post> {
  return request<Post>(`/api/posts/${postId}`, {
    method: "GET",
  });
}

/**
 * 创建帖子
 * POST /api/posts
 */
export async function createPost(params: CreatePostParams): Promise<Post> {
  return request<Post>("/api/posts", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 更新帖子
 * PUT /api/posts/{postId}
 */
export async function updatePost(
  postId: number,
  params: UpdatePostParams
): Promise<Post> {
  return request<Post>(`/api/posts/${postId}`, {
    method: "PUT",
    body: JSON.stringify(params),
  });
}

/**
 * 删除帖子
 * DELETE /api/posts/{postId}?userId={userId}
 */
export async function deletePost(
  postId: number,
  userId: number
): Promise<void> {
  return request<void>(`/api/posts/${postId}?userId=${userId}`, {
    method: "DELETE",
  });
}

// ==================== 点赞功能 ====================

/**
 * 点赞帖子
 * POST /api/posts/{postId}/like?userId={userId}
 */
export async function likePost(postId: number, userId: number): Promise<void> {
  return request<void>(`/api/posts/${postId}/like?userId=${userId}`, {
    method: "POST",
  });
}

/**
 * 取消点赞
 * DELETE /api/posts/{postId}/like?userId={userId}
 */
export async function unlikePost(
  postId: number,
  userId: number
): Promise<void> {
  return request<void>(`/api/posts/${postId}/like?userId=${userId}`, {
    method: "DELETE",
  });
}

// ==================== 收藏功能 ====================

/**
 * 收藏帖子
 * POST /api/posts/{postId}/favorite?userId={userId}
 */
export async function favoritePost(
  postId: number,
  userId: number
): Promise<void> {
  return request<void>(`/api/posts/${postId}/favorite?userId=${userId}`, {
    method: "POST",
  });
}

/**
 * 取消收藏
 * DELETE /api/posts/{postId}/favorite?userId={userId}
 */
export async function unfavoritePost(
  postId: number,
  userId: number
): Promise<void> {
  return request<void>(`/api/posts/${postId}/favorite?userId=${userId}`, {
    method: "DELETE",
  });
}

// ==================== 用户帖子 ====================

/**
 * 获取用户的帖子列表
 * GET /api/posts/user/{userId}?status={status}
 * @param userId 用户ID
 * @param status 可选，帖子状态筛选：DRAFT | PUBLISHED | HIDDEN
 */
export async function getPostsByUserId(
  userId: number,
  status?: PostStatus
): Promise<Post[]> {
  const query = status ? `?status=${status}` : "";
  return request<Post[]>(`/api/posts/user/${userId}${query}`, {
    method: "GET",
  });
}

/**
 * 获取用户点赞的帖子列表
 * GET /api/posts/user/{userId}/liked
 * @param userId 用户ID
 */
export async function getLikedPostsByUserId(userId: number): Promise<Post[]> {
  return request<Post[]>(`/api/posts/user/${userId}/liked`, {
    method: "GET",
  });
}

/**
 * 获取用户收藏的帖子列表
 * GET /api/posts/user/{userId}/favorites
 * @param userId 用户ID
 */
export async function getFavoritePostsByUserId(
  userId: number
): Promise<Post[]> {
  return request<Post[]>(`/api/posts/user/${userId}/favorites`, {
    method: "GET",
  });
}

// ==================== 秀场关联帖子 ====================

/**
 * 获取某个秀场关联的帖子
 * GET /api/posts/show/{showId}
 * 只返回 PUBLISHED 且审核通过(APPROVED) 的帖子
 * @param showId 秀场ID（支持整数或字符串类型）
 */
export async function getPostsByShowId(showId: number | string): Promise<Post[]> {
  // 直接使用传入的ID，不进行类型转换
  return request<Post[]>(`/api/posts/show/${encodeURIComponent(showId)}`, {
    method: "GET",
  });
}

/**
 * 获取某个品牌关联的所有帖子（通过 brand_ids 数组查询）
 * GET /api/posts/brand/id/{brandId}
 * 只返回 PUBLISHED 且审核通过(APPROVED) 的帖子
 * @param brandId 品牌 ID
 * @param limit 返回数量限制
 */
export async function getPostsByBrandId(
  brandId: number,
  limit: number = 50
): Promise<Post[]> {
  return request<Post[]>(
    `/api/posts/brand/id/${brandId}?limit=${limit}`,
    {
      method: "GET",
    }
  );
}

/**
 * 获取某个品牌相关的所有帖子（通过该品牌的所有秀场，兼容旧数据）
 * GET /api/posts/brand/{brandName}
 * 只返回 PUBLISHED 且审核通过(APPROVED) 的帖子
 * @param brandName 品牌名称
 * @param limit 返回数量限制
 */
export async function getPostsByBrandName(
  brandName: string,
  limit: number = 50
): Promise<Post[]> {
  return request<Post[]>(
    `/api/posts/brand/${encodeURIComponent(brandName)}?limit=${limit}`,
    {
      method: "GET",
    }
  );
}

/**
 * 搜索帖子（支持标题、内容、作者名搜索）
 * GET /api/posts/search
 * @param keyword 搜索关键词
 * @param limit 返回数量限制
 */
export async function searchPosts(
  keyword: string,
  limit: number = 50
): Promise<Post[]> {
  return request<Post[]>(
    `/api/posts/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`,
    {
      method: "GET",
    }
  );
}

// ==================== 社区帖子 ====================

/**
 * 获取某个社区的帖子
 * GET /api/posts/community/{communityId}
 * 只返回 PUBLISHED 且审核通过(APPROVED) 的帖子
 * @param communityId 社区ID
 */
export async function getPostsByCommunityId(communityId: number): Promise<Post[]> {
  return request<Post[]>(`/api/posts/community/${communityId}`, {
    method: "GET",
  });
}

/**
 * 获取所有论坛帖子
 * GET /api/posts/forum/all
 * 只返回 PUBLISHED 且审核通过(APPROVED) 的论坛帖子
 * @param limit 返回数量限制，默认 50
 */
export async function getForumPosts(limit: number = 50): Promise<Post[]> {
  return request<Post[]>(`/api/posts/forum/all?limit=${limit}`, {
    method: "GET",
  });
}

/**
 * 获取推荐帖子（非论坛帖子）
 * GET /api/posts/recommend
 * 只返回无 communityId 的 PUBLISHED 且审核通过(APPROVED) 的帖子
 * @param limit 返回数量限制，默认 50
 */
export async function getRecommendPosts(limit: number = 50): Promise<Post[]> {
  return request<Post[]>(`/api/posts/recommend?limit=${limit}`, {
    method: "GET",
  });
}

/**
 * 获取关注用户的帖子
 * GET /api/posts/following
 * 返回当前用户关注的人发布的非论坛帖子
 * @param limit 返回数量限制，默认 50
 */
export async function getFollowingPosts(limit: number = 50): Promise<Post[]> {
  return request<Post[]>(`/api/posts/following?limit=${limit}`, {
    method: "GET",
  });
}

// 导出 postService 对象
export const postService = {
  // 图片上传
  uploadImage,
  uploadImages,
  // CRUD
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  // 点赞
  likePost,
  unlikePost,
  // 收藏
  favoritePost,
  unfavoritePost,
  // 用户帖子
  getPostsByUserId,
  getLikedPostsByUserId,
  getFavoritePostsByUserId,
  // 秀场关联帖子
  getPostsByShowId,
  // 品牌关联帖子
  getPostsByBrandId,
  getPostsByBrandName,
  // 搜索
  searchPosts,
  // 社区帖子
  getPostsByCommunityId,
  getForumPosts,
  // 推荐与关注
  getRecommendPosts,
  getFollowingPosts,
};

export default postService;
