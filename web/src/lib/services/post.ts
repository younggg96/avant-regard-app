/**
 * Post interaction endpoints (like / favorite / want / delete).
 * Client-side only (uses the authenticated api-client).
 *
 * Backend verbs & URLs mirror [frontend/src/services/postService.ts](../../../frontend/src/services/postService.ts).
 * All interaction endpoints take `userId` as a query param because the FastAPI
 * routers were designed that way — we still send the Bearer token for auth.
 */

import { apiClient } from "../api-client";
import type { FeedResponse, Post } from "../types";

export type { Post };

/**
 * Client-side wrapper around `GET /api/posts/feed` used by the Discover
 * infinite-scroll pagination. Mirrors `getFeed` in
 * `frontend/src/services/postService.ts`:
 *  - `skip` → number of post items already consumed (not total items).
 *  - `excludeIds` → sliding dedup window; negative IDs encode show cards.
 *
 * Distinct from the SSR `getFeed` in `web/src/lib/api.ts`, which uses
 * Next.js `fetch` caching for the first page; this variant uses the
 * authenticated `apiClient` so personalization applies and we bypass the
 * edge cache on subsequent pages.
 */
export interface GetFeedPageParams {
  limit?: number;
  skip?: number;
  excludeIds?: number[];
}

export async function getFeedPage(
  params: GetFeedPageParams = {},
): Promise<FeedResponse> {
  const { limit = 30, skip = 0, excludeIds } = params;
  const query: Record<string, unknown> = { limit, skip };
  if (excludeIds && excludeIds.length > 0) {
    query.exclude_ids = excludeIds.join(",");
  }
  return apiClient.get<FeedResponse>("/api/posts/feed", query);
}

export interface PostInteractionState {
  liked: boolean;
  favorited: boolean;
  wanted: boolean;
  likeCount: number;
  favoriteCount: number;
  wantCount: number;
  commentCount: number;
}

// 创建/更新店铺帖子的最小参数集合（migration 055）。
// Web 端商家后台目前只支持「文字 + 多张图片 URL」的简化版本, 不带评分 /
// 关联秀场 / 单品分类等复杂字段（这些在移动端 PublishLookbookScreen 完整
// 提供）. 后端会校验 user 必须是 storeId 对应的 APPROVED 商家。
export interface CreateStorePostParams {
  userId: number;
  postType: "OUTFIT" | "DAILY_SHARE" | "ITEM_REVIEW" | "ARTICLES";
  postStatus: "DRAFT" | "PUBLISHED";
  title: string;
  contentText?: string;
  imageUrls: string[];
  storeId: string;
}

export interface UpdateStorePostParams {
  userId: number;
  postType: "OUTFIT" | "DAILY_SHARE" | "ITEM_REVIEW" | "ARTICLES";
  status: "DRAFT" | "PUBLISHED" | "HIDDEN";
  title: string;
  contentText: string;
  imageUrls: string[];
  storeId?: string;
}

export const postService = {
  getPost: (postId: number | string) =>
    apiClient.get<Post>(`/api/posts/${postId}`),

  createStorePost: (params: CreateStorePostParams) =>
    apiClient.post<Post>(`/api/posts`, params),

  updateStorePost: (postId: number | string, params: UpdateStorePostParams) =>
    apiClient.put<Post>(`/api/posts/${postId}`, params),

  deletePost: (postId: number | string, userId: number) =>
    apiClient.delete<void>(`/api/posts/${postId}?userId=${userId}`),

  likePost: (postId: number | string, userId: number) =>
    apiClient.post<void>(`/api/posts/${postId}/like?userId=${userId}`),
  unlikePost: (postId: number | string, userId: number) =>
    apiClient.delete<void>(`/api/posts/${postId}/like?userId=${userId}`),

  favoritePost: (postId: number | string, userId: number) =>
    apiClient.post<void>(`/api/posts/${postId}/favorite?userId=${userId}`),
  unfavoritePost: (postId: number | string, userId: number) =>
    apiClient.delete<void>(`/api/posts/${postId}/favorite?userId=${userId}`),

  wantPost: (postId: number | string, userId: number) =>
    apiClient.post<void>(`/api/posts/${postId}/want?userId=${userId}`),
  unwantPost: (postId: number | string, userId: number) =>
    apiClient.delete<void>(`/api/posts/${postId}/want?userId=${userId}`),

  getUserPosts: (userId: number | string) =>
    apiClient.get<Post[]>(`/api/posts/user/${userId}?status=PUBLISHED`),

  getLikedPostsByUserId: (userId: number | string) =>
    apiClient.get<Post[]>(`/api/posts/user/${userId}/liked`),

  getFavoritePostsByUserId: (userId: number | string) =>
    apiClient.get<Post[]>(`/api/posts/user/${userId}/favorites`),

  getWantedPostsByUserId: (userId: number | string) =>
    apiClient.get<Post[]>(`/api/posts/user/${userId}/wanted`),

  getPostsByCommunityId: (communityId: number | string) =>
    apiClient.get<Post[]>(`/api/posts/community/${communityId}`),

  /**
   * 买手店店铺帖子（migration 055）。
   * - 公开调用: 默认 includeUnpublished=false, 只返回 PUBLISHED+APPROVED.
   * - 商家后台调用: 传 includeUnpublished=true, 后端会再校验当前 user 是否
   *   是该 store 的 APPROVED 商家, 校验失败时静默降级回 public 列表。
   */
  getPostsByStoreId: (
    storeId: string,
    options: { limit?: number; includeUnpublished?: boolean } = {},
  ) => {
    const query: Record<string, unknown> = {
      limit: options.limit ?? 50,
    };
    if (options.includeUnpublished) {
      query.includeUnpublished = true;
    }
    return apiClient.get<Post[]>(
      `/api/posts/store/${encodeURIComponent(storeId)}`,
      query,
    );
  },

  getForumPosts: (limit = 50) =>
    apiClient.get<Post[]>(`/api/posts/forum/all?limit=${limit}`),

  getRecommendPosts: (limit = 50) =>
    apiClient.get<Post[]>(`/api/posts/recommend?limit=${limit}`),

  /**
   * Feed of posts authored by users the current viewer follows.
   * Mirrors `getFollowingPosts` in `frontend/src/services/postService.ts` —
   * requires authentication (apiClient attaches the Bearer token).
   */
  getFollowingPosts: (limit = 50) =>
    apiClient.get<Post[]>(`/api/posts/following?limit=${limit}`),

  getPostsByBrandId: (brandId: number, limit = 50) =>
    apiClient.get<Post[]>(`/api/posts/brand/id/${brandId}?limit=${limit}`),

  getPostsByShowId: (showId: number | string) =>
    apiClient.get<Post[]>(
      `/api/posts/show/${encodeURIComponent(String(showId))}`,
    ),

  getFeedPage,
};
