/**
 * Public (read-only) API types shared between web pages.
 * Kept intentionally narrow — only the fields the web surface consumes.
 * Mirrors shapes defined in frontend/src/services/postService.ts and
 * frontend/src/services/userInfoService.ts.
 */

export type PostType = "OUTFIT" | "DAILY_SHARE" | "ITEM_REVIEW" | "ARTICLES";
// 后端 backend/app/schemas/post.py PostStatus 枚举只有这三档。
// 历史: 早期 web 端的 ARCHIVED 是手误, 后端从未返回过该值; 与移动端
// frontend/src/services/userPostService.ts 的 PostStatus 也对不齐
// (移动端额外加了 PENDING, 但 PENDING 实际是 audit_status 概念)。
// 这里以后端为准，避免店铺帖子 Hidden 状态在 web 上识别不出来。
export type PostStatus = "DRAFT" | "PUBLISHED" | "HIDDEN";

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

  // 买手店帖子（migration 055）— storeId 非空 → 该帖是某买手店发布的
  // 「店铺帖子」, 在 PostCard 上显示「店铺」角标, 并可点击跳到 StoreDetail.
  storeId?: string;
  storeName?: string;

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
  preferredTheme?: "system" | "light" | "dark";
  postCount?: number;
  followerCount?: number;
  followingCount?: number;
}

export interface ApiEnvelope<T> {
  code: number;
  message?: string;
  data: T;
}
