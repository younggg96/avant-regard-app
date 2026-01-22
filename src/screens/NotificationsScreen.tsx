import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import ScreenHeader, { HeaderAction } from "../components/ScreenHeader";
import {
  Notification,
  getAllNotifications,
  markAsRead as markNotificationAsRead,
  markAllAsRead as markAllNotificationsAsRead,
} from "../services/notificationService";

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // 加载通知
  const loadNotifications = async () => {
    try {
      const data = await getAllNotifications();
      setNotifications(data);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  };

  // 页面加载时获取通知
  useEffect(() => {
    loadNotifications();
  }, []);

  // 当页面获得焦点时刷新
  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [])
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "like":
        return { name: "heart", color: "#E74C3C" };
      case "comment":
        return { name: "chatbubble", color: "#3498DB" };
      case "follow":
        return { name: "person-add", color: "#27AE60" };
      case "mention":
        return { name: "at", color: "#9B59B6" };
      case "collection":
        return { name: "briefcase-outline", color: theme.colors.accent };
      case "system":
        return { name: "notifications", color: "#F39C12" };
      default:
        return { name: "ellipse", color: theme.colors.gray400 };
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      await markNotificationAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
    }

    // Navigate based on notification type
    switch (notification.type) {
      case "like":
      case "comment":
        if (notification.actionData?.postId) {
          (navigation.navigate as any)("LookDetail", {
            id: notification.actionData.postId,
          });
        }
        break;
      case "follow":
      case "mention":
        if (notification.actionData?.userId) {
          (navigation.navigate as any)("Profile", {
            userId: notification.actionData.userId,
          });
        }
        break;
      case "collection":
        if (notification.actionData?.collectionId) {
          (navigation.navigate as any)("LookbookDetail", {
            id: notification.actionData.collectionId,
          });
        }
        break;
    }
  };

  const markAllAsRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, []);

  const headerActions: HeaderAction[] =
    unreadCount > 0
      ? [
        {
          icon: "trash-outline",
          onPress: markAllAsRead,
          style: "secondary" as const,
        },
      ]
      : [];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title="通知"
        rightActions={headerActions}
        showBackButton={true}
      />

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === "all" && styles.activeFilterTab]}
          onPress={() => setFilter("all")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterText,
              filter === "all" && styles.activeFilterText,
            ]}
          >
            全部 ({notifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === "unread" && styles.activeFilterTab,
          ]}
          onPress={() => setFilter("unread")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterText,
              filter === "unread" && styles.activeFilterText,
            ]}
          >
            未读 ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.black}
          />
        }
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="notifications-outline"
              size={48}
              color={theme.colors.gray400}
            />
            <Text style={styles.emptyTitle}>
              {filter === "unread" ? "没有未读通知" : "暂无通知"}
            </Text>
            <Text style={styles.emptyText}>
              {filter === "unread"
                ? "您已阅读了所有通知"
                : "当有新的互动时，您会在这里收到通知"}
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {filteredNotifications.map((notification) => {
              const icon = getNotificationIcon(notification.type);
              return (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationCard,
                    !notification.isRead && styles.unreadNotification,
                  ]}
                  onPress={() => handleNotificationPress(notification)}
                  activeOpacity={0.8}
                >
                  <View style={styles.notificationIcon}>
                    {notification.avatar ? (
                      <View style={styles.avatarContainer}>
                        <Image
                          source={{ uri: notification.avatar }}
                          style={styles.avatar}
                        />
                        <View
                          style={[
                            styles.iconBadge,
                            { backgroundColor: icon.color },
                          ]}
                        >
                          <Ionicons
                            name={icon.name as any}
                            size={12}
                            color={theme.colors.white}
                          />
                        </View>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.systemIcon,
                          { backgroundColor: icon.color },
                        ]}
                      >
                        <Ionicons
                          name={icon.name as any}
                          size={20}
                          color={theme.colors.white}
                        />
                      </View>
                    )}
                  </View>

                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle}>
                      {notification.title}
                    </Text>
                    <Text style={styles.notificationMessage}>
                      {notification.message}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {notification.timestamp}
                    </Text>
                  </View>

                  {notification.image && (
                    <Image
                      source={{ uri: notification.image }}
                      style={styles.notificationImage}
                      resizeMode="cover"
                    />
                  )}

                  {!notification.isRead && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  filterTab: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    marginRight: theme.spacing.md,
  },
  activeFilterTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.black,
  },
  filterText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
  },
  activeFilterText: {
    color: theme.colors.black,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: theme.spacing.xxl * 2,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    textAlign: "center",
  },
  notificationsList: {
    paddingVertical: theme.spacing.sm,
  },
  notificationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  unreadNotification: {
    backgroundColor: theme.colors.gray100,
  },
  notificationIcon: {
    marginRight: theme.spacing.md,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: theme.borderRadius.sm,
  },
  iconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: theme.borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  systemIcon: {
    width: 50,
    height: 50,
    borderRadius: theme.borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationContent: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  notificationTitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    fontWeight: "600",
    marginBottom: theme.spacing.xs / 2,
  },
  notificationMessage: {
    ...theme.typography.body,
    color: theme.colors.gray600,
    marginBottom: theme.spacing.xs,
  },
  notificationTime: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  notificationImage: {
    width: 50,
    height: 60,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.sm,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: "#E74C3C",
    position: "absolute",
    top: theme.spacing.md + 4,
    right: theme.spacing.md,
  },
});

export default NotificationsScreen;
