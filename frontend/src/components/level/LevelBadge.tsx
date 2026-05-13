/**
 * 等级徽章 · 黑白极简款 (符合冷峻调性)
 *
 * - 不做等级 0 的渲染 (未达到 Lv1 的用户, 主页不挂徽章)
 * - 支持 size: "sm" (头像旁挂件) / "md" (我的等级页) / "lg" (升级动画)
 * - 仅使用黑白灰; 禁止引入彩色
 */

import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemedStyles, type AppTheme } from "../../theme";
import { getLevelTitle, getLevelTitleKey } from "./levelTitles";

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
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  if (!level || level < 1) return null;

  const dim = DIM[size];

  return (
    <View
      accessibilityLabel={`Level Lv${level} ${t(getLevelTitleKey(level))}`}
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

const makeStyles = (t: AppTheme) => StyleSheet.create({
  base: {
    backgroundColor: t.colors.text,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: t.colors.background,
  },
  text: {
    color: t.colors.textInverted,
    fontFamily: t.typography.h4.fontFamily,
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
    backgroundColor: t.colors.textInverted,
    borderWidth: 1,
    borderColor: t.colors.text,
  },
});
