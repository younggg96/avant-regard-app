import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { NotificationBadge } from "../../../components/ui/NotificationBadge";
import { Conversation } from "../../../services/chatService";
import { formatTime, formatLastMessage } from "../utils";
import { styles } from "../styles";

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
}

export const ConversationItem = ({
  conversation,
  onPress,
}: ConversationItemProps) => {
  const { t } = useTranslation();
  const other = conversation.otherUser;
  const hasUnread = conversation.unreadCount > 0;

  return (
    <TouchableOpacity
      style={[styles.conversationItem, hasUnread && styles.unreadItem]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarWrapper}>
        <UserAvatar uri={other?.avatarUrl} name={other?.username} size={52} />
        {hasUnread && (
          <NotificationBadge count={conversation.unreadCount} size="md" showBorder />
        )}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
            <Text style={[styles.conversationName, { flex: 0, flexShrink: 1 }]} numberOfLines={1}>
              {other?.username || t("interaction.unknownUser")}
            </Text>
            {other?.primaryTitle ? (
              <View style={styles.titleBadge}>
                <Text style={styles.titleBadgeText} numberOfLines={1}>
                  {other.primaryTitle}
                </Text>
              </View>
            ) : null}
          </View>
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
          {formatLastMessage(conversation.lastMessageText)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
