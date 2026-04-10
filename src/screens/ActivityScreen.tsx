import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  FlatList,
  RefreshControl,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { Box, Text, Pressable, HStack, VStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import ScreenHeader from "../components/ScreenHeader";
import { theme } from "../theme";

import {
  Notification,
  NotificationType,
  getAllNotifications,
  markAsRead as markNotificationAsRead,
  markAllAsRead as markAllNotificationsAsRead,
} from "../services/notificationService";

type ActivityFilter = "all" | "like_collection" | "comment" | "follow" | "system";

const FILTER_TABS: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "like_collection", label: "赞与收藏" },
  { id: "comment", label: "评论" },
  { id: "follow", label: "关注" },
  { id: "system", label: "系统" },
];

function matchesFilter(type: NotificationType, filter: ActivityFilter): boolean {
  if (filter === "all") return true;
  switch (filter) {
    case "like_collection":
      return type === "like" || type === "collection";
    case "comment":
      return type === "comment";
    case "follow":
      return type === "follow";
    case "system":
      return type === "system" || type === "mention";
    default:
      return true;
  }
}

const NOTIF_ICON_MAP: Record<string, { name: string; color: string }> = {
  like: { name: "heart", color: "#E74C3C" },
  comment: { name: "chatbubble", color: "#3498DB" },
  follow: { name: "person-add", color: "#27AE60" },
  mention: { name: "at", color: "#9B59B6" },
  collection: { name: "briefcase-outline", color: theme.colors.accent },
  system: { name: "notifications", color: "#F39C12" },
};

const getNotifIcon = (type: string) =>
  NOTIF_ICON_MAP[type] || { name: "ellipse", color: theme.colors.gray400 };

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const min = Math.floor(ms / 60000);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  if (hrs < 24) return `${hrs}小时前`;
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString("zh-CN");
}

const NotificationRow = ({
  item,
  onPress,
}: {
  item: Notification;
  onPress: () => void;
}) => {
  const icon = getNotifIcon(item.type);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, !item.isRead && styles.rowUnread]}
    >
      <HStack alignItems="center" flex={1}>
        <Box position="relative" mr="$md">
          {item.avatar ? (
            <Box position="relative">
              <OptimizedImage
                uri={item.avatar}
                size={ImageSize.THUMBNAIL}
                style={styles.avatar}
                contentFit="cover"
                lazy
              />
              <Box style={[styles.iconBadge, { backgroundColor: icon.color }]}>
                <Ionicons name={icon.name as any} size={11} color={theme.colors.white} />
              </Box>
            </Box>
          ) : (
            <Box
              w={48} h={48} rounded="$full"
              justifyContent="center" alignItems="center"
              style={{ backgroundColor: icon.color }}
            >
              <Ionicons name={icon.name as any} size={20} color={theme.colors.white} />
            </Box>
          )}
        </Box>

        <VStack flex={1} mr="$sm">
          <Text fontSize="$sm" fontWeight="$semibold" color="$black" mb={2}>
            {item.title}
          </Text>
          <Text fontSize="$sm" color="$gray300" numberOfLines={1}>
            {item.message}
          </Text>
          <Text fontSize="$xs" color="$gray200" mt={2}>
            {formatTime(item.createdAt)}
          </Text>
        </VStack>

        {item.image && (
          <OptimizedImage
            uri={item.image}
            size={ImageSize.MEDIUM}
            style={styles.notifImage}
            contentFit="cover"
            lazy
          />
        )}

        {!item.isRead && <Box style={styles.unreadIndicator} />}
      </HStack>
    </Pressable>
  );
};

const FilterChip = ({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.chip, isActive && styles.chipActive]}
  >
    <Text
      fontSize="$sm"
      fontWeight={isActive ? "$semibold" : "$normal"}
      color={isActive ? "$white" : "$gray400"}
    >
      {label}
    </Text>
  </Pressable>
);

const ActivityScreen = () => {
  const navigation = useNavigation();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setNotifications(await getAllNotifications());
    } catch (e) {
      console.error("Error loading notifications:", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleNotifPress = useCallback(
    async (n: Notification) => {
      if (!n.isRead) {
        await markNotificationAsRead(n.id);
        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
        );
      }
      switch (n.type) {
        case "like":
        case "comment":
          if (n.actionData?.postId)
            (navigation.navigate as any)("PostDetail", { postId: n.actionData.postId });
          break;
        case "follow":
        case "mention":
          if (n.actionData?.userId)
            (navigation.navigate as any)("UserProfile", { userId: n.actionData.userId });
          break;
        case "system":
          if (n.actionData?.externalUrl) {
            Linking.openURL(n.actionData.externalUrl).catch(() => { });
          } else if (n.actionData?.navigateTo) {
            (navigation.navigate as any)(n.actionData.navigateTo, n.actionData.navigateParams || {});
          } else if (n.actionData?.postId) {
            (navigation.navigate as any)("PostDetail", { postId: n.actionData.postId });
          } else if (n.actionData?.userId) {
            (navigation.navigate as any)("UserProfile", { userId: n.actionData.userId });
          }
          break;
      }
    },
    [navigation]
  );

  const handleMarkAllRead = useCallback(async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
  }, []);

  const filtered = notifications.filter((n) => matchesFilter(n.type, filter));
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="互动消息"
        showBackButton
        rightActions={
          unreadCount > 0
            ? [{ icon: "checkmark-done-outline" as const, onPress: handleMarkAllRead, style: "secondary" as const }]
            : []
        }
      />

      <HStack px="$md" py="$sm" style={styles.filterBar}>
        {FILTER_TABS.map((tab) => (
          <FilterChip
            key={tab.id}
            label={tab.label}
            isActive={filter === tab.id}
            onPress={() => setFilter(tab.id)}
          />
        ))}
      </HStack>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow item={item} onPress={() => handleNotifPress(item)} />
        )}
        ListEmptyComponent={
          <Box py="$xxl" px="$lg" alignItems="center">
            <Ionicons name="notifications-outline" size={44} color={theme.colors.gray200} />
            <Text fontSize="$md" fontWeight="$semibold" color="$black" mt="$md" mb="$sm">
              暂无互动消息
            </Text>
            <Text fontSize="$sm" color="$gray400" textAlign="center">
              当有人点赞、评论或关注你时，将在这里显示
            </Text>
          </Box>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.black}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  filterBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: theme.colors.gray100,
  },
  chipActive: {
    backgroundColor: theme.colors.black,
  },
  row: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
  },
  rowUnread: {
    backgroundColor: `${theme.colors.accent}05`,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  iconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  notifImage: {
    width: 46,
    height: 56,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.sm,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
    position: "absolute",
    top: 16,
    right: theme.spacing.md,
  },
});

export default ActivityScreen;
