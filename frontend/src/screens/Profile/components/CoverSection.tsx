import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { OptimizedImage, Pressable } from "../../../components/ui";
import { ImageSize } from "../../../utils/imageUtils";
import { styles } from "../styles";

interface CoverSectionProps {
  coverImage: string | null;
  insetTop: number;
  coverAnimatedStyle: any;
  topActionsAnimatedStyle: any;
  onSettingsPress: () => void;
}

export const CoverSection = ({
  coverImage,
  insetTop,
  coverAnimatedStyle,
  topActionsAnimatedStyle,
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
      <Pressable style={styles.actionButton} onPress={onSettingsPress}>
        <Ionicons name="settings-outline" size={22} color="white" />
      </Pressable>
    </Animated.View>
  </Animated.View>
);
