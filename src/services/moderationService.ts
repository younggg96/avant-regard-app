/**
 * Content moderation service: report content + block users.
 * Required by Apple Guideline 1.2 (User-Generated Content).
 */

import { useAuthStore } from "../store/authStore";
import { config } from "../config/env";

const EXPO_PUBLIC_API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export type ReportReason =
  | "SPAM"
  | "INAPPROPRIATE"
  | "MISINFORMATION"
  | "COPYRIGHT"
  | "HARASSMENT"
  | "OTHER";

export interface ReportContentParams {
  targetType: "POST" | "COMMENT";
  targetId: number;
  reason: ReportReason;
  description?: string;
}

export interface BlockedUser {
  userId: number;
  username: string;
  avatarUrl: string;
}

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

  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get("content-type");

  if (!response.ok) {
    let errorMessage = "请求失败";
    if (contentType?.includes("application/json")) {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    }
    throw new Error(errorMessage);
  }

  if (contentType?.includes("application/json")) {
    const jsonResponse = await response.json();
    if (jsonResponse && typeof jsonResponse === "object" && "code" in jsonResponse) {
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

  return (await response.text()) as unknown as T;
}

export async function reportContent(params: ReportContentParams): Promise<void> {
  return request<void>("/api/moderation/report", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function blockUser(blockedUserId: number): Promise<void> {
  return request<void>("/api/moderation/block", {
    method: "POST",
    body: JSON.stringify({ blockedUserId }),
  });
}

export async function unblockUser(blockedUserId: number): Promise<void> {
  return request<void>(`/api/moderation/block/${blockedUserId}`, {
    method: "DELETE",
  });
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  return request<BlockedUser[]>("/api/moderation/blocked-users", {
    method: "GET",
  });
}

export const moderationService = {
  reportContent,
  blockUser,
  unblockUser,
  getBlockedUsers,
};

export default moderationService;
