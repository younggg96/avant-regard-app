import React, { useState, useCallback, useEffect, useRef } from "react";
import { FlatList, RefreshControl, Linking, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, HStack } from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import { theme, useAppTheme } from "../../theme";
import { Notification } from "../../services/notificationService";
import { useNotificationStore } from "../../store/notificationStore";
import { ActivityFilter, FILTER_TABS, EXCLUDED_TYPES } from "./constants";
import { matchesFilter } from "./utils";
import { NotificationRow } from "./components/NotificationRow";
import { FilterChip } from "./components/FilterChip";
import { useActivityStyles } from "./styles";

const isChatNotif = (n: Notification) => n.actionData?.navigateTo === "Chat";

const ActivityScreen = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const styles = useActivityStyles();
  const systemOnly = route.params?.filter === "system";
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  // Skip the useFocusEffect that fires right after mount — the initial
  // useEffect below already owns the first fetch, avoiding a double request.
  const didInitialFetchRef = useRef(false);

  const notifications = useNotificationStore((s) => s.notifications);
  const loadNotifications = useNotificationStore((s) => s.loadNotifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markManyRead = useNotificationStore((s) => s.markManyRead);

  // 把「当前 tab 列表里」的未读全部标已读。聊天类通知 (navigateTo==="Chat")
  // 由 Chat 屏自己清理，避免在用户进入互动消息详情时误清未打开的聊天提醒。
  const markVisibleAsRead = useCallback(() => {
    const ids = useNotificationStore
      .getState()
      .notifications.filter((n) => {
        if (n.isRead) return false;
        if (isChatNotif(n)) return false;
        if (systemOnly) return n.type === "system" || n.type === "mention";
        return !EXCLUDED_TYPES.includes(n.type);
      })
      .map((n) => n.id);
    if (ids.length > 0) markManyRead(ids);
  }, [systemOnly, markManyRead]);

  const loadData = useCallback(async () => {
    await loadNotifications();
    // 进入/刷新即视为「看完」：拉完最新列表后立刻清掉视觉上的红点/数字。
    markVisibleAsRead();
  }, [loadNotifications, markVisibleAsRead]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadData();
      if (!cancelled) setInitialLoading(false);
      didInitialFetchRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      if (!didInitialFetchRef.current) return;
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
        await markRead(n.id);
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
    [navigation, markRead]
  );

  const handleMarkAllRead = useCallback(async () => {
    // 只把当前列表里可见的未读标已读；避免把聊天通知（由 Chat 屏自己清）也误清。
    const ids = (systemOnly
      ? notifications.filter((n) => (n.type === "system" || n.type === "mention") && !isChatNotif(n))
      : notifications.filter((n) => !EXCLUDED_TYPES.includes(n.type))
    )
      .filter((n) => !n.isRead)
      .map((n) => n.id);
    await markManyRead(ids);
  }, [notifications, systemOnly, markManyRead]);

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
        title={systemOnly ? t("interaction.systemNotice") : t("activity.title")}
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
              label={t(tab.labelKey)}
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
          initialLoading ? (
            <Box py={48} px="$lg" alignItems="center">
              <ActivityIndicator size="small" color={theme.colors.gray300} />
            </Box>
          ) : (
            <Box py={48} px="$lg" alignItems="center">
              <Ionicons name="notifications-outline" size={44} color={theme.colors.gray200} />
              <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.black }} mt="$md" mb="$sm">
                {t("activity.noActivity")}
              </Text>
              <Text fontSize="$sm" style={{ color: theme.colors.gray400 }} textAlign="center">
                {t("activity.emptyHint")}
              </Text>
            </Box>
          )
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
