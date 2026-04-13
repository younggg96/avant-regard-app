import React from "react";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { Box, Text, Pressable, HStack, VStack } from "../../../components/ui";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { NotificationBadge } from "../../../components/ui/NotificationBadge";
import { Conversation } from "../../../services/chatService";
import { CS_USER_ID, CS_DISPLAY_NAME } from "../constants";
import { formatTime, formatLastMessage } from "../utils";
import { styles } from "../styles";

const APP_LOGO = require("../../../../assets/images/logo.jpg");

interface ConversationRowProps {
  item: Conversation;
  onPress: () => void;
  onLongPress: () => void;
}

export const ConversationRow = ({ item, onPress, onLongPress }: ConversationRowProps) => {
  const other = item.otherUser;
  const hasUnread = item.unreadCount > 0;
  const isCs = other?.userId === CS_USER_ID;
  const displayName = isCs ? CS_DISPLAY_NAME : (other?.username || "未知用户");

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.row, hasUnread && styles.rowUnread]}
    >
      <HStack alignItems="center" flex={1}>
        <Box position="relative" mr="$md">
          {isCs ? (
            <ExpoImage source={APP_LOGO} style={styles.csAvatar} contentFit="cover" />
          ) : (
            <UserAvatar uri={other?.avatarUrl} name={other?.username} size={48} />
          )}
          {hasUnread && (
            <NotificationBadge count={item.unreadCount} size="md" showBorder />
          )}
        </Box>

        <VStack flex={1} mr="$sm">
          <HStack justifyContent="between" alignItems="center" mb={3}>
            <Text
              fontSize="$sm" fontWeight="$semibold" color="$black"
              flex={1} mr="$sm" numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text fontSize="$xs" color="$gray200">
              {formatTime(item.lastMessageAt)}
            </Text>
          </HStack>
          <Text
            fontSize="$sm" numberOfLines={1}
            color={hasUnread ? "$black" : "$gray300"}
            fontWeight={hasUnread ? "$medium" : "$normal"}
          >
            {formatLastMessage(item.lastMessageText)}
          </Text>
        </VStack>
      </HStack>
    </Pressable>
  );
};
