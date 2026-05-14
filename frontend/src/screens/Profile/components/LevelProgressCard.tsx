/**
 * 个人主页 · 等级进度卡片
 *
 * 渲染时机:
 *   - 仅在本人主页 (调用方通过 isOwnProfile 保证)
 *   - useLevelStore.status 已加载 (App 根的 useLevelWatcher 负责拉取)
 *
 * 视觉:
 *   - 与 FollowedBrands / UserTitlesSection 对齐: 行级 padding 16, 紧凑 section 头
 *   - 卡片体: 1px gray100 边框 + 内 padding, 整张可点击跳转「我的等级」
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
import { theme,
  playfairFonts,
  useThemedStyles,
  type AppTheme, useAppTheme } from "../../../theme";
import { useLevelStore } from "../../../store/levelStore";
import { LevelProgressBar, getLevelTitleKey } from "../../../components/level";

export const LevelProgressCard: React.FC = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const status = useLevelStore((s) => s.status);
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
    <Box pb={10} style={{ backgroundColor: theme.colors.white }}>
      <HStack px={16} mb={6} justifyContent="between">
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
        mx={16}
        px="$md"
        py="$sm"
        borderWidth={1}
        style={[{ borderColor: theme.colors.gray100 }, { backgroundColor: theme.colors.white }]}

        onPress={goDetail}
      >
        <HStack justifyContent="between" alignItems="center">
          <VStack flex={1} pr={8}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {headlineText}
            </Text>
            {benefitText ? (
              <Text style={styles.cardSubtitle} numberOfLines={2}>
                {benefitText}
              </Text>
            ) : null}
          </VStack>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={theme.colors.gray300}
            style={styles.chevron}
          />
        </HStack>

        {!topReached && !isPendingAudit && tasks.length > 0 ? (
          <VStack mt="$sm">
            <Text style={styles.howToHint}>{t("level.howToLevelUp")}</Text>
            <Box>
              {tasks.map((task) => (
                <LevelProgressBar
                  key={task.action}
                  task={task}
                  compact
                />
              ))}
            </Box>
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
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.gray400,
      fontFamily: playfairFonts.medium,
    },
    lvChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: t.colors.text,
    },
    lvChipText: {
      fontSize: 10,
      fontWeight: "600",
      color: t.colors.textInverted,
      fontFamily: playfairFonts.medium,
      letterSpacing: 0.5,
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
    cardTitle: {
      fontFamily: playfairFonts.medium,
      fontSize: 12,
      lineHeight: 16,
      color: t.colors.text,
      fontWeight: "600",
    },
    cardSubtitle: {
      ...t.typography.caption,
      color: t.colors.gray300,
      marginTop: 2,
    },
    chevron: {
      marginTop: 0,
    },
    howToHint: {
      ...t.typography.caption,
      color: t.colors.gray400,
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    manualOnly: {
      ...t.typography.bodySmall,
      color: t.colors.gray300,
      fontStyle: "italic",
      marginTop: 6,
    },
  });
