import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { Box, Text, Pressable, HStack, VStack } from "../../../components/ui";
import { NotificationBadge } from "../../../components/ui/NotificationBadge";
import { Notification } from "../../../services/notificationService";
import { formatTime } from "../utils";
import { NOTIF_ICON_MAP } from "../constants";
import { styles } from "../styles";

interface ActivityEntryProps {
  notifications: Notification[];
  onPress: () => void;
}

export const ActivityEntry = ({ notifications, onPress }: ActivityEntryProps) => {
  const nonSystem = notifications.filter((n) => n.type !== "system" && n.type !== "mention");
  const unreadCount = nonSystem.filter((n) => !n.isRead).length;
  const latest = nonSystem[0];

  if (nonSystem.length === 0) return null;

  const latestIcon = latest
    ? NOTIF_ICON_MAP[latest.type] || { name: "ellipse", color: theme.colors.gray400 }
    : { name: "notifications", color: "#F39C12" };

  return (
    <Pressable onPress={onPress} style={[styles.row, unreadCount > 0 && styles.rowUnread]}>
      <HStack alignItems="center" flex={1}>
        <Box position="relative" mr="$md">
          <Box
            w={48} h={48} rounded="$full"
            justifyContent="center" alignItems="center"
            bg="$gray100"
          >
            <Ionicons name="chatbubbles-outline" size={22} color={theme.colors.black} />
          </Box>
          {latest && (
            <NotificationBadge
              variant="icon"
              icon={latestIcon.name as any}
              iconSize={10}
              color={latestIcon.color}
              showBorder
            />
          )}
          {unreadCount > 0 && (
            <NotificationBadge count={unreadCount} size="md" showBorder />
          )}
        </Box>

        <VStack flex={1} mr="$sm">
          <HStack justifyContent="between" alignItems="center" mb={3}>
            <Text fontSize="$sm" fontWeight="$semibold" color="$black">
              互动消息
            </Text>
            {latest && (
              <Text fontSize="$xs" color="$gray200">
                {formatTime(latest.createdAt)}
              </Text>
            )}
          </HStack>
          <Text fontSize="$sm" color={unreadCount > 0 ? "$black" : "$gray300"} numberOfLines={1}>
            {latest ? `${latest.title} ${latest.message}` : "暂无互动消息"}
          </Text>
        </VStack>

        <Ionicons name="chevron-forward" size={18} color={theme.colors.gray200} />
      </HStack>
    </Pressable>
  );
};
