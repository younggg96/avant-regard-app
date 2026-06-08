import React, { useState, useCallback } from "react";
import {
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image as RNImage,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../../../theme";
import { Box, Text, ActionSheet } from "../../../components/ui";
import type { ActionSheetAction } from "../../../components/ui";
import { useProfileLoadingGif } from "../../../utils/loadingGifs";
import { useNotificationStore } from "../../../store/notificationStore";
import { useChatStore } from "../../../store/chatStore";
import { TradingCategory } from "../../../services/notificationService";
import { Conversation, isTradeConversation } from "../../../services/chatService";
import { getConversationChatParams } from "../../../utils/chatNavigationUtils";
import { TRADING_CATEGORY_META } from "../constants";
import { TradingCategoryEntry } from "./TradingCategoryEntry";
import { TradingConversationRow } from "./TradingConversationRow";

/**
 * 互动页「交易」tab 内容：
 *   1) 顶部三个分类入口（物流 / 售后 / 心动）——聚合交易相关「通知」；
 *   2) 下方交易相关「会话」列表——所有含订单 / 出价 / 售后 / 商品 / 分享卡片的
 *      会话都归在这里，行内直接展示商品封面图 + 买家 / 订单状态标识。
 */
export const TradingContent = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const profileLoadingGif = useProfileLoadingGif();

  const notifications = useNotificationStore((s) => s.notifications);
  const loadNotifications = useNotificationStore((s) => s.loadNotifications);
  const isNotificationsLoaded = useNotificationStore((s) => s.isInitialLoaded);

  const {
    conversations,
    loadConversations,
    removeConversation,
    toggleConversationRead,
    deletingConversationIds,
    isConversationsInitialLoaded,
  } = useChatStore();

  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetTitle, setSheetTitle] = useState("");
  const [sheetActions, setSheetActions] = useState<ActionSheetAction[]>([]);

  const isInitialLoaded = isNotificationsLoaded && isConversationsInitialLoaded;

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
      loadConversations();
    }, [loadNotifications, loadConversations])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadNotifications(), loadConversations()]);
    setRefreshing(false);
  }, [loadNotifications, loadConversations]);

  const byCategory = useCallback(
    (category: TradingCategory) =>
      notifications.filter((n) => n.category === category),
    [notifications]
  );

  const goToCategory = useCallback(
    (category: TradingCategory) => {
      (navigation.navigate as any)("Activity", { tradingCategory: category });
    },
    [navigation]
  );

  const handleConvPress = useCallback(
    (c: Conversation) => {
      (navigation.navigate as any)("Chat", getConversationChatParams(c, t));
    },
    [navigation, t]
  );

  const handleLongPress = useCallback(
    (c: Conversation) => {
      const readLabel =
        c.unreadCount > 0 ? t("interaction.markRead") : t("interaction.markUnread");
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
            Alert.alert(
              t("interaction.confirmDelete"),
              t("interaction.deleteWarning"),
              [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("common.delete"),
                  style: "destructive",
                  onPress: () => removeConversation(c.id),
                },
              ]
            );
          },
        },
      ]);
      setSheetVisible(true);
    },
    [t, toggleConversationRead, removeConversation]
  );

  const tradeConversations = [...conversations]
    .filter(isTradeConversation)
    .sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });

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

  return (
    <>
      <FlatList
        data={tradeConversations}
        keyExtractor={(item) => `trade-conv-${item.id}`}
        renderItem={({ item }) => {
          const itemDeleting = deletingConversationIds.has(item.id);
          return (
            <Box opacity={itemDeleting ? 0.5 : 1} position="relative">
              <TradingConversationRow
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
            {TRADING_CATEGORY_META.map((meta) => (
              <TradingCategoryEntry
                key={meta.id}
                notifications={byCategory(meta.id)}
                label={t(meta.labelKey)}
                emptyText={t(meta.emptyKey)}
                icon={meta.icon}
                color={meta.color}
                onPress={() => goToCategory(meta.id)}
              />
            ))}
            {tradeConversations.length > 0 && (
              <Box px="$md" pt="$md" pb="$sm">
                <Text
                  fontSize="$xs"
                  fontWeight="$semibold"
                  style={{ color: theme.colors.gray400 }}
                >
                  {t("interaction.tradeConversations")}
                </Text>
              </Box>
            )}
          </>
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
