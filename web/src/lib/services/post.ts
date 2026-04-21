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

export const postService = {
  getPost: (postId: number | string) =>
    apiClient.get<Post>(`/api/posts/${postId}`),

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
