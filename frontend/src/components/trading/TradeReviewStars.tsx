/**
 * TradeReviewStars —— 交易互评专用星级组件（整数 1–5）。
 *
 * 支持只读 / 可交互两种模式；交互时带轻微缩放动画。
 * 颜色走 useAppTheme，兼容 DarkTheme / LightTheme。
 */
import React, { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useAppTheme, type AppTheme } from "../../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TradeReviewStarsProps {
  value: number;
  size?: number;
  /** 传入则进入可交互模式 */
  onChange?: (value: number) => void;
  alignSelf?: "center" | "flex-start" | "flex-end";
}

const StarButton: React.FC<{
  filled: boolean;
  size: number;
  onPress?: () => void;
}> = ({ filled, size, onPress }) => {
  const theme = useAppTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    if (!onPress) return;
    scale.value = withSpring(1.18, { damping: 8, stiffness: 320 }, () => {
      scale.value = withSpring(1, { damping: 10, stiffness: 280 });
    });
    onPress();
  }, [onPress, scale]);

  const icon = (
    <Ionicons
      name={filled ? "star" : "star-outline"}
      size={size}
      color={filled ? theme.colors.starRated : theme.colors.gray200}
    />
  );

  if (!onPress) {
    return <View style={styles.starSlot}>{icon}</View>;
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      hitSlop={8}
      style={[styles.starSlot, animStyle]}
    >
      {icon}
    </AnimatedPressable>
  );
};

export const TradeReviewStars: React.FC<TradeReviewStarsProps> = ({
  value,
  size = 18,
  onChange,
  alignSelf = "center",
}) => (
  <View style={[styles.row, { alignSelf }]}>
    {[1, 2, 3, 4, 5].map((n) => (
      <StarButton
        key={n}
        filled={n <= value}
        size={size}
        onPress={onChange ? () => onChange(n) : undefined}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  starSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default TradeReviewStars;
