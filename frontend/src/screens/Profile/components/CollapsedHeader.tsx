import React from "react";
import { View, Text as RNText } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { OptimizedImage, Pressable } from "../../../components/ui";
import { ImageSize } from "../../../utils/imageUtils";
import { HEADER_CONTENT_HEIGHT } from "../constants";
import { styles } from "../styles";

interface CollapsedHeaderProps {
  avatarUri: string | undefined;
  username: string;
  isCollapsed: boolean;
  insetTop: number;
  headerTotalHeight: number;
  animatedStyle: any;
  onSettingsPress: () => void;
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
  onAvatarPress,
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
      {/* 左侧占位：保持 avatar 居中对齐（宽度与右侧 settings 按钮一致）。 */}
      <View style={styles.headerButton} />
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
        <Pressable style={styles.headerButton} onPress={onSettingsPress}>
          <Ionicons name="settings-outline" size={20} color="#1A1A1A" />
        </Pressable>
      </View>
    </View>
  </Animated.View>
);
