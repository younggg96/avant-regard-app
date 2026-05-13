import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { theme } from "../../../theme";
import { Box, Text, Pressable, HStack, VStack } from "../../../components/ui";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { NotificationBadge } from "../../../components/ui/NotificationBadge";
import { Conversation } from "../../../services/chatService";
import { formatTime, formatLastMessage } from "../utils";
import { useInteractionStyles } from "../styles";

interface StrangerEntryProps {
  conversations: Conversation[];
  onPress: () => void;
}

export const StrangerEntry = ({ conversations, onPress }: StrangerEntryProps) => {
  const { t } = useTranslation();
  const styles = useInteractionStyles();
  if (conversations.length === 0) return null;

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const latest = conversations[0];
  const latestName = latest?.otherUser?.username || t("interaction.unknownUser");

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, totalUnread > 0 && styles.rowUnread]}
    >
      <HStack alignItems="center" flex={1}>
        <Box position="relative" mr="$md">
          <Box
            w={48}
            h={48}
            rounded="$full"
            justifyContent="center"
            alignItems="center"
            bg="$gray100"
          >
            <Ionicons
              name="person-outline"
              size={22}
              color={theme.colors.gray400}
            />
          </Box>
          {totalUnread > 0 && (
            <NotificationBadge count={totalUnread} size="md" showBorder />
          )}
        </Box>

        <VStack flex={1} mr="$sm">
          <HStack justifyContent="between" alignItems="center" mb={3}>
            <Text fontSize="$sm" fontWeight="$semibold" color="$black">
              {t("strangerMessages.title")}
            </Text>
            {latest && (
              <Text fontSize="$xs" color="$gray200">
                {formatTime(latest.lastMessageAt)}
              </Text>
            )}
          </HStack>
          <Text
            fontSize="$sm"
            color={totalUnread > 0 ? "$black" : "$gray300"}
            numberOfLines={1}
          >
            {latest
              ? `${latestName}: ${formatLastMessage(latest.lastMessageText) || t("interaction.sentMessage")}`
              : t("strangerMessages.empty")}
          </Text>
        </VStack>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.colors.gray200}
        />
      </HStack>
    </Pressable>
  );
};
