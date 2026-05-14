import React from "react";
import { View, Text as RNText } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { OptimizedImage, Pressable, NotificationBadge } from "../../../components/ui";
import { ImageSize } from "../../../utils/imageUtils";
import { HEADER_CONTENT_HEIGHT } from "../constants";
import { useProfileStyles } from "../styles";
import { useAppTheme } from "../../../theme";

interface CollapsedHeaderProps {
  avatarUri: string | undefined;
  username: string;
  isCollapsed: boolean;
  insetTop: number;
  headerTotalHeight: number;
  animatedStyle: any;
  onSettingsPress: () => void;
  onMessagesPress: () => void;
  unreadCount?: number;
  onAvatarPress?: () => void;
}

export const CollapsedHeader = ({
  avatarUri,
  username,
  isCollapsed,
  insetTop,
  headerTotalHeight,
  animatedStyle,
  onSettingsPress,
  onMessagesPress,
  unreadCount = 0,
  onAvatarPress,
}: CollapsedHeaderProps) => {
  const styles = useProfileStyles();
  const theme = useAppTheme();
  return (
    <Animated.View
      style={[
        styles.collapsedHeader,
        { paddingTop: insetTop, height: headerTotalHeight },
        animatedStyle,
      ]}
      pointerEvents={isCollapsed ? "auto" : "none"}
    >
      <View style={[styles.collapsedHeaderBg, { backgroundColor: theme.colors.card }]} />
      <View style={[styles.collapsedHeaderContent, { height: HEADER_CONTENT_HEIGHT }]}>
        {/* 左侧占位：保持头像在中间（宽度对齐右侧消息+设置双按钮）。 */}
        <View style={styles.headerLeftSpacer} />
        <View style={styles.collapsedAvatarContainer}>
          {avatarUri ? (
            <Pressable onPress={onAvatarPress} hitSlop={8} disabled={!onAvatarPress}>
              <OptimizedImage uri={avatarUri} size={ImageSize.THUMBNAIL} style={styles.collapsedAvatar} contentFit="cover" lazy={false} />
            </Pressable>
          ) : (
            <View style={[styles.collapsedAvatar, styles.avatarPlaceholder]}>
              <RNText style={styles.avatarTextSmall}>
                {username?.slice(0, 1).toUpperCase() || "U"}
              </RNText>
            </View>
          )}
        </View>
        <View style={styles.headerRightButtons}>
          <Pressable style={styles.headerButton} onPress={onMessagesPress}>
            <Ionicons name="notifications-outline" size={20} color={theme.colors.text} />
            <NotificationBadge count={unreadCount} size="sm" showBorder />
          </Pressable>
          <Pressable style={styles.headerButton} onPress={onSettingsPress}>
            <Ionicons name="settings-outline" size={20} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
};
