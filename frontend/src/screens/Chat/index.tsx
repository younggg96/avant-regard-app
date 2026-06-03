import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import {
  View,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme, useAppTheme } from "../../theme";
import { Box, Text } from "../../components/ui";
import { useChatStore } from "../../store/chatStore";
import { useNotificationStore } from "../../store/notificationStore";
import { useAuthStore } from "../../store/authStore";
import { Message, chatWS, sendMessageREST } from "../../services/chatService";
import { getUserType } from "../../services/userInfoService";
import { ChatRouteParams } from "./types";
import { shouldShowTimestamp } from "./utils";
import { ChatHeader } from "./components/ChatHeader";
import { MessageBubble } from "./components/MessageBubble";
import { ChatReportModal } from "./components/ChatReportModal";
import { MessageInput } from "./components/MessageInput";
import { SharePickerSheet, ShareCategory } from "./components/SharePickerSheet";
import {
  ShareContentPickerModal,
  SharePayload,
} from "./components/ShareContentPickerModal";
import { isCustomerServiceUser } from "../../constants/customerService";
import { ShippingAddressModal } from "../../components/trading/ShippingAddressModal";
import { useChatStyles } from "./styles";

type ReportTarget =
  | { type: "MESSAGE"; messageId: number; senderId: number }
  | { type: "USER"; userId: number };

