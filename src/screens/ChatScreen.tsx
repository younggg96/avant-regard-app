import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { Box, Text, Pressable, HStack, VStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { Message, chatWS } from "../services/chatService";

type ChatRouteParams = {
  Chat: {
    conversationId: number;
    otherUserName?: string;
    otherUserAvatar?: string;
    otherUserId?: number;
  };
};

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  if (isToday) return `${h}:${m}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${h}:${m}`;

  return `${d.getMonth() + 1}/${d.getDate()} ${h}:${m}`;
}

function shouldShowTimestamp(
  current: Message,
  previous: Message | undefined
): boolean {
  if (!previous) return true;
  const diff =
    new Date(current.createdAt).getTime() -
    new Date(previous.createdAt).getTime();
  return diff > 5 * 60 * 1000;
}

const DateSeparator = ({ dateStr }: { dateStr: string }) => (
  <HStack justifyContent="center" py="$sm" my="$xs">
    <Box px="$md" py="$xs" rounded="$full" bg="$gray100">
      <Text fontSize="$xs" color="$gray300">
        {dateStr}
      </Text>
    </Box>
  </HStack>
);

const ChatHeader = ({
  name,
  avatar,
  onBack,
  onProfile,
}: {
  name: string;
  avatar?: string;
  onBack: () => void;
  onProfile: () => void;
}) => (
  <Box bg="$white" px="$md" py="$sm" borderBottomWidth={1} borderBottomColor="$gray100">
    <HStack alignItems="center" space="sm">
      <Pressable
        w={40}
        h={40}
        justifyContent="center"
        alignItems="center"
        onPress={onBack}
      >
        <Ionicons name="arrow-back" size={22} color={theme.colors.black} />
      </Pressable>

      <Pressable onPress={onProfile} style={styles.headerUserInfo}>
        <HStack alignItems="center" space="sm">
          {avatar ? (
            <OptimizedImage
              uri={avatar}
              size={ImageSize.THUMBNAIL}
              style={styles.headerAvatar}
              contentFit="cover"
            />
          ) : (
            <Box style={styles.headerAvatarPlaceholder}>
              <Ionicons name="person" size={18} color={theme.colors.gray200} />
            </Box>
          )}
          <VStack>
            <Text fontWeight="$semibold" fontSize="$md" color="$black" numberOfLines={1}>
              {name}
            </Text>
          </VStack>
        </HStack>
      </Pressable>
    </HStack>
  </Box>
);

