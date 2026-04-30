/**
 * 等级审批 Tab · Admin 管理入口
 *
 * 负责两条红线落地 (PRD 高价值权益人工管控):
 *   1) Lv4 升级工单审批:  列出所有 PENDING, 逐条 通过 / 拒绝.
 *   2) Lv5 手动授予:      输入 userId 直接赋 5 级 (不可降级, 服务层保护).
 *
 * 本 Tab 严格限定于 admin, 路由通过 get_current_admin_user 依赖兜底.
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
  BackfillResponse,
  UpgradeRequestInfo,
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
} from "../../components/ui";
import { Modal } from "../../components/ui/modal";
import { LEVEL_OPTIONS } from "../../components/level/levelTitles";

const LevelReviewTab: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<UpgradeRequestInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // 拒绝 Modal
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectRemark, setRejectRemark] = useState("");

  // 手动赋等级
  const [grantUserId, setGrantUserId] = useState("");
  const [grantLevel, setGrantLevel] = useState<number>(5);
  const [grantRemark, setGrantRemark] = useState("");

  // 存量回填
  const [backfillUserId, setBackfillUserId] = useState("");
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<BackfillResponse | null>(
    null,
  );

  // ---------- 列表加载 ----------

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminLevelService.listUpgradeRequests();
      setItems(data);
    } catch (e) {
      Alert.alert(
        t("admin.error"),
        e instanceof Error ? e.message : t("admin.fetchLevelRequestsFailed")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPending();
    setRefreshing(false);
  }, [fetchPending]);

  // ---------- 审批 ----------

  const handleApprove = (item: UpgradeRequestInfo) => {
    Alert.alert(
      t("admin.confirmApprove"),
      `确认授予 @${item.username ?? item.userId} 升级到 Lv${item.targetLevel}?  \n通过后将自动发放对应权益(Lv4 -> 1 张免费门票), 不可撤销.`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.confirmApprove"),
          onPress: async () => {
            try {
              setActionLoading(true);
              await adminLevelService.reviewUpgradeRequest(item.id, true);
              Alert.alert(t("admin.approved"), t("admin.levelUpgraded"));
              fetchPending();
            } catch (e) {
              Alert.alert(
                t("admin.error"),
                e instanceof Error ? e.message : t("admin.levelReviewFailed")
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const openReject = (item: UpgradeRequestInfo) => {
    setRejectingId(item.id);
    setRejectRemark("");
    setRejectVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectingId) return;
    try {
      setActionLoading(true);
      await adminLevelService.reviewUpgradeRequest(
        rejectingId,
        false,
        rejectRemark
      );
      setRejectVisible(false);
      setRejectingId(null);
      Alert.alert(t("admin.levelRejected"), t("admin.userNotified"));
      fetchPending();
    } catch (e) {
      Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.operationFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  // ---------- 手动赋等级 ----------

  const handleGrant = () => {
    const uid = parseInt(grantUserId.trim(), 10);
    if (!uid || Number.isNaN(uid)) {
      Alert.alert(t("admin.error"), "请输入合法的用户 ID");
      return;
    }
    if (grantLevel < 1 || grantLevel > 5) {
      Alert.alert(t("admin.error"), "等级必须在 1-5 之间");
      return;
    }
    Alert.alert(
      t("admin.confirmGrant"),
      `将直接把 user #${uid} 的等级设为 Lv${grantLevel}. \n受"只升不降"约束, 若该用户当前等级 >= Lv${grantLevel} 将被拒绝.`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.confirmGrant"),
          onPress: async () => {
            try {
              setActionLoading(true);
              await adminLevelService.grantLevel(uid, grantLevel, grantRemark);
              Alert.alert(t("common.success"), t("admin.levelGranted"));
              setGrantUserId("");
              setGrantRemark("");
              fetchPending();
            } catch (e) {
              Alert.alert(
                t("admin.error"),
                e instanceof Error ? e.message : t("admin.grantFailed")
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // ---------- 存量回填 ----------

  const runBackfill = async (opts: { dryRun: boolean; userId?: number }) => {
    try {
      setBackfillLoading(true);
      setBackfillResult(null);
      const res = await adminLevelService.backfillLevels({
        userId: opts.userId,
        dryRun: opts.dryRun,
      });
      setBackfillResult(res);
      if (!opts.dryRun) {
        fetchPending();
      }
    } catch (e) {
      Alert.alert(
        t("admin.error"),
        e instanceof Error ? e.message : t("admin.backfillFailed")
      );
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleBackfillAll = (dryRun: boolean) => {
    Alert.alert(
      dryRun ? "Dry Run 全量预览?" : "确认执行全量回填?",
      dryRun
        ? "将对所有用户做等级回溯计算, 但不写库. 仅用于预览."
        : "将对所有用户做等级回溯计算并写库. 操作幂等, 不会重复发福利 / 不会发通知. 建议先 Dry Run.",
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: dryRun ? "Dry Run" : t("admin.execute"),
          onPress: () => runBackfill({ dryRun }),
        },
      ]
    );
  };

  const handleBackfillSingle = () => {
    const uid = parseInt(backfillUserId.trim(), 10);
    if (!uid || Number.isNaN(uid)) {
      Alert.alert(t("admin.error"), "请输入合法用户 ID");
      return;
    }
    runBackfill({ dryRun: false, userId: uid });
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
        {/* ====== 模块 1: 待审批工单 ====== */}
        <Text style={styles.sectionTitle}>{t("admin.levelPendingTitle")}</Text>
        <Text style={styles.sectionHint}>
          {t("admin.levelPendingHint")}
        </Text>

        {loading ? (
          <Box style={sharedStyles.loadingContainer}>
            <ActivityIndicator color={theme.colors.black} size="small" />
            <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
          </Box>
        ) : items.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons
              name="checkmark-done-outline"
              size={40}
              color={theme.colors.gray200}
            />
            <Text style={sharedStyles.emptyText}>{t("admin.noLevelRequests")}</Text>
          </Box>
        ) : (
          items.map((it) => (
            <Box key={it.id} style={sharedStyles.postCard}>
              <HStack style={sharedStyles.postHeader}>
                <Text style={sharedStyles.username}>
                  @{it.username ?? `user#${it.userId}`}
                </Text>
                <Text style={sharedStyles.postDate}>
                  {new Date(it.createdAt).toLocaleString("zh-CN")}
                </Text>
              </HStack>

              <HStack style={styles.targetRow}>
                <Box style={styles.targetBadge}>
                  <Text style={styles.targetBadgeText}>
                    目标 Lv{it.targetLevel}
                  </Text>
                </Box>
                <Text style={styles.userIdText}>user id: {it.userId}</Text>
              </HStack>

              <HStack style={sharedStyles.actionButtons}>
                <Button
                  size="sm"
                  colorScheme="success"
                  onPress={() => handleApprove(it)}
                  disabled={actionLoading}
                  leftIcon={
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={16}
                      color={theme.colors.white}
                    />
                  }
                >
                  <ButtonText style={{ fontSize: 12 }}>{t("admin.approve")}</ButtonText>
                </Button>
                <Button
                  size="sm"
                  colorScheme="error"
                  onPress={() => openReject(it)}
                  disabled={actionLoading}
                  leftIcon={
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={theme.colors.white}
                    />
                  }
                >
                  <ButtonText style={{ fontSize: 12 }}>{t("admin.reject")}</ButtonText>
                </Button>
              </HStack>
            </Box>
          ))
        )}

        {/* ====== 模块 2: 手动赋等级 ====== */}
        <Box style={[sharedStyles.postCard, { marginTop: theme.spacing.lg }]}>
          <HStack style={{ alignItems: "center", marginBottom: 6 }}>
            <Ionicons
              name="star-outline"
              size={18}
              color={theme.colors.black}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.sectionTitle}>{t("admin.grantLevelTitle")}</Text>
          </HStack>
          <Text style={styles.sectionHint}>
            {t("admin.grantLevelHint")}
          </Text>

          <Text style={sharedStyles.formLabel}>{t("admin.userId")}</Text>
          <Input
            variant="outline"
            size="md"
            placeholder="例如 1024"
            placeholderTextColor={theme.colors.gray300}
            value={grantUserId}
            onChangeText={setGrantUserId}
            keyboardType="number-pad"
          />

          <Text style={sharedStyles.formLabel}>{t("admin.targetLevel")}</Text>
          <Box style={styles.levelRow}>
            {LEVEL_OPTIONS.map((opt) => {
              const active = grantLevel === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setGrantLevel(opt.value)}
                  style={[
                    styles.levelChip,
                    active && styles.levelChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.levelChipText,
                      active && styles.levelChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </Box>

          <Text style={sharedStyles.formLabel}>{t("admin.remarkOptional")}</Text>
          <Input
            variant="outline"
            size="md"
            placeholder="例如:  2026-Q2 线下活动参与者"
            placeholderTextColor={theme.colors.gray300}
            value={grantRemark}
            onChangeText={setGrantRemark}
          />

          <Button
            size="md"
            onPress={handleGrant}
            disabled={actionLoading}
            isLoading={actionLoading}
            style={{ marginTop: theme.spacing.md }}
          >
            <ButtonText>{t("admin.confirmGrant")}</ButtonText>
          </Button>
        </Box>

        {/* ====== 模块 3: 存量用户等级回填 ====== */}
        <Box style={[sharedStyles.postCard, { marginTop: theme.spacing.lg }]}>
          <HStack style={{ alignItems: "center", marginBottom: 6 }}>
            <Ionicons
              name="sync-outline"
              size={18}
              color={theme.colors.black}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.sectionTitle}>{t("admin.backfillTitle")}</Text>
          </HStack>
          <Text style={styles.sectionHint}>
            {t("admin.backfillHint")}
          </Text>

          <HStack style={{ gap: 8, marginTop: 4 }}>
            <Button
              variant="outline"
              size="sm"
              onPress={() => handleBackfillAll(true)}
              disabled={backfillLoading}
              isLoading={backfillLoading}
              style={{ flex: 1 }}
            >
              <ButtonText style={{ fontSize: 12 }}>Dry Run</ButtonText>
            </Button>
            <Button
              size="sm"
              onPress={() => handleBackfillAll(false)}
              disabled={backfillLoading}
              isLoading={backfillLoading}
              style={{ flex: 1 }}
            >
              <ButtonText style={{ fontSize: 12 }}>{t("admin.backfillExecute")}</ButtonText>
            </Button>
          </HStack>

          <Text style={[sharedStyles.formLabel, { marginTop: theme.spacing.md }]}>
            {t("admin.backfillSingle")}
          </Text>
          <HStack style={{ gap: 8, alignItems: "center" }}>
            <Box style={{ flex: 1 }}>
              <Input
                variant="outline"
                size="md"
                placeholder="用户 ID"
                placeholderTextColor={theme.colors.gray300}
                value={backfillUserId}
                onChangeText={setBackfillUserId}
                keyboardType="number-pad"
              />
            </Box>
            <Button
              size="sm"
              onPress={handleBackfillSingle}
              disabled={backfillLoading}
              isLoading={backfillLoading}
            >
              <ButtonText style={{ fontSize: 12 }}>{t("admin.execute")}</ButtonText>
            </Button>
          </HStack>

          {backfillResult && (
            <Box style={styles.backfillResultBox}>
              {backfillResult.scope === "single" ? (
                <>
                  <Text style={styles.backfillResultLine}>
                    用户 #{backfillResult.user.userId}:  Lv
                    {backfillResult.user.beforeLevel} → Lv
                    {backfillResult.user.afterLevel}
                    {backfillResult.user.pendingLevel
                      ? `  (pending Lv${backfillResult.user.pendingLevel})`
                      : ""}
                  </Text>
                  <Text style={styles.backfillResultCaption}>
                    counters: {JSON.stringify(backfillResult.user.counters)}
                  </Text>
                  {backfillResult.user.dryRun && (
                    <Text style={styles.backfillResultCaption}>
                      Dry Run — 未写入数据库
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.backfillResultLine}>
                    扫描 {backfillResult.summary.scanned} 人 · 升级{" "}
                    {backfillResult.summary.upgraded} 人 · 新增 Lv4 PENDING{" "}
                    {backfillResult.summary.pendingCreated} 条
                  </Text>
                  <Text style={styles.backfillResultCaption}>
                    错误 {backfillResult.summary.errors} ·  分布{" "}
                    {JSON.stringify(backfillResult.summary.levelDistribution)}
                  </Text>
                  {backfillResult.summary.dryRun && (
                    <Text style={styles.backfillResultCaption}>
                      Dry Run — 未写入数据库
                    </Text>
                  )}
                </>
              )}
            </Box>
          )}
        </Box>

        <Box style={{ height: 40 }} />
      </ScrollView>

      {/* ====== 拒绝 Modal ====== */}
      <Modal
        visible={rejectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectVisible(false)}
      >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={sharedStyles.modalContent}>
            <Text style={sharedStyles.modalTitle}>{t("admin.levelRejectTitle")}</Text>
            <Text style={styles.sectionHint}>
              {t("admin.levelRejectHint")}
            </Text>
            <Input
              variant="outline"
              size="md"
              placeholder="例如:  档案质量不达标, 请补充品牌正面照"
              placeholderTextColor={theme.colors.gray300}
              value={rejectRemark}
              onChangeText={setRejectRemark}
              multiline
              numberOfLines={3}
            />
            <HStack style={sharedStyles.modalButtons}>
              <Button
                variant="outline"
                size="sm"
                onPress={() => setRejectVisible(false)}
              >
                <ButtonText style={{ color: theme.colors.gray400 }}>
                  {t("common.cancel")}
                </ButtonText>
              </Button>
              <Button
                size="sm"
                colorScheme="error"
                onPress={confirmReject}
                disabled={actionLoading}
                isLoading={actionLoading}
              >
                <ButtonText>{t("admin.confirmReject")}</ButtonText>
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
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  targetBadge: {
    backgroundColor: theme.colors.black,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: theme.spacing.md,
  },
  targetBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    letterSpacing: 1,
  },
  userIdText: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  levelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  levelChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
  },
  levelChipActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  levelChipText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  levelChipTextActive: {
    color: theme.colors.white,
    fontWeight: "600",
  },
  backfillResultBox: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
  },
  backfillResultLine: {
    ...theme.typography.body,
    color: theme.colors.black,
  },
  backfillResultCaption: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginTop: 2,
  },
});

export default LevelReviewTab;
