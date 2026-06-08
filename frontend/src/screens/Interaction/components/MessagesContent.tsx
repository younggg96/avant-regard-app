import React, { useState, useCallback, useEffect } from "react";
import { FlatList, RefreshControl, Alert, ActivityIndicator, Image as RNImage, StyleSheet, Dimensions } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme, useAppTheme } from "../../../theme";
import { useProfileLoadingGif } from "../../../utils/loadingGifs";
import { Box, Text, ActionSheet } from "../../../components/ui";
import type { ActionSheetAction } from "../../../components/ui";
import { useChatStore } from "../../../store/chatStore";
import { useNotificationStore } from "../../../store/notificationStore";
import { Conversation, isTradeConversation } from "../../../services/chatService";
import { ConversationRow } from "./ConversationRow";
import { ActivityEntry } from "./ActivityEntry";
import { SystemEntry } from "./SystemEntry";
import { StrangerEntry } from "./StrangerEntry";
import { RecentAvatars } from "./RecentAvatars";
import { getConversationChatParams } from "../../../utils/chatNavigationUtils";
import { isStrangerConversation } from "../utils";

export const MessagesContent = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const profileLoadingGif = useProfileLoadingGif();
  const {
    conversations,
    loadConversations,
    connectWebSocket,
    removeConversation,
    toggleConversationRead,
    deletingConversationIds,
    isConversationsInitialLoaded,
  } = useChatStore();

  const notifications = useNotificationStore((s) => s.notifications);
  const loadNotifications = useNotificationStore((s) => s.loadNotifications);
  const isNotificationsInitialLoaded = useNotificationStore(
    (s) => s.isInitialLoaded
  );

  // Gate the whole page on BOTH stores having completed their first fetch.
  // Why not `useRef`: the flag must drive rendering. Why store-level instead
  // of component-local state: `MessagesContent` remounts when the user leaves
  // and returns to the 互动 tab; if the data is already in the store we must
  // skip the spinner to avoid a useless flash.
  const isInitialLoaded =
    isConversationsInitialLoaded && isNotificationsInitialLoaded;

  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetTitle, setSheetTitle] = useState("");
  const [sheetActions, setSheetActions] = useState<ActionSheetAction[]>([]);

  useEffect(() => {
    connectWebSocket();
  }, []);

  useFocusEffect(
    useCallback(() => {
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
      (navigation.navigate as any)("Chat", getConversationChatParams(c, t));
    },
    [navigation, t]
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
      const readLabel = c.unreadCount > 0 ? t("interaction.markRead") : t("interaction.markUnread");
      setSheetTitle(c.otherUser?.username || t("interaction.conversation"));
      setSheetActions([
        {
          label: readLabel,
          onPress: () => toggleConversationRead(c.id),
        },
        {
          label: t("interaction.deleteConversation"),
          destructive: true,
          onPress: () => {
            Alert.alert(t("interaction.confirmDelete"), t("interaction.deleteWarning"), [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("common.delete"),
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

  if (!isInitialLoaded) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center">
        <RNImage
          source={profileLoadingGif}
          style={msgStyles.loadingGif}
          resizeMode="contain"
        />
      </Box>
    );
  }

  const sortedConversations = [...conversations].sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

  // 交易 / 帖子 / 活动相关会话归入「交易」tab，私信只保留纯人际私聊。
  const dmConversations = sortedConversations.filter((c) => !isTradeConversation(c));
  const strangerConversations = dmConversations.filter(isStrangerConversation);
  const regularConversations = dmConversations.filter((c) => !isStrangerConversation(c));

  return (
    <>
      <FlatList
        data={regularConversations}
        keyExtractor={(item) => `conv-${item.id}`}
        renderItem={({ item }) => {
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
        }}
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
            <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.black }} mt="$md" mb="$sm">
              {t("interaction.noMessages")}
            </Text>
            <Text fontSize="$sm" style={{ color: theme.colors.gray400 }} textAlign="center">
              {t("interaction.startChatHint")}
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

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const msgStyles = StyleSheet.create({
  loadingGif: {
    width: screenWidth,
    height: screenHeight / 2,
  },
});
