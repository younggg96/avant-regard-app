import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import {
  RecommendConfig,
  getRecommendConfig,
  updateRecommendConfig,
} from "../../services/adminService";
import { Box, HStack, VStack, Text, Pressable, ScrollView } from "../../components/ui";

const ALL_GRADES = ["A", "B", "C", "D"];

const GRADE_DESCRIPTIONS: Record<string, string> = {
  A: "深度内容",
  B: "单品介绍",
  C: "日常分享",
  D: "无关联",
};

const DEFAULT_CONFIG: RecommendConfig = {
  pool_ratios: { core: 0.5, discovery: 0.3, random: 0.2 },
  core_pool: { grades: ["A", "B", "C"] },
  discovery_pool: { enabled: true },
  random_pool: { grades: ["A", "B"] },
  cold_start: { days: 7, grades: ["A", "B"] },
};

const RecommendConfigTab = () => {
  const [config, setConfig] = useState<RecommendConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [coreInput, setCoreInput] = useState("50");
  const [discoveryInput, setDiscoveryInput] = useState("30");
  const [randomInput, setRandomInput] = useState("20");
  const [daysInput, setDaysInput] = useState("7");

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRecommendConfig();
      setConfig(data);
      setCoreInput(String(Math.round(data.pool_ratios.core * 100)));
      setDiscoveryInput(String(Math.round(data.pool_ratios.discovery * 100)));
      setRandomInput(String(Math.round(data.pool_ratios.random * 100)));
      setDaysInput(String(data.cold_start.days));
      setDirty(false);
    } catch (e) {
      Alert.alert("错误", "加载推荐配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const updateField = <K extends keyof RecommendConfig>(
    section: K,
    value: RecommendConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [section]: value }));
    setDirty(true);
  };

  const toggleGrade = (
    section: "core_pool" | "random_pool" | "cold_start",
    grade: string
  ) => {
    setConfig((prev) => {
      const current = prev[section].grades;
      const next = current.includes(grade)
        ? current.filter((g) => g !== grade)
        : [...current, grade].sort();
      return { ...prev, [section]: { ...prev[section], grades: next } };
    });
    setDirty(true);
  };

  const parsedRatios = useCallback(() => {
    const c = parseInt(coreInput, 10) || 0;
    const d = parseInt(discoveryInput, 10) || 0;
    const r = parseInt(randomInput, 10) || 0;
    return { c, d, r };
  }, [coreInput, discoveryInput, randomInput]);

  const handleRatioBlur = () => {
    const { c, d, r } = parsedRatios();
    updateField("pool_ratios", {
      core: c / 100,
      discovery: d / 100,
      random: r / 100,
    });
  };

  const handleDaysBlur = () => {
    const days = Math.max(1, Math.min(90, parseInt(daysInput, 10) || 7));
    setDaysInput(String(days));
    updateField("cold_start", { ...config.cold_start, days });
  };

  const ratioSum = () => {
    const { c, d, r } = parsedRatios();
    return c + d + r;
  };

  const handleSave = async () => {
    const sum = ratioSum();
    if (sum !== 100) {
      Alert.alert("比例错误", `三个池的比例之和必须为 100%，当前为 ${sum}%`);
      return;
    }
    if (config.core_pool.grades.length === 0) {
      Alert.alert("配置错误", "核心池至少选择一个评级");
      return;
    }
    if (config.random_pool.grades.length === 0) {
      Alert.alert("配置错误", "随机池至少选择一个评级");
      return;
    }
    if (config.cold_start.grades.length === 0) {
      Alert.alert("配置错误", "冷启动至少选择一个评级");
      return;
    }

    // Sync un-blurred inputs into the config before shipping to the backend;
    // otherwise, tapping Save directly after typing would send stale ratios/days.
    const { c, d, r } = parsedRatios();
    const clampedDays = Math.max(1, Math.min(90, parseInt(daysInput, 10) || 7));
    const payload: RecommendConfig = {
      ...config,
      pool_ratios: {
        core: c / 100,
        discovery: d / 100,
        random: r / 100,
      },
      cold_start: { ...config.cold_start, days: clampedDays },
    };

    try {
      setSaving(true);
      const saved = await updateRecommendConfig(payload);
      setConfig(saved);
      setDaysInput(String(saved.cold_start.days));
      setCoreInput(String(Math.round(saved.pool_ratios.core * 100)));
      setDiscoveryInput(String(Math.round(saved.pool_ratios.discovery * 100)));
      setRandomInput(String(Math.round(saved.pool_ratios.random * 100)));
      setDirty(false);
      Alert.alert("保存成功", "推荐算法配置已更新");
    } catch (e) {
      Alert.alert("保存失败", e instanceof Error ? e.message : "请重试");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.black} />
        <Text style={styles.loadingText}>加载推荐配置...</Text>
      </Box>
    );
  }

  const sum = ratioSum();
  const sumValid = sum === 100;

  return (
    <ScrollView
      style={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <VStack style={styles.header}>
        <Ionicons name="analytics" size={32} color={theme.colors.black} />
        <Text style={styles.headerTitle}>推荐算法配置</Text>
        <Text style={styles.headerSubtitle}>
          调整推荐页内容分发比例、评级筛选和冷启动策略
        </Text>
      </VStack>

      {/* ===== Pool Ratios ===== */}
      <Box style={styles.section}>
        <HStack style={styles.sectionHeader}>
          <Ionicons name="pie-chart-outline" size={20} color={theme.colors.black} />
          <Text style={styles.sectionTitle}>内容池分发比例</Text>
        </HStack>
        <Text style={styles.sectionDesc}>
          三个池的比例之和必须为 100%
        </Text>

        <VStack style={styles.ratioRow}>
          {([
            { label: "核心池", key: "core" as const, input: coreInput, setInput: setCoreInput, desc: "关注品牌的帖子" },
            { label: "发现池", key: "discovery" as const, input: discoveryInput, setInput: setDiscoveryInput, desc: "同品类其他品牌" },
            { label: "随机池", key: "random" as const, input: randomInput, setInput: setRandomInput, desc: "全站优质帖子" },
          ]).map((item) => (
            <HStack key={item.key} style={styles.ratioItem}>
              <VStack style={styles.ratioLabelGroup}>
                <Text style={styles.ratioLabel}>{item.label}</Text>
                <Text style={styles.ratioDesc}>{item.desc}</Text>
              </VStack>
              <HStack style={styles.ratioInputGroup}>
                <TextInput
                  style={styles.ratioInput}
                  value={item.input}
                  onChangeText={(v) => {
                    item.setInput(v.replace(/[^0-9]/g, ""));
                    setDirty(true);
                  }}
                  onBlur={handleRatioBlur}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.ratioPercent}>%</Text>
              </HStack>
            </HStack>
          ))}
        </VStack>

        <HStack style={[styles.sumRow, !sumValid && styles.sumRowError]}>
          <Text style={[styles.sumText, !sumValid && styles.sumTextError]}>
            合计：{sum}%
          </Text>
          {sumValid ? (
            <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
          ) : (
            <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
          )}
        </HStack>
      </Box>

      {/* ===== Core Pool Grades ===== */}
      <Box style={styles.section}>
        <HStack style={styles.sectionHeader}>
          <Ionicons name="star-outline" size={20} color={theme.colors.black} />
          <Text style={styles.sectionTitle}>核心池评级筛选</Text>
        </HStack>
        <Text style={styles.sectionDesc}>
          选择哪些评级的帖子可以进入核心池
        </Text>
        <HStack style={styles.gradeRow}>
          {ALL_GRADES.map((g) => {
            const active = config.core_pool.grades.includes(g);
            return (
              <Pressable
                key={g}
                style={[styles.gradeChip, active && styles.gradeChipActive]}
                onPress={() => toggleGrade("core_pool", g)}
              >
                <Text style={[styles.gradeChipText, active && styles.gradeChipTextActive]}>
                  {g}
                </Text>
                <Text style={[styles.gradeChipDesc, active && styles.gradeChipDescActive]}>
                  {GRADE_DESCRIPTIONS[g]}
                </Text>
              </Pressable>
            );
          })}
        </HStack>
      </Box>

      {/* ===== Discovery Pool Toggle ===== */}
      <Box style={styles.section}>
        <HStack style={styles.sectionHeader}>
          <Ionicons name="compass-outline" size={20} color={theme.colors.black} />
          <Text style={styles.sectionTitle}>发现池</Text>
        </HStack>
        <HStack style={styles.toggleRow}>
          <VStack style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>启用发现池</Text>
            <Text style={styles.toggleDesc}>
              关闭后推荐页不再展示同品类其他品牌的帖子
            </Text>
          </VStack>
          <Switch
            value={config.discovery_pool.enabled}
            onValueChange={(v) => updateField("discovery_pool", { enabled: v })}
            trackColor={{ false: theme.colors.gray200, true: theme.colors.black }}
            thumbColor={theme.colors.white}
          />
        </HStack>
      </Box>

      {/* ===== Random Pool Grades ===== */}
      <Box style={styles.section}>
        <HStack style={styles.sectionHeader}>
          <Ionicons name="shuffle-outline" size={20} color={theme.colors.black} />
          <Text style={styles.sectionTitle}>随机池评级筛选</Text>
        </HStack>
        <Text style={styles.sectionDesc}>
          选择哪些评级的帖子可以进入随机池
        </Text>
        <HStack style={styles.gradeRow}>
          {ALL_GRADES.map((g) => {
            const active = config.random_pool.grades.includes(g);
            return (
              <Pressable
                key={g}
                style={[styles.gradeChip, active && styles.gradeChipActive]}
                onPress={() => toggleGrade("random_pool", g)}
              >
                <Text style={[styles.gradeChipText, active && styles.gradeChipTextActive]}>
                  {g}
                </Text>
                <Text style={[styles.gradeChipDesc, active && styles.gradeChipDescActive]}>
                  {GRADE_DESCRIPTIONS[g]}
                </Text>
              </Pressable>
            );
          })}
        </HStack>
      </Box>

      {/* ===== Cold Start ===== */}
      <Box style={styles.section}>
        <HStack style={styles.sectionHeader}>
          <Ionicons name="snow-outline" size={20} color={theme.colors.black} />
          <Text style={styles.sectionTitle}>冷启动策略</Text>
        </HStack>
        <Text style={styles.sectionDesc}>
          新用户（无关注数据）的推荐规则
        </Text>

        <HStack style={styles.coldStartDaysRow}>
          <Text style={styles.coldStartDaysLabel}>时间窗口</Text>
          <HStack style={styles.ratioInputGroup}>
            <TextInput
              style={styles.ratioInput}
              value={daysInput}
              onChangeText={(v) => {
                setDaysInput(v.replace(/[^0-9]/g, ""));
                setDirty(true);
              }}
              onBlur={handleDaysBlur}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.ratioPercent}>天</Text>
          </HStack>
        </HStack>

        <Text style={styles.gradeSelectLabel}>评级筛选</Text>
        <HStack style={styles.gradeRow}>
          {ALL_GRADES.map((g) => {
            const active = config.cold_start.grades.includes(g);
            return (
              <Pressable
                key={g}
                style={[styles.gradeChip, active && styles.gradeChipActive]}
                onPress={() => toggleGrade("cold_start", g)}
              >
                <Text style={[styles.gradeChipText, active && styles.gradeChipTextActive]}>
                  {g}
                </Text>
                <Text style={[styles.gradeChipDesc, active && styles.gradeChipDescActive]}>
                  {GRADE_DESCRIPTIONS[g]}
                </Text>
              </Pressable>
            );
          })}
        </HStack>
      </Box>

      {/* ===== Save Button ===== */}
      <Pressable
        style={[
          styles.saveButton,
          (!dirty || saving || !sumValid) && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={!dirty || saving || !sumValid}
      >
        {saving ? (
          <ActivityIndicator color={theme.colors.white} />
        ) : (
          <>
            <Ionicons name="save-outline" size={20} color={theme.colors.white} />
            <Text style={styles.saveButtonText}>
              {dirty ? "保存配置" : "无修改"}
            </Text>
          </>
        )}
      </Pressable>

      <HStack style={styles.tips}>
        <Ionicons
          name="information-circle-outline"
          size={18}
          color={theme.colors.gray400}
        />
        <Text style={styles.tipsText}>
          配置修改后立即生效，无需重启服务。冷启动仅对无品牌关注数据的用户生效。
        </Text>
      </HStack>

      <Box style={{ height: 60 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    marginTop: theme.spacing.md,
  },
  header: {
    alignItems: "center",
    marginBottom: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
  },
  headerTitle: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginTop: theme.spacing.md,
  },
  headerSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginTop: theme.spacing.xs,
    textAlign: "center",
  },
  section: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  sectionHeader: {
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  sectionTitle: {
    ...theme.typography.body,
    color: theme.colors.black,
    fontWeight: "700",
  },
  sectionDesc: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginBottom: theme.spacing.md,
  },
  ratioRow: {
    gap: theme.spacing.sm,
  },
  ratioItem: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  ratioLabelGroup: {
    flex: 1,
  },
  ratioLabel: {
    ...theme.typography.body,
    color: theme.colors.black,
    fontWeight: "600",
  },
  ratioDesc: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  ratioInputGroup: {
    alignItems: "center",
    gap: 4,
  },
  ratioInput: {
    width: 56,
    height: 40,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    textAlign: "center",
    ...theme.typography.body,
    color: theme.colors.black,
    fontWeight: "600",
    backgroundColor: theme.colors.gray50,
  },
  ratioPercent: {
    ...theme.typography.body,
    color: theme.colors.gray400,
  },
  sumRow: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray50,
  },
  sumRowError: {
    backgroundColor: "#FFF0F0",
  },
  sumText: {
    ...theme.typography.body,
    color: theme.colors.success,
    fontWeight: "600",
  },
  sumTextError: {
    color: theme.colors.error,
  },
  gradeRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  gradeChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
  },
  gradeChipActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  gradeChipText: {
    ...theme.typography.body,
    color: theme.colors.black,
    fontWeight: "700",
  },
  gradeChipTextActive: {
    color: theme.colors.white,
  },
  gradeChipDesc: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: 2,
  },
  gradeChipDescActive: {
    color: "rgba(255,255,255,0.7)",
  },
  toggleRow: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: {
    ...theme.typography.body,
    color: theme.colors.black,
    fontWeight: "600",
  },
  toggleDesc: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginTop: 2,
  },
  coldStartDaysRow: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  coldStartDaysLabel: {
    ...theme.typography.body,
    color: theme.colors.black,
    fontWeight: "600",
  },
  gradeSelectLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    fontWeight: "600",
    marginBottom: theme.spacing.sm,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.black,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.gray300,
  },
  saveButtonText: {
    ...theme.typography.body,
    color: theme.colors.white,
    fontWeight: "600",
  },
  tips: {
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.lg,
  },
  tipsText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    flex: 1,
    lineHeight: 18,
  },
});

export default RecommendConfigTab;
