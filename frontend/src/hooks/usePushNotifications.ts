/**
 * Push Notifications Hook
 * 管理推送通知的初始化、监听和处理
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { useAuthStore } from "../store/authStore";
import {
  registerForPushNotificationsAsync,
  sendPushTokenToServer,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  getLastNotificationResponse,
  NotificationData,
} from "../services/pushNotificationService";

type RootStackParamList = {
  PostDetail: { id: string };
  UserProfile: { userId: string };
  LookDetail: { id: string };
  Profile: { userId: string };
};

export function usePushNotifications() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { isAuthenticated, user } = useAuthStore();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);

  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // 处理通知点击导航
  const handleNotificationNavigation = useCallback(
    (data: NotificationData | null) => {
      if (!data) return;

      switch (data.type) {
        case "like":
        case "comment":
          if (data.postId) {
            navigation.navigate("PostDetail", { id: String(data.postId) });
          }
          break;
        case "follow":
          if (data.userId) {
            navigation.navigate("UserProfile", { userId: String(data.userId) });
          }
          break;
        case "collection":
          if (data.collectionId) {
            // 可以导航到 collection 详情页
          }
          break;
        default:
          break;
      }
    },
    [navigation]
  );

  // 初始化推送通知
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // 注册推送通知并获取 token
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        // 发送 token 到服务器
        sendPushTokenToServer(token);
      }
    });

    // 监听通知接收（前台）
    notificationListener.current = addNotificationReceivedListener(
      (notification) => {
        console.log("Notification received:", notification);
        setNotification(notification);
      }
    );

    // 监听通知点击响应
    responseListener.current = addNotificationResponseReceivedListener(
      (response) => {
        console.log("Notification response:", response);
        const data = response.notification.request.content
          .data as NotificationData;
        handleNotificationNavigation(data);
      }
    );

    // 检查应用是否从通知启动
    getLastNotificationResponse().then((response) => {
      if (response) {
        const data = response.notification.request.content
          .data as NotificationData;
        handleNotificationNavigation(data);
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(
          notificationListener.current
        );
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [isAuthenticated, handleNotificationNavigation]);

  return {
    expoPushToken,
    notification,
  };
}

export default usePushNotifications;
