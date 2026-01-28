/**
 * 帖子评论服务 - 处理 post-comment-controller 相关的 API 调用
 */

import { useAuthStore } from "../store/authStore";
import { config } from "../config/env";

const EXPO_PUBLIC_API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

// API 响应包装类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 评论回复类型
export interface CommentReply {
  id: number;
  postId: number;
  parentId: number;
  userId: number;
  username: string;
  userAvatar?: string;
  replyToUserId?: number;
  replyToUsername?: string;
  content: string;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

// 评论类型
export interface PostComment {
  id: number;
  postId: number;
  userId: number;
  username: string;
  userAvatar?: string;
  content: string;
  likeCount: number;
  replyCount: number;
  replies: CommentReply[];
  createdAt: string;
  updatedAt: string;
}

// 创建评论请求参数
export interface CreateCommentParams {
  userId: number;
  content: string;
  parentId?: number; // 父评论ID，为空表示顶级评论
  replyToUserId?: number; // 回复的用户ID
}

// 通用请求方法
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

        if (apiResponse.code !== 0) {
          throw new Error(apiResponse.message || "请求失败");
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
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("网络请求失败，请检查网络连接");
  }
}

/**
 * 获取帖子评论
 * GET /api/posts/{postId}/comments
 */
export async function getPostComments(postId: number): Promise<PostComment[]> {
  return request<PostComment[]>(`/api/posts/${postId}/comments`, {
    method: "GET",
  });
}

/**
 * 发布评论
 * POST /api/posts/{postId}/comments
 */
export async function createComment(
  postId: number,
  params: CreateCommentParams
): Promise<PostComment> {
  return request<PostComment>(`/api/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 点赞评论
 * POST /api/posts/comments/{commentId}/like?userId={userId}
 */
export async function likeComment(
  commentId: number,
  userId: number
): Promise<void> {
  return request<void>(
    `/api/posts/comments/${commentId}/like?userId=${userId}`,
    {
      method: "POST",
    }
  );
}

/**
 * 取消点赞评论
 * DELETE /api/posts/comments/{commentId}/like?userId={userId}
 */
export async function unlikeComment(
  commentId: number,
  userId: number
): Promise<void> {
  return request<void>(
    `/api/posts/comments/${commentId}/like?userId=${userId}`,
    {
      method: "DELETE",
    }
  );
}

/**
 * 删除评论
 * DELETE /api/posts/comments/{commentId}?userId={userId}
 */
export async function deleteComment(
  commentId: number,
  userId: number
): Promise<void> {
  return request<void>(`/api/posts/comments/${commentId}?userId=${userId}`, {
    method: "DELETE",
  });
}

/**
 * 获取评论的所有回复
 * GET /api/posts/comments/{commentId}/replies
 */
export async function getCommentReplies(
  commentId: number
): Promise<CommentReply[]> {
  return request<CommentReply[]>(
    `/api/posts/comments/${commentId}/replies`,
    {
      method: "GET",
    }
  );
}

/**
 * 回复评论
 * POST /api/posts/{postId}/comments
 */
export async function replyToComment(
  postId: number,
  params: CreateCommentParams
): Promise<PostComment> {
  return request<PostComment>(`/api/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ==================== 用户评论管理 ====================

/**
 * 用户评论（带帖子信息）
 */
export interface UserComment extends PostComment {
  // 评论所属帖子的基本信息可以通过 postId 获取
}

/**
 * 用户点赞的评论
 */
export interface LikedComment {
  comment: PostComment;
  likedAt: string;
}

/**
 * 获取用户的所有帖子评论
 * GET /api/users/{userId}/comments
 */
export async function getUserComments(userId: number): Promise<PostComment[]> {
  return request<PostComment[]>(`/api/users/${userId}/comments`, {
    method: "GET",
  });
}

/**
 * 获取用户点赞的所有评论
 * GET /api/users/{userId}/comment-likes
 */
export async function getUserCommentLikes(
  userId: number
): Promise<LikedComment[]> {
  return request<LikedComment[]>(`/api/users/${userId}/comment-likes`, {
    method: "GET",
  });
}

// 导出 commentService 对象
export const commentService = {
  getPostComments,
  createComment,
  likeComment,
  unlikeComment,
  deleteComment,
  getCommentReplies,
  replyToComment,
  getUserComments,
  getUserCommentLikes,
};

export default commentService;
