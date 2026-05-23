/**
 * 个人主页 · 等级进度卡片
 *
 * 渲染时机:
 *   - 仅在本人主页 (调用方通过 isOwnProfile 保证)
 *   - useLevelStore.status 已加载 (App 根的 useLevelWatcher 负责拉取)
 *
 * 视觉:
 *   - 与 FollowedBrands / UserTitlesSection 对齐: 行级 padding 16, 紧凑 section 头
 *   - 卡片体: 1px border + theme.borderRadius.lg 圆角 + 内 padding, 整张可点击跳转「我的等级」
 *
 * 状态分支:
 *   - 顶级 (Lv5)              -> 仅展示 "已达顶级 · {title}", 无进度条
 *   - 待审核 (Lv4 pending)    -> 顶部状态行展示 "Lv{n} 审核中"
 *   - 普通 (Lv0~Lv4)          -> "升至 Lv{n+1} · {title}" + 任务进度条
 */

import React from "react";
import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Pressable, Text, VStack } from "../../../components/ui";
import {
  playfairFonts,
  useThemedStyles,
  type AppTheme,
  useAppTheme,
} from "../../../theme";
import { useLevelStore } from "../../../store/levelStore";
import { LevelProgressBar, getLevelTitleKey } from "../../../components/level";
import { useProfileStyles } from "../styles";

export const LevelProgressCard: React.FC = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const status = useLevelStore((s) => s.status);
  const profileStyles = useProfileStyles();
  const styles = useThemedStyles(makeStyles);

  if (!status) return null;

  const currentLevel = status.currentLevel ?? 0;
  const pendingLevel = status.pendingLevel ?? null;
  const nextLevel = status.nextLevel ?? null;
  const tasks = status.nextTasks ?? [];

  const topReached = !nextLevel && currentLevel >= 5;
  const isPendingAudit = !!pendingLevel;

  const nextTitle =
    (nextLevel ? t(getLevelTitleKey(nextLevel)) : "") ||
    status.nextLevelTitle ||
    "";

  const headlineText = topReached
    ? `${t("level.topReached")} · ${t(getLevelTitleKey(5))}`
    : isPendingAudit
    ? t("level.pendingReview", { level: pendingLevel })
    : nextLevel
    ? t("level.toNextLevel", { level: nextLevel, title: nextTitle })
    : t("level.notStarted");

  const benefitText =
    !topReached && !isPendingAudit && status.nextLevelBenefit
      ? t("level.unlockBenefit", { benefit: status.nextLevelBenefit })
      : null;

  const goDetail = () => navigation.navigate("MyLevel");

  return (
    <Box style={styles.section}>
      <HStack style={styles.sectionHeader} justifyContent="between">
        <Text style={styles.sectionTitle}>{t("profile.levelProgress")}</Text>
        {currentLevel > 0 ? (
          <Box style={styles.lvChip}>
            <Text style={styles.lvChipText}>
              Lv{currentLevel}
              {nextLevel ? ` → Lv${nextLevel}` : ""}
            </Text>
          </Box>
        ) : null}
      </HStack>

      <Pressable
        style={[profileStyles.profileInsetCard, styles.cardPressable]}
        onPress={goDetail}
      >
        <HStack justifyContent="between" alignItems="center">
          <HStack flex={1} alignItems="flex-start" space="xs" style={styles.cardHeadlineRow}>
            <Ionicons
              name="trophy-outline"
              size={13}
              color={theme.colors.text}
              style={styles.cardIcon}
            />
            <VStack flex={1} style={styles.cardHeadlineCol}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {headlineText}
              </Text>
              {benefitText ? (
                <Text style={styles.cardSubtitle} numberOfLines={2}>
                  {benefitText}
                </Text>
              ) : null}
            </VStack>
          </HStack>
          <Ionicons
            name="chevron-forward"
            size={12}
            color={theme.colors.gray300}
          />
        </HStack>

        {!topReached && !isPendingAudit && tasks.length > 0 ? (
          <VStack style={styles.tasksBlock}>
            <Text style={styles.howToHint}>{t("level.howToLevelUp")}</Text>
            <VStack style={styles.tasksList}>
              {tasks.map((task) => (
                <LevelProgressBar
                  key={task.action}
                  task={task}
                  compact
                />
              ))}
            </VStack>
          </VStack>
        ) : null}

        {!topReached && !isPendingAudit && tasks.length === 0 && nextLevel ? (
          <Text style={styles.manualOnly}>{t("level.manualGrantOnly")}</Text>
        ) : null}
      </Pressable>
    </Box>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    section: {
      paddingTop: t.spacing.xs,
      paddingBottom: t.spacing.sm,
      backgroundColor: t.colors.card,
    },
    sectionHeader: {
      paddingHorizontal: t.spacing.md,
      marginBottom: t.spacing.xs,
      alignItems: "center",
    },
    cardPressable: {
      overflow: "hidden",
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.gray400,
      fontFamily: playfairFonts.medium,
    },
    lvChip: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.text,
    },
    lvChipText: {
      fontSize: 9,
      fontWeight: "600",
      color: t.colors.textInverted,
      fontFamily: playfairFonts.medium,
      letterSpacing: 0.4,
    },
    card: {
      marginHorizontal: 16,
      padding: t.spacing.md,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    cardTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    cardTextCol: {
      flex: 1,
      paddingRight: 8,
    },
    cardHeadlineRow: {
      paddingRight: t.spacing.xs,
    },
    cardIcon: {
      marginTop: 1,
    },
    cardHeadlineCol: {
      gap: 2,
    },
    cardTitle: {
      fontFamily: playfairFonts.medium,
      fontSize: 11,
      lineHeight: 15,
      color: t.colors.text,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
    cardSubtitle: {
      fontSize: 10,
      lineHeight: 14,
      color: t.colors.gray300,
    },
    tasksBlock: {
      marginTop: t.spacing.sm,
      paddingTop: t.spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    tasksList: {
      gap: 6,
    },
    howToHint: {
      fontSize: 10,
      lineHeight: 14,
      color: t.colors.gray400,
      marginBottom: t.spacing.xs,
      letterSpacing: 0.4,
    },
    manualOnly: {
      fontSize: 10,
      lineHeight: 14,
      color: t.colors.gray300,
      fontStyle: "italic",
      marginTop: t.spacing.xs,
    },
  });
