/**
 * User info service (web). Mirrors the subset of
 * `frontend/src/services/userInfoService.ts` that web needs for /me and
 * /settings pages.
 *
 * Upload endpoints (avatar / cover) are NOT included here — per the project
 * write-scope decision, web is read + interact-only; image upload goes through
 * a future dedicated endpoint if/when we open profile editing with avatars.
 */

import { apiClient } from "../api-client";
import type { UserInfo } from "../types";

export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface UserProfileInfo extends UserInfo {
  gender?: Gender;
  age?: number;
  preference?: string;
  followedBrandIds?: number[];
  profileCompleted?: boolean;
  userType?: string;
}

export interface UpdateUserInfoParams {
  username?: string;
  bio?: string;
  location?: string;
  avatarUrl?: string;
  coverUrl?: string;
}

export interface UpdateUserProfileParams extends UpdateUserInfoParams {
  gender?: Gender;
  age?: number;
  preference?: string;
  followedBrandIds?: number[];
  profileCompleted?: boolean;
}

export interface UserPrivacySettings {
  userId: number;
  hideFollowing: boolean;
  hideFollowers: boolean;
  hideLikes: boolean;
  hideWishlist: boolean;
}

export const userInfoService = {
  get: (userId: number | string) =>
    apiClient.get<UserInfo>(`/api/user-info/${userId}`),

  update: (userId: number, params: UpdateUserInfoParams) =>
    apiClient.put<UserInfo>(`/api/user-info/${userId}`, params),

  getProfile: (userId: number | string) =>
    apiClient.get<UserProfileInfo>(`/api/user-info/${userId}/profile`),

  updateProfile: (userId: number, params: UpdateUserProfileParams) =>
    apiClient.put<UserProfileInfo>(
      `/api/user-info/${userId}/profile`,
      params,
    ),

  getPrivacy: (userId: number | string) =>
    apiClient.get<UserPrivacySettings>(`/api/user-info/${userId}/privacy`),

  updatePrivacy: (
    userId: number,
    params: Partial<Omit<UserPrivacySettings, "userId">>,
  ) =>
    apiClient.put<UserPrivacySettings>(
      `/api/user-info/${userId}/privacy`,
      params,
    ),
};
