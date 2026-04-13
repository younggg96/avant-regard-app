import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { Box, Text, Pressable, HStack, VStack } from "../../../components/ui";
import { OptimizedImage } from "../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../utils/imageUtils";
import { Notification } from "../../../services/notificationService";
import { getNotifIcon, formatTime } from "../utils";
import { styles } from "../styles";

interface NotificationRowProps {
  item: Notification;
  onPress: () => void;
}

export const NotificationRow = ({ item, onPress }: NotificationRowProps) => {
  const icon = getNotifIcon(item.type);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, !item.isRead && styles.rowUnread]}
    >
      <HStack alignItems="center" flex={1}>
        <Box position="relative" mr="$md">
          {item.avatar ? (
            <Box position="relative">
              <OptimizedImage
                uri={item.avatar}
                size={ImageSize.THUMBNAIL}
                style={styles.avatar}
                contentFit="cover"
                lazy
              />
              <Box style={[styles.iconBadge, { backgroundColor: icon.color }]}>
                <Ionicons name={icon.name as any} size={11} color={theme.colors.white} />
              </Box>
            </Box>
          ) : (
            <Box
              w={48} h={48} rounded="$full"
              justifyContent="center" alignItems="center"
              style={{ backgroundColor: icon.color }}
            >
              <Ionicons name={icon.name as any} size={20} color={theme.colors.white} />
            </Box>
          )}
        </Box>

        <VStack flex={1} mr="$sm">
          <Text fontSize="$sm" fontWeight="$semibold" color="$black" mb={2}>
            {item.title}
          </Text>
          <Text fontSize="$sm" color="$gray300" numberOfLines={1}>
            {item.message}
          </Text>
          <Text fontSize="$xs" color="$gray200" mt={2}>
            {formatTime(item.createdAt)}
          </Text>
        </VStack>

        {item.image && (
          <OptimizedImage
            uri={item.image}
            size={ImageSize.MEDIUM}
            style={styles.notifImage}
            contentFit="cover"
            lazy
          />
        )}

        {!item.isRead && <Box style={styles.unreadIndicator} />}
      </HStack>
    </Pressable>
  );
};
