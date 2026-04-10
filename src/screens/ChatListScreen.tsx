import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { useChatStore } from "../store/chatStore";
import { Conversation } from "../services/chatService";

function formatTime(isoString: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString("zh-CN");
}

const ConversationItem = ({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) => {
  const other = conversation.otherUser;
  const hasUnread = conversation.unreadCount > 0;

  return (
    <TouchableOpacity
      style={[styles.conversationItem, hasUnread && styles.unreadItem]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarWrapper}>
        {other?.avatarUrl ? (
          <OptimizedImage
            uri={other.avatarUrl}
            size={ImageSize.THUMBNAIL}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={24} color={theme.colors.gray200} />
          </View>
        )}
        {hasUnread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {other?.username || "未知用户"}
          </Text>
          <Text style={styles.conversationTime}>
            {formatTime(conversation.lastMessageAt)}
          </Text>
        </View>
        <Text
          style={[
            styles.lastMessage,
            hasUnread && styles.lastMessageUnread,
          ]}
          numberOfLines={1}
        >
          {conversation.lastMessageText || "暂无消息"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const ChatListScreen = () => {
  const navigation = useNavigation();
  const {
    conversations,
    isLoadingConversations,
    loadConversations,
    connectWebSocket,
    disconnectWebSocket,
  } = useChatStore();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, []);

  const handleConversationPress = (conversation: Conversation) => {
    (navigation.navigate as any)("Chat", {
      conversationId: conversation.id,
      otherUserName: conversation.otherUser?.username || "聊天",
      otherUserAvatar: conversation.otherUser?.avatarUrl,
      otherUserId: conversation.otherUser?.userId,
    });
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="chatbubbles-outline"
        size={48}
        color={theme.colors.gray200}
      />
      <Text style={styles.emptyTitle}>暂无对话</Text>
      <Text style={styles.emptyText}>
        在用户主页点击"发消息"开始聊天
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader title="消息" showBackButton={true} />

      <FlatList
        data={conversations}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            onPress={() => handleConversationPress(item)}
          />
        )}
        ListEmptyComponent={
          isLoadingConversations ? null : renderEmpty()
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.black}
          />
        }
        contentContainerStyle={
          conversations.length === 0 ? styles.emptyContainer : undefined
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  emptyContainer: {
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
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
  },
  unreadItem: {
    backgroundColor: `${theme.colors.accent}05`,
  },
  avatarWrapper: {
    position: "relative",
    marginRight: theme.spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.gray100,
    justifyContent: "center",
    alignItems: "center",
  },
  unreadBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.error,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  unreadBadgeText: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationName: {
    ...theme.typography.bodySmall,
    fontWeight: "600",
    color: theme.colors.black,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  conversationTime: {
    ...theme.typography.caption,
    color: theme.colors.gray200,
  },
  lastMessage: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray300,
  },
  lastMessageUnread: {
    color: theme.colors.black,
    fontWeight: "500",
  },
});

export default ChatListScreen;
