/**
 * WizardStepper —— PRD 单品发布 4-step 流程进度条。
 *
 * 通用横向进度条 + 步骤编号 + 标题；点击之前已完成步骤可回跳。
 * 全局沿用主题 borderRadius=4。
 */
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { Box, Text, Pressable } from "./ui";
import { useThemedStyles, type AppTheme } from "../theme";

export interface WizardStepperProps {
  /** 总步骤数，PRD 默认 4。 */
  total: number;
  /** 1-indexed 当前激活步骤。 */
  current: number;
  /** 每个 step 的标题（length === total）。 */
  labels: string[];
  /** 点击已完成步骤跳回（仅 step <= current 才会响应）。 */
  onJumpTo?: (step: number) => void;
}

const WizardStepper: React.FC<WizardStepperProps> = ({
  total,
  current,
  labels,
  onJumpTo,
}) => {
  const styles = useThemedStyles(makeStyles);

  const safeLabels = useMemo(() => {
    const arr = labels.slice(0, total);
    while (arr.length < total) arr.push("");
    return arr;
  }, [labels, total]);

  const progress = Math.min(Math.max(current, 1), total) / total;

  return (
    <Box style={styles.container}>
      {/* 顶部当前步骤计数 + 当前标题 */}
      <Box style={styles.headerRow}>
        <Text style={styles.stepCount}>
          {current} / {total}
        </Text>
        <Text style={styles.stepTitle} numberOfLines={1}>
          {safeLabels[current - 1]}
        </Text>
      </Box>
      {/* 进度条 */}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
      </View>
      {/* 步骤点 + 标签 */}
      <View style={styles.dotsRow}>
        {safeLabels.map((label, i) => {
          const stepIdx = i + 1;
          const isDone = stepIdx < current;
          const isActive = stepIdx === current;
          const interactive = !!onJumpTo && stepIdx < current;
          return (
            <Pressable
              key={stepIdx}
              disabled={!interactive}
              onPress={interactive ? () => onJumpTo?.(stepIdx) : undefined}
              style={styles.dotCol}
            >
              <View
                style={[
                  styles.dot,
                  isDone && styles.dotDone,
                  isActive && styles.dotActive,
                ]}
              >
                <Text
                  style={[
                    styles.dotText,
                    (isDone || isActive) && styles.dotTextActive,
                  ]}
                >
                  {stepIdx}
                </Text>
              </View>
              <Text
                style={[
                  styles.dotLabel,
                  isActive && styles.dotLabelActive,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Box>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 14,
      backgroundColor: t.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    stepCount: {
      fontSize: 12,
      color: t.colors.textSecondary,
      letterSpacing: 1,
    },
    stepTitle: {
      flex: 1,
      textAlign: "right",
      fontSize: 14,
      color: t.colors.text,
      fontWeight: "600",
      marginLeft: 16,
    },
    barTrack: {
      height: 4,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.surface,
      overflow: "hidden",
    },
    barFill: {
      height: "100%",
      backgroundColor: t.colors.accent,
      borderRadius: t.borderRadius.sm,
    },
    dotsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    dotCol: {
      flex: 1,
      alignItems: "center",
    },
    dot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    dotActive: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
    },
    dotDone: {
      backgroundColor: t.colors.text,
      borderColor: t.colors.text,
    },
    dotText: {
      fontSize: 11,
      color: t.colors.textSecondary,
    },
    dotTextActive: {
      color: t.colors.textInverted,
      fontWeight: "700",
    },
    dotLabel: {
      marginTop: 4,
      fontSize: 11,
      color: t.colors.textSecondary,
      letterSpacing: 0.5,
    },
    dotLabelActive: {
      color: t.colors.text,
      fontWeight: "600",
    },
  });

export default WizardStepper;
