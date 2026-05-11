/**
 * 单任务进度条 (黑白, 极简).
 * 用在「我的等级」页面的每条任务前.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { theme } from "../../theme";
import { LevelTaskProgress } from "../../services/levelService";

interface Props {
  task: LevelTaskProgress;
  /** 个人主页等窄卡片内使用，缩小行高与轨高 */
  compact?: boolean;
}

export const LevelProgressBar: React.FC<Props> = ({ task, compact }) => {
  const { t } = useTranslation();
  const pct = task.target > 0
    ? Math.max(0, Math.min(1, task.progress / task.target))
    : 0;

  const label = t(`level.taskLabels.${task.action}`, {
    target: task.target,
    defaultValue: task.label,
  });

  const rowStyle = compact ? styles.rowCompact : styles.row;
  const labelRowStyle = compact ? styles.labelRowCompact : styles.labelRow;
  const trackStyle = compact ? styles.trackCompact : styles.track;
  const labelStyle = compact ? styles.labelCompact : styles.label;
  const countStyle = compact ? styles.countCompact : styles.count;

  return (
    <View style={rowStyle}>
      <View style={labelRowStyle}>
        <Text style={labelStyle}>{label}</Text>
        <Text style={[countStyle, task.completed && styles.countDone]}>
          {task.progress}/{task.target}
        </Text>
      </View>
      <View style={trackStyle}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { marginBottom: 14 },
  rowCompact: { marginBottom: 8 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  labelRowCompact: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  label: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
  },
  labelCompact: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  count: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    letterSpacing: 0.5,
  },
  countCompact: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 11,
    lineHeight: 14,
    color: theme.colors.gray300,
    letterSpacing: 0.5,
  },
  countDone: {
    color: theme.colors.black,
    fontWeight: "600",
  },
  track: {
    height: 3,
    backgroundColor: theme.colors.gray100,
    overflow: "hidden",
  },
  trackCompact: {
    height: 2,
    backgroundColor: theme.colors.gray100,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: theme.colors.black,
  },
});
