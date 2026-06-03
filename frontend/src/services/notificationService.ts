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

/**
 * 交易通知二级分类（互动页「交易」tab）：
 *   - logistics   物流信息（订单 / 发货 / 收货 / 结算进度）
 *   - after_sales 售后信息（纠纷 / 退款 / 鉴定 / 评价）
 *   - wishlist    心动信息（收藏单品变动 / 出价）
 * 非交易类通知为 null。
 */
export type TradingCategory = "logistics" | "after_sales" | "wishlist";

export const TRADING_CATEGORIES: TradingCategory[] = [
  "logistics",
  "after_sales",
  "wishlist",
];

const AFTER_SALES_NAV = ["Authentication", "OrderReviews"];
const AFTER_SALES_KEYWORDS = [
  "售后", "申诉", "退款", "退货", "纠纷", "仲裁", "鉴定", "评价", "争议", "客服介入",
  "after-sale", "after sale", "refund", "dispute", "authentication", "review",
];
const LOGISTICS_NAV = ["OrderDetail", "MyWallet"];
const LOGISTICS_KEYWORDS = [
  "物流", "发货", "收货", "包裹", "签收", "结算", "入账", "提现", "订单",
  "logistics", "shipped", "shipping", "delivery", "order", "settle",
];
const WISHLIST_NAV = ["StoreProductDetail"];
const WISHLIST_KEYWORDS = [
  "降价", "心动", "收藏", "出价", "上架", "售出", "下架", "价格",
  "price", "offer", "listing", "sold", "favorite", "wishlist",
];

/**
 * 前端兜底：万一后端未返回 category（旧版本后端），用同样的规则本地推导，
 * 保证「交易」tab 不依赖后端发版即可工作。规则需与后端
 * notification_service.derive_notification_category 保持一致。
 */
export function deriveTradingCategory(
  type: string,
  title: string | undefined,
  navigateTo: string | undefined
): TradingCategory | null {
  if (type?.toLowerCase() !== "system") return null;
  const text = title || "";
  const has = (kws: string[]) =>
    kws.some((k) => text.toLowerCase().includes(k.toLowerCase()));

  if ((navigateTo && AFTER_SALES_NAV.includes(navigateTo)) || has(AFTER_SALES_KEYWORDS))
    return "after_sales";
  if ((navigateTo && LOGISTICS_NAV.includes(navigateTo)) || has(LOGISTICS_KEYWORDS))
    return "logistics";
  if ((navigateTo && WISHLIST_NAV.includes(navigateTo)) || has(WISHLIST_KEYWORDS))
    return "wishlist";
  return null;
}

// 通知接口
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
  /** 交易通知分类；非交易类为 null */
  category?: TradingCategory | null;
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
  category?: TradingCategory | null;
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
  const type = data.type.toLowerCase() as NotificationType;
  // 优先使用后端返回的 category；旧后端未返回时本地兜底推导。
  const category =
    data.category ??
    deriveTradingCategory(type, data.title, data.actionData?.navigateTo);
  return {
    id: String(data.id),
    type,
    title: data.title,
    message: data.message,
    timestamp: formatTimestamp(data.createdAt),
    createdAt: data.createdAt,
    isRead: data.isRead,
    category,
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