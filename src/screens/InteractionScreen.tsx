import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  FlatList,
  RefreshControl,
  Dimensions,
  ScrollView as RNScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useFocusEffect,
  useRoute,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { Box, Text, Pressable, HStack, VStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { CenteredTabBar } from "../components/CenteredTabBar";
import { theme } from "../theme";

import { useChatStore } from "../store/chatStore";
import { Conversation } from "../services/chatService";
import {
  Notification,
  getAllNotifications,
} from "../services/notificationService";

import BuyerMapScreen from "./BuyerMapScreen";

type SubTab = "messages" | "map";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "messages", label: "消息" },
  { id: "map", label: "地图" },
];

// ======================= Helpers =======================

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

const NOTIF_ICON_MAP: Record<string, { name: string; color: string }> = {
  like: { name: "heart", color: "#E74C3C" },
  comment: { name: "chatbubble", color: "#3498DB" },
  follow: { name: "person-add", color: "#27AE60" },
  mention: { name: "at", color: "#9B59B6" },
  collection: { name: "briefcase-outline", color: theme.colors.accent },
  system: { name: "notifications", color: "#F39C12" },
};

// ======================= Row components =======================

const ConversationRow = ({
  item,
  onPress,
  onLongPress,
}: {
  item: Conversation;
  onPress: () => void;
  onLongPress: () => void;
}) => {
  const other = item.otherUser;
  const hasUnread = item.unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.row, hasUnread && styles.rowUnread]}
    >
      <HStack alignItems="center" flex={1}>
        <Box position="relative" mr="$md">
          {other?.avatarUrl ? (
            <OptimizedImage
              uri={other.avatarUrl}
              size={ImageSize.THUMBNAIL}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <Box
              w={48} h={48} rounded="$full"
              bg="$gray100" justifyContent="center" alignItems="center"
            >
              <Ionicons name="person" size={22} color={theme.colors.gray200} />
            </Box>
          )}
          {hasUnread && (
            <Box style={styles.unreadDot}>
              <Text style={styles.unreadDotText}>
                {item.unreadCount > 99 ? "99+" : item.unreadCount}
              </Text>
            </Box>
          )}
        </Box>

        <VStack flex={1} mr="$sm">
          <HStack justifyContent="between" alignItems="center" mb={3}>
            <Text
              fontSize="$sm" fontWeight="$semibold" color="$black"
              flex={1} mr="$sm" numberOfLines={1}
            >
              {other?.username || "未知用户"}
            </Text>
            <Text fontSize="$xs" color="$gray200">
              {formatTime(item.lastMessageAt)}
            </Text>
          </HStack>
          <Text
            fontSize="$sm" numberOfLines={1}
            color={hasUnread ? "$black" : "$gray300"}
            fontWeight={hasUnread ? "$medium" : "$normal"}
          >
            {item.lastMessageText || "暂无消息"}
          </Text>
        </VStack>
      </HStack>
    </Pressable>
  );
};

const ActivityEntry = ({
  notifications,
  onPress,
}: {
  notifications: Notification[];
  onPress: () => void;
}) => {
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const latest = notifications[0];

  if (notifications.length === 0) return null;

  const previewAvatars = notifications
    .map((n) => n.avatar)
    .filter(Boolean)
    .slice(0, 3) as string[];

  const latestIcon = latest
    ? NOTIF_ICON_MAP[latest.type] || { name: "ellipse", color: theme.colors.gray400 }
    : { name: "notifications", color: "#F39C12" };

  return (
    <Pressable onPress={onPress} style={[styles.row, unreadCount > 0 && styles.rowUnread]}>
      <HStack alignItems="center" flex={1}>
        <Box position="relative" mr="$md">
          {previewAvatars.length > 0 ? (
            <Box position="relative">
              <OptimizedImage
                uri={previewAvatars[0]}
                size={ImageSize.THUMBNAIL}
                style={styles.avatar}
                contentFit="cover"
                lazy
              />
              <Box style={[styles.iconBadge, { backgroundColor: latestIcon.color }]}>
                <Ionicons name={latestIcon.name as any} size={11} color={theme.colors.white} />
              </Box>
            </Box>
          ) : (
            <Box
              w={48} h={48} rounded="$full"
              justifyContent="center" alignItems="center"
              bg="$gray100"
            >
              <Ionicons name="notifications" size={22} color={theme.colors.gray400} />
            </Box>
          )}
          {unreadCount > 0 && (
            <Box style={styles.unreadDot}>
              <Text style={styles.unreadDotText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </Box>
          )}
        </Box>

        <VStack flex={1} mr="$sm">
          <HStack justifyContent="between" alignItems="center" mb={3}>
            <Text fontSize="$sm" fontWeight="$semibold" color="$black">
              互动消息
            </Text>
            {latest && (
              <Text fontSize="$xs" color="$gray200">
                {formatTime(latest.createdAt)}
              </Text>
            )}
          </HStack>
          <Text fontSize="$sm" color={unreadCount > 0 ? "$black" : "$gray300"} numberOfLines={1}>
            {latest ? `${latest.title} ${latest.message}` : "暂无互动消息"}
          </Text>
        </VStack>

        <Ionicons name="chevron-forward" size={18} color={theme.colors.gray200} />
      </HStack>
    </Pressable>
  );
};

// ======================= Messages content =======================

const MessagesContent = () => {
  const navigation = useNavigation();
  const {
    conversations,
    loadConversations,
    connectWebSocket,
    disconnectWebSocket,
    removeConversation,
    toggleConversationRead,
  } = useChatStore();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const all = await getAllNotifications();
      all.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNotifications(all);
    } catch (e) {
      console.error("Error loading notifications:", e);
    }
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => disconnectWebSocket();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
      loadNotifications();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadConversations(), loadNotifications()]);
    setRefreshing(false);
  }, []);

  const handleConvPress = useCallback(
    (c: Conversation) => {
      (navigation.navigate as any)("Chat", {
        conversationId: c.id,
        otherUserName: c.otherUser?.username || "聊天",
        otherUserAvatar: c.otherUser?.avatarUrl,
        otherUserId: c.otherUser?.userId,
      });
    },
    [navigation]
  );

  const handleActivityPress = useCallback(() => {
    (navigation.navigate as any)("Activity");
  }, [navigation]);

  const handleLongPress = useCallback(
    (c: Conversation) => {
      const readLabel = c.unreadCount > 0 ? "标记已读" : "标记未读";
      Alert.alert(
        c.otherUser?.username || "会话",
        undefined,
        [
          {
            text: readLabel,
            onPress: () => toggleConversationRead(c.id),
          },
          {
            text: "删除会话",
            style: "destructive",
            onPress: () => {
              Alert.alert("确认删除", "删除后将无法恢复聊天记录", [
                { text: "取消", style: "cancel" },
                {
                  text: "删除",
                  style: "destructive",
                  onPress: () => removeConversation(c.id),
                },
              ]);
            },
          },
          { text: "取消", style: "cancel" },
        ]
      );
    },
    [toggleConversationRead, removeConversation]
  );

  const sortedConversations = [...conversations].sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationRow
        item={item}
        onPress={() => handleConvPress(item)}
        onLongPress={() => handleLongPress(item)}
      />
    ),
    [handleConvPress, handleLongPress]
  );

  return (
    <FlatList
      data={sortedConversations}
      keyExtractor={(item) => `conv-${item.id}`}
      renderItem={renderItem}
      ListHeaderComponent={
        <ActivityEntry
          notifications={notifications}
          onPress={handleActivityPress}
        />
      }
      ListEmptyComponent={
        <Box py="$xxl" px="$lg" alignItems="center">
          <Ionicons name="chatbubbles-outline" size={44} color={theme.colors.gray200} />
          <Text fontSize="$md" fontWeight="$semibold" color="$black" mt="$md" mb="$sm">
            暂无对话
          </Text>
          <Text fontSize="$sm" color="$gray400" textAlign="center">
            前往用户主页发起聊天
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
  );
};

// ======================= Main screen =======================

const { width: screenWidth } = Dimensions.get("window");

const TAB_INDEX: Record<SubTab, number> = { messages: 0, map: 1 };
const INDEX_TAB: SubTab[] = ["messages", "map"];

const InteractionScreen = () => {
  const route = useRoute<any>();
  const initialTab = route.params?.subTab as SubTab | undefined;
  const [activeTab, setActiveTab] = useState<SubTab>(initialTab || "messages");
  const { refreshUnreadCount } = useChatStore();
  const horizontalScrollRef = useRef<RNScrollView>(null);

  useEffect(() => {
    if (initialTab && INDEX_TAB.includes(initialTab)) {
      setActiveTab(initialTab);
      horizontalScrollRef.current?.scrollTo({
        x: TAB_INDEX[initialTab] * screenWidth,
        animated: false,
      });
    }
  }, [initialTab]);

  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount();
    }, [])
  );

  const handleTabChange = useCallback((tab: SubTab) => {
    setActiveTab(tab);
    horizontalScrollRef.current?.scrollTo({
      x: TAB_INDEX[tab] * screenWidth,
      animated: true,
    });
  }, []);

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const pageIndex = Math.round(offsetX / screenWidth);
      const newTab = INDEX_TAB[pageIndex];
      if (newTab && newTab !== activeTab) {
        setActiveTab(newTab);
      }
    },
    [activeTab]
  );

  const tabItems = SUB_TABS.map((t) => ({ ...t, badge: 0 }));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <CenteredTabBar
        tabs={tabItems}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      <RNScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.swipeContainer}
      >
        <View style={{ width: screenWidth }}>
          <MessagesContent />
        </View>
        <View style={{ width: screenWidth }}>
          <BuyerMapScreen embedded />
        </View>
      </RNScrollView>
    </SafeAreaView>
  );
};

// ======================= Styles =======================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  swipeContainer: {
    flex: 1,
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
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.error,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  unreadDotText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: "700",
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
});

export default InteractionScreen;
