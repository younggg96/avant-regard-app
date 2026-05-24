import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { theme, useAppTheme } from "../../../theme";
import { Box, Text, Pressable, HStack, VStack } from "../../../components/ui";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { CustomerServiceAvatar } from "../../../components/ui/CustomerServiceAvatar";
import { NotificationBadge } from "../../../components/ui/NotificationBadge";
import { Conversation } from "../../../services/chatService";
import { isCustomerServiceUser } from "../../../constants/customerService";
import { formatTime, formatLastMessage } from "../utils";
import { useInteractionStyles } from "../styles";

interface ConversationRowProps {
  item: Conversation;
  onPress: () => void;
  onLongPress: () => void;
}

export const ConversationRow = ({ item, onPress, onLongPress }: ConversationRowProps) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const styles = useInteractionStyles();
  const other = item.otherUser;
  const hasUnread = item.unreadCount > 0;
  const isCs = isCustomerServiceUser(other?.userId);
  const displayName = isCs
    ? t("interaction.csDisplayName")
    : (other?.username || t("interaction.unknownUser"));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.row, hasUnread && styles.rowUnread]}
    >
      <HStack alignItems="center" flex={1}>
        <Box position="relative" mr="$md">
          {isCs ? (
            <CustomerServiceAvatar size={48} />
          ) : (
            <UserAvatar uri={other?.avatarUrl} name={other?.username} size={48} />
          )}
          {hasUnread && (
            <NotificationBadge count={item.unreadCount} size="md" showBorder />
          )}
        </Box>

        <VStack flex={1} mr="$sm">
          <HStack justifyContent="between" alignItems="center" mb={3}>
            <HStack alignItems="center" flex={1} mr="$sm">
              <Text
                fontSize="$sm" fontWeight="$semibold" style={{ color: theme.colors.black }}
                numberOfLines={1} flexShrink={1}
              >
                {displayName}
              </Text>
              {!isCs && other?.primaryTitle ? (
                <Box style={{ backgroundColor: theme.colors.gray100 }} px="$xs" py={1} rounded="$xs" ml={4} flexShrink={0}>
                  <Text style={{ color: theme.colors.gray600 }} fontSize={9} fontWeight="$medium" numberOfLines={1}>
                    {other.primaryTitle}
                  </Text>
                </Box>
              ) : null}
            </HStack>
            <Text fontSize="$xs" style={{ color: theme.colors.gray200 }} flexShrink={0}>
              {formatTime(item.lastMessageAt)}
            </Text>
          </HStack>
          <Text
            fontSize="$sm" numberOfLines={1}
            style={{ color: hasUnread ? theme.colors.black : theme.colors.gray300 }}
            fontWeight={hasUnread ? "$medium" : "$normal"}
          >
            {formatLastMessage(item.lastMessageText)}
          </Text>
        </VStack>
      </HStack>
    </Pressable>
  );
};
