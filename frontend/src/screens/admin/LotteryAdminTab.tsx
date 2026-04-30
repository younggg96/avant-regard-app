/**
 * 月度抽奖 Tab · Admin 管理入口
 *
 * 落地 PRD 红线:
 *   - 严禁系统自动开奖, 本页是抽奖开奖的唯一触发点.
 *   - 奖池完全由 JSONB prize_config 驱动, 服务层不写死任何奖品.
 *   - 只有 OPEN 状态的期数能改奖池, 一旦 DRAWN 立即冻结.
 *   - 通知策略由 lottery_service 保障: 只推中奖者.
 *
 * 本页提供:
 *   1) 当期 + 历史期数列表  (月份 / 状态 / 参与数 / 中奖数 / 奖池概览)
 *   2) 建期 / 更新奖池     (Modal 表单, prize_config 行内可配多条)
 *   3) 同步进池             (兜底批量把 Lv3+ 用户拉入当期)
 *   4) 开奖                (按 prize_config 随机抽, 二次确认后写入)
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { theme } from "../../theme";
import {
  adminLevelService,
  LotteryPrize,
  LotteryRoundInfo,
} from "../../services/levelService";
import { sharedStyles } from "./adminStyles";
import {
  Box,
  Button,
  ButtonText,
  HStack,
  Input,
  Pressable,
  ScrollView,
  Text,
  VStack,
} from "../../components/ui";
import { Modal } from "../../components/ui/modal";

// ---------------- 工具 ----------------

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------- 组件 ----------------

const LotteryAdminTab: React.FC = () => {
  const { t } = useTranslation();

  const statusLabel = (status: LotteryRoundInfo["status"]): {
    text: string;
    color: string;
  } => {
    switch (status) {
      case "OPEN":
        return { text: t("admin.lotteryOpen"), color: theme.colors.success };
      case "DRAWN":
        return { text: t("admin.lotteryDrawn"), color: theme.colors.black };
      case "CLOSED":
        return { text: t("admin.lotteryClosed"), color: theme.colors.gray300 };
      default:
        return { text: status, color: theme.colors.gray300 };
    }
  };
  const [rounds, setRounds] = useState<LotteryRoundInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // 奖池编辑 Modal
  //   editorMode = "create"  -> 建期, month 可输入
  //   editorMode = "edit"    -> 改奖池, month 锁死 (否则 upsert 会按 month 查找,
  //                             误改月份会静默写到别的期, A 期反而没被改)
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editorMonth, setEditorMonth] = useState(currentMonth());
  const [editorPrizes, setEditorPrizes] = useState<LotteryPrize[]>([
    { prizeId: "p1", name: "", quota: 1 },
  ]);

  // ---------- 数据拉取 ----------

  const fetchRounds = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminLevelService.listRounds(24);
      setRounds(data);
    } catch (e) {
      Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.fetchRoundsFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRounds();
    setRefreshing(false);
  }, [fetchRounds]);

  // ---------- 编辑奖池 ----------

  const openEditor = (round?: LotteryRoundInfo) => {
    if (round) {
      setEditorMode("edit");
      setEditorMonth(round.month);
      setEditorPrizes(
        round.prizeConfig.length > 0
          ? round.prizeConfig.map((p) => ({ ...p }))
          : [{ prizeId: "p1", name: "", quota: 1 }]
      );
    } else {
      setEditorMode("create");
      setEditorMonth(currentMonth());
      setEditorPrizes([{ prizeId: "p1", name: "", quota: 1 }]);
    }
    setEditorVisible(true);
  };

  const updatePrize = (
    idx: number,
    field: "prizeId" | "name" | "quota",
    value: string
  ) => {
    setEditorPrizes((prev) => {
      const next = [...prev];
      if (field === "quota") {
        const n = parseInt(value, 10);
        next[idx] = {
          ...next[idx],
          quota: Number.isNaN(n) || n < 0 ? 0 : n,
        };
      } else {
        next[idx] = { ...next[idx], [field]: value };
      }
      return next;
    });
  };

  const addPrizeRow = () => {
    setEditorPrizes((prev) => [
      ...prev,
      { prizeId: `p${prev.length + 1}`, name: "", quota: 1 },
    ]);
  };

  const removePrizeRow = (idx: number) => {
    setEditorPrizes((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev
    );
  };

  const saveEditor = async () => {
    const monthPattern = /^\d{4}-\d{2}$/;
    if (!monthPattern.test(editorMonth.trim())) {
      Alert.alert(t("admin.error"), t("admin.lotteryMonthFormat"));
      return;
    }
    const cleaned: LotteryPrize[] = editorPrizes
      .map((p) => ({
        prizeId: p.prizeId.trim(),
        name: p.name.trim(),
        quota: Number(p.quota) || 0,
        meta: p.meta,
      }))
      .filter((p) => p.prizeId && p.name && p.quota > 0);

    if (cleaned.length === 0) {
      Alert.alert(t("admin.error"), t("admin.lotteryMinPrize"));
      return;
    }
    const idSet = new Set<string>();
    for (const p of cleaned) {
      if (idSet.has(p.prizeId)) {
        Alert.alert(t("admin.error"), t("admin.lotteryDuplicateId") + `: ${p.prizeId}`);
        return;
      }
      idSet.add(p.prizeId);
    }

    try {
      setActionLoading(true);
      await adminLevelService.upsertRound(editorMonth.trim(), cleaned);
      setEditorVisible(false);
      Alert.alert(t("common.success"), t("admin.lotteryPrizesUpdated"));
      fetchRounds();
    } catch (e) {
      Alert.alert(
        t("admin.error"),
        e instanceof Error ? e.message : t("admin.lotteryPrizeSaveFailed")
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ---------- 同步进池 ----------

  const handleSyncEntries = (round: LotteryRoundInfo) => {
    Alert.alert(
      t("admin.lotterySyncEntries"),
      `把所有 Lv3+ 用户批量拉入 ${round.month} 期. 已在池的用户会被自动跳过.`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.lotterySyncStart"),
          onPress: async () => {
            try {
              setActionLoading(true);
              const res = await adminLevelService.syncEntries(round.id);
              Alert.alert(t("admin.lotterySyncDone"), `新增 ${res.added} 位参与者`);
              fetchRounds();
            } catch (e) {
              Alert.alert(
                t("admin.error"),
                e instanceof Error ? e.message : t("admin.operationFailed")
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // ---------- 开奖 (红线) ----------

  const handleDraw = (round: LotteryRoundInfo) => {
    if (round.status !== "OPEN") {
      Alert.alert(t("admin.hint"), t("admin.lotteryAlreadyDrawn"));
      return;
    }
    if (round.prizeConfig.length === 0) {
      Alert.alert(t("admin.lotteryEmptyPrizes"), t("admin.lotteryNoPrizes"));
      return;
    }
    if (round.totalEntries === 0) {
      Alert.alert(t("admin.lotteryNoEntries"), t("admin.lotteryNoEntries"));
      return;
    }

    const totalQuota = round.prizeConfig.reduce(
      (sum, p) => sum + (Number(p.quota) || 0),
      0
    );

    Alert.alert(
      `开奖 · ${round.month}`,
      `即将按奖池随机抽取:\n\n${round.prizeConfig
        .map((p) => `  · ${p.name} × ${p.quota}`)
        .join("\n")}\n\n共 ${totalQuota} 个名额, 从 ${round.totalEntries} 位参与者中抽取.\n开奖后期数状态会锁定为 DRAWN, 不可撤销.`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.lotteryConfirmDraw"),
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              const res = await adminLevelService.drawRound(round.id, null);
              Alert.alert(t("admin.lotteryDrawnResult"), `共产生 ${res.winners} 位中奖者`);
              fetchRounds();
            } catch (e) {
              Alert.alert(
                t("admin.error"),
                e instanceof Error ? e.message : t("admin.operationFailed")
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // ---------- 渲染 ----------

  return (
    <Box style={{ flex: 1 }}>
      <ScrollView
        style={sharedStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <HStack
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <Text style={styles.sectionTitle}>{t("admin.lotteryRounds")}</Text>
          <Button
            size="sm"
            onPress={() => openEditor()}
            leftIcon={
              <Ionicons
                name="add-outline"
                size={16}
                color={theme.colors.white}
              />
            }
          >
            <ButtonText style={{ fontSize: 12 }}>{t("admin.lotteryCreateEdit")}</ButtonText>
          </Button>
        </HStack>
        <Text style={styles.sectionHint}>
          {t("admin.lotteryHint")}
        </Text>

        {loading ? (
          <Box style={sharedStyles.loadingContainer}>
            <ActivityIndicator color={theme.colors.black} size="small" />
            <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
          </Box>
        ) : rounds.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons
              name="gift-outline"
              size={40}
              color={theme.colors.gray200}
            />
            <Text style={sharedStyles.emptyText}>{t("admin.noRounds")}</Text>
            <Text style={sharedStyles.emptySubtext}>
              点右上 "建期 / 改奖池" 开始
            </Text>
          </Box>
        ) : (
          rounds.map((r) => {
            const sl = statusLabel(r.status);
            const isOpen = r.status === "OPEN";
            return (
              <Box key={r.id} style={sharedStyles.postCard}>
                <HStack style={sharedStyles.postHeader}>
                  <Text style={sharedStyles.postTitle}>{r.month}</Text>
                  <Box
                    style={[
                      styles.statusBadge,
                      { backgroundColor: sl.color },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>{sl.text}</Text>
                  </Box>
                </HStack>

                <HStack style={styles.statRow}>
                  <VStack style={styles.statCell}>
                    <Text style={styles.statLabel}>{t("admin.lotteryEntries")}</Text>
                    <Text style={styles.statValue}>{r.totalEntries}</Text>
                  </VStack>
                  <VStack style={styles.statCell}>
                    <Text style={styles.statLabel}>{t("admin.lotteryWinners")}</Text>
                    <Text style={styles.statValue}>{r.totalWinners}</Text>
                  </VStack>
                  <VStack style={styles.statCell}>
                    <Text style={styles.statLabel}>{t("admin.lotteryPrizes")}</Text>
                    <Text style={styles.statValue}>
                      {r.prizeConfig.length}
                    </Text>
                  </VStack>
                  <VStack style={styles.statCell}>
                    <Text style={styles.statLabel}>{t("admin.lotteryDrawnAt")}</Text>
                    <Text style={styles.statValue}>
                      {r.drawnAt
                        ? new Date(r.drawnAt).toLocaleDateString("zh-CN")
                        : "--"}
                    </Text>
                  </VStack>
                </HStack>

                {r.prizeConfig.length > 0 ? (
                  <VStack style={styles.prizeList}>
                    {r.prizeConfig.map((p) => (
                      <HStack key={p.prizeId} style={styles.prizeRow}>
                        <Text style={styles.prizeId}>{p.prizeId}</Text>
                        <Text style={styles.prizeName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={styles.prizeQuota}>× {p.quota}</Text>
                      </HStack>
                    ))}
                  </VStack>
                ) : (
                  <Text style={styles.emptyPrizeText}>{t("admin.lotteryNoPrizes")}</Text>
                )}

                <HStack style={sharedStyles.actionButtons}>
                  {isOpen && (
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => openEditor(r)}
                      disabled={actionLoading}
                    >
                      <ButtonText
                        style={{
                          fontSize: 12,
                          color: theme.colors.black,
                        }}
                      >
                        {t("admin.lotteryEditPrizes")}
                      </ButtonText>
                    </Button>
                  )}
                  {isOpen && (
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => handleSyncEntries(r)}
                      disabled={actionLoading}
                    >
                      <ButtonText
                        style={{
                          fontSize: 12,
                          color: theme.colors.black,
                        }}
                      >
                        {t("admin.lotterySyncEntries")}
                      </ButtonText>
                    </Button>
                  )}
                  {isOpen && (
                    <Button
                      size="sm"
                      colorScheme="error"
                      onPress={() => handleDraw(r)}
                      disabled={actionLoading}
                      leftIcon={
                        <Ionicons
                          name="trophy-outline"
                          size={14}
                          color={theme.colors.white}
                        />
                      }
                    >
                      <ButtonText style={{ fontSize: 12 }}>{t("admin.lotteryDraw")}</ButtonText>
                    </Button>
                  )}
                </HStack>
              </Box>
            );
          })
        )}

        <Box style={{ height: 40 }} />
      </ScrollView>

      {/* ====== 建期 / 改奖池 Modal ====== */}
      <Modal
        visible={editorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditorVisible(false)}
      >
        <Box style={sharedStyles.modalOverlay}>
          <Box
            style={[sharedStyles.modalContent, { maxHeight: "85%" }]}
          >
            <Text style={sharedStyles.modalTitle}>
              {editorMode === "edit" ? t("admin.lotteryEditPrizes") : t("admin.lotteryCreateRound")}
            </Text>

            <Text style={sharedStyles.formLabel}>{t("admin.lotteryMonth")}</Text>
            <Input
              variant="outline"
              size="md"
              placeholder="例如 2026-04"
              placeholderTextColor={theme.colors.gray300}
              value={editorMonth}
              onChangeText={setEditorMonth}
              editable={editorMode === "create"}
              style={
                editorMode === "edit"
                  ? { backgroundColor: theme.colors.gray100 }
                  : undefined
              }
            />
            <Text style={sharedStyles.formHint}>
              {editorMode === "edit"
                ? "改奖池时期号锁定, 如需换期请回到列表选择对应期数."
                : "已 DRAWN 的期数不能再改奖池."}
            </Text>

            <Text style={sharedStyles.formLabel}>{t("admin.lotteryPrizeList")}</Text>
            <ScrollView
              style={{ maxHeight: 260 }}
              showsVerticalScrollIndicator={false}
            >
              {editorPrizes.map((p, idx) => (
                <Box key={idx} style={styles.prizeEditorRow}>
                  <HStack style={{ gap: 6 }}>
                    <Input
                      variant="outline"
                      size="sm"
                      placeholder="prizeId"
                      placeholderTextColor={theme.colors.gray300}
                      value={p.prizeId}
                      onChangeText={(v) => updatePrize(idx, "prizeId", v)}
                      style={{ flex: 1 }}
                    />
                    <Input
                      variant="outline"
                      size="sm"
                      placeholder="名称"
                      placeholderTextColor={theme.colors.gray300}
                      value={p.name}
                      onChangeText={(v) => updatePrize(idx, "name", v)}
                      style={{ flex: 2 }}
                    />
                    <Input
                      variant="outline"
                      size="sm"
                      placeholder="名额"
                      placeholderTextColor={theme.colors.gray300}
                      value={String(p.quota ?? "")}
                      onChangeText={(v) => updatePrize(idx, "quota", v)}
                      keyboardType="number-pad"
                      style={{ flex: 1 }}
                    />
                    <Pressable
                      onPress={() => removePrizeRow(idx)}
                      style={styles.removeBtn}
                    >
                      <Ionicons
                        name="remove-circle-outline"
                        size={22}
                        color={theme.colors.error}
                      />
                    </Pressable>
                  </HStack>
                </Box>
              ))}
            </ScrollView>

            <Pressable onPress={addPrizeRow} style={styles.addRowBtn}>
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={theme.colors.black}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.addRowText}>{t("admin.lotteryAddRow")}</Text>
            </Pressable>

            <HStack style={sharedStyles.modalButtons}>
              <Button
                variant="outline"
                size="sm"
                onPress={() => setEditorVisible(false)}
              >
                <ButtonText style={{ color: theme.colors.gray400 }}>
                  {t("common.cancel")}
                </ButtonText>
              </Button>
              <Button
                size="sm"
                onPress={saveEditor}
                disabled={actionLoading}
                isLoading={actionLoading}
              >
                <ButtonText>{t("common.save")}</ButtonText>
              </Button>
            </HStack>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
  },
  sectionHint: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: 2,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    letterSpacing: 1,
  },
  statRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.gray100,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginBottom: 2,
  },
  statValue: {
    ...theme.typography.h4,
    color: theme.colors.black,
  },
  prizeList: {
    marginTop: theme.spacing.sm,
    gap: 4,
  },
  prizeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  prizeId: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    minWidth: 40,
  },
  prizeName: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    flex: 1,
  },
  prizeQuota: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  emptyPrizeText: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    fontStyle: "italic",
    marginTop: theme.spacing.sm,
  },
  prizeEditorRow: {
    marginBottom: 6,
  },
  removeBtn: {
    justifyContent: "center",
    alignItems: "center",
    width: 32,
  },
  addRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    borderStyle: "dashed",
    marginTop: 6,
  },
  addRowText: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
  },
});

export default LotteryAdminTab;
