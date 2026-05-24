/**
 * AnimatedChip —— 可复用的圆角筛选 chip (light/dark + 动效)。
 *
 * 动效:
 *   - 选中 / 取消: 背景、边框、文字色 withTiming (~200ms)
 *   - 按压: scale spring 轻弹
 *
 * 适用于 Profile sub-tab、订单状态筛选、列表过滤等场景。
 */
import React, { useEffect } from "react";
import { LayoutChangeEvent, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Pressable } from "./pressable";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

export interface AnimatedChipProps {
  label: string;
  count?: number;
  isActive: boolean;
  onPress: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  style?: ViewStyle;
}

export const AnimatedChip: React.FC<AnimatedChipProps> = ({
  label,
  count,
  isActive,
  onPress,
  onLayout,
  style,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeChipStyles);

  const progress = useSharedValue(isActive ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, { duration: 200 });
  }, [isActive, progress]);

  const inactiveBg = theme.colors.card;
  const activeBg = theme.colors.text;
  const inactiveBorder = theme.colors.gray200;
  const activeBorder = theme.colors.text;
  const inactiveLabel = theme.colors.text;
  const activeLabel = theme.colors.textInverted;
  const inactiveCount = theme.colors.textSecondary;
  const activeCount = theme.colors.textInverted;

  const chipAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveBg, activeBg],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveBorder, activeBorder],
    ),
  }));

  const labelAnimStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveLabel, activeLabel],
    ),
    fontWeight: progress.value > 0.5 ? "600" : "500",
  }));

  const countAnimStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveCount, activeCount],
    ),
    opacity: interpolate(progress.value, [0, 1], [1, 0.75]),
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 18, stiffness: 320 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 260 });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLayout={onLayout}
    >
      <Animated.View style={[styles.chip, chipAnimStyle, style]}>
        <Animated.Text style={[styles.chipText, labelAnimStyle]}>
          {label}
          {count != null && count > 0 ? (
            <>
              {" "}
              <Animated.Text style={[styles.chipCount, countAnimStyle]}>
                {count}
              </Animated.Text>
            </>
          ) : null}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
};
AnimatedChip.displayName = "AnimatedChip";

const makeChipStyles = (t: AppTheme) =>
  StyleSheet.create({
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      backgroundColor: t.colors.card,
    },
    chipText: {
      fontSize: 13,
      color: t.colors.text,
      fontWeight: "500",
    },
    chipCount: {
      fontSize: 11,
      color: t.colors.textSecondary,
      fontWeight: "600",
    },
  });

export default AnimatedChip;
