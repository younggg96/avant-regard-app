/**
 * Notification service (web). Mirrors `frontend/src/services/notificationService.ts`.
 *
 * Keeps the raw backend enum lowercased (`like` / `comment` / `follow` /
 * `mention` / `system` / `collection`) because every UI screen pattern-matches
 * on that literal.
 */

import { apiClient } from "../api-client";

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "mention"
  | "system"
  | "collection";

export interface NotificationResponse {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionData: {
    userId?: number;
    postId?: number;
    collectionId?: number;
    commentId?: number;
    actorName?: string;
    actorAvatar?: string;
    postImage?: string;
    navigateTo?: string;
    navigateParams?: Record<string, unknown>;
    externalUrl?: string;
  };
  createdAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  createdAt: string;
  isRead: boolean;
  avatar?: string;
  image?: string;
  actionData?: {
    userId?: string;
    postId?: string;
    collectionId?: string;
    commentId?: string;
    actorName?: string;
    navigateTo?: string;
    navigateParams?: Record<string, unknown>;
    externalUrl?: string;
  };
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "刚刚";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}小时前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}天前`;
  return date.toLocaleDateString("zh-CN");
}

export function transformNotification(data: NotificationResponse): Notification {
  const a = data.actionData || {};
  return {
    id: String(data.id),
    type: (data.type || "").toLowerCase() as NotificationType,
    title: data.title,
    message: data.message,
    timestamp: formatTimestamp(data.createdAt),
    createdAt: data.createdAt,
    isRead: data.isRead,
    avatar: a.actorAvatar,
    image: a.postImage,
    actionData: {
      userId: a.userId != null ? String(a.userId) : undefined,
      postId: a.postId != null ? String(a.postId) : undefined,
      collectionId: a.collectionId != null ? String(a.collectionId) : undefined,
      commentId: a.commentId != null ? String(a.commentId) : undefined,
      actorName: a.actorName,
      navigateTo: a.navigateTo,
      navigateParams: a.navigateParams,
      externalUrl: a.externalUrl,
    },
  };
}

export const notificationService = {
  getAll: async (): Promise<Notification[]> => {
    const list = await apiClient.get<NotificationResponse[]>(
      "/api/notifications",
    );
    return (list || []).map(transformNotification);
  },

  getUnread: async (): Promise<Notification[]> => {
    const list = await apiClient.get<NotificationResponse[]>(
      "/api/notifications",
      { unreadOnly: true },
    );
    return (list || []).map(transformNotification);
  },

  getUnreadCount: async (): Promise<number> => {
    const d = await apiClient.get<{ count: number }>(
      "/api/notifications/unread-count",
    );
    return d.count ?? 0;
  },

  markAsRead: (id: string) =>
    apiClient.post<void>(`/api/notifications/${id}/read`),

  markAllAsRead: () => apiClient.post<void>(`/api/notifications/read-all`),

  delete: (id: string) => apiClient.delete<void>(`/api/notifications/${id}`),

  clearAll: () => apiClient.delete<void>(`/api/notifications/clear-all`),
};
