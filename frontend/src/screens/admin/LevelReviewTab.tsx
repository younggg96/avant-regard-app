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
        "错误",
        e instanceof Error ? e.message : "获取审批列表失败"
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
      "确认通过",
      `确认授予 @${item.username ?? item.userId} 升级到 Lv${item.targetLevel}?  \n通过后将自动发放对应权益(Lv4 -> 1 张免费门票), 不可撤销.`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "确认通过",
          onPress: async () => {
            try {
              setActionLoading(true);
              await adminLevelService.reviewUpgradeRequest(item.id, true);
              Alert.alert("已通过", "用户等级已升级, 权益已发放");
              fetchPending();
            } catch (e) {
              Alert.alert(
                "错误",
                e instanceof Error ? e.message : "审批失败"
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
      Alert.alert("已驳回", "已通知用户");
      fetchPending();
    } catch (e) {
      Alert.alert("错误", e instanceof Error ? e.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  // ---------- 手动赋等级 ----------

  const handleGrant = () => {
    const uid = parseInt(grantUserId.trim(), 10);
    if (!uid || Number.isNaN(uid)) {
      Alert.alert("错误", "请输入合法的用户 ID");
      return;
    }
    if (grantLevel < 1 || grantLevel > 5) {
      Alert.alert("错误", "等级必须在 1-5 之间");
      return;
    }
    Alert.alert(
      "确认授予",
      `将直接把 user #${uid} 的等级设为 Lv${grantLevel}. \n受"只升不降"约束, 若该用户当前等级 >= Lv${grantLevel} 将被拒绝.`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "确认授予",
          onPress: async () => {
            try {
              setActionLoading(true);
              await adminLevelService.grantLevel(uid, grantLevel, grantRemark);
              Alert.alert("成功", "等级已授予, 相关权益已发放");
              setGrantUserId("");
              setGrantRemark("");
              fetchPending();
            } catch (e) {
              Alert.alert(
                "错误",
                e instanceof Error ? e.message : "授予失败 (可能该用户已达此级)"
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
        "错误",
        e instanceof Error ? e.message : "回填失败"
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
        { text: "取消", style: "cancel" },
        {
          text: dryRun ? "Dry Run" : "立即执行",
          onPress: () => runBackfill({ dryRun }),
        },
      ]
    );
  };

  const handleBackfillSingle = () => {
    const uid = parseInt(backfillUserId.trim(), 10);
    if (!uid || Number.isNaN(uid)) {
      Alert.alert("错误", "请输入合法用户 ID");
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
        <Text style={styles.sectionTitle}>Lv4 升级待审批</Text>
        <Text style={styles.sectionHint}>
          用户上传 3 份档案后进入此队列. 通过后自动赠送 1 张免费门票权益.
        </Text>

        {loading ? (
          <Box style={sharedStyles.loadingContainer}>
            <ActivityIndicator color={theme.colors.black} size="small" />
            <Text style={sharedStyles.loadingText}>加载中...</Text>
          </Box>
        ) : items.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons
              name="checkmark-done-outline"
              size={40}
              color={theme.colors.gray200}
            />
            <Text style={sharedStyles.emptyText}>暂无待审批工单</Text>
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
                  <ButtonText style={{ fontSize: 12 }}>通过</ButtonText>
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
                  <ButtonText style={{ fontSize: 12 }}>拒绝</ButtonText>
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
            <Text style={styles.sectionTitle}>手动授予等级</Text>
          </HStack>
          <Text style={styles.sectionHint}>
            Lv5 荣誉官的唯一通道. Lv1/2/3 建议交给规则引擎自动升, 仅在特殊情况补偿时使用.
          </Text>

          <Text style={sharedStyles.formLabel}>用户 ID</Text>
          <Input
            variant="outline"
            size="md"
            placeholder="例如 1024"
            placeholderTextColor={theme.colors.gray300}
            value={grantUserId}
            onChangeText={setGrantUserId}
            keyboardType="number-pad"
          />

          <Text style={sharedStyles.formLabel}>目标等级</Text>
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

          <Text style={sharedStyles.formLabel}>备注 (可选)</Text>
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
            <ButtonText>确认授予</ButtonText>
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
            <Text style={styles.sectionTitle}>存量用户等级回填</Text>
          </HStack>
          <Text style={styles.sectionHint}>
            从业务表统计老用户的真实行为累计数并静默升级 (Lv1-3 自动; Lv4 仅入审核队列; Lv5 不触发). 操作幂等, 不会重发权益 / 不发站内信.
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
              <ButtonText style={{ fontSize: 12 }}>全量执行</ButtonText>
            </Button>
          </HStack>

          <Text style={[sharedStyles.formLabel, { marginTop: theme.spacing.md }]}>
            单用户回填
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
              <ButtonText style={{ fontSize: 12 }}>执行</ButtonText>
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
            <Text style={sharedStyles.modalTitle}>填写拒绝原因</Text>
            <Text style={styles.sectionHint}>
              拒绝后用户收到站内信, remark 会作为消息正文.
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
                  取消
                </ButtonText>
              </Button>
              <Button
                size="sm"
                colorScheme="error"
                onPress={confirmReject}
                disabled={actionLoading}
                isLoading={actionLoading}
              >
                <ButtonText>确认拒绝</ButtonText>
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
