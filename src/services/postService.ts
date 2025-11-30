/**
 * 帖子服务 - 处理所有帖子相关的 API 调用
 */

import { useAuthStore } from "../store/authStore";

const API_BASE_URL = "http://42.193.122.67:8080";

// API 响应包装类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 帖子类型
export type PostType = "OUTFIT" | "LOOKBOOK" | "REVIEW" | "ARTICLE";

// 帖子状态
export type PostStatus = "DRAFT" | "PUBLISHED" | "HIDDEN";

// 帖子响应类型
export interface Post {
  id: number;
  userId: number;
  username: string;
  postType: PostType;
  status: PostStatus;
  title: string;
  contentText: string;
  imageUrls: string[];
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

// 创建帖子请求参数
export interface CreatePostParams {
  userId: number;
  postType: PostType;
  postStatus: PostStatus;
  title: string;
  contentText: string;
  imageUrls: string[];
}

// 更新帖子请求参数
export interface UpdatePostParams {
  userId: number;
  postType: PostType;
  status: PostStatus;
  title: string;
  contentText: string;
  imageUrls: string[];
}

// 通用请求方法 - 默认携带 token
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

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

// ==================== 帖子 CRUD ====================

/**
 * 获取帖子列表
 * GET /api/posts
 */
export async function getPosts(): Promise<Post[]> {
  return request<Post[]>("/api/posts", {
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

// 导出 postService 对象
export const postService = {
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
};

export default postService;
