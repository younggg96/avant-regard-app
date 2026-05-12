/**
 * 「我的等级」进度看板.
 *
 * 页面结构 (由上至下):
 *   1. 顶部大号当前等级徽章 + 称号 + pending 状态提醒 (若 Lv4 审核中)
 *   2. 下一级任务进度条
 *   3. 下一级权益说明
 *   4. 已解锁权益卡片 (Lv4 免费门票 / Lv5 年度权益)
 *   5. 月度抽奖入口 (仅 Lv3+ 可见, 复用 MonthlyLotteryEntry)
 *   6. 全量等级规则时间线 (只读展示, 让用户看清后面还有什么)
 *
 * 严格遵守:
 *   - 所有颜色走 theme (只黑白灰)
 *   - 下拉刷新自动再次拉 /levels/me
 *   - 如果后端回一个"升级"了的等级, 由 useLevelStore 统一触发全屏动画,
 *     本页只管展示状态, 不自己弹任何庆祝 UI.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import ScreenHeader from "../components/ScreenHeader";
import {
  LevelBadge,
  LevelProgressBar,
  MonthlyLotteryEntry,
  getLevelTitleKey,
} from "../components/level";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { useLevelStore } from "../store/levelStore";
import { useFeatureFlagsStore } from "../store/featureFlagsStore";
import {
  LevelSpec,
  levelService,
} from "../services/levelService";

const MyLevelScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const status = useLevelStore((s) => s.status);
  const refresh = useLevelStore((s) => s.refresh);
  const loading = useLevelStore((s) => s.loading);
  // Admin 关掉抽奖时, 隐藏 Lv3 的抽奖文案 (subtitle / benefit / nextLevel 提示),
  // 与 MonthlyLotteryEntry 的隐藏行为保持一致, 避免页面留下"已解锁但用不了"的矛盾.
  const lotteryEnabled = useFeatureFlagsStore((s) => s.flags.lotteryEnabled);

  const [rules, setRules] = useState<LevelSpec[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const data = await levelService.getRules();
      setRules(data);
    } catch (e) {
      console.warn("[MyLevel] loadRules failed:", e);
    }
  }, []);

  useEffect(() => {
    loadRules();
    refresh();
  }, [loadRules, refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadRules()]);
    setRefreshing(false);
  }, [refresh, loadRules]);

  if (!user?.userId) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title={t("myLevel.title")} showBack />
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t("myLevel.loginRequired")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentLevel = status?.currentLevel ?? 0;
  const pendingLevel = status?.pendingLevel ?? null;
  const benefits = status?.benefits ?? [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={t("myLevel.title")} showBack />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.black}
          />
        }
      >
        {/* ============ Hero ============ */}
        <View style={styles.hero}>
          {currentLevel > 0 ? (
            <LevelBadge
              level={currentLevel}
              size="lg"
              pendingLevel={pendingLevel}
            />
          ) : (
            <View style={styles.zeroBadge}>
              <Text style={styles.zeroBadgeText}>Lv0</Text>
            </View>
          )}

          {/* <Text style={styles.heroLevel}>
            {currentLevel > 0 ? `Lv${currentLevel}` : t("level.notStarted")}
          </Text>
          {currentLevel > 0 ? (
            <Text style={styles.heroTitle}>
              {t(getLevelTitleKey(currentLevel))}
            </Text>
          ) : null} */}

          {pendingLevel ? (
            <View style={styles.pendingChip}>
              <Ionicons
                name="time-outline"
                size={14}
                color={theme.colors.white}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.pendingChipText}>
                {t("level.pendingReview", { level: pendingLevel })}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ============ 下一级任务进度 ============ */}
        {status?.nextLevel ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {t("level.toNextLevel", {
                level: status.nextLevel,
                title:
                  t(getLevelTitleKey(status.nextLevel!)) ||
                  status.nextLevelTitle ||
                  "",
              })}
            </Text>
            {status.nextLevelBenefit &&
            !(status.nextLevel === 3 && !lotteryEnabled) ? (
              <Text style={styles.cardSubtitle}>
                {t("level.unlockBenefit", { benefit: status.nextLevelBenefit })}
              </Text>
            ) : null}

            <View style={{ marginTop: theme.spacing.md }}>
              {status.nextTasks.length === 0 ? (
                <Text style={styles.noTaskText}>
                  {t("level.manualGrantOnly")}
                </Text>
              ) : (
                status.nextTasks.map((task) => (
                  <LevelProgressBar key={task.action} task={task} />
                ))
              )}
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("level.topReached")}</Text>
            <Text style={styles.cardSubtitle}>{t("level.congratsUpgrade")} · {t(getLevelTitleKey(5))}</Text>
          </View>
        )}

        {/* ============ 已解锁权益 ============ */}
        {benefits.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("level.myBenefits")}</Text>
            {benefits.map((b) => (
              <View key={b.benefitId} style={styles.benefitRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitName}>{b.name}</Text>
                  {b.description ? (
                    <Text style={styles.benefitDesc}>{b.description}</Text>
                  ) : null}
                  <Text style={styles.benefitQuota}>
                    {t("level.remaining", { remaining: b.remaining, quota: b.quota })}
                  </Text>
                </View>

                {/* PRD: 免费门票的核销只能在活动报名页触发, 这里只做"持有"展示. */}
                {b.benefitType === "FREE_TICKET_LV4" ? (
                  <View style={styles.offlineChip}>
                    <Text style={styles.offlineChipText}>
                      {b.remaining > 0 ? t("level.freeTicketUse") : t("level.exhausted")}
                    </Text>
                  </View>
                ) : null}

                {b.benefitType === "ANNUAL_LV5" ? (
                  <View style={styles.offlineChip}>
                    <Text style={styles.offlineChipText}>{t("level.annualPerksUse")}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* ============ 月度抽奖 (Lv3+) ============ */}
        <MonthlyLotteryEntry
          isOwnProfile
          currentLevel={currentLevel}
        />

        {/* ============ 全量规则时间线 ============ */}
        <View style={[styles.card, { marginTop: theme.spacing.md, marginBottom: theme.spacing.md }]}>
          <Text style={styles.cardTitle}>{t("level.levelRoadmap")}</Text>
          {rules.map((spec) => {
            const reached = currentLevel >= spec.level;
            const specTitle = t(getLevelTitleKey(spec.level)) || spec.title;
            // Lv3 的副标题/权益说明都是抽奖文案. 关掉抽奖时整段抹掉,
            // 不能让用户看到"解锁月度抽奖入口"却找不到入口.
            const isLotteryLevel = spec.level === 3;
            const hideLotteryCopy = isLotteryLevel && !lotteryEnabled;
            const specSubtitle = hideLotteryCopy
              ? ""
              : t(`level.subtitles.${spec.level}`) || spec.subtitle;
            const specBenefit = hideLotteryCopy
              ? ""
              : t(`level.benefits.${spec.level}`, { defaultValue: "" }) ||
                spec.benefit;
            return (
              <View key={spec.level} style={styles.timelineRow}>
                <View
                  style={[
                    styles.timelineDot,
                    reached && styles.timelineDotActive,
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineLv}>
                    Lv{spec.level} · {specTitle}
                  </Text>
                  {specSubtitle ? (
                    <Text style={styles.timelineSubtitle}>{specSubtitle}</Text>
                  ) : null}
                  {spec.tasks.length > 0 ? (
                    <Text style={styles.timelineBody}>
                      {spec.tasks
                        .map((task) =>
                          t(`level.taskLabels.${task.action}`, {
                            target: task.target,
                            defaultValue: task.label,
                          })
                        )
                        .join(" · ")}
                    </Text>
                  ) : null}
                  {specBenefit ? (
                    <Text style={styles.timelineBenefit}>
                      {t("level.benefit")}: {specBenefit}
                    </Text>
                  ) : null}
                  <Text style={styles.timelineMode}>
                    {spec.mode === "AUTO"
                      ? t("level.autoUpgrade")
                      : spec.mode === "AUDIT"
                      ? t("level.auditUpgrade")
                      : t("level.manualUpgrade")}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {loading && !status ? (
          <ActivityIndicator
            style={{ marginVertical: 24 }}
            color={theme.colors.black}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.gray300,
  },

  hero: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  heroLevel: {
    ...theme.typography.hero,
    color: theme.colors.black,
    fontSize: 42,
    lineHeight: 48,
    marginTop: theme.spacing.md,
  },
  heroTitle: {
    ...theme.typography.h3,
    color: theme.colors.gray400,
    marginTop: 4,
    letterSpacing: 2,
  },
  zeroBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: "center",
    justifyContent: "center",
  },
  zeroBadgeText: {
    ...theme.typography.h2,
    color: theme.colors.gray200,
  },
  pendingChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.black,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: theme.spacing.md,
  },
  pendingChipText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    letterSpacing: 1,
  },

  card: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  cardTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
  },
  cardSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: 4,
  },
  noTaskText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray300,
    fontStyle: "italic",
  },

  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  benefitName: {
    ...theme.typography.body,
    color: theme.colors.black,
    fontWeight: "600",
  },
  benefitDesc: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: 2,
  },
  benefitQuota: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginTop: 4,
    letterSpacing: 1,
  },
  offlineChip: {
    borderWidth: 1,
    borderColor: theme.colors.black,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  offlineChipText: {
    ...theme.typography.caption,
    color: theme.colors.black,
  },

  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: theme.colors.black,
    marginTop: 6,
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.white,
  },
  timelineDotActive: {
    backgroundColor: theme.colors.black,
  },
  timelineLv: {
    ...theme.typography.h4,
    color: theme.colors.black,
  },
  timelineSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginTop: 2,
  },
  timelineBody: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginTop: 6,
    lineHeight: 20,
  },
  timelineBenefit: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    marginTop: 4,
  },
  timelineMode: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: 6,
    letterSpacing: 1,
  },
});

export default MyLevelScreen;
