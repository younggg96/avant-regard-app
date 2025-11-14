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

// Mock notifications data
let mockNotifications: Notification[] = [
  {
    id: "1",
    type: "like",
    title: "新的点赞",
    message: "Marie Claire 赞了您的搭配分享",
    timestamp: "2分钟前",
    isRead: false,
    avatar: "https://via.placeholder.com/50x50",
    image: "https://via.placeholder.com/60x80",
  },
  {
    id: "2",
    type: "comment",
    title: "新评论",
    message: "Fashion Editor 评论了您的 '春日优雅穿搭'",
    timestamp: "15分钟前",
    isRead: false,
    avatar: "https://via.placeholder.com/50x50",
  },
  {
    id: "3",
    type: "follow",
    title: "新关注者",
    message: "Style Icon 开始关注您",
    timestamp: "1小时前",
    isRead: false,
    avatar: "https://via.placeholder.com/50x50",
  },
  {
    id: "4",
    type: "collection",
    title: "新系列发布",
    message: "CHANEL 发布了 2024 春夏新系列",
    timestamp: "2小时前",
    isRead: true,
    image: "https://via.placeholder.com/60x80",
  },
  {
    id: "5",
    type: "mention",
    title: "提及您",
    message: "Vogue Editor 在时尚趋势分析中提到了您",
    timestamp: "3小时前",
    isRead: true,
    avatar: "https://via.placeholder.com/50x50",
  },
  {
    id: "6",
    type: "system",
    title: "系统通知",
    message: "您的内容获得了本周最佳搭配奖",
    timestamp: "1天前",
    isRead: true,
  },
];

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

