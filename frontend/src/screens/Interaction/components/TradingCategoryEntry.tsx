import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../../../theme";
import { Box, Text, Pressable, HStack, VStack } from "../../../components/ui";
import { NotificationBadge } from "../../../components/ui/NotificationBadge";
import { Notification } from "../../../services/notificationService";
import { formatTime } from "../utils";
import { useInteractionStyles } from "../styles";

interface TradingCategoryEntryProps {
  /** 已经按分类过滤好的通知（最新在前） */
  notifications: Notification[];
  label: string;
  emptyText: string;
  icon: string;
  color: string;
  onPress: () => void;
}

/**
 * 「交易」tab 下单个分类的入口行（物流 / 售后 / 心动）。
 * 视觉与 SystemEntry 完全对齐：圆形彩色图标 + 标题 + 最新一条预览 + 未读角标。
 */
export const TradingCategoryEntry = ({
  notifications,
  label,
  emptyText,
  icon,
  color,
  onPress,
}: TradingCategoryEntryProps) => {
  const theme = useAppTheme();
  const styles = useInteractionStyles();

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const latest = notifications[0];

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, unreadCount > 0 && styles.rowUnread]}
    >
      <HStack alignItems="center" flex={1}>
        <Box position="relative" mr="$md">
          <Box
            w={48}
            h={48}
            rounded="$full"
            justifyContent="center"
            alignItems="center"
            style={{ backgroundColor: color }}
          >
            <Ionicons name={icon as any} size={22} color={theme.colors.white} />
          </Box>
          {unreadCount > 0 && (
            <NotificationBadge count={unreadCount} size="md" showBorder />
          )}
        </Box>

        <VStack flex={1} mr="$sm">
          <HStack justifyContent="between" alignItems="center" mb={3}>
            <Text
              fontSize="$sm"
              fontWeight="$semibold"
              style={{ color: theme.colors.black }}
            >
              {label}
            </Text>
            {latest && (
              <Text fontSize="$xs" style={{ color: theme.colors.gray200 }}>
                {formatTime(latest.createdAt)}
              </Text>
            )}
          </HStack>
          <Text
            fontSize="$sm"
            style={{
              color: unreadCount > 0 ? theme.colors.black : theme.colors.gray300,
            }}
            numberOfLines={1}
          >
            {latest ? `${latest.title} ${latest.message}` : emptyText}
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
