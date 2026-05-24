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

/** chip 行容器 —— 左对齐、可换行 */
export const chipRowStyle: ViewStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  alignSelf: "stretch",
  width: "100%",
  gap: 8,
};

export interface AnimatedChipProps {
  label: string;
  count?: number;
  /** 为 true 时 count 为 0 也展示数字 (收藏 sub-chip 等场景) */
  showZeroCount?: boolean;
  isActive: boolean;
  onPress: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  style?: ViewStyle;
}

export const AnimatedChip: React.FC<AnimatedChipProps> = ({
  label,
  count,
  showZeroCount = false,
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
  // inactive count 用 gray400：dark #CFCFCF / light #444444，在 card 底上都有足够对比度。
  // textSecondary 在嵌套 Animated.Text 里偶发继承异常，导致 dark 下几乎看不见。
  const inactiveCount = theme.colors.gray400;
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
    opacity: interpolate(progress.value, [0, 1], [0.85, 0.7]),
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 18, stiffness: 320 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 260 });
  };

  return (
    <Pressable
      style={{ alignSelf: "flex-start" }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLayout={onLayout}
    >
      <Animated.View style={[styles.chip, chipAnimStyle, style]}>
        <Animated.Text style={[styles.chipText, labelAnimStyle]}>
          {label}
        </Animated.Text>
        {count != null && (showZeroCount || count > 0) ? (
          <Animated.Text style={[styles.chipCount, countAnimStyle]}>
            {count}
          </Animated.Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
};
AnimatedChip.displayName = "AnimatedChip";

const makeChipStyles = (t: AppTheme) =>
  StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      backgroundColor: t.colors.card,
    },
    chipText: {
      fontSize: 12,
      fontWeight: "500",
    },
    chipCount: {
      fontSize: 10,
      fontWeight: "600",
    },
  });

export default AnimatedChip;
