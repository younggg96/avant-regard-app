/**
 * Thin read-only API client for the Avant Regard backend.
 *
 * Design notes:
 *  - Unwraps the `{ code, message, data }` envelope used by the FastAPI backend
 *    (see frontend/src/services/postService.ts for the mobile-side mirror).
 *  - No auth tokens: the web surface is anonymous / read-only for v1.
 *  - Uses Next.js fetch caching with a short revalidate window so server
 *    components stay fresh without hammering the backend.
 */

import { config } from "./config";
import type {
  ApiEnvelope,
  FeedResponse,
  Post,
  UserInfo,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  revalidate?: number | false;
  tags?: string[];
  signal?: AbortSignal;
}

async function request<T>(
  endpoint: string,
  { revalidate = 60, tags, signal }: RequestOptions = {},
): Promise<T> {
  const url = `${config.apiBaseUrl}${endpoint}`;
  const init: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
    },
    signal,
    next: revalidate === false ? { tags } : { revalidate, tags },
  };

  const response = await fetch(url, init);
  if (!response.ok) {
    throw new ApiError(response.status, `GET ${endpoint} → HTTP ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  if (
    json &&
    typeof json === "object" &&
    "code" in (json as Record<string, unknown>)
  ) {
    const envelope = json as ApiEnvelope<T>;
    if (envelope.code !== 0) {
      throw new ApiError(200, envelope.message || "API error");
    }
    return envelope.data;
  }
  return json as T;
}

// ---------- Feed / Discover ----------

export interface GetFeedParams {
  limit?: number;
  skip?: number;
  excludeIds?: number[];
}

export async function getFeed(params: GetFeedParams = {}): Promise<FeedResponse> {
  const { limit = 30, skip = 0, excludeIds } = params;
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  query.set("skip", String(skip));
  if (excludeIds?.length) query.set("exclude_ids", excludeIds.join(","));
  return request<FeedResponse>(`/api/posts/feed?${query.toString()}`, {
    revalidate: 30,
    tags: ["discover-feed"],
  });
}

// ---------- Posts ----------

export async function getPost(postId: number | string): Promise<Post> {
  return request<Post>(`/api/posts/${postId}`, {
    revalidate: 60,
    tags: [`post-${postId}`],
  });
}

export async function getUserPosts(
  userId: number | string,
  status: "PUBLISHED" | "DRAFT" = "PUBLISHED",
): Promise<Post[]> {
  return request<Post[]>(
    `/api/posts/user/${userId}?status=${status}`,
    { revalidate: 60, tags: [`user-posts-${userId}`] },
  );
}

// ---------- Users ----------

export async function getUserInfo(userId: number | string): Promise<UserInfo> {
  return request<UserInfo>(`/api/user-info/${userId}`, {
    revalidate: 120,
    tags: [`user-info-${userId}`],
  });
}

export async function getUserFollowerCount(
  userId: number | string,
): Promise<number> {
  const data = await request<{ count: number } | number>(
    `/api/follow/user/${userId}/followers/count`,
    { revalidate: 120 },
  );
  return typeof data === "number" ? data : data.count ?? 0;
}

export async function getUserFollowingCount(
  userId: number | string,
): Promise<number> {
  const data = await request<{ count: number } | number>(
    `/api/follow/user/${userId}/following/count`,
    { revalidate: 120 },
  );
  return typeof data === "number" ? data : data.count ?? 0;
}
