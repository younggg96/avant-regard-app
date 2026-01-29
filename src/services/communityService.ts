/**
 * 社区服务
 */
import { API_BASE_URL } from "../config/env";
import { getAuthHeaders } from "./authService";

// 社区分类
export type CommunityCategory = "GENERAL" | "FASHION" | "LIFESTYLE" | "BEAUTY" | "CULTURE";

// 社区类型
export interface Community {
  id: number;
  name: string;
  slug: string;
  description: string;
  iconUrl: string;
  coverUrl: string;
  category: CommunityCategory;
  isOfficial: boolean;
  isActive: boolean;
  memberCount: number;
  postCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  isFollowing?: boolean;
}

// 社区列表响应
export interface CommunityListResponse {
  popular: Community[];
  following: Community[];
  all: Community[];
}

// 社区统计
export interface CommunityStats {
  memberCount: number;
  postCount: number;
  todayPostCount: number;
  weekPostCount: number;
}

/**
 * 获取社区列表（热门、关注、全部）
 */
export async function getCommunities(): Promise<CommunityListResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/communities`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("获取社区列表失败");
  }

  const data = await response.json();
  return data.data as CommunityListResponse;
}

/**
 * 获取热门社区
 */
export async function getPopularCommunities(limit: number = 5): Promise<Community[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/communities/popular?limit=${limit}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("获取热门社区失败");
  }

  const data = await response.json();
  return data.data as Community[];
}

/**
 * 获取我关注的社区
 */
export async function getFollowingCommunities(): Promise<Community[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/communities/following`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("获取关注的社区失败");
  }

  const data = await response.json();
  return data.data as Community[];
}

/**
 * 获取社区详情
 */
export async function getCommunityById(communityId: number): Promise<Community> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/communities/${communityId}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("获取社区详情失败");
  }

  const data = await response.json();
  return data.data as Community;
}

/**
 * 通过 slug 获取社区详情
 */
export async function getCommunityBySlug(slug: string): Promise<Community> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/communities/slug/${slug}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("获取社区详情失败");
  }

  const data = await response.json();
  return data.data as Community;
}

/**
 * 获取社区统计信息
 */
export async function getCommunityStats(communityId: number): Promise<CommunityStats> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/communities/${communityId}/stats`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("获取社区统计失败");
  }

  const data = await response.json();
  return data.data as CommunityStats;
}

/**
 * 关注社区
 */
export async function followCommunity(communityId: number): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/communities/${communityId}/follow`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    throw new Error("关注社区失败");
  }
}

/**
 * 取消关注社区
 */
export async function unfollowCommunity(communityId: number): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/communities/${communityId}/follow`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error("取消关注失败");
  }
}

/**
 * 搜索社区
 */
export async function searchCommunities(keyword: string, limit: number = 20): Promise<Community[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/communities/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`,
    {
      method: "GET",
      headers,
    }
  );

  if (!response.ok) {
    throw new Error("搜索社区失败");
  }

  const data = await response.json();
  return data.data as Community[];
}
