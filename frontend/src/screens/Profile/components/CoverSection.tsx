import React from "react";
import { View, Text as RNText } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { OptimizedImage, NotificationBadge, Pressable, HStack } from "../../../components/ui";
import { ImageSize } from "../../../utils/imageUtils";
import { styles } from "../styles";

interface CoverSectionProps {
  coverImage: string | null;
  unreadNotificationCount: number;
  insetTop: number;
  coverAnimatedStyle: any;
  topActionsAnimatedStyle: any;
  onInteractionPress: () => void;
  onSettingsPress: () => void;
}

export const CoverSection = ({
  coverImage,
  unreadNotificationCount,
  insetTop,
  coverAnimatedStyle,
  topActionsAnimatedStyle,
  onInteractionPress,
  onSettingsPress,
}: CoverSectionProps) => (
  <Animated.View style={[styles.coverContainer, coverAnimatedStyle]}>
    {coverImage ? (
      <OptimizedImage uri={coverImage} size={ImageSize.LARGE} style={styles.coverImage} contentFit="cover" lazy={false} />
    ) : (
      <View style={styles.defaultCover} />
    )}
    <LinearGradient
      colors={["rgba(0,0,0,0.4)", "transparent", "rgba(0,0,0,0.5)"]}
      locations={[0, 0.4, 1]}
      style={styles.coverGradient}
    />
    <Animated.View style={[styles.topActions, { top: insetTop + 8 }, topActionsAnimatedStyle]}>
      <Pressable />
      <HStack gap="$sm">
        <Pressable style={styles.actionButton} onPress={onInteractionPress}>
          <View style={{ position: "relative" }}>
            <Ionicons name="notifications-outline" size={22} color="white" />
            {unreadNotificationCount > 0 && (
              <NotificationBadge count={unreadNotificationCount} size="sm" />
            )}
          </View>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={onSettingsPress}>
          <Ionicons name="settings-outline" size={22} color="white" />
        </Pressable>
      </HStack>
    </Animated.View>
  </Animated.View>
);
