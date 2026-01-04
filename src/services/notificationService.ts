/**
 * 通知服务
 * 管理用户通知的获取、标记已读等功能
 */

export interface Notification {
  id: string;
  type: "like" | "comment" | "follow" | "mention" | "system" | "collection";
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
  };
}

// 通知数据（暂时为空，后续接入真实 API）
let mockNotifications: Notification[] = [];

/**
 * 获取所有通知
 */
export const getAllNotifications = async (): Promise<Notification[]> => {
  // 模拟 API 延迟
  await new Promise((resolve) => setTimeout(resolve, 300));
  return [...mockNotifications];
};

/**
 * 获取未读通知数量
 */
export const getUnreadCount = async (): Promise<number> => {
  const notifications = await getAllNotifications();
  return notifications.filter((n) => !n.isRead).length;
};

/**
 * 获取未读通知
 */
export const getUnreadNotifications = async (): Promise<Notification[]> => {
  const notifications = await getAllNotifications();
  return notifications.filter((n) => !n.isRead);
};

/**
 * 标记通知为已读
 */
export const markAsRead = async (notificationId: string): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  mockNotifications = mockNotifications.map((n) =>
    n.id === notificationId ? { ...n, isRead: true } : n
  );
};

/**
 * 标记所有通知为已读
 */
export const markAllAsRead = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  mockNotifications = mockNotifications.map((n) => ({ ...n, isRead: true }));
};

/**
 * 删除通知
 */
export const deleteNotification = async (
  notificationId: string
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  mockNotifications = mockNotifications.filter((n) => n.id !== notificationId);
};

