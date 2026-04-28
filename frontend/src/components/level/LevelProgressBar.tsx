/**
 * 单任务进度条 (黑白, 极简).
 * 用在「我的等级」页面的每条任务前.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../../theme";
import { LevelTaskProgress } from "../../services/levelService";

interface Props {
  task: LevelTaskProgress;
}

export const LevelProgressBar: React.FC<Props> = ({ task }) => {
  const pct = task.target > 0
    ? Math.max(0, Math.min(1, task.progress / task.target))
    : 0;

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{task.label}</Text>
        <Text style={[styles.count, task.completed && styles.countDone]}>
          {task.progress}/{task.target}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { marginBottom: 14 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
  },
  count: {
    ...theme.typography.caption,
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
  fill: {
    height: "100%",
    backgroundColor: theme.colors.black,
  },
});
