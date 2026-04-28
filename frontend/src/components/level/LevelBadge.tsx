/**
 * 等级徽章 · 黑白极简款 (符合冷峻调性)
 *
 * - 不做等级 0 的渲染 (未达到 Lv1 的用户, 主页不挂徽章)
 * - 支持 size: "sm" (头像旁挂件) / "md" (我的等级页) / "lg" (升级动画)
 * - 仅使用黑白灰; 禁止引入彩色
 */

import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { theme } from "../../theme";
import { getLevelTitle } from "./levelTitles";

export { getLevelTitle };

type Size = "sm" | "md" | "lg";

export interface LevelBadgeProps {
  level: number;
  size?: Size;
  style?: ViewStyle;
  /** pendingLevel 有值时右上角打一个小点, 提示"待审核" */
  pendingLevel?: number | null;
}

const DIM: Record<Size, { w: number; h: number; font: number }> = {
  sm: { w: 26, h: 26, font: 11 },
  md: { w: 40, h: 40, font: 15 },
  lg: { w: 96, h: 96, font: 32 },
};

export const LevelBadge: React.FC<LevelBadgeProps> = ({
  level,
  size = "sm",
  style,
  pendingLevel,
}) => {
  if (!level || level < 1) return null;

  const dim = DIM[size];

  return (
    <View
      accessibilityLabel={`等级 Lv${level} ${getLevelTitle(level)}`}
      style={[
        styles.base,
        { width: dim.w, height: dim.h, borderRadius: dim.w / 2 },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: dim.font }]}>Lv{level}</Text>
      {pendingLevel ? <View style={styles.pendingDot} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.white,
  },
  text: {
    color: theme.colors.white,
    fontFamily: theme.typography.h4.fontFamily,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  pendingDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.black,
  },
});
