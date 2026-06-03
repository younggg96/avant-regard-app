import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
  Switch,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import { useSharedStyles } from "./adminStyles";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { NotificationBadge } from "../../components/ui/NotificationBadge";
import {
  Conversation,
  getConversations,
  deleteConversation,
} from "../../services/chatService";
import {
  AutoReplyConfig,
  getAutoReplyConfig,
  updateAutoReplyConfig,
} from "../../services/adminService";

function formatTime(iso: string | null, t: (key: string, opts?: Record<string, any>) => string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const min = Math.floor(ms / 60000);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);
  if (min < 1) return t("time.justNow");
  if (min < 60) return t("time.minutesAgo", { count: min });
  if (hrs < 24) return t("time.hoursAgo", { count: hrs });
  if (days < 7) return t("time.daysAgo", { count: days });
  return d.toLocaleDateString();
}

const DEFAULT_CONFIG: AutoReplyConfig = {
  enabled: true,
  message:
    "您好，感谢您联系 Avant Regard 客服！\n\n我们已收到您的消息，会尽快回复。\n如需紧急帮助，请发送邮件至：support@avantregard.com\n\n工作时间：周一至周五 9:00-18:00（北京时间）",
  email: "support@avantregard.com",
};

const CustomerServiceTab = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auto-reply state
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<AutoReplyConfig>(DEFAULT_CONFIG);
  const [configLoading, setConfigLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const data = await getAutoReplyConfig();
      setConfig(data);
      setDirty(false);
    } catch {
      // keep defaults
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const data = await getConversations();
      const sorted = [...data].sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      });
      setConversations(sorted);
    } catch (e) {
      console.error("Failed to load CS conversations:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadConfig()]);
    setRefreshing(false);
  }, [loadData, loadConfig]);

  const handleSaveConfig = useCallback(async () => {
    Keyboard.dismiss();
    setSaving(true);
    try {
      const updated = await updateAutoReplyConfig(config);
      setConfig(updated);
      setDirty(false);
      Alert.alert(t("admin.saveSuccess"), t("admin.csAutoReplyUpdated"));
    } catch {
      Alert.alert(t("admin.saveFailed"), t("common.retryLater"));
    } finally {
      setSaving(false);
    }
  }, [config]);

  const updateField = useCallback(
    <K extends keyof AutoReplyConfig>(key: K, value: AutoReplyConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
    },
    []
  );

  const handlePress = useCallback(
    (c: Conversation) => {
      (navigation.navigate as any)("Chat", {
        conversationId: c.id,
        otherUserName: c.otherUser?.username || t("profile.user"),
        otherUserAvatar: c.otherUser?.avatarUrl,
        otherUserId: c.otherUser?.userId,
      });
    },
    [navigation]
  );

  const handleDelete = useCallback(
    (c: Conversation) => {
      Alert.alert(
        t("interaction.deleteConversation"),
        t("admin.csDeleteConfirm", { name: c.otherUser?.username || t("profile.user") }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              try {
                await deleteConversation(c.id);
                setConversations((prev) => prev.filter((x) => x.id !== c.id));
              } catch {
                Alert.alert(t("admin.error"), t("admin.deleteFailed"));
              }
            },
          },
        ]
      );
    },
    []
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const renderAutoReplySettings = () => (
    <View style={styles.settingsCard}>
      <TouchableOpacity
        style={styles.settingsHeader}
        activeOpacity={0.7}
        onPress={() => setExpanded((v) => !v)}
      >
        <View style={styles.settingsHeaderLeft}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={16}
            color={theme.colors.black}
          />
          <Text style={styles.settingsTitle}>{t("admin.csAutoReplySettings")}</Text>
        </View>
        <View style={styles.settingsHeaderRight}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: config.enabled ? theme.colors.success : theme.colors.gray200 },
            ]}
          />
          <Text style={styles.statusLabel}>
            {config.enabled ? t("admin.csEnabled") : t("admin.csClosed")}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={theme.colors.gray300}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.settingsBody}>
          {configLoading ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.gray300}
              style={{ paddingVertical: 16 }}
            />
          ) : (
            <>
              <View style={styles.toggleRow}>
                <Text style={styles.fieldLabel}>{t("admin.csEnableAutoReply")}</Text>
                <Switch
                  value={config.enabled}
                  onValueChange={(v) => updateField("enabled", v)}
                  trackColor={{ false: theme.colors.gray200, true: theme.colors.success }}
                  thumbColor={theme.colors.white}
                />
              </View>

              <Text style={styles.fieldLabel}>{t("admin.csEmail")}</Text>
              <TextInput
                style={styles.emailInput}
                value={config.email}
                onChangeText={(v) => updateField("email", v)}
                placeholder="例如：support@avantregard.com"
                placeholderTextColor={theme.colors.gray200}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>{t("admin.csReplyContent")}</Text>
              <TextInput
                style={styles.messageInput}
                value={config.message}
                onChangeText={(v) => updateField("message", v)}
                placeholder={t("admin.csReplyPlaceholder")}
                placeholderTextColor={theme.colors.gray200}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.fieldHint}>
                {t("admin.csReplyHint")}
              </Text>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!dirty || saving) && styles.saveButtonDisabled,
                ]}
                activeOpacity={0.7}
                onPress={handleSaveConfig}
                disabled={!dirty || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>{t("admin.saveConfig")}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );

  const renderItem = ({ item }: { item: Conversation }) => {
    const other = item.otherUser;
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => handlePress(item)}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.avatarWrap}>
          <UserAvatar uri={other?.avatarUrl} name={other?.username} size={38} />
          {hasUnread && (
            <NotificationBadge count={item.unreadCount} size="md" showBorder />
          )}
        </View>

        <View style={styles.info}>
          <View style={styles.topRow}>
            <Text style={styles.username} numberOfLines={1}>
              {other?.username || t("interaction.unknownUser")}
            </Text>
            <Text style={styles.time}>{formatTime(item.lastMessageAt, t)}</Text>
          </View>
          <Text
            style={[styles.message, hasUnread && styles.messageUnread]}
            numberOfLines={1}
          >
            {item.lastMessageText || t("interaction.noMessages")}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={sharedStyles.loadingContainer}>
        <Ionicons name="chatbubbles-outline" size={36} color={theme.colors.gray200} />
        <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => `cs-${item.id}`}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.black}
          />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {renderAutoReplySettings()}
            {conversations.length > 0 && (
              <View style={styles.statsBar}>
                <Text style={styles.statsText}>
                  {t("admin.csConversationCount", { count: conversations.length })}
                  {totalUnread > 0 ? t("admin.csUnreadCount", { count: totalUnread }) : ""}
                </Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={sharedStyles.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={40}
              color={theme.colors.gray200}
            />
            <Text style={sharedStyles.emptyText}>{t("admin.csNoConversations")}</Text>
            <Text style={sharedStyles.emptySubtext}>
              {t("admin.csNoConversationsHint")}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  // ---------- Auto-reply settings ----------
  settingsCard: {
    margin: 10,
    marginBottom: t.spacing.sm,
    backgroundColor: t.colors.card,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: t.colors.border,
    overflow: "hidden",
  },
  settingsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  settingsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  settingsTitle: {
    ...t.typography.bodySmall,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    color: t.colors.text,
  },
  settingsHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray300,
  },
  settingsBody: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    paddingTop: 10,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  fieldLabel: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    color: t.colors.gray400,
    marginBottom: 4,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    ...t.typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.text,
    marginBottom: t.spacing.sm,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    ...t.typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.text,
    minHeight: 90,
    textAlignVertical: "top",
  },
  fieldHint: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray200,
    marginTop: 4,
    marginBottom: t.spacing.sm,
  },
  saveButton: {
    backgroundColor: t.colors.text,
    borderRadius: 4,
    paddingVertical: 8,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    ...t.typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.textInverted,
    fontWeight: "600",
  },
  // ---------- Conversation list ----------
  statsBar: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  statsText: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray300,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  avatarWrap: {
    position: "relative",
    marginRight: 10,
  },
  info: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  username: {
    ...t.typography.bodySmall,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    color: t.colors.text,
    flex: 1,
    marginRight: t.spacing.sm,
  },
  time: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray200,
  },
  message: {
    ...t.typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.gray300,
  },
  messageUnread: {
    color: t.colors.text,
    fontWeight: "500",
  },
});

export default CustomerServiceTab;
