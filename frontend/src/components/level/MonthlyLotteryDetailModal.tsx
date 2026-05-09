/**
 * 「本月抽奖」详情弹窗.
 *
 * 在 MyLevel 页点击 MonthlyLotteryEntry 时弹出, 展示:
 *   - 当期月份 / 状态 / 开奖时间 / 参与人数 / 中奖人数
 *   - 奖池配置 (奖品名称 + 名额)
 *   - 我的参与与中奖状态
 *   - 最近 6 期历史 (只读)
 *
 * 只展示数据, 不做核销; 与 admin 抽奖管理页面解耦.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { theme } from "../../theme";
import {
  CurrentLotteryPayload,
  LotteryRoundInfo,
  levelService,
} from "../../services/levelService";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const HISTORY_LIMIT = 6;

/** 运营约定: 每月 25 号统一开奖. 与 admin lotteryHint 文案保持一致. */
const SCHEDULED_DRAW_DAY = 25;

const formatDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** 期号 "YYYY-MM" → "MM-25" (仅展示, 不参与计算). */
const formatScheduledDraw = (month: string | undefined): string | null => {
  if (!month) return null;
  const parts = month.split("-");
  if (parts.length !== 2) return null;
  return `${parts[1]}-${SCHEDULED_DRAW_DAY}`;
};

