/**
 * Push Notification 服务
 * 使用 Expo Notifications 实现系统推送通知
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useAuthStore } from "../store/authStore";
import { config } from "../config/env";

const EXPO_PUBLIC_API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

// 通知类型
export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "mention"
  | "system"
  | "collection";

// 通知数据接口
export interface NotificationData {
  type: NotificationType;
  postId?: number;
  userId?: number;
  commentId?: number;
  collectionId?: number;
}

// 配置通知处理行为
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * 注册推送通知并获取 Expo Push Token
 */
export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  let token: string | null = null;

  // 检查是否是真实设备
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  // 检查并请求通知权限
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Failed to get push token: permission not granted");
    return null;
  }

  try {
    // 获取 Expo Push Token
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.log("Project ID not found for push notifications");
      return null;
    }

    const pushTokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    token = pushTokenResponse.data;
    console.log("Expo Push Token:", token);
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }

  // Android 特定配置
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "默认通知",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#000000",
    });
  }

  return token;
}

/**
 * 将 Push Token 发送到服务器
 */
export async function sendPushTokenToServer(
  pushToken: string
): Promise<boolean> {
  const authStore = useAuthStore.getState();
  const accessToken = authStore.getAccessToken();

  if (!accessToken) {
    console.log("No access token, cannot send push token to server");
    return false;
  }

  try {
    const response = await fetch(
      `${EXPO_PUBLIC_API_BASE_URL}/api/notifications/push-token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pushToken,
          platform: Platform.OS,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to send push token: ${response.status}`);
    }

    console.log("Push token sent to server successfully");
    return true;
  } catch (error) {
    console.error("Error sending push token to server:", error);
    return false;
  }
}

/**
 * 移除服务器上的 Push Token（登出时调用）
 */
export async function removePushTokenFromServer(): Promise<boolean> {
  const authStore = useAuthStore.getState();
  const accessToken = authStore.getAccessToken();

  if (!accessToken) {
    return false;
  }

  try {
    const response = await fetch(
      `${EXPO_PUBLIC_API_BASE_URL}/api/notifications/push-token`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error("Error removing push token from server:", error);
    return false;
  }
}

/**
 * 调度本地通知（用于 App 内展示）
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: NotificationData
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as any,
      sound: true,
    },
    trigger: null, // 立即显示
  });
}

/**
 * 取消所有待处理的通知
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * 获取通知徽章数量
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * 设置通知徽章数量
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * 清除通知徽章
 */
export async function clearBadgeCount(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * 添加通知接收监听器
 */
export function addNotificationReceivedListener(
  listener: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(listener);
}

/**
 * 添加通知响应监听器（用户点击通知时触发）
 */
export function addNotificationResponseReceivedListener(
  listener: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

/**
 * 获取最后一个通知响应（应用从通知启动时）
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}

// 导出服务对象
export const pushNotificationService = {
  registerForPushNotificationsAsync,
  sendPushTokenToServer,
  removePushTokenFromServer,
  scheduleLocalNotification,
  cancelAllNotifications,
  getBadgeCount,
  setBadgeCount,
  clearBadgeCount,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  getLastNotificationResponse,
};

export default pushNotificationService;
