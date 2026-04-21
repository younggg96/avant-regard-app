/**
 * Follow service (web).
 *
 * Mirror of [frontend/src/services/followService.ts](../../../frontend/src/services/followService.ts)
 * for the endpoints the web currently needs. Brand + mutual follow endpoints
 * are included up-front so /archive/brands and /me/follows can use them later
 * without another service file.
 */

import { apiClient } from "../api-client";

export interface FollowingUser {
  userId: number;
  username: string;
  avatar: string;
  bio: string;
  location: string;
}

export interface FollowingBrand {
  brandId: number;
  name: string;
  category: string;
  coverImage: string;
  country: string;
  followersCount: number;
}

export const followService = {
  // --- user follow ---
  followUser: (followerId: number, targetUserId: number) =>
    apiClient.post<void>("/api/follow/user", { followerId, targetUserId }),
  unfollowUser: (followerId: number, targetUserId: number) =>
    apiClient.delete<void>("/api/follow/user", {
      body: { followerId, targetUserId },
    }),
  isFollowingUser: (followerId: number, targetUserId: number) =>
    apiClient.get<boolean>(
      `/api/follow/user/${followerId}/is-following/${targetUserId}`,
    ),
  getFollowersCount: (userId: number | string) =>
    apiClient.get<number>(`/api/follow/user/${userId}/followers/count`),
  getFollowingCount: (userId: number | string) =>
    apiClient.get<number>(`/api/follow/user/${userId}/following/count`),
  getFollowingUsers: (userId: number | string) =>
    apiClient.get<FollowingUser[]>(
      `/api/follow/users/${userId}/following-users`,
    ),
  getFollowers: (userId: number | string) =>
    apiClient.get<FollowingUser[]>(`/api/follow/users/${userId}/followers`),

  // --- brand follow ---
  followBrand: (userId: number, brandId: number) =>
    apiClient.post<void>("/api/follow/brand", { userId, brandId }),
  unfollowBrand: (userId: number, brandId: number) =>
    apiClient.delete<void>("/api/follow/brand", {
      body: { userId, brandId },
    }),
  isFollowingBrand: (userId: number, brandId: number) =>
    apiClient.get<boolean>(
      `/api/follow/user/${userId}/is-following-brand/${brandId}`,
    ),
  getFollowingBrands: (userId: number | string) =>
    apiClient.get<FollowingBrand[]>(
      `/api/follow/users/${userId}/following-brands`,
    ),
  getBrandFollowersCount: (brandId: number | string) =>
    apiClient.get<number>(`/api/follow/brand/${brandId}/followers/count`),
};
