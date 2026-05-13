import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { theme, useThemedStyles, type AppTheme } from "../../theme";
import {
  MaintenanceConfig,
  getMaintenanceConfig,
  updateMaintenanceConfig,
} from "../../services/adminService";
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  useMaintenanceStore,
} from "../../store/maintenanceStore";
import { Box, HStack, VStack, Text, Pressable, ScrollView } from "../../components/ui";

/**
 * MaintenanceTab
 * ------------------------------------------------------------------
 * 管理员维护模式控制台：开关 + 自定义提示文案。
 *
 * 设计要点：
 * - 单一数据源：保存成功后把最新配置回写到本地 maintenance store，
 *   让管理员当前设备立即看到或收起遮罩，无需等待轮询。
 * - 离线可感知：加载/保存失败用 Alert 明确告警，避免“静默失败”。
 */

const DEFAULT_CONFIG: MaintenanceConfig = {
  enabled: false,
  message: DEFAULT_MAINTENANCE_MESSAGE,
};

const MaintenanceTab = () => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [config, setConfig] = useState<MaintenanceConfig>(DEFAULT_CONFIG);
  const [messageInput, setMessageInput] = useState(DEFAULT_MAINTENANCE_MESSAGE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const applyStatusToLocalStore = useMaintenanceStore((s) => s.setStatus);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMaintenanceConfig();
      setConfig(data);
      setMessageInput(data.message || DEFAULT_MAINTENANCE_MESSAGE);
      setDirty(false);
    } catch (e) {
      Alert.alert(t("admin.error"), e instanceof Error ? e.message : t("admin.fetchMaintenanceFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleToggle = (value: boolean) => {
    setConfig((prev) => ({ ...prev, enabled: value }));
    setDirty(true);
  };

  const handleMessageChange = (text: string) => {
    setMessageInput(text);
    setDirty(true);
  };

  const handleReset = () => {
    setMessageInput(DEFAULT_MAINTENANCE_MESSAGE);
    setDirty(true);
  };

  const handleSave = async () => {
    const trimmed = messageInput.trim();
    if (config.enabled && trimmed.length === 0) {
      Alert.alert(t("admin.maintenanceMessageEmpty"), t("admin.maintenanceMessageRequired"));
      return;
    }

    try {
      setSaving(true);
      const saved = await updateMaintenanceConfig({
        enabled: config.enabled,
        message: trimmed || DEFAULT_MAINTENANCE_MESSAGE,
      });
      setConfig(saved);
      setMessageInput(saved.message);
      setDirty(false);
      // 立刻同步当前管理员设备的遮罩状态，避免要等下一次轮询
      applyStatusToLocalStore(saved.enabled, saved.message);
      Alert.alert(
        t("admin.saveSuccess"),
        saved.enabled ? t("admin.maintenanceEnabled") : t("admin.maintenanceDisabled")
      );
    } catch (e) {
      Alert.alert(t("admin.saveFailed"), e instanceof Error ? e.message : t("common.retryLater"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.black} />
        <Text style={styles.loadingText}>{t("admin.loadingMaintenance")}</Text>
      </Box>
    );
  }

  return (
    <ScrollView
      style={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <VStack style={styles.header}>
        <Ionicons name="construct-outline" size={32} color={theme.colors.black} />
        <Text style={styles.headerTitle}>{t("admin.maintenanceTitle")}</Text>
        <Text style={styles.headerSubtitle}>
          {t("admin.maintenanceSubtitle")}
        </Text>
      </VStack>

      {/* ===== Toggle ===== */}
      <Box style={styles.section}>
        <HStack style={styles.sectionHeader}>
          <Ionicons
            name={config.enabled ? "power" : "power-outline"}
            size={20}
            color={config.enabled ? theme.colors.error : theme.colors.black}
          />
          <Text style={styles.sectionTitle}>{t("admin.maintenanceToggle")}</Text>
        </HStack>
        <HStack style={styles.toggleRow}>
          <VStack style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>
              {config.enabled ? t("admin.maintenanceOn") : t("admin.maintenanceOff")}
            </Text>
            <Text style={styles.toggleDesc}>
              {t("admin.maintenanceToggleHint")}
            </Text>
          </VStack>
          <Switch
            value={config.enabled}
            onValueChange={handleToggle}
            trackColor={{ false: theme.colors.gray200, true: theme.colors.error }}
            thumbColor={theme.colors.white}
          />
        </HStack>
      </Box>

      {/* ===== Message ===== */}
      <Box style={styles.section}>
        <HStack style={styles.sectionHeader}>
          <Ionicons name="chatbubble-outline" size={20} color={theme.colors.black} />
          <Text style={styles.sectionTitle}>{t("admin.maintenanceMessage")}</Text>
        </HStack>
        <Text style={styles.sectionDesc}>
          {t("admin.maintenanceMessageHint")}
        </Text>
        <TextInput
          style={styles.messageInput}
          value={messageInput}
          onChangeText={handleMessageChange}
          multiline
          numberOfLines={4}
          maxLength={500}
          placeholder={DEFAULT_MAINTENANCE_MESSAGE}
          placeholderTextColor={theme.colors.gray300}
          textAlignVertical="top"
        />
        <HStack style={styles.messageFooter}>
          <Text style={styles.counter}>{messageInput.length}/500</Text>
          <Pressable onPress={handleReset} style={styles.resetButton}>
            <Ionicons name="refresh-outline" size={14} color={theme.colors.gray400} />
            <Text style={styles.resetText}>{t("admin.maintenanceResetDefault")}</Text>
          </Pressable>
        </HStack>
      </Box>

      {/* ===== Save ===== */}
      <Pressable
        style={[
          styles.saveButton,
          (!dirty || saving) && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={!dirty || saving}
      >
        {saving ? (
          <ActivityIndicator color={theme.colors.white} />
        ) : (
          <>
            <Ionicons name="save-outline" size={20} color={theme.colors.white} />
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
          {t("admin.maintenanceTips")}
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
    backgroundColor: t.colors.gray50,
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
    paddingHorizontal: t.spacing.md,
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
  toggleRow: {
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: t.spacing.sm,
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
  messageInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: t.colors.gray200,
    borderRadius: t.borderRadius.md,
    padding: t.spacing.sm,
    ...t.typography.body,
    color: t.colors.text,
    backgroundColor: t.colors.gray50,
  },
  messageFooter: {
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: t.spacing.sm,
  },
  counter: {
    ...t.typography.caption,
    color: t.colors.gray300,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetText: {
    ...t.typography.caption,
    color: t.colors.gray400,
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
    backgroundColor: t.colors.gray300,
  },
  saveButtonText: {
    ...t.typography.body,
    color: t.colors.textInverted,
    fontWeight: "600",
  },
  tips: {
    alignItems: "flex-start",
    gap: t.spacing.sm,
    backgroundColor: t.colors.gray50,
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

export default MaintenanceTab;
