/**
 * Post comment service (web).
 *
 * Mirror of [frontend/src/services/commentService.ts](../../../frontend/src/services/commentService.ts).
 * Get endpoints accept an optional userId query so the backend can annotate
 * `isLiked` per current user.
 */

import { apiClient } from "../api-client";

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
  isLiked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PostComment {
  id: number;
  postId: number;
  userId: number;
  username: string;
  userAvatar?: string;
  content: string;
  likeCount: number;
  isLiked: boolean;
  replyCount: number;
  replies: CommentReply[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentParams {
  userId: number;
  content: string;
  parentId?: number;
  replyToUserId?: number;
}

export const commentService = {
  getPostComments: (postId: number | string, userId?: number) =>
    apiClient.get<PostComment[]>(
      `/api/posts/${postId}/comments${userId ? `?userId=${userId}` : ""}`,
    ),

  createComment: (postId: number | string, params: CreateCommentParams) =>
    apiClient.post<PostComment>(`/api/posts/${postId}/comments`, params),

  likeComment: (commentId: number, userId: number) =>
    apiClient.post<void>(
      `/api/posts/comments/${commentId}/like?userId=${userId}`,
    ),

  unlikeComment: (commentId: number, userId: number) =>
    apiClient.delete<void>(
      `/api/posts/comments/${commentId}/like?userId=${userId}`,
    ),

  deleteComment: (commentId: number, userId: number) =>
    apiClient.delete<void>(`/api/posts/comments/${commentId}?userId=${userId}`),

  getCommentReplies: (commentId: number) =>
    apiClient.get<CommentReply[]>(`/api/posts/comments/${commentId}/replies`),
};