const ChatScreen = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ChatRouteParams, "Chat">>();
  const styles = useChatStyles();
  const {
    conversationId,
    otherUserName: routeOtherUserName = t("chat.title"),
    otherUserAvatar,
    otherUserId,
    openShippingForOrderId,
    shippingProductTitle,
    shippingCoverImage,
  } = route.params;

  const [shippingModalVisible, setShippingModalVisible] = useState(false);

  // offer 成交后从顶部「填写收货地址」提示进入时, 自动弹出地址表单。
  useEffect(() => {
    if (openShippingForOrderId != null) {
      setShippingModalVisible(true);
    }
  }, [openShippingForOrderId]);

  const isCsChat = isCustomerServiceUser(otherUserId);
  const otherUserName = isCsChat
    ? t("interaction.csDisplayName")
    : routeOtherUserName;

  const {
    messages,
    hasMoreMessages,
    isLoadingMessages,
    loadMessages,
    setCurrentConversation,
    markConversationRead,
    connectWebSocket,
    refreshBlockedUsers,
    conversations,
    deleteMessage,
  } = useChatStore();

  const markChatNotificationsRead = useNotificationStore(
    (s) => s.markChatNotificationsRead
  );

  const flatListRef = useRef<FlatList>(null);
  const [inputText, setInputText] = useState("");
  const [isWriting, setIsWriting] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [otherIsAdmin, setOtherIsAdmin] = useState(false);
  const [sharePickerOpen, setSharePickerOpen] = useState(false);
  const [shareCategory, setShareCategory] = useState<ShareCategory | null>(null);
  const inputRef = useRef<TextInput>(null);
  const currentUser = useAuthStore((s) => s.user);

  const conversationMessages = messages[conversationId] || [];

  const resolvedOtherUserAvatar = useMemo(() => {
    if (otherUserAvatar) return otherUserAvatar;
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv?.otherUser?.avatarUrl) return conv.otherUser.avatarUrl;
    const peerMessage = conversationMessages.find(
      (m) => !m.isMine && m.senderAvatar,
    );
    return peerMessage?.senderAvatar ?? undefined;
  }, [otherUserAvatar, conversations, conversationId, conversationMessages]);

  // 把消息按时间倒序铺给 FlatList(inverted)。
  //
  // 顺便对 ``order_status`` 卡做一次去重:相同 (orderId, status) 只保留时间
  // 上最靠后的那一条。新后端按状态固定方向已经做到 1 张/状态,但历史会话
  // 里仍可能有早期"双向发卡"留下的两张同状态卡片(典型现象:同一订单连续
  // 两张"Awaiting shipment"卡)。在渲染前做一次轻量级 client-side dedupe,
  // 让历史会话也立刻干净。
  const reversedMessages = useMemo(() => {
    const reversed = [...conversationMessages].reverse();
    const seenOrderStatus = new Set<string>();
    return reversed.filter((m) => {
      if (m.messageType !== "order_status") return true;
      try {
        const parsed = JSON.parse(m.content);
        const orderId = parsed?.orderId;
        const status = parsed?.status;
        if (typeof orderId !== "number" || typeof status !== "string") {
          return true;
        }
        const key = `${orderId}:${status}`;
        if (seenOrderStatus.has(key)) return false;
        seenOrderStatus.add(key);
        return true;
      } catch {
        return true;
      }
    });
  }, [conversationMessages]);

  const otherHasReplied = useMemo(
    () => conversationMessages.some((m) => !m.isMine),
    [conversationMessages]
  );

  const myMessageCount = useMemo(
    () => conversationMessages.filter((m) => m.isMine).length,
    [conversationMessages]
  );

  const isAdmin = currentUser?.is_admin === true;
  const skipRestriction = isAdmin || otherIsAdmin;

  const sendRestricted = !skipRestriction && !otherHasReplied && myMessageCount >= 1;
  const showFirstMsgHint = !skipRestriction && !otherHasReplied;

  useEffect(() => {
    setCurrentConversation(conversationId);
    connectWebSocket();
    loadMessages(conversationId);
    markConversationRead(conversationId);
    // 把「XX 发来了一条消息」这类通知一并标已读，避免打开聊天后互动页
    // 入口上的红点还挂着。不阻塞主流程（store 层已做乐观更新）。
    markChatNotificationsRead(conversationId);

    return () => {
      setCurrentConversation(null);
    };
  }, [conversationId]);

  useEffect(() => {
    if (!currentUser?.userId || !otherUserId) return;
    getUserType(otherUserId)
      .then((res) => setOtherIsAdmin(res.isAdmin))
      .catch(() => {});
  }, [currentUser?.userId, otherUserId]);

  const sendPayload = useCallback(
    (content: string, messageType: string) => {
      if (chatWS.isConnected) {
        chatWS.sendMessage(conversationId, content, messageType);
      } else {
        sendMessageREST(conversationId, content, messageType).catch((e: Error) =>
          console.error("Failed to send message:", e)
        );
      }
    },
    [conversationId]
  );

  const handleSend = useCallback(() => {
    if (sendRestricted) return;
    const text = inputText.trim();
    if (!text) return;

    setInputText("");
    sendPayload(text, "text");
  }, [inputText, sendRestricted, sendPayload]);

  /**
   * Exit the composing state without sending.
   * Called by:
   *   - the tap-outside overlay that covers the message list while writing
   *   - the `+` toggle button (which swaps writing mode for the share picker)
   *   - the onSend callback (after the message leaves)
   *
   * Keeping a single helper avoids drift between the two call sites (DRY) and
   * makes the "what does cancel mean" contract explicit.
   */
  const exitWriting = useCallback(() => {
    setIsWriting(false);
    setInputText("");
    inputRef.current?.blur();
  }, []);

  const handleToggleSharePicker = useCallback(() => {
    if (isWriting) {
      exitWriting();
    }
    setSharePickerOpen((prev) => !prev);
  }, [isWriting, exitWriting]);

  const handleSelectShareCategory = useCallback((cat: ShareCategory) => {
    setShareCategory(cat);
  }, []);

  const handleCloseShareContent = useCallback(() => {
    setShareCategory(null);
  }, []);

  const handleShareSelected = useCallback(
    (result: SharePayload) => {
      if (sendRestricted) return;
      sendPayload(JSON.stringify(result.payload), result.messageType);
      setShareCategory(null);
      setSharePickerOpen(false);
    },
    [sendPayload, sendRestricted]
  );

  const canLoadMore = hasMoreMessages[conversationId] !== false;

  const handleLoadMore = useCallback(() => {
    if (isLoadingMessages || !canLoadMore || conversationMessages.length === 0) return;
    const oldest = conversationMessages[0];
    if (oldest) {
      loadMessages(conversationId, oldest.id);
    }
  }, [conversationId, conversationMessages, isLoadingMessages, canLoadMore]);

  const handleBlocked = useCallback(() => {
    refreshBlockedUsers();
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation, refreshBlockedUsers]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const navigateToProfile = useCallback(() => {
    if (otherUserId && !isCsChat) {
      (navigation.navigate as any)("UserProfile", { userId: otherUserId });
    }
  }, [navigation, otherUserId, isCsChat]);

  const handleReportMessage = useCallback((msg: Message) => {
    setReportTarget({ type: "MESSAGE", messageId: msg.id, senderId: msg.senderId });
    setShowReport(true);
  }, []);

  const handleReportUser = useCallback((msg: Message) => {
    setReportTarget({ type: "USER", userId: msg.senderId });
    setShowReport(true);
  }, []);

  const handleDeleteMessage = useCallback(
    (msg: Message) => {
      Alert.alert(
        t("chat.deleteMessage"),
        t("chat.deleteMessageConfirm"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => {
              deleteMessage(conversationId, msg.id).catch(() => {});
            },
          },
        ]
      );
    },
    [conversationId, deleteMessage, t]
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const prev =
        index < reversedMessages.length - 1
          ? reversedMessages[index + 1]
          : undefined;
      const isLast = index === 0;
      return (
        <MessageBubble
          message={item}
          showTime={shouldShowTimestamp(item, prev)}
          isLast={isLast}
          otherUserId={otherUserId}
          onReportMessage={handleReportMessage}
          onReportUser={handleReportUser}
          onDeleteMessage={handleDeleteMessage}
        />
      );
    },
    [reversedMessages, otherUserId, handleReportMessage, handleReportUser, handleDeleteMessage]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ChatHeader
        name={otherUserName}
        avatar={resolvedOtherUserAvatar}
        otherUserId={otherUserId}
        onBack={handleBack}
        onProfile={navigateToProfile}
        onBlocked={handleBlocked}
      />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.flex1}>
          <FlatList
          ref={flatListRef}
          data={reversedMessages}
          inverted
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            showFirstMsgHint ? (
              <View style={styles.restrictionBanner}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={theme.colors.gray300}
                />
                <Text style={styles.restrictionBannerText}>
                  {sendRestricted
                    ? t("chat.sendRestricted")
                    : t("chat.firstMessageHint")}
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            isLoadingMessages && canLoadMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={theme.colors.gray300} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !isLoadingMessages ? (
              <View style={styles.emptyChat}>
                <Box
                  w={64}
                  h={64}
                  rounded="$full"
                  style={{ backgroundColor: theme.colors.gray100 }}
                  justifyContent="center"
                  alignItems="center"
                  mb="$md"
                >
                  <Ionicons
                    name="chatbubbles-outline"
                    size={28}
                    color={theme.colors.gray200}
                  />
                </Box>
                <Text style={styles.emptyChatText}>
                  {t("chat.emptyHint")}
                </Text>
              </View>
            ) : null
          }
          />
          {isWriting && (
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={exitWriting}
              accessibilityLabel={t('chat.exitInput')}
            />
          )}
        </View>

        <MessageInput
          inputText={inputText}
          isWriting={isWriting}
          inputRef={inputRef as React.RefObject<TextInput>}
          disabled={sendRestricted}
          sharePickerOpen={sharePickerOpen}
          onChangeText={setInputText}
          onStartWriting={() => {
            setIsWriting(true);
            setSharePickerOpen(false);
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
          onSend={() => {
            handleSend();
            setIsWriting(false);
          }}
          onToggleSharePicker={handleToggleSharePicker}
        />

        <SharePickerSheet
          visible={sharePickerOpen && !sendRestricted}
          otherIsAdmin={otherIsAdmin}
          onSelect={handleSelectShareCategory}
        />
      </KeyboardAvoidingView>

      <ShareContentPickerModal
        visible={shareCategory !== null}
        category={shareCategory}
        onClose={handleCloseShareContent}
        onSelect={handleShareSelected}
      />

      <ChatReportModal
        visible={showReport}
        target={reportTarget}
        onClose={() => {
          setShowReport(false);
          setReportTarget(null);
        }}
      />

      {openShippingForOrderId != null ? (
        <ShippingAddressModal
          visible={shippingModalVisible}
          orderId={openShippingForOrderId}
          productTitle={shippingProductTitle}
          coverImage={shippingCoverImage}
          onClose={() => setShippingModalVisible(false)}
        />
      ) : null}
    </SafeAreaView>
  );
};

export default ChatScreen;
