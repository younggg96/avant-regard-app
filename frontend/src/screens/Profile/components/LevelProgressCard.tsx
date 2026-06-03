/**
 * 个人主页 · 等级进度紧凑卡片（图二左栏）。
 */
import React, { useMemo, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import { HStack, Text, VStack } from "../../../components/ui";
import {
  playfairFonts,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";
import { useLevelStore } from "../../../store/levelStore";
import { getLevelTitleKey } from "../../../components/level";
import { ProfileSectionCard } from "./ProfileSectionCard";

const computeOverallProgress = (
  tasks: { progress: number; target: number }[],
): number => {
  if (tasks.length === 0) return 0;
  const totalProgress = tasks.reduce(
    (sum, task) => sum + Math.min(task.progress, task.target),
    0,
  );
  const totalTarget = tasks.reduce((sum, task) => sum + task.target, 0);
  if (totalTarget <= 0) return 0;
  return Math.round((totalProgress / totalTarget) * 100);
};

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const LevelProgressCard: React.FC<{ embedded?: boolean }> = ({
  embedded = false,
}) => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const status = useLevelStore((s) => s.status);
  const styles = useThemedStyles(makeStyles);
  const [expanded, setExpanded] = useState(false);

  const tasks = status?.nextTasks ?? [];
  const overallPct = useMemo(() => computeOverallProgress(tasks), [tasks]);

  if (!status) return null;

  const currentLevel = status.currentLevel ?? 0;
  const pendingLevel = status.pendingLevel ?? null;
  const nextLevel = status.nextLevel ?? null;
  const displayLevel = Math.max(currentLevel, 1);

  const topReached = !nextLevel && currentLevel >= 5;
  const isPendingAudit = !!pendingLevel;

  const levelLine = topReached
    ? `${t("level.topReached")} · ${t(getLevelTitleKey(5))}`
    : isPendingAudit
      ? t("level.pendingReview", { level: pendingLevel })
      : `Lv${displayLevel} · ${t(getLevelTitleKey(displayLevel))}`;

  const hasTasks = !topReached && !isPendingAudit && tasks.length > 0;
  const goDetail = () => navigation.navigate("MyLevel");

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <ProfileSectionCard
      cardTitle={t("profile.levelProgress")}
      embedded={embedded}
      embeddedFlex={embedded ? 3 : undefined}
      onPress={hasTasks ? toggleExpanded : goDetail}
      headerTrailing={
        hasTasks ? (
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={theme.colors.gray300}
          />
        ) : undefined
      }
      cardStyle={styles.cardFill}
    >
      <VStack space="sm" style={styles.content}>
        <HStack justifyContent="between" alignItems="center">
          <Text style={styles.levelLine} numberOfLines={1}>
            {levelLine}
          </Text>
          {hasTasks ? (
            <Text style={styles.pctText}>{overallPct}%</Text>
          ) : null}
        </HStack>

        {hasTasks ? (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${overallPct}%` }]} />
          </View>
        ) : null}

        {hasTasks && expanded ? (
          <>
            {tasks.map((task) => {
              const label = t(`level.taskLabels.${task.action}`, {
                target: task.target,
                defaultValue: task.label,
              });
              return (
                <View key={task.action} style={styles.taskRow}>
                  <Text style={styles.taskLabel} numberOfLines={1}>
                    {label}
                  </Text>
                  <Text
                    style={[
                      styles.taskCount,
                      task.completed && styles.taskCountDone,
                    ]}
                  >
                    {task.progress}/{task.target}
                  </Text>
                </View>
              );
            })}
            <Pressable
              onPress={goDetail}
              style={styles.detailRow}
              accessibilityRole="button"
            >
              <Text style={styles.detailText}>
                {t("profile.levelViewDetail")}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={12}
                color={theme.colors.gray300}
              />
            </Pressable>
          </>
        ) : null}

        {!topReached && !isPendingAudit && tasks.length === 0 && nextLevel ? (
          <Text style={styles.manualOnly}>{t("level.manualGrantOnly")}</Text>
        ) : null}
      </VStack>
    </ProfileSectionCard>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    cardFill: {},
    content: {
      alignSelf: "stretch",
    },
    levelLine: {
      ...t.typography.caption,
      fontFamily: playfairFonts.medium,
      color: t.colors.text,
      flex: 1,
      paddingRight: t.spacing.xs,
    },
    pctText: {
      ...t.typography.caption,
      fontFamily: playfairFonts.medium,
      color: t.colors.textSecondary,
    },
    taskRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.spacing.xs,
    },
    taskLabel: {
      ...t.typography.caption,
      color: t.colors.textSecondary,
      flex: 1,
    },
    taskCount: {
      ...t.typography.caption,
      fontFamily: playfairFonts.medium,
      color: t.colors.gray300,
    },
    taskCountDone: {
      color: t.colors.text,
    },
    track: {
      height: 2,
      backgroundColor: t.colors.gray100,
      borderRadius: t.borderRadius.full,
      overflow: "hidden",
    },
    fill: {
      height: "100%",
      backgroundColor: t.colors.text,
    },
    manualOnly: {
      ...t.typography.caption,
      color: t.colors.gray300,
      fontStyle: "italic",
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 2,
      marginTop: t.spacing.xs,
    },
    detailText: {
      ...t.typography.caption,
      fontFamily: playfairFonts.medium,
      color: t.colors.textSecondary,
    },
  });
