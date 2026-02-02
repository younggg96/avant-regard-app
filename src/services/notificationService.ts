/**
 * 通知服务
 * 管理用户通知的获取、标记已读等功能
 * 连接后端 API 获取真实数据
 */

import { useAuthStore } from "../store/authStore";
import { config } from "../config/env";

const EXPO_PUBLIC_API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

// API 响应包装类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 通知类型
export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "mention"
  | "system"
  | "collection";

// 通知接口
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  avatar?: string;
  image?: string;
  actionData?: {
    userId?: string;
    postId?: string;
    collectionId?: string;
    commentId?: string;
    actorName?: string; // 操作人名称
    // 自定义跳转
    navigateTo?: string; // 应用内页面名称
    navigateParams?: Record<string, unknown>; // 跳转参数
    externalUrl?: string; // 外部链接
  };
}

// 后端通知响应类型
interface NotificationResponse {
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
    // 自定义跳转
    navigateTo?: string;
    navigateParams?: Record<string, unknown>;
    externalUrl?: string;
  };
  createdAt: string;
}

// 通用请求方法
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

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      let errorMessage = "请求失败";
      if (contentType?.includes("application/json")) {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } else {
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    if (contentType?.includes("application/json")) {
      const jsonResponse = await response.json();

      // 处理包装的 API 响应格式 { code, message, data }
      if (
        jsonResponse &&
        typeof jsonResponse === "object" &&
        "code" in jsonResponse
      ) {
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

    const text = await response.text();
    return text as unknown as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("网络请求失败，请检查网络连接");
  }
}

/**
 * 将后端响应转换为前端通知格式
 */
function transformNotification(data: NotificationResponse): Notification {
  return {
    id: String(data.id),
    type: data.type.toLowerCase() as NotificationType,
    title: data.title,
    message: data.message,
    timestamp: formatTimestamp(data.createdAt),
    isRead: data.isRead,
    avatar: data.actionData?.actorAvatar,
    image: data.actionData?.postImage,
    actionData: {
      userId: data.actionData?.userId ? String(data.actionData.userId) : undefined,
      postId: data.actionData?.postId ? String(data.actionData.postId) : undefined,
      collectionId: data.actionData?.collectionId
        ? String(data.actionData.collectionId)
        : undefined,
      commentId: data.actionData?.commentId
        ? String(data.actionData.commentId)
        : undefined,
      actorName: data.actionData?.actorName,
      // 自定义跳转
      navigateTo: data.actionData?.navigateTo,
      navigateParams: data.actionData?.navigateParams,
      externalUrl: data.actionData?.externalUrl,
    },
  };
}

/**
 * 格式化时间戳为友好显示
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "刚刚";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return date.toLocaleDateString("zh-CN");
  }
}

/**
 * 获取所有通知
 * GET /api/notifications
 */
export const getAllNotifications = async (): Promise<Notification[]> => {
  try {
    const data = await request<NotificationResponse[]>("/api/notifications", {
      method: "GET",
    });
    return data.map(transformNotification);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
};

/**
 * 获取未读通知数量
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (): Promise<number> => {
  try {
    const data = await request<{ count: number }>(
      "/api/notifications/unread-count",
      {
        method: "GET",
      }
    );
    return data.count;
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return 0;
  }
};

/**
 * 获取未读通知
 * GET /api/notifications?unreadOnly=true
 */
export const getUnreadNotifications = async (): Promise<Notification[]> => {
  try {
    const data = await request<NotificationResponse[]>(
      "/api/notifications?unreadOnly=true",
      {
        method: "GET",
      }
    );
    return data.map(transformNotification);
  } catch (error) {
    console.error("Error fetching unread notifications:", error);
    return [];
  }
};

/**
 * 标记通知为已读
 * POST /api/notifications/{notificationId}/read
 */
export const markAsRead = async (notificationId: string): Promise<void> => {
  try {
    await request<void>(`/api/notifications/${notificationId}/read`, {
      method: "POST",
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
};

/**
 * 标记所有通知为已读
 * POST /api/notifications/read-all
 */
export const markAllAsRead = async (): Promise<void> => {
  try {
    await request<void>("/api/notifications/read-all", {
      method: "POST",
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  }
};

/**
 * 删除通知
 * DELETE /api/notifications/{notificationId}
 */
export const deleteNotification = async (
  notificationId: string
): Promise<void> => {
  try {
    await request<void>(`/api/notifications/${notificationId}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
  }
};

/**
 * 清空所有通知
 * DELETE /api/notifications/clear-all
 */
export const clearAllNotifications = async (): Promise<void> => {
  try {
    await request<void>("/api/notifications/clear-all", {
      method: "DELETE",
    });
  } catch (error) {
    console.error("Error clearing all notifications:", error);
  }
};

// 导出 notificationService 对象
export const notificationService = {
  getAllNotifications,
  getUnreadCount,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
};

export default notificationService;