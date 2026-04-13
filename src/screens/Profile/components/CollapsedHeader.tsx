import React from "react";
import { View, Text as RNText } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { OptimizedImage, NotificationBadge, Pressable } from "../../../components/ui";
import { ImageSize } from "../../../utils/imageUtils";
import { HEADER_CONTENT_HEIGHT } from "../constants";
import { styles } from "../styles";

interface CollapsedHeaderProps {
  avatarUri: string | undefined;
  username: string;
  unreadNotificationCount: number;
  isCollapsed: boolean;
  insetTop: number;
  headerTotalHeight: number;
  animatedStyle: any;
  onInteractionPress: () => void;
  onSettingsPress: () => void;
}

export const CollapsedHeader = ({
  avatarUri,
  username,
  unreadNotificationCount,
  isCollapsed,
  insetTop,
  headerTotalHeight,
  animatedStyle,
  onInteractionPress,
  onSettingsPress,
}: CollapsedHeaderProps) => (
  <Animated.View
    style={[
      styles.collapsedHeader,
      { paddingTop: insetTop, height: headerTotalHeight },
      animatedStyle,
    ]}
    pointerEvents={isCollapsed ? "auto" : "none"}
  >
    <View style={[styles.collapsedHeaderBg, { backgroundColor: '#FFF' }]} />
    <View style={[styles.collapsedHeaderContent, { height: HEADER_CONTENT_HEIGHT }]}>
      <Pressable style={styles.headerButton} onPress={onInteractionPress}>
        <View style={{ position: "relative" }}>
          <Ionicons name="notifications-outline" size={20} color="#1A1A1A" />
          {unreadNotificationCount > 0 && (
            <NotificationBadge count={unreadNotificationCount} size="sm" />
          )}
        </View>
      </Pressable>
      <View style={styles.collapsedAvatarContainer}>
        {avatarUri ? (
          <OptimizedImage uri={avatarUri} size={ImageSize.THUMBNAIL} style={styles.collapsedAvatar} contentFit="cover" lazy={false} />
        ) : (
          <View style={[styles.collapsedAvatar, styles.avatarPlaceholder]}>
            <RNText style={styles.avatarTextSmall}>
              {username?.slice(0, 1).toUpperCase() || "U"}
            </RNText>
          </View>
        )}
      </View>
      <View style={styles.headerRightButtons}>
        <Pressable style={styles.headerButton} onPress={onSettingsPress}>
          <Ionicons name="settings-outline" size={20} color="#1A1A1A" />
        </Pressable>
      </View>
    </View>
  </Animated.View>
);
