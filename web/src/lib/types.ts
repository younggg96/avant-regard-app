/**
 * Public (read-only) API types shared between web pages.
 * Kept intentionally narrow — only the fields the web surface consumes.
 * Mirrors shapes defined in frontend/src/services/postService.ts and
 * frontend/src/services/userInfoService.ts.
 */

export type PostType = "OUTFIT" | "DAILY_SHARE" | "ITEM_REVIEW" | "ARTICLES";
export type PostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface Post {
  id: number;
  userId: number;
  username: string;
  avatarUrl?: string;
  postType: PostType;
  status?: PostStatus;
  title: string;
  contentText: string;
  imageUrls: string[];
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;

  productName?: string;
  brandName?: string;
  rating?: number;

  showIds?: (number | string)[];
  brandIds?: number[];

  itemBrand?: string;
  itemBrandId?: number;
  itemCategory?: string;
  itemSizes?: string[];
  itemColors?: string[];

  communityId?: number;
  communityName?: string;
  communitySlug?: string;

  // Current-user interaction state (present when caller is authenticated).
  likedByMe?: boolean;
  favoritedByMe?: boolean;
  wantedByMe?: boolean;
  wantCount?: number;
}

export interface FeedShowCard {
  id: string | number;
  brandName: string;
  season: string;
  year?: number;
  coverImage?: string;
  category?: string;
  title?: string;
}

export interface FeedItem {
  type: "post" | "show";
  data: Post | FeedShowCard;
}

export interface FeedResponse {
  items: FeedItem[];
}

/**
 * Mirrors the backend `UserInfoVO` shape (see `frontend/src/services/userInfoService.ts`).
 * The backend returns `userId` as the primary key — NOT `id` — so any web code
 * reading this type must use `user.userId`.
 */
export interface UserInfo {
  userId: number;
  infoId?: number;
  username: string;
  avatarUrl?: string;
  coverUrl?: string;
  bio?: string;
  gender?: string;
  location?: string;
  primaryTitle?: string;
  preferredLanguage?: string;
  postCount?: number;
  followerCount?: number;
  followingCount?: number;
}

export interface ApiEnvelope<T> {
  code: number;
  message?: string;
  data: T;
}
