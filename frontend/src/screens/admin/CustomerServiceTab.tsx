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
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import { sharedStyles } from "./adminStyles";
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

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const min = Math.floor(ms / 60000);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  if (hrs < 24) return `${hrs}小时前`;
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString("zh-CN");
}

const DEFAULT_CONFIG: AutoReplyConfig = {
  enabled: true,
  message:
    "您好，感谢您联系 Avant Regard 客服！\n\n我们已收到您的消息，会尽快回复。\n如需紧急帮助，请发送邮件至：support@avantregard.com\n\n工作时间：周一至周五 9:00-18:00（北京时间）",
  email: "support@avantregard.com",
};

const CustomerServiceTab = () => {
  const navigation = useNavigation();
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
      Alert.alert("保存成功", "自动回复配置已更新");
    } catch {
      Alert.alert("保存失败", "请稍后再试");
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
        otherUserName: c.otherUser?.username || "用户",
        otherUserAvatar: c.otherUser?.avatarUrl,
        otherUserId: c.otherUser?.userId,
      });
    },
    [navigation]
  );

  const handleDelete = useCallback(
    (c: Conversation) => {
      Alert.alert(
        "删除会话",
        `确认删除与「${c.otherUser?.username || "用户"}」的客服对话？`,
        [
          { text: "取消", style: "cancel" },
          {
            text: "删除",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteConversation(c.id);
                setConversations((prev) => prev.filter((x) => x.id !== c.id));
              } catch {
                Alert.alert("错误", "删除失败，请稍后再试");
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
            size={18}
            color={theme.colors.black}
          />
          <Text style={styles.settingsTitle}>自动回复设置</Text>
        </View>
        <View style={styles.settingsHeaderRight}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: config.enabled ? theme.colors.success : theme.colors.gray200 },
            ]}
          />
          <Text style={styles.statusLabel}>
            {config.enabled ? "已开启" : "已关闭"}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
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
              style={{ paddingVertical: 20 }}
            />
          ) : (
            <>
              <View style={styles.toggleRow}>
                <Text style={styles.fieldLabel}>启用自动回复</Text>
                <Switch
                  value={config.enabled}
                  onValueChange={(v) => updateField("enabled", v)}
                  trackColor={{ false: theme.colors.gray200, true: theme.colors.success }}
                  thumbColor={theme.colors.white}
                />
              </View>

              <Text style={styles.fieldLabel}>客服邮箱</Text>
              <TextInput
                style={styles.emailInput}
                value={config.email}
                onChangeText={(v) => updateField("email", v)}
                placeholder="例如：support@avantregard.com"
                placeholderTextColor={theme.colors.gray200}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>回复内容</Text>
              <TextInput
                style={styles.messageInput}
                value={config.message}
                onChangeText={(v) => updateField("message", v)}
                placeholder="输入自动回复的内容..."
                placeholderTextColor={theme.colors.gray200}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.fieldHint}>
                当用户首次发送消息给客服时，将自动发送此回复
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
                  <Text style={styles.saveButtonText}>保存设置</Text>
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
          <UserAvatar uri={other?.avatarUrl} name={other?.username} size={48} />
          {hasUnread && (
            <NotificationBadge count={item.unreadCount} size="md" showBorder />
          )}
        </View>

        <View style={styles.info}>
          <View style={styles.topRow}>
            <Text style={styles.username} numberOfLines={1}>
              {other?.username || "未知用户"}
            </Text>
            <Text style={styles.time}>{formatTime(item.lastMessageAt)}</Text>
          </View>
          <Text
            style={[styles.message, hasUnread && styles.messageUnread]}
            numberOfLines={1}
          >
            {item.lastMessageText || "暂无消息"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={sharedStyles.loadingContainer}>
        <Ionicons name="chatbubbles-outline" size={40} color={theme.colors.gray200} />
        <Text style={sharedStyles.loadingText}>加载中...</Text>
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
                  共 {conversations.length} 个会话
                  {totalUnread > 0 ? `，${totalUnread} 条未读` : ""}
                </Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={sharedStyles.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={theme.colors.gray200}
            />
            <Text style={sharedStyles.emptyText}>暂无客服会话</Text>
            <Text style={sharedStyles.emptySubtext}>
              用户发起客服对话后将显示在此处
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  // ---------- Auto-reply settings ----------
  settingsCard: {
    margin: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    overflow: "hidden",
  },
  settingsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  settingsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingsTitle: {
    ...theme.typography.bodySmall,
    fontWeight: "600",
    color: theme.colors.black,
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
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  settingsBody: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.gray100,
    paddingTop: theme.spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    ...theme.typography.caption,
    fontWeight: "600",
    color: theme.colors.gray400,
    marginBottom: 6,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    marginBottom: theme.spacing.md,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    minHeight: 120,
    textAlignVertical: "top",
  },
  fieldHint: {
    ...theme.typography.caption,
    color: theme.colors.gray200,
    marginTop: 4,
    marginBottom: theme.spacing.md,
  },
  saveButton: {
    backgroundColor: theme.colors.black,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.white,
    fontWeight: "600",
  },
  // ---------- Conversation list ----------
  statsBar: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
  },
  statsText: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
  },
  avatarWrap: {
    position: "relative",
    marginRight: theme.spacing.md,
  },
  info: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  username: {
    ...theme.typography.bodySmall,
    fontWeight: "600",
    color: theme.colors.black,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  time: {
    ...theme.typography.caption,
    color: theme.colors.gray200,
  },
  message: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray300,
  },
  messageUnread: {
    color: theme.colors.black,
    fontWeight: "500",
  },
});

export default CustomerServiceTab;
