import React, { useState, useCallback, useEffect, useRef } from "react";
import { FlatList, RefreshControl, Alert, ActivityIndicator } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { Box, Text, ActionSheet } from "../../../components/ui";
import type { ActionSheetAction } from "../../../components/ui";
import { useChatStore } from "../../../store/chatStore";
import { useNotificationStore } from "../../../store/notificationStore";
import { Conversation } from "../../../services/chatService";
import { ConversationRow } from "./ConversationRow";
import { ActivityEntry } from "./ActivityEntry";
import { SystemEntry } from "./SystemEntry";
import { StrangerEntry } from "./StrangerEntry";
import { RecentAvatars } from "./RecentAvatars";
import { isStrangerConversation } from "../utils";

export const MessagesContent = () => {
  const navigation = useNavigation();
  const {
    conversations,
    loadConversations,
    connectWebSocket,
    removeConversation,
    toggleConversationRead,
    deletingConversationIds,
  } = useChatStore();

  const notifications = useNotificationStore((s) => s.notifications);
  const loadNotifications = useNotificationStore((s) => s.loadNotifications);

  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetTitle, setSheetTitle] = useState("");
  const [sheetActions, setSheetActions] = useState<ActionSheetAction[]>([]);
  const didInitialFetchRef = useRef(false);

  useEffect(() => {
    connectWebSocket();
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([loadConversations(), loadNotifications()]);
      didInitialFetchRef.current = true;
    })();
  }, [loadNotifications]);

  useFocusEffect(
    useCallback(() => {
      if (!didInitialFetchRef.current) return;
      loadConversations();
      loadNotifications();
    }, [loadNotifications])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadConversations(), loadNotifications()]);
    setRefreshing(false);
  }, [loadNotifications]);

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

  const handleSystemPress = useCallback(() => {
    (navigation.navigate as any)("Activity", { filter: "system" });
  }, [navigation]);

  const handleStrangerPress = useCallback(() => {
    (navigation.navigate as any)("StrangerMessages");
  }, [navigation]);

  const handleLongPress = useCallback(
    (c: Conversation) => {
      const readLabel = c.unreadCount > 0 ? "标记已读" : "标记未读";
      setSheetTitle(c.otherUser?.username || "会话");
      setSheetActions([
        {
          label: readLabel,
          onPress: () => toggleConversationRead(c.id),
        },
        {
          label: "删除会话",
          destructive: true,
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
      ]);
      setSheetVisible(true);
    },
    [toggleConversationRead, removeConversation]
  );

  const sortedConversations = [...conversations].sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

  const strangerConversations = sortedConversations.filter(isStrangerConversation);
  const regularConversations = sortedConversations.filter((c) => !isStrangerConversation(c));

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const itemDeleting = deletingConversationIds.has(item.id);
      return (
        <Box opacity={itemDeleting ? 0.5 : 1} position="relative">
          <ConversationRow
            item={item}
            onPress={() => handleConvPress(item)}
            onLongPress={() => handleLongPress(item)}
          />
          {itemDeleting && (
            <Box
              position="absolute"
              right={16}
              top={0}
              bottom={0}
              justifyContent="center"
            >
              <ActivityIndicator size="small" color={theme.colors.gray300} />
            </Box>
          )}
        </Box>
      );
    },
    [handleConvPress, handleLongPress, deletingConversationIds]
  );

  return (
    <>
      <FlatList
        data={regularConversations}
        keyExtractor={(item) => `conv-${item.id}`}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <RecentAvatars conversations={sortedConversations} />
            <SystemEntry
              notifications={notifications}
              onPress={handleSystemPress}
            />
            <ActivityEntry
              notifications={notifications}
              onPress={handleActivityPress}
            />
            <StrangerEntry
              conversations={strangerConversations}
              onPress={handleStrangerPress}
            />
          </>
        }
        ListEmptyComponent={
          <Box py={48} px="$lg" alignItems="center">
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

      <ActionSheet
        visible={sheetVisible}
        title={sheetTitle}
        actions={sheetActions}
        onClose={() => setSheetVisible(false)}
      />
    </>
  );
};
