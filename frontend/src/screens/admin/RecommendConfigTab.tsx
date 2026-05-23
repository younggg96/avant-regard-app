import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import {
  RecommendConfig,
  getRecommendConfig,
  updateRecommendConfig,
} from "../../services/adminService";
import { Box, HStack, VStack, Text, Pressable, ScrollView } from "../../components/ui";

/** iOS Switch 默认偏大，与 admin 其他页一致 */
const COMPACT_SWITCH_PROPS = Platform.select({
  ios: { style: { transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] } as const },
  default: {},
});

const ALL_GRADES = ["A", "B", "C", "D"];

const DEFAULT_CONFIG: RecommendConfig = {
  pool_ratios: { core: 0.5, discovery: 0.3, random: 0.2 },
  core_pool: { grades: ["A", "B", "C"] },
  discovery_pool: { enabled: true },
  random_pool: { grades: ["A", "B"] },
  cold_start: { days: 7, grades: ["A", "B"] },
};

const RecommendConfigTab = () => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const GRADE_DESCRIPTIONS: Record<string, string> = {
    A: t("admin.gradeA"),
    B: t("admin.gradeB"),
    C: t("admin.gradeC"),
    D: t("admin.gradeD"),
  };

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
      Alert.alert(t("admin.error"), t("admin.fetchRecommendFailed"));
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
      Alert.alert(t("admin.recommendRatioError"), `${t("admin.recommendRatioHint")} (${sum}%)`);
      return;
    }
    if (config.core_pool.grades.length === 0) {
      Alert.alert(t("admin.recommendConfigError"), t("admin.recommendCoreMin"));
      return;
    }
    if (config.random_pool.grades.length === 0) {
      Alert.alert(t("admin.recommendConfigError"), t("admin.recommendRandomMin"));
      return;
    }
    if (config.cold_start.grades.length === 0) {
      Alert.alert(t("admin.recommendConfigError"), t("admin.recommendColdMin"));
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
      Alert.alert(t("admin.saveSuccess"), t("admin.recommendUpdated"));
    } catch (e) {
      Alert.alert(t("admin.saveFailed"), e instanceof Error ? e.message : t("common.retryLater"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.text} />
        <Text style={styles.loadingText}>{t("admin.loadingRecommend")}</Text>
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
        <Ionicons name="analytics" size={28} color={theme.colors.text} />
        <Text style={styles.headerTitle}>{t("admin.recommendTitle")}</Text>
        <Text style={styles.headerSubtitle}>
          {t("admin.recommendSubtitle")}
        </Text>
      </VStack>

      {/* ===== Pool Ratios ===== */}
      <Box style={styles.section}>
        <HStack style={styles.sectionHeader}>
          <Ionicons name="pie-chart-outline" size={20} color={theme.colors.text} />
          <Text style={styles.sectionTitle}>{t("admin.recommendPoolRatios")}</Text>
        </HStack>
        <Text style={styles.sectionDesc}>
          {t("admin.recommendRatioHint")}
        </Text>

        <VStack style={styles.ratioRow}>
          {([
            { label: t("admin.recommendCorePool"), key: "core" as const, input: coreInput, setInput: setCoreInput, desc: t("admin.recommendCoreDesc") },
            { label: t("admin.recommendDiscoveryPool"), key: "discovery" as const, input: discoveryInput, setInput: setDiscoveryInput, desc: t("admin.recommendDiscoveryDesc") },
            { label: t("admin.recommendRandomPool"), key: "random" as const, input: randomInput, setInput: setRandomInput, desc: t("admin.recommendRandomDesc") },
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
            {t("admin.recommendTotal", { sum })}
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
          <Ionicons name="star-outline" size={20} color={theme.colors.text} />
          <Text style={styles.sectionTitle}>{t("admin.recommendCoreGrades")}</Text>
        </HStack>
        <Text style={styles.sectionDesc}>
          {t("admin.recommendCoreGradesHint")}
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
                <Text
                  style={[styles.gradeChipDesc, active && styles.gradeChipDescActive]}
                  numberOfLines={2}
                >
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
          <Ionicons name="compass-outline" size={20} color={theme.colors.text} />
          <Text style={styles.sectionTitle}>{t("admin.recommendDiscoveryPool")}</Text>
        </HStack>
        <HStack style={styles.toggleRow}>
          <VStack style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>{t("admin.recommendEnableDiscovery")}</Text>
            <Text style={styles.toggleDesc}>
              {t("admin.recommendDisableDiscoveryHint")}
            </Text>
          </VStack>
          <Switch
            {...COMPACT_SWITCH_PROPS}
            value={config.discovery_pool.enabled}
            onValueChange={(v) => updateField("discovery_pool", { enabled: v })}
            trackColor={{ false: theme.colors.gray200, true: theme.colors.success }}
            thumbColor={theme.colors.card}
          />
        </HStack>
      </Box>

      {/* ===== Random Pool Grades ===== */}
      <Box style={styles.section}>
        <HStack style={styles.sectionHeader}>
          <Ionicons name="shuffle-outline" size={20} color={theme.colors.text} />
          <Text style={styles.sectionTitle}>{t("admin.recommendRandomGrades")}</Text>
        </HStack>
        <Text style={styles.sectionDesc}>
          {t("admin.recommendRandomGradesHint")}
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
                <Text
                  style={[styles.gradeChipDesc, active && styles.gradeChipDescActive]}
                  numberOfLines={2}
                >
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
          <Ionicons name="snow-outline" size={20} color={theme.colors.text} />
          <Text style={styles.sectionTitle}>{t("admin.recommendColdStart")}</Text>
        </HStack>
        <Text style={styles.sectionDesc}>
          {t("admin.recommendColdStartHint")}
        </Text>

        <HStack style={styles.coldStartDaysRow}>
          <Text style={styles.coldStartDaysLabel}>{t("admin.recommendTimeWindow")}</Text>
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
            <Text style={styles.ratioPercent}>{t("admin.recommendDays")}</Text>
          </HStack>
        </HStack>

        <Text style={styles.gradeSelectLabel}>{t("admin.recommendGradeFilter")}</Text>
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
                <Text
                  style={[styles.gradeChipDesc, active && styles.gradeChipDescActive]}
                  numberOfLines={2}
                >
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
          <ActivityIndicator color={theme.colors.textInverted} />
        ) : (
          <>
            <Ionicons name="save-outline" size={20} color={theme.colors.textInverted} />
            <Text style={styles.saveButtonText}>
              {dirty ? t("admin.saveConfig") : t("admin.noChanges")}
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
          {t("admin.recommendTips")}
        </Text>
      </HStack>

      <Box style={{ height: 60 }} />
    </ScrollView>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  content: {
    flex: 1,
    padding: t.spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  loadingText: {
    ...t.typography.body,
    color: t.colors.gray400,
    marginTop: t.spacing.md,
  },
  header: {
    alignItems: "center",
    marginBottom: t.spacing.xl,
    paddingVertical: t.spacing.lg,
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.lg,
  },
  headerTitle: {
    ...t.typography.h3,
    color: t.colors.text,
    marginTop: t.spacing.md,
  },
  headerSubtitle: {
    ...t.typography.bodySmall,
    color: t.colors.gray400,
    marginTop: t.spacing.xs,
    textAlign: "center",
  },
  section: {
    backgroundColor: t.colors.card,
    borderRadius: t.borderRadius.lg,
    padding: t.spacing.lg,
    marginBottom: t.spacing.md,
    ...t.shadows.sm,
  },
  sectionHeader: {
    alignItems: "center",
    gap: t.spacing.sm,
    marginBottom: t.spacing.xs,
  },
  sectionTitle: {
    ...t.typography.body,
    color: t.colors.text,
    fontWeight: "700",
  },
  sectionDesc: {
    ...t.typography.caption,
    color: t.colors.gray400,
    marginBottom: t.spacing.md,
  },
  ratioRow: {
    gap: t.spacing.sm,
  },
  ratioItem: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: t.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  ratioLabelGroup: {
    flex: 1,
  },
  ratioLabel: {
    ...t.typography.body,
    color: t.colors.text,
    fontWeight: "600",
  },
  ratioDesc: {
    ...t.typography.caption,
    color: t.colors.gray300,
  },
  ratioInputGroup: {
    alignItems: "center",
    gap: 4,
  },
  ratioInput: {
    width: 56,
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.md,
    textAlign: "center",
    fontSize: 15,
    color: t.colors.text,
    fontWeight: "600",
    backgroundColor: t.colors.surface,
  },
  ratioPercent: {
    ...t.typography.body,
    color: t.colors.gray400,
  },
  sumRow: {
    alignItems: "center",
    justifyContent: "center",
    gap: t.spacing.xs,
    marginTop: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderRadius: t.borderRadius.md,
    backgroundColor: t.colors.surface,
  },
  sumRowError: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.error,
  },
  sumText: {
    ...t.typography.body,
    color: t.colors.success,
    fontWeight: "600",
  },
  sumTextError: {
    color: t.colors.error,
  },
  gradeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.spacing.sm,
  },
  gradeChip: {
    flexGrow: 1,
    flexBasis: "22%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.xs,
    borderRadius: t.borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    minHeight: 56,
  },
  gradeChipActive: {
    backgroundColor: t.colors.cardElevated,
    borderColor: t.colors.text,
    borderWidth: 1,
  },
  gradeChipText: {
    fontSize: 15,
    color: t.colors.text,
    fontWeight: "700",
  },
  gradeChipTextActive: {
    color: t.colors.text,
  },
  gradeChipDesc: {
    fontSize: 10,
    color: t.colors.gray300,
    marginTop: 2,
    textAlign: "center",
    lineHeight: 13,
  },
  gradeChipDescActive: {
    color: t.colors.textSecondary,
  },
  toggleRow: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: {
    ...t.typography.body,
    color: t.colors.text,
    fontWeight: "600",
  },
  toggleDesc: {
    ...t.typography.caption,
    color: t.colors.gray300,
    marginTop: 2,
  },
  coldStartDaysRow: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: t.spacing.md,
  },
  coldStartDaysLabel: {
    ...t.typography.body,
    color: t.colors.text,
    fontWeight: "600",
  },
  gradeSelectLabel: {
    ...t.typography.bodySmall,
    color: t.colors.text,
    fontWeight: "600",
    marginBottom: t.spacing.sm,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.text,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.md,
    gap: t.spacing.sm,
    marginTop: t.spacing.md,
  },
  saveButtonDisabled: {
    backgroundColor: t.colors.gray200,
    opacity: 0.7,
  },
  saveButtonText: {
    ...t.typography.body,
    color: t.colors.textInverted,
    fontWeight: "600",
  },
  tips: {
    alignItems: "flex-start",
    gap: t.spacing.sm,
    backgroundColor: t.colors.surface,
    padding: t.spacing.md,
    borderRadius: t.borderRadius.md,
    marginTop: t.spacing.lg,
  },
  tipsText: {
    ...t.typography.caption,
    color: t.colors.gray400,
    flex: 1,
    lineHeight: 18,
  },
});

export default RecommendConfigTab;