export const MonthlyLotteryDetailModal: React.FC<Props> = ({
  visible,
  onClose,
}) => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<CurrentLotteryPayload | null>(null);
  const [history, setHistory] = useState<LotteryRoundInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, h] = await Promise.all([
        levelService.getCurrentLottery(),
        levelService
          .getLotteryHistory(HISTORY_LIMIT)
          .catch(() => [] as LotteryRoundInfo[]),
      ]);
      setCurrent(c);
      setHistory(h);
    } catch (e) {
      console.warn("[MonthlyLotteryDetailModal] load failed:", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    loadAll();
  }, [visible, loadAll]);

  const round = current?.round;
  const entry = current?.entry;

  const statusLabel = (() => {
    if (!round) return "--";
    if (round.status === "DRAWN") return t("lotteryDetail.statusDrawn");
    if (round.status === "CLOSED") return t("lotteryDetail.statusClosed");
    return t("lotteryDetail.statusOpen");
  })();

  /**
   * 「开奖日期」单元格: 当期未开奖时显示运营约定的预计开奖日 (MM-25),
   * 已开奖显示真实 drawn_at, 否则才回退到 "--".
   */
  const drawnAtCell = (() => {
    if (!round) return { value: "--", label: t("lotteryDetail.drawnAt") };
    if (round.status === "OPEN") {
      const scheduled = formatScheduledDraw(round.month);
      return {
        value: scheduled ?? "--",
        label: t("lotteryDetail.drawnAtScheduled"),
      };
    }
    return {
      value: formatDate(round.drawnAt) ?? "--",
      label: t("lotteryDetail.drawnAt"),
    };
  })();

  const myStatusLabel = (() => {
    if (!round || !entry) return null;
    if (round.status === "DRAWN") {
      return entry.isWinner
        ? t("level.won", { prize: entry.prizeName ?? "" })
        : t("level.drawn");
    }
    if (round.status === "CLOSED") return t("level.closed");
    return entry.entered ? t("level.entered") : t("level.autoEnter");
  })();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("lotteryDetail.title")}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("common.close") || "Close"}
          >
            <Ionicons name="close" size={22} color={theme.colors.black} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading && !current ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={theme.colors.black} />
            </View>
          ) : error && !current ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>
                {t("common.loadFailed") || "Load failed"}
              </Text>
              <Pressable onPress={loadAll} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>
                  {t("common.retry") || "Retry"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* ============ 当期概况 ============ */}
              <View style={styles.card}>
                <View style={styles.roundHeader}>
                  <Text style={styles.roundMonth}>
                    {round?.month ?? "--"}
                  </Text>
                  <View style={styles.statusChip}>
                    <Text style={styles.statusChipText}>{statusLabel}</Text>
                  </View>
                </View>

                {myStatusLabel ? (
                  <Text style={styles.myStatus} numberOfLines={2}>
                    {myStatusLabel}
                  </Text>
                ) : null}

                <View style={styles.statsRow}>
                  <View style={styles.statCell}>
                    <Text style={styles.statValue}>
                      {round?.totalEntries ?? 0}
                    </Text>
                    <Text style={styles.statLabel}>
                      {t("lotteryDetail.entries")}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statValue}>
                      {round?.totalWinners ?? 0}
                    </Text>
                    <Text style={styles.statLabel}>
                      {t("lotteryDetail.winners")}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statValue}>{drawnAtCell.value}</Text>
                    <Text style={styles.statLabel}>{drawnAtCell.label}</Text>
                  </View>
                </View>
              </View>

              {/* ============ 奖池 ============ */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  {t("lotteryDetail.prizePool")}
                </Text>
                {round && round.prizeConfig.length > 0 ? (
                  round.prizeConfig.map((prize, idx) => {
                    const isMine =
                      entry?.isWinner && entry.prizeId === prize.prizeId;
                    return (
                      <View
                        key={`${prize.prizeId}-${idx}`}
                        style={[
                          styles.prizeRow,
                          idx > 0 && styles.prizeRowBorder,
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.prizeName}>{prize.name}</Text>
                          <Text style={styles.prizeQuota}>
                            {t("lotteryDetail.quotaSuffix", {
                              count: prize.quota,
                            })}
                          </Text>
                        </View>
                        {isMine ? (
                          <View style={styles.wonChip}>
                            <Text style={styles.wonChipText}>
                              {t("lotteryDetail.youWon")}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>
                    {t("lotteryDetail.noPrizes")}
                  </Text>
                )}
              </View>

              {/* ============ 历史 ============ */}
              {history.length > 0 ? (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>
                    {t("lotteryDetail.history")}
                  </Text>
                  {history.map((h, idx) => {
                    const status =
                      h.status === "DRAWN"
                        ? t("lotteryDetail.statusDrawn")
                        : h.status === "CLOSED"
                          ? t("lotteryDetail.statusClosed")
                          : t("lotteryDetail.statusOpen");
                    return (
                      <View
                        key={h.id}
                        style={[
                          styles.historyRow,
                          idx > 0 && styles.prizeRowBorder,
                        ]}
                      >
                        <Text style={styles.historyMonth}>{h.month}</Text>
                        <Text style={styles.historyStatus}>{status}</Text>
                        <Text style={styles.historyMeta}>
                          {t("lotteryDetail.historyMeta", {
                            entries: h.totalEntries,
                            winners: h.totalWinners,
                          })}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              <Text style={styles.footerHint}>
                {t("lotteryDetail.footerHint")}
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  headerTitle: {
    ...theme.typography.h3,
    color: theme.colors.black,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  loadingWrap: {
    paddingVertical: 64,
    alignItems: "center",
  },
  errorWrap: {
    paddingVertical: 64,
    alignItems: "center",
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.gray300,
  },
  retryButton: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.black,
  },
  retryButtonText: {
    ...theme.typography.button,
    color: theme.colors.black,
  },

  card: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  sectionTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
    marginBottom: theme.spacing.sm,
  },

  roundHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundMonth: {
    ...theme.typography.h2,
    color: theme.colors.black,
  },
  statusChip: {
    borderWidth: 1,
    borderColor: theme.colors.black,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusChipText: {
    ...theme.typography.caption,
    color: theme.colors.black,
    letterSpacing: 1,
  },
  myStatus: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginTop: theme.spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    ...theme.typography.h4,
    color: theme.colors.black,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: 2,
    letterSpacing: 1,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.gray100,
  },

  prizeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  prizeRowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  prizeName: {
    ...theme.typography.body,
    color: theme.colors.black,
    fontWeight: "600",
  },
  prizeQuota: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: 2,
    letterSpacing: 1,
  },
  wonChip: {
    backgroundColor: theme.colors.black,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  wonChipText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    letterSpacing: 1,
  },
  emptyText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray300,
    fontStyle: "italic",
  },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  historyMonth: {
    ...theme.typography.body,
    color: theme.colors.black,
    fontWeight: "600",
    width: 80,
  },
  historyStatus: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    letterSpacing: 1,
    width: 64,
  },
  historyMeta: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    flex: 1,
    textAlign: "right",
  },

  footerHint: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    textAlign: "center",
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    lineHeight: 18,
  },
});

export default MonthlyLotteryDetailModal;
