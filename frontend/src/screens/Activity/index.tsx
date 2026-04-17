import React, { useState, useCallback } from "react";
import { FlatList, RefreshControl, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, HStack } from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import { theme } from "../../theme";
import {
  Notification,
  getAllNotifications,
  markAsRead as markNotificationAsRead,
  markAllAsRead as markAllNotificationsAsRead,
} from "../../services/notificationService";
import { ActivityFilter, FILTER_TABS, EXCLUDED_TYPES } from "./constants";
import { matchesFilter } from "./utils";
import { NotificationRow } from "./components/NotificationRow";
import { FilterChip } from "./components/FilterChip";
import { styles } from "./styles";

const ActivityScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const systemOnly = route.params?.filter === "system";
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

  const isChatNotif = (n: Notification) => n.actionData?.navigateTo === "Chat";

  const filtered = systemOnly
    ? notifications.filter((n) => (n.type === "system" || n.type === "mention") && !isChatNotif(n))
    : notifications.filter((n) => matchesFilter(n.type, filter));
  const interactionNotifs = systemOnly
    ? notifications.filter((n) => (n.type === "system" || n.type === "mention") && !isChatNotif(n))
    : notifications.filter((n) => !EXCLUDED_TYPES.includes(n.type));
  const unreadCount = interactionNotifs.filter((n) => !n.isRead).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={systemOnly ? "系统消息" : "互动消息"}
        showBackButton
        rightActions={
          unreadCount > 0
            ? [{ icon: "checkmark-done-outline" as const, onPress: handleMarkAllRead, style: "secondary" as const }]
            : []
        }
      />

      {!systemOnly && (
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
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow item={item} onPress={() => handleNotifPress(item)} />
        )}
        ListEmptyComponent={
          <Box py={48} px="$lg" alignItems="center">
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

export default ActivityScreen;
