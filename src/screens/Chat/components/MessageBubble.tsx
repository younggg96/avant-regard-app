import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { theme } from "../../../theme";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { OptimizedImage } from "../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../utils/imageUtils";
import { ActionSheet } from "../../../components/ui/ActionSheet";
import type { ActionSheetAction } from "../../../components/ui/ActionSheet";
import { Message } from "../../../services/chatService";
import { PostSharePayload } from "../../../components/ShareToChatModal";
import { formatMessageTime } from "../utils";
import { DateSeparator } from "./DateSeparator";
import { styles } from "../styles";

interface MessageBubbleProps {
  message: Message;
  showTime: boolean;
  isLast: boolean;
  onReportMessage?: (message: Message) => void;
  onReportUser?: (message: Message) => void;
}

function tryParsePostCard(content: string): PostSharePayload | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed.postId === "string") return parsed;
  } catch { }
  return null;
}

export const MessageBubble = ({
  message,
  showTime,
  isLast,
  onReportMessage,
  onReportUser,
}: MessageBubbleProps) => {
  const isMine = message.isMine;
  const [showMenu, setShowMenu] = useState(false);
  const navigation = useNavigation();

  const canReport = !isMine && (onReportMessage || onReportUser);

  const isPostCard = message.messageType === "post_card";
  const postCard = isPostCard ? tryParsePostCard(message.content) : null;

  const menuActions = useMemo<ActionSheetAction[]>(() => {
    const list: ActionSheetAction[] = [];
    if (onReportMessage) {
      list.push({
        label: "举报此消息",
        icon: <Ionicons name="flag-outline" size={20} color={theme.colors.error} />,
        destructive: true,
        onPress: () => onReportMessage(message),
      });
    }
    if (onReportUser) {
      list.push({
        label: "举报该用户",
        icon: <Ionicons name="person-remove-outline" size={20} color={theme.colors.error} />,
        destructive: true,
        onPress: () => onReportUser(message),
      });
    }
    return list;
  }, [message, onReportMessage, onReportUser]);

  const handlePostCardPress = () => {
    if (!postCard) return;
    (navigation.navigate as any)("PostDetail", { postId: postCard.postId });
  };

  const renderContent = () => {
    if (postCard) {
      return (
        <TouchableOpacity
          style={[
            cardStyles.container,
            isMine ? cardStyles.containerMine : cardStyles.containerOther,
          ]}
          onPress={handlePostCardPress}
          activeOpacity={0.7}
        >
          {postCard.imageUrl && (
            <OptimizedImage
              uri={postCard.imageUrl}
              size={ImageSize.MEDIUM}
              style={cardStyles.image}
              contentFit="cover"
              lazy
            />
          )}
          <View style={cardStyles.body}>
            <Text
              style={[
                cardStyles.title,
                isMine ? cardStyles.titleMine : cardStyles.titleOther,
              ]}
              numberOfLines={2}
            >
              {postCard.title || "帖子分享"}
            </Text>
            <View style={cardStyles.footer}>
              <View style={cardStyles.authorRow}>
                <UserAvatar
                  uri={postCard.authorAvatar}
                  name={postCard.authorName}
                  size={18}
                />
                <Text
                  style={[
                    cardStyles.authorName,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                  numberOfLines={1}
                >
                  {postCard.authorName}
                </Text>
              </View>
              <View style={cardStyles.tapHint}>
                <Text
                  style={[
                    cardStyles.tapHintText,
                    isMine ? cardStyles.textMuted : cardStyles.textSubtle,
                  ]}
                >
                  查看
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={isMine ? "rgba(255,255,255,0.5)" : theme.colors.gray200}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
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
    );
  };

  return (
    <View style={styles.messageWrapper}>
      {showTime && (
        <DateSeparator dateStr={formatMessageTime(message.createdAt)} />
      )}
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={canReport ? () => setShowMenu(true) : undefined}
        delayLongPress={400}
        style={[
          styles.bubbleRow,
          isMine ? styles.bubbleRowRight : styles.bubbleRowLeft,
        ]}
      >
        {!isMine && (
          <View style={styles.senderAvatarContainer}>
            <UserAvatar
              uri={message.senderAvatar}
              name={message.senderName}
              size={36}
            />
          </View>
        )}

        <View style={isMine ? styles.bubbleGroupRight : styles.bubbleGroupLeft}>
          {!isMine && message.senderTitle ? (
            <View style={titleStyles.badge}>
              <Text style={titleStyles.badgeText}>{message.senderTitle}</Text>
            </View>
          ) : null}
          {renderContent()}
        </View>
      </TouchableOpacity>

      <ActionSheet
        visible={showMenu}
        actions={menuActions}
        onClose={() => setShowMenu(false)}
      />
    </View>
  );
};

const titleStyles = StyleSheet.create({
  badge: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "500",
    color: theme.colors.gray600,
  },
});

const cardStyles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
    width: 220,
  },
  containerMine: {
    backgroundColor: theme.colors.black,
  },
  containerOther: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  image: {
    width: "100%",
    height: 140,
    backgroundColor: theme.colors.gray100,
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  titleMine: {
    color: theme.colors.white,
  },
  titleOther: {
    color: theme.colors.black,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  authorName: {
    fontSize: 12,
    flex: 1,
  },
  textMuted: {
    color: "rgba(255,255,255,0.55)",
  },
  textSubtle: {
    color: theme.colors.gray200,
  },
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  tapHintText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
