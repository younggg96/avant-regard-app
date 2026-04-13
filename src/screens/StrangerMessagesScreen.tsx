import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { Box, Text, ActionSheet } from "../components/ui";
import type { ActionSheetAction } from "../components/ui";
import ScreenHeader from "../components/ScreenHeader";
import { useChatStore } from "../store/chatStore";
import { Conversation } from "../services/chatService";
import { ConversationRow } from "./Interaction/components/ConversationRow";
import { isStrangerConversation } from "./Interaction/utils";

const StrangerMessagesScreen = () => {
  const navigation = useNavigation();
  const {
    conversations,
    loadConversations,
    removeConversation,
    toggleConversationRead,
  } = useChatStore();

  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetTitle, setSheetTitle] = useState("");
  const [sheetActions, setSheetActions] = useState<ActionSheetAction[]>([]);

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

  const strangerConversations = [...conversations]
    .filter(isStrangerConversation)
    .sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });

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
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.white }}
      edges={["top"]}
    >
      <ScreenHeader title="陌生人消息" showBackButton />

      <FlatList
        data={strangerConversations}
        keyExtractor={(item) => `stranger-${item.id}`}
        renderItem={renderItem}
        ListEmptyComponent={
          <Box py={48} px="$lg" alignItems="center">
            <Ionicons
              name="person-outline"
              size={44}
              color={theme.colors.gray200}
            />
            <Text
              fontSize="$md"
              fontWeight="$semibold"
              color="$black"
              mt="$md"
              mb="$sm"
            >
              暂无陌生人消息
            </Text>
            <Text fontSize="$sm" color="$gray400" textAlign="center">
              来自未对话过的用户的消息将在这里显示
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
    </SafeAreaView>
  );
};

export default StrangerMessagesScreen;
