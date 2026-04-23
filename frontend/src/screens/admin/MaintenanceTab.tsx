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
      Alert.alert("错误", e instanceof Error ? e.message : "加载维护配置失败");
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
      Alert.alert("提示文案不能为空", "开启维护模式时必须填写提示文案");
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
        "保存成功",
        saved.enabled ? "维护模式已开启" : "维护模式已关闭"
      );
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
        <Text style={styles.loadingText}>加载维护配置...</Text>
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
        <Text style={styles.headerTitle}>维护模式</Text>
        <Text style={styles.headerSubtitle}>
          开启后除登录与管理员接口外，App 全站接口统一返回 503，用户会看到维护提示
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
          <Text style={styles.sectionTitle}>维护开关</Text>
        </HStack>
        <HStack style={styles.toggleRow}>
          <VStack style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>
              {config.enabled ? "维护中" : "服务正常"}
            </Text>
            <Text style={styles.toggleDesc}>
              切换开关后需要点击下方“保存”按钮才会生效
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
          <Text style={styles.sectionTitle}>提示文案</Text>
        </HStack>
        <Text style={styles.sectionDesc}>
          用户在 App 内看到的维护提示内容，支持换行
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
            <Text style={styles.resetText}>恢复默认文案</Text>
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
          维护开启后，管理员后台、登录与维护状态查询依然可用；
          普通用户侧所有接口统一返回 503，App 会显示维护遮罩。
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
    paddingHorizontal: theme.spacing.md,
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
  toggleRow: {
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing.sm,
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
  messageInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    ...theme.typography.body,
    color: theme.colors.black,
    backgroundColor: theme.colors.gray50,
  },
  messageFooter: {
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing.sm,
  },
  counter: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
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

export default MaintenanceTab;
