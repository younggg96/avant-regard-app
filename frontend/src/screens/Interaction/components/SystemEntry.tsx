import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { theme } from "../../../theme";
import { Box, Text, Pressable, HStack, VStack } from "../../../components/ui";
import { NotificationBadge } from "../../../components/ui/NotificationBadge";
import { Notification } from "../../../services/notificationService";
import { formatTime, isChatNotification } from "../utils";
import { useInteractionStyles } from "../styles";

interface SystemEntryProps {
  notifications: Notification[];
  onPress: () => void;
}

export const SystemEntry = ({ notifications, onPress }: SystemEntryProps) => {
  const { t } = useTranslation();
  const styles = useInteractionStyles();
  const systemNotifs = notifications.filter(
    (n) => (n.type === "system" || n.type === "mention") && !isChatNotification(n)
  );
  const unreadCount = systemNotifs.filter((n) => !n.isRead).length;
  const latest = systemNotifs[0];

  if (systemNotifs.length === 0) return null;

  return (
    <Pressable onPress={onPress} style={[styles.row, unreadCount > 0 && styles.rowUnread]}>
      <HStack alignItems="center" flex={1}>
        <Box position="relative" mr="$md">
          <Box
            w={48} h={48} rounded="$full"
            justifyContent="center" alignItems="center"
            bg="$error"
          >
            <Ionicons name="notifications-outline" size={22} color={theme.colors.white} />
          </Box>
          {unreadCount > 0 && (
            <NotificationBadge count={unreadCount} size="md" showBorder />
          )}
        </Box>

        <VStack flex={1} mr="$sm">
          <HStack justifyContent="between" alignItems="center" mb={3}>
            <Text fontSize="$sm" fontWeight="$semibold" color="$black">
              {t("interaction.systemNotice")}
            </Text>
            {latest && (
              <Text fontSize="$xs" color="$gray200">
                {formatTime(latest.createdAt)}
              </Text>
            )}
          </HStack>
          <Text fontSize="$sm" color={unreadCount > 0 ? "$black" : "$gray300"} numberOfLines={1}>
            {latest ? `${latest.title} ${latest.message}` : t("interaction.noSystemMessages")}
          </Text>
        </VStack>

        <Ionicons name="chevron-forward" size={18} color={theme.colors.gray200} />
      </HStack>
    </Pressable>
  );
};
