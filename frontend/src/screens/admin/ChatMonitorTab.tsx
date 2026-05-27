/**
 * ChatMonitorTab — 管理员只读的「全站聊天检索」面板。
 *
 * 设计思路:
 *   - 顶部一个搜索框 + 模式切换 (按用户 / 按消息).
 *     * 按用户: 关键字会做 username / email / phone / userId 模糊匹配,
 *       结果是"会话列表"——列出所有命中用户参与的会话.
 *     * 按消息: 关键字做消息正文 ILIKE, 结果是"命中消息列表",每条
 *       消息附带它所在会话的参与者, 让运营直接看到上下文.
 *   - 点击列表项 → 打开全屏 Modal 显示完整消息流, 包含已被软删的消息
 *     (用灰色 "(已删除)" 占位), 方便事后审计.
 *   - 这里全部走 admin 专用接口, 不会泄漏给普通用户.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { useSharedStyles } from "./adminStyles";
import { formatDate } from "./adminUtils";
import {
  adminService,
  type AdminChatConversation,
  type AdminChatConversationDetail,
  type AdminChatMessage,
  type AdminChatParticipant,
  type AdminChatSearchMessage,
} from "../../services/adminService";

type SearchMode = "users" | "messages";

// 把卡片类消息显示成简短标签, 与 chat_service 中后端 preview 逻辑一致.
const CARD_LABELS: Record<string, string> = {
  post_card: "[帖子分享]",
  store_card: "[店铺分享]",
  brand_card: "[品牌分享]",
  show_card: "[秀场分享]",
  user_card: "[名片分享]",
  product_listing: "[商品]",
  offer: "[出价]",
  order_status: "[订单]",
  dispute: "[售后]",
  image: "[图片]",
};

function previewContent(msg: { content: string; messageType: string }): string {
  const label = CARD_LABELS[msg.messageType];
  if (label) {
    try {
      const parsed = JSON.parse(msg.content);
      if (parsed && typeof parsed === "object") {
        for (const key of [
          "title",
          "name",
          "brandName",
          "username",
          "orderNo",
          "reason",
        ]) {
          const v = (parsed as any)[key];
          if (typeof v === "string" && v.trim()) {
            return `${label} ${v.trim()}`;
          }
        }
        const product = (parsed as any).product;
        if (product && typeof product === "object") {
          const title = (product as any).title;
          if (typeof title === "string" && title.trim()) {
            return `${label} ${title.trim()}`;
          }
        }
      }
    } catch {
      // 不是 JSON 就只显示 label.
    }
    return label;
  }
  return msg.content || "";
}

function participantsLabel(p: AdminChatParticipant[]): string {
  if (!p || p.length === 0) return "—";
  return p
    .map((u) => (u.username ? u.username : `#${u.id}`))
    .join(" ↔ ");
}

const ChatMonitorTab: React.FC = () => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();

  const [mode, setMode] = useState<SearchMode>("users");
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [conversations, setConversations] = useState<AdminChatConversation[]>(
    []
  );
  const [matchedMessages, setMatchedMessages] = useState<
    AdminChatSearchMessage[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // 详情 Modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<AdminChatConversationDetail | null>(
    null
  );
  const [detailConvId, setDetailConvId] = useState<number | null>(null);

  const fetchData = useCallback(
    async (nextPage: number, opts: { reset?: boolean } = {}) => {
      const isFirstPage = nextPage === 1;
      if (isFirstPage && opts.reset) {
        setConversations([]);
        setMatchedMessages([]);
      }
      try {
        setLoading(true);
        if (mode === "users") {
          const res = await adminService.getAdminChatConversations({
            keyword: appliedKeyword || undefined,
            page: nextPage,
            pageSize: PAGE_SIZE,
          });
          setTotal(res.total);
          setPage(res.page);
          setConversations((prev) =>
            isFirstPage ? res.conversations : [...prev, ...res.conversations]
          );
        } else {
          if (!appliedKeyword.trim()) {
            setMatchedMessages([]);
            setTotal(0);
            setPage(1);
            return;
          }
          const res = await adminService.searchAdminChatMessages(
            appliedKeyword,
            nextPage,
            PAGE_SIZE
          );
          setTotal(res.total);
          setPage(res.page);
          setMatchedMessages((prev) =>
            isFirstPage ? res.messages : [...prev, ...res.messages]
          );
        }
      } catch (err) {
        console.error("ChatMonitorTab fetch failed:", err);
        Alert.alert(
          t("admin.error"),
          err instanceof Error ? err.message : t("admin.chatMonitor.fetchFailed")
        );
      } finally {
        setLoading(false);
      }
    },
    [mode, appliedKeyword, t]
  );

  useEffect(() => {
    fetchData(1, { reset: true });
  }, [fetchData]);

  const onSubmitSearch = () => {
    Keyboard.dismiss();
    setAppliedKeyword(keyword.trim());
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(1, { reset: true });
    setRefreshing(false);
  }, [fetchData]);

  const onLoadMore = () => {
    if (loading) return;
    const currentCount =
      mode === "users" ? conversations.length : matchedMessages.length;
    if (currentCount >= total) return;
    fetchData(page + 1);
  };

  const openDetail = async (conversationId: number) => {
    setDetailConvId(conversationId);
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await adminService.getAdminChatConversationDetail(
        conversationId,
        { limit: 200 }
      );
      setDetail(res);
    } catch (err) {
      console.error("ChatMonitorTab detail fetch failed:", err);
      Alert.alert(
        t("admin.error"),
        err instanceof Error
          ? err.message
          : t("admin.chatMonitor.fetchDetailFailed")
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const renderConversation = ({ item }: { item: AdminChatConversation }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => openDetail(item.id)}
    >
      <View style={styles.avatarStack}>
        {item.participants.slice(0, 2).map((p, idx) => (
          <View
            key={p.id}
            style={[
              styles.avatarSlot,
              idx === 1 && styles.avatarSlotOverlap,
            ]}
          >
            <UserAvatar uri={p.avatarUrl} name={p.username} size={36} />
          </View>
        ))}
      </View>
      <View style={styles.rowMain}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {participantsLabel(item.participants)}
          </Text>
          <Text style={styles.rowTime}>
            {item.lastMessageAt ? formatDate(item.lastMessageAt) : ""}
          </Text>
        </View>
        <Text style={styles.rowPreview} numberOfLines={1}>
          {item.lastMessagePreview ||
            item.lastMessageText ||
            t("admin.chatMonitor.noMessages")}
        </Text>
        <View style={styles.rowMetaRow}>
          <Text style={styles.rowMeta}>
            {t("admin.chatMonitor.convIdLabel", { id: item.id })}
          </Text>
          <Text style={styles.rowMeta}>
            {t("admin.chatMonitor.messageCount", {
              count: item.messageCount,
            })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderMatchedMessage = ({
    item,
  }: {
    item: AdminChatSearchMessage;
  }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => openDetail(item.conversationId)}
    >
      <UserAvatar uri={item.senderAvatar} name={item.senderName} size={36} />
      <View style={styles.rowMain}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.senderName || `#${item.senderId}`}
          </Text>
          <Text style={styles.rowTime}>
            {item.createdAt ? formatDate(item.createdAt) : ""}
          </Text>
        </View>
        <Text style={styles.rowPreview} numberOfLines={2}>
          {previewContent(item)}
        </Text>
        <View style={styles.rowMetaRow}>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {t("admin.chatMonitor.inConversation", {
              names: participantsLabel(item.participants),
            })}
          </Text>
          <Text style={styles.rowMeta}>
            {t("admin.chatMonitor.convIdLabel", {
              id: item.conversationId,
            })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const data: any[] = mode === "users" ? conversations : matchedMessages;
  const renderItem =
    mode === "users" ? renderConversation : renderMatchedMessage;

  const emptyHint = useMemo(() => {
    if (loading && data.length === 0) {
      return (
        <View style={sharedStyles.loadingContainer}>
          <ActivityIndicator color={theme.colors.black} />
          <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
        </View>
      );
    }
    if (data.length === 0) {
      if (mode === "messages" && !appliedKeyword.trim()) {
        return (
          <View style={sharedStyles.emptyContainer}>
            <Ionicons
              name="search-outline"
              size={48}
              color={theme.colors.gray300}
            />
            <Text style={sharedStyles.emptyText}>
              {t("admin.chatMonitor.enterKeyword")}
            </Text>
          </View>
        );
      }
      return (
        <View style={sharedStyles.emptyContainer}>
          <Ionicons
            name="chatbubbles-outline"
            size={48}
            color={theme.colors.gray300}
          />
          <Text style={sharedStyles.emptyText}>
            {t("admin.chatMonitor.empty")}
          </Text>
        </View>
      );
    }
    return null;
  }, [loading, data.length, mode, appliedKeyword, sharedStyles, t]);

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeChip, mode === "users" && styles.modeChipActive]}
            onPress={() => setMode("users")}
          >
            <Text
              style={[
                styles.modeChipText,
                mode === "users" && styles.modeChipTextActive,
              ]}
            >
              {t("admin.chatMonitor.modeUsers")}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeChip,
              mode === "messages" && styles.modeChipActive,
            ]}
            onPress={() => setMode("messages")}
          >
            <Text
              style={[
                styles.modeChipText,
                mode === "messages" && styles.modeChipTextActive,
              ]}
            >
              {t("admin.chatMonitor.modeMessages")}
            </Text>
          </Pressable>
        </View>
        <View style={styles.searchRow}>
          <Ionicons
            name="search"
            size={18}
            color={theme.colors.gray300}
            style={{ marginRight: 8 }}
          />
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder={
              mode === "users"
                ? t("admin.chatMonitor.placeholderUsers")
                : t("admin.chatMonitor.placeholderMessages")
            }
            placeholderTextColor={theme.colors.gray300}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={onSubmitSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {keyword.length > 0 ? (
            <Pressable
              onPress={() => {
                setKeyword("");
                setAppliedKeyword("");
              }}
              hitSlop={8}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.colors.gray300}
              />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalText}>
            {mode === "users"
              ? t("admin.chatMonitor.totalConversations", { count: total })
              : t("admin.chatMonitor.totalMessages", { count: total })}
          </Text>
        </View>
      </View>

      {emptyHint ? (
        <View style={{ flex: 1 }}>{emptyHint}</View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item: any) =>
            mode === "users" ? `c-${item.id}` : `m-${item.id}`
          }
          renderItem={renderItem as any}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loading && data.length > 0 ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={theme.colors.black} />
              </View>
            ) : null
          }
        />
      )}

      <DetailModal
        visible={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
          setDetailConvId(null);
        }}
        loading={detailLoading}
        detail={detail}
        conversationId={detailConvId}
      />
    </View>
  );
};

// ============================== Detail Modal ==============================

interface DetailModalProps {
  visible: boolean;
  onClose: () => void;
  loading: boolean;
  detail: AdminChatConversationDetail | null;
  conversationId: number | null;
}

const DetailModal: React.FC<DetailModalProps> = ({
  visible,
  onClose,
  loading,
  detail,
  conversationId,
}) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  const renderMessage = ({ item }: { item: AdminChatMessage }) => {
    const isCard = !!CARD_LABELS[item.messageType];
    return (
      <View style={styles.msgRow}>
        <UserAvatar
          uri={item.senderAvatar}
          name={item.senderName}
          size={28}
        />
        <View style={styles.msgBody}>
          <View style={styles.msgHeader}>
            <Text style={styles.msgSender} numberOfLines={1}>
              {item.senderName || `#${item.senderId}`}
            </Text>
            <Text style={styles.msgTime}>
              {item.createdAt ? formatDate(item.createdAt) : ""}
            </Text>
          </View>
          <View
            style={[
              styles.msgBubble,
              item.isDeleted && styles.msgBubbleDeleted,
            ]}
          >
            {item.isDeleted ? (
              <Text style={styles.msgDeleted}>
                {t("admin.chatMonitor.deletedMessage")}
              </Text>
            ) : (
              <Text style={styles.msgContent}>{previewContent(item)}</Text>
            )}
            {!item.isDeleted && isCard ? (
              <Text style={styles.msgRaw} numberOfLines={4}>
                {item.content}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer} edges={["top"]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons
              name="close"
              size={24}
              color={theme.colors.text}
            />
          </Pressable>
          <Text style={styles.modalTitle} numberOfLines={1}>
            {detail
              ? participantsLabel(detail.conversation.participants)
              : conversationId != null
                ? t("admin.chatMonitor.convIdLabel", { id: conversationId })
                : t("admin.chatMonitor.conversation")}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {loading || !detail ? (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <ActivityIndicator color={theme.colors.black} />
          </View>
        ) : (
          <FlatList
            data={detail.messages}
            keyExtractor={(m) => `m-${m.id}`}
            renderItem={renderMessage}
            contentContainerStyle={styles.modalListContent}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            ListHeaderComponent={
              <View style={styles.modalParticipantsBox}>
                {detail.conversation.participants.map((p) => (
                  <View key={p.id} style={styles.participantRow}>
                    <UserAvatar
                      uri={p.avatarUrl}
                      name={p.username}
                      size={32}
                    />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.participantName}>
                        {p.username || `#${p.id}`}
                      </Text>
                      <Text style={styles.participantMeta}>
                        {[`ID: ${p.id}`, p.email, p.phone]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            }
            ListEmptyComponent={
              <View style={{ paddingTop: 40, alignItems: "center" }}>
                <Text style={{ color: theme.colors.gray300 }}>
                  {t("admin.chatMonitor.noMessages")}
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    searchBox: {
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.sm,
      backgroundColor: t.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    modeRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: t.spacing.sm,
    },
    modeChip: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    modeChipActive: {
      backgroundColor: t.colors.text,
      borderColor: t.colors.text,
    },
    modeChipText: {
      ...t.typography.caption,
      color: t.colors.gray400,
      fontWeight: "500",
    },
    modeChipTextActive: {
      color: t.colors.textInverted,
      fontWeight: "600",
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.surface,
      borderRadius: t.borderRadius.md,
      paddingHorizontal: t.spacing.sm,
      height: 40,
    },
    searchInput: {
      flex: 1,
      ...t.typography.body,
      color: t.colors.text,
      padding: 0,
    },
    totalRow: {
      marginTop: 6,
    },
    totalText: {
      ...t.typography.caption,
      color: t.colors.gray300,
    },
    listContent: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.border,
      marginVertical: 4,
    },
    row: {
      flexDirection: "row",
      paddingVertical: t.spacing.sm,
      gap: t.spacing.sm,
      alignItems: "flex-start",
    },
    avatarStack: {
      width: 50,
      height: 40,
    },
    avatarSlot: {
      position: "absolute",
      top: 0,
      left: 0,
    },
    avatarSlotOverlap: {
      left: 16,
      top: 4,
    },
    rowMain: {
      flex: 1,
    },
    rowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    rowTitle: {
      ...t.typography.body,
      color: t.colors.text,
      fontWeight: "600",
      flex: 1,
      marginRight: t.spacing.sm,
    },
    rowTime: {
      ...t.typography.caption,
      color: t.colors.gray300,
    },
    rowPreview: {
      ...t.typography.bodySmall,
      color: t.colors.gray400,
      marginTop: 2,
    },
    rowMetaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 4,
      gap: 8,
    },
    rowMeta: {
      ...t.typography.caption,
      color: t.colors.gray300,
      flexShrink: 1,
    },
    footer: {
      paddingVertical: t.spacing.md,
      alignItems: "center",
    },
    // ===== Detail Modal =====
    modalContainer: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    modalTitle: {
      ...t.typography.h4,
      color: t.colors.text,
      flex: 1,
      textAlign: "center",
      marginHorizontal: t.spacing.sm,
    },
    modalListContent: {
      padding: t.spacing.md,
    },
    modalParticipantsBox: {
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.lg,
      padding: t.spacing.md,
      marginBottom: t.spacing.md,
      gap: 10,
    },
    participantRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    participantName: {
      ...t.typography.body,
      color: t.colors.text,
      fontWeight: "600",
    },
    participantMeta: {
      ...t.typography.caption,
      color: t.colors.gray300,
      marginTop: 2,
    },
    msgRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
    },
    msgBody: {
      flex: 1,
    },
    msgHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    msgSender: {
      ...t.typography.caption,
      color: t.colors.text,
      fontWeight: "600",
      flex: 1,
      marginRight: 8,
    },
    msgTime: {
      ...t.typography.caption,
      color: t.colors.gray300,
    },
    msgBubble: {
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.md,
      padding: t.spacing.sm,
    },
    msgBubbleDeleted: {
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderStyle: "dashed",
    },
    msgContent: {
      ...t.typography.bodySmall,
      color: t.colors.text,
    },
    msgDeleted: {
      ...t.typography.bodySmall,
      color: t.colors.gray300,
      fontStyle: "italic",
    },
    msgRaw: {
      ...t.typography.caption,
      color: t.colors.gray300,
      marginTop: 4,
    },
  });

export default ChatMonitorTab;
