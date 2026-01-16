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

// 导出 adminService 对象
export const adminService = {
  // 帖子审核
  getPendingPosts,
  approvePost,
  rejectPost,
  // 用户管理
  deleteUser,
  // 评论管理
  getAllComments,
  getCommentsByPost,
  getCommentsByUser,
  deleteComment,
};

export default adminService;