const MessageBubble = ({
  message,
  showTime,
  isLast,
}: {
  message: Message;
  showTime: boolean;
  isLast: boolean;
}) => {
  const isMine = message.isMine;

  return (
    <View style={styles.messageWrapper}>
      {showTime && (
        <DateSeparator dateStr={formatMessageTime(message.createdAt)} />
      )}
      <View
        style={[
          styles.bubbleRow,
          isMine ? styles.bubbleRowRight : styles.bubbleRowLeft,
        ]}
      >
        {!isMine && (
          <View style={styles.senderAvatarContainer}>
            {message.senderAvatar ? (
              <OptimizedImage
                uri={message.senderAvatar}
                size={ImageSize.THUMBNAIL}
                style={styles.senderAvatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.senderAvatarPlaceholder}>
                <Ionicons
                  name="person"
                  size={14}
                  color={theme.colors.gray200}
                />
              </View>
            )}
          </View>
        )}

        <View style={isMine ? styles.bubbleGroupRight : styles.bubbleGroupLeft}>
          <View
            style={[
              styles.bubble,
              isMine ? styles.bubbleMine : styles.bubbleOther,
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                isMine ? styles.bubbleTextMine : styles.bubbleTextOther,
              ]}
            >
              {message.content}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

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
    isLoadingMessages,
    loadMessages,
    setCurrentConversation,
    markConversationRead,
    connectWebSocket,
  } = useChatStore();

  const flatListRef = useRef<FlatList>(null);
  const [inputText, setInputText] = useState("");
  const [isWriting, setIsWriting] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const currentUser = useAuthStore((s) => s.user);

  const conversationMessages = messages[conversationId] || [];

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
    if (conversationMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [conversationMessages.length]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;

    setInputText("");

    if (chatWS.isConnected) {
      chatWS.sendMessage(conversationId, text);
    } else {
      const { sendMessageREST } = require("../services/chatService");
      sendMessageREST(conversationId, text).catch((e: Error) =>
        console.error("Failed to send message:", e)
      );
    }
  }, [inputText, conversationId]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMessages || conversationMessages.length === 0) return;
    const oldest = conversationMessages[0];
    if (oldest) {
      loadMessages(conversationId, oldest.id);
    }
  }, [conversationId, conversationMessages, isLoadingMessages]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const navigateToProfile = useCallback(() => {
    if (otherUserId) {
      (navigation.navigate as any)("UserProfile", { userId: otherUserId });
    }
  }, [navigation, otherUserId]);

  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const prev = index > 0 ? conversationMessages[index - 1] : undefined;
      const isLast = index === conversationMessages.length - 1;
      return (
        <MessageBubble
          message={item}
          showTime={shouldShowTimestamp(item, prev)}
          isLast={isLast}
        />
      );
    },
    [conversationMessages]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ChatHeader
        name={otherUserName}
        avatar={otherUserAvatar}
        onBack={handleBack}
        onProfile={navigateToProfile}
      />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={conversationMessages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onStartReached={handleLoadMore}
          onStartReachedThreshold={0.5}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
          }}
          ListHeaderComponent={
            isLoadingMessages ? (
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

        <View style={styles.inputContainer}>
          {!isWriting ? (
            <TouchableOpacity
              style={styles.writeMessageButton}
              onPress={() => {
                setIsWriting(true);
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.writeMessagePlaceholder}>输入消息...</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.writeMessageExpanded}>
              <TextInput
                ref={inputRef}
                style={styles.expandedTextInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="输入消息..."
                placeholderTextColor={theme.colors.gray200}
                multiline
                maxLength={5000}
                autoFocus
              />
              <View style={styles.inputActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsWriting(false);
                    setInputText("");
                  }}
                >
                  <Text style={styles.cancelButtonText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    !inputText.trim() && styles.sendButtonDisabled,
                  ]}
                  onPress={() => {
                    handleSend();
                    setIsWriting(false);
                  }}
                  disabled={!inputText.trim()}
                >
                  <Text
                    style={[
                      styles.sendButtonText,
                      !inputText.trim() && styles.sendButtonTextDisabled,
                    ]}
                  >
                    发送
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  flex1: {
    flex: 1,
  },
  headerUserInfo: {
    flex: 1,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  headerAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.gray100,
    justifyContent: "center",
    alignItems: "center",
  },
  messageList: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    flexGrow: 1,
  },
  loadingMore: {
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  emptyChat: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: theme.spacing.xxl * 2,
  },
  emptyChatText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray200,
  },
  messageWrapper: {
    marginBottom: 6,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 2,
  },
  bubbleRowLeft: {
    justifyContent: "flex-start",
  },
  bubbleRowRight: {
    justifyContent: "flex-end",
  },
  bubbleGroupLeft: {
    maxWidth: "75%",
  },
  bubbleGroupRight: {
    maxWidth: "75%",
    alignItems: "flex-end",
  },
  senderAvatarContainer: {
    marginRight: 10,
    marginBottom: 2,
  },
  senderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  senderAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.gray100,
    justifyContent: "center",
    alignItems: "center",
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleMine: {
    backgroundColor: theme.colors.black,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: theme.colors.gray50,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    ...theme.typography.bodySmall,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: theme.colors.white,
  },
  bubbleTextOther: {
    color: theme.colors.black,
  },
  deliveredText: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.gray200,
    marginTop: 3,
    marginRight: 2,
  },
  inputContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    backgroundColor: theme.colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.gray100,
  },
  writeMessageButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  writeMessagePlaceholder: {
    ...theme.typography.body,
    color: theme.colors.gray300,
    marginLeft: 8,
    flex: 1,
  },
  writeMessageExpanded: {
    backgroundColor: theme.colors.gray50,
    padding: 16,
    borderRadius: 12,
  },
  expandedTextInput: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    textAlignVertical: "top",
    minHeight: 80,
    marginBottom: 12,
  },
  inputActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.gray100,
  },
  cancelButtonText: {
    ...theme.typography.bodySmall,
    fontWeight: "500",
    color: theme.colors.gray400,
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.black,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.gray100,
  },
  sendButtonText: {
    ...theme.typography.bodySmall,
    fontWeight: "500",
    color: theme.colors.white,
  },
  sendButtonTextDisabled: {
    color: theme.colors.gray200,
  },
});

export default ChatScreen;
