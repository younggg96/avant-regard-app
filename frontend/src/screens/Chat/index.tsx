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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import { Box, Text } from "../../components/ui";
import { useChatStore } from "../../store/chatStore";
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
import { styles } from "./styles";

type ReportTarget =
  | { type: "MESSAGE"; messageId: number; senderId: number }
  | { type: "USER"; userId: number };

const ChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ChatRouteParams, "Chat">>();
  const {
    conversationId,
    otherUserName = "聊天",
    otherUserAvatar,
    otherUserId,
  } = route.params;

  const {
    messages,
    hasMoreMessages,
    isLoadingMessages,
    loadMessages,
    setCurrentConversation,
    markConversationRead,
    connectWebSocket,
    refreshBlockedUsers,
  } = useChatStore();

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

  const reversedMessages = useMemo(
    () => [...conversationMessages].reverse(),
    [conversationMessages]
  );

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
    if (otherUserId) {
      (navigation.navigate as any)("UserProfile", { userId: otherUserId });
    }
  }, [navigation, otherUserId]);

  const handleReportMessage = useCallback((msg: Message) => {
    setReportTarget({ type: "MESSAGE", messageId: msg.id, senderId: msg.senderId });
    setShowReport(true);
  }, []);

  const handleReportUser = useCallback((msg: Message) => {
    setReportTarget({ type: "USER", userId: msg.senderId });
    setShowReport(true);
  }, []);

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
          onReportMessage={handleReportMessage}
          onReportUser={handleReportUser}
        />
      );
    },
    [reversedMessages, handleReportMessage, handleReportUser]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ChatHeader
        name={otherUserName}
        avatar={otherUserAvatar}
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
                    ? "已发送一条消息，等待对方回复后才能继续发送"
                    : "对方还未回复前，仅可发送一条消息"}
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
                  bg="$gray100"
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
                  发送消息开始聊天吧
                </Text>
              </View>
            ) : null
          }
          />
          {isWriting && (
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={exitWriting}
              accessibilityLabel="退出输入"
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
    </SafeAreaView>
  );
};

export default ChatScreen;
