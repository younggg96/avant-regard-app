import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { UserAvatar } from "./ui/UserAvatar";
import { OptimizedImage } from "./ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import {
  Conversation,
  getConversations,
  createConversation,
  sendMessageREST,
  chatWS,
} from "../services/chatService";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";
import { Post } from "./PostCard";

export interface PostSharePayload {
  postId: string;
  title: string;
  imageUrl?: string;
  authorName: string;
  authorAvatar?: string;
}

interface ShareToChatModalProps {
  visible: boolean;
  post: Post | null;
  onClose: () => void;
  onShareComplete?: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export function buildPostSharePayload(post: Post): PostSharePayload {
  return {
    postId: post.id,
    title: post.content?.title || post.title || "",
    imageUrl: post.content?.images?.[0] || post.image,
    authorName: post.author.name,
    authorAvatar: post.author.avatar,
  };
}

export const ShareToChatModal: React.FC<ShareToChatModalProps> = ({
  visible,
  post,
  onClose,
  onShareComplete,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const currentUser = useAuthStore((s) => s.user);
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      setSentIds(new Set());
      fetchConversations();
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const data = await getConversations();
      setConversations(data);
    } catch {
      console.error("Failed to load conversations for share");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = useCallback(
    async (conversation: Conversation) => {
      if (!post || sending !== null) return;

      const other = conversation.otherUser;
      if (!other) return;

      setSending(conversation.id);
      try {
        const payload = buildPostSharePayload(post);
        const content = JSON.stringify(payload);

        if (chatWS.isConnected) {
          chatWS.sendMessage(conversation.id, content, "post_card");
        } else {
          await sendMessageREST(conversation.id, content, "post_card");
        }

        setSentIds((prev) => new Set(prev).add(conversation.id));
        onShareComplete?.();
      } catch {
        Alert.show("分享失败，请稍后重试");
      } finally {
        setSending(null);
      }
    },
    [post, sending, onShareComplete]
  );

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const other = item.otherUser;
      if (!other) return null;

      const isSent = sentIds.has(item.id);
      const isSending = sending === item.id;

      return (
        <TouchableOpacity
          style={s.conversationRow}
          onPress={() => handleSend(item)}
          disabled={isSent || isSending}
          activeOpacity={0.6}
        >
          <UserAvatar
            uri={other.avatarUrl}
            name={other.username}
            size={44}
          />
          <Text style={s.username} numberOfLines={1}>
            {other.username}
          </Text>
          {isSending ? (
            <ActivityIndicator size="small" color={theme.colors.black} />
          ) : isSent ? (
            <View style={s.sentBadge}>
              <Ionicons name="checkmark" size={14} color={theme.colors.white} />
              <Text style={s.sentText}>已发送</Text>
            </View>
          ) : (
            <View style={s.sendBtn}>
              <Text style={s.sendBtnText}>发送</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [handleSend, sending, sentIds]
  );

  if (!post) return null;

  const payload = buildPostSharePayload(post);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[s.container, { transform: [{ translateY: slideAnim }] }]}
      >
        <View style={s.handleContainer}>
          <View style={s.handle} />
        </View>

        <Text style={s.title}>分享给</Text>

        {/* Post preview card */}
        <View style={s.previewCard}>
          {payload.imageUrl && (
            <OptimizedImage
              uri={payload.imageUrl}
              size={ImageSize.THUMBNAIL}
              style={s.previewImage}
              contentFit="cover"
              lazy
            />
          )}
          <View style={s.previewInfo}>
            <Text style={s.previewTitle} numberOfLines={2}>
              {payload.title || "分享帖子"}
            </Text>
            <Text style={s.previewAuthor} numberOfLines={1}>
              @{payload.authorName}
            </Text>
          </View>
        </View>

        {/* Conversations list */}
        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.gray300} />
          </View>
        ) : conversations.length === 0 ? (
          <View style={s.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={32}
              color={theme.colors.gray200}
            />
            <Text style={s.emptyText}>暂无聊天对象</Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            style={s.list}
            showsVerticalScrollIndicator={false}
          />
        )}

        <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
          <Text style={s.cancelText}>取消</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 34,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: theme.colors.gray200,
    borderRadius: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.colors.black,
    textAlign: "center",
    marginBottom: 12,
  },
  previewCard: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 10,
    backgroundColor: theme.colors.gray50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    gap: 10,
  },
  previewImage: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: theme.colors.gray100,
  },
  previewInfo: {
    flex: 1,
    justifyContent: "center",
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.black,
    lineHeight: 18,
  },
  previewAuthor: {
    fontSize: 12,
    color: theme.colors.gray300,
    marginTop: 2,
  },
  list: {
    maxHeight: 320,
    paddingHorizontal: 16,
  },
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  username: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.black,
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: theme.colors.black,
    borderRadius: 16,
  },
  sendBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.white,
  },
  sentBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.gray200,
    borderRadius: 16,
    gap: 4,
  },
  sentText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.white,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.gray300,
  },
  cancelBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  cancelText: {
    fontSize: 16,
    color: theme.colors.gray300,
  },
});

export default ShareToChatModal;
