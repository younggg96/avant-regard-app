/**
 * Moderation service (web): blocks + reports.
 *
 * Mirrors the portion of the mobile `moderationService.ts` that web currently
 * surfaces — block/unblock/list blocked users and list-my-reports. The actual
 * "create report" action also lives here so any future "举报" button on the
 * web can call `moderationService.reportContent(...)` directly.
 */

import { apiClient } from "../api-client";

export type ReportReason =
  | "SPAM"
  | "INAPPROPRIATE"
  | "MISINFORMATION"
  | "COPYRIGHT"
  | "HARASSMENT"
  | "PORNOGRAPHY"
  | "VIOLENCE"
  | "OTHER";

export interface ReportContentParams {
  targetType: "POST" | "COMMENT" | "MESSAGE" | "USER";
  targetId: number;
  reason: ReportReason;
  description?: string;
}

export interface BlockedUser {
  userId: number;
  username: string;
  avatarUrl: string;
}

export interface ReportRecord {
  id: number;
  targetType: "POST" | "COMMENT" | "MESSAGE" | "USER";
  targetId: number;
  reason: string;
  description: string;
  status: "PENDING" | "REVIEWED" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  targetInfo: {
    title?: string;
    type?: string;
    coverImage?: string;
    content?: string;
    postId?: number;
    senderId?: number;
    username?: string;
  };
}

export interface MyReportsResponse {
  reports: ReportRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export const moderationService = {
  reportContent: (params: ReportContentParams) =>
    apiClient.post<void>("/api/moderation/report", params),

  blockUser: (blockedUserId: number) =>
    apiClient.post<void>("/api/moderation/block", { blockedUserId }),

  unblockUser: (blockedUserId: number) =>
    apiClient.delete<void>(`/api/moderation/block/${blockedUserId}`),

  getBlockedUsers: () =>
    apiClient.get<BlockedUser[]>("/api/moderation/blocked-users"),

  getMyReports: (page = 1, pageSize = 20) =>
    apiClient.get<MyReportsResponse>(`/api/moderation/my-reports`, {
      page,
      pageSize,
    }),
};
