/**
 * UserDataModal — 管理员「用户全量数据查询」面板。
 *
 * 从用户管理的用户详情进入, 聚合该用户在全站的所有数据:
 *   总览  — 档案 + 各业务域数据量 (点击可跳到对应明细)
 *   聊天  — 该用户参与的所有会话, 点进去看完整消息流 (含已软删)
 *   订单  — 作为买家 / 卖家的所有订单
 *   帖子  — 发布的所有帖子 (含未过审 / 已下架)
 *   评论  — 发表的所有评论
 *   评价  — 交易互评 (写的 + 收到的, 含未公开)
 *   仲裁  — 售后仲裁单 (发起的 + 被动卷入的)
 *
 * 全部只读, 走 admin 专用接口; 主题用 useThemedStyles, 自动适配明暗两套。
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { useFormatPrice } from "../../utils/currency";
import { useSharedStyles } from "./adminStyles";
import { formatDate } from "./adminUtils";
import { CARD_LABELS, participantsLabel, previewContent } from "./ChatMonitorTab";
import {
  adminService,
  type AdminChatConversation,
  type AdminChatConversationDetail,
  type AdminChatMessage,
  type AdminComment,
  type AdminOrder,
  type AdminTradeReview,
  type AdminUser,
  type AdminUserDispute,
  type AdminUserOverview,
} from "../../services/adminService";
import type { Post } from "../../services/postService";

type DataTab =
  | "overview"
  | "chats"
  | "orders"
  | "posts"
  | "comments"
  | "reviews"
  | "disputes";

const TAB_ICONS: Record<DataTab, keyof typeof Ionicons.glyphMap> = {
  overview: "grid-outline",
  chats: "chatbubbles-outline",
  orders: "cart-outline",
  posts: "document-text-outline",
  comments: "chatbox-ellipses-outline",
  reviews: "star-outline",
  disputes: "shield-outline",
};

const PAGE_SIZE = 20;

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending_payment: "#F59E0B",
  paid: "#3B82F6",
  shipped: "#3B82F6",
  delivered: "#3B82F6",
  completed: "#10B981",
  settled: "#10B981",
  refunded: "#9CA3AF",
  refunded_auto: "#9CA3AF",
  disputed: "#EF4444",
  resolved: "#9CA3AF",
};

const DISPUTE_STATUS_COLORS: Record<string, string> = {
  open: "#F59E0B",
  investigating: "#3B82F6",
  resolved_refund: "#10B981",
  resolved_release: "#10B981",
  withdrawn: "#9CA3AF",
};

interface UserDataModalProps {
  visible: boolean;
  onClose: () => void;
  user: AdminUser | null;
}

const UserDataModal: React.FC<UserDataModalProps> = ({
  visible,
  onClose,
  user,
}) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [tab, setTab] = useState<DataTab>("overview");

  // visible 切换时重置到总览, 避免上一个用户的页签状态残留
  useEffect(() => {
    if (visible) setTab("overview");
  }, [visible, user?.id]);

  const TABS: { key: DataTab; label: string }[] = [
    { key: "overview", label: t("admin.userData.tabOverview") },
    { key: "chats", label: t("admin.userData.tabChats") },
    { key: "orders", label: t("admin.userData.tabOrders") },
    { key: "posts", label: t("admin.userData.tabPosts") },
    { key: "comments", label: t("admin.userData.tabComments") },
    { key: "reviews", label: t("admin.userData.tabReviews") },
    { key: "disputes", label: t("admin.userData.tabDisputes") },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {user
              ? t("admin.userData.title", { name: user.username, id: user.id })
              : t("admin.userData.titleFallback")}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBar}
          >
            {TABS.map((item) => (
              <Pressable
                key={item.key}
                style={[styles.tabChip, tab === item.key && styles.tabChipActive]}
                onPress={() => setTab(item.key)}
              >
                <Ionicons
                  name={TAB_ICONS[item.key]}
                  size={13}
                  color={
                    tab === item.key
                      ? theme.colors.textInverted
                      : theme.colors.gray400
                  }
                />
                <Text
                  style={[
                    styles.tabChipText,
                    tab === item.key && styles.tabChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {user ? (
          <View style={{ flex: 1 }}>
            {tab === "overview" && (
              <OverviewSection user={user} onJump={setTab} />
            )}
            {tab === "chats" && <ChatsSection userId={user.id} />}
            {tab === "orders" && <OrdersSection userId={user.id} />}
            {tab === "posts" && <PostsSection userId={user.id} />}
            {tab === "comments" && <CommentsSection userId={user.id} />}
            {tab === "reviews" && <ReviewsSection userId={user.id} />}
            {tab === "disputes" && <DisputesSection userId={user.id} />}
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
};

// ============================== 通用小部件 ==============================

const LoadingView: React.FC = () => {
  const sharedStyles = useSharedStyles();
  const { t } = useTranslation();
  return (
    <View style={sharedStyles.loadingContainer}>
      <ActivityIndicator color={theme.colors.text} />
      <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
    </View>
  );
};

const EmptyView: React.FC<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = ({
  icon,
  text,
}) => {
  const sharedStyles = useSharedStyles();
  return (
    <View style={sharedStyles.emptyContainer}>
      <Ionicons name={icon} size={40} color={theme.colors.gray300} />
      <Text style={sharedStyles.emptyText}>{text}</Text>
    </View>
  );
};

const ListFooter: React.FC<{ loading: boolean; hasItems: boolean }> = ({
  loading,
  hasItems,
}) => {
  if (!loading || !hasItems) return null;
  return (
    <View style={{ paddingVertical: 10, alignItems: "center" }}>
      <ActivityIndicator size="small" color={theme.colors.text} />
    </View>
  );
};

/** 分页加载通用 hook: 管 items / total / page / loading / onLoadMore。 */
function usePagedLoader<T>(
  fetcher: (page: number) => Promise<{ items: T[]; total: number; page: number }>
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(
    async (nextPage: number) => {
      try {
        setLoading(true);
        const res = await fetcher(nextPage);
        setTotal(res.total);
        setPage(res.page);
        setItems((prev) =>
          nextPage === 1 ? res.items : [...prev, ...res.items]
        );
      } catch (err) {
        console.error("UserDataModal load failed:", err);
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    },
    [fetcher]
  );

  useEffect(() => {
    setItems([]);
    setTotal(0);
    setLoaded(false);
    load(1);
  }, [load]);

  const onLoadMore = useCallback(() => {
    if (loading || items.length >= total) return;
    load(page + 1);
  }, [loading, items.length, total, page, load]);

  return { items, total, loading, loaded, onLoadMore };
}

// ============================== 总览 ==============================

const OverviewSection: React.FC<{
  user: AdminUser;
  onJump: (tab: DataTab) => void;
}> = ({ user, onJump }) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [overview, setOverview] = useState<AdminUserOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminService
      .getAdminUserOverview(user.id)
      .then((res) => {
        if (!cancelled) setOverview(res);
      })
      .catch((err) => console.error("overview load failed:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  if (loading) return <LoadingView />;
  if (!overview) {
    return (
      <EmptyView icon="alert-circle-outline" text={t("admin.userData.loadFailed")} />
    );
  }

  const s = overview.stats;
  const groups: {
    title: string;
    tiles: { label: string; value: number; jump?: DataTab }[];
  }[] = [
    {
      title: t("admin.userData.groupContent"),
      tiles: [
        { label: t("admin.userData.statPosts"), value: s.posts, jump: "posts" },
        { label: t("admin.userData.statComments"), value: s.comments, jump: "comments" },
        { label: t("admin.userData.statLikes"), value: s.likesGiven },
        { label: t("admin.userData.statFavorites"), value: s.favorites },
      ],
    },
    {
      title: t("admin.userData.groupSocial"),
      tiles: [
        { label: t("admin.followers"), value: s.followers },
        { label: t("admin.following"), value: s.following },
        { label: t("admin.userData.statBlocksInitiated"), value: s.blocksInitiated },
        { label: t("admin.userData.statBlockedBy"), value: s.blockedByOthers },
      ],
    },
    {
      title: t("admin.userData.groupChat"),
      tiles: [
        { label: t("admin.userData.statConversations"), value: s.conversations, jump: "chats" },
        { label: t("admin.userData.statMessagesSent"), value: s.messagesSent, jump: "chats" },
      ],
    },
    {
      title: t("admin.userData.groupTrading"),
      tiles: [
        { label: t("admin.userData.statOrdersBuyer"), value: s.ordersAsBuyer, jump: "orders" },
        { label: t("admin.userData.statOrdersSeller"), value: s.ordersAsSeller, jump: "orders" },
        { label: t("admin.userData.statOffersBuyer"), value: s.offersAsBuyer },
        { label: t("admin.userData.statOffersSeller"), value: s.offersAsSeller },
        { label: t("admin.userData.statAuthOrders"), value: s.authenticationOrders },
        { label: t("admin.userData.statBrowsing"), value: s.browsingHistory },
      ],
    },
    {
      title: t("admin.userData.groupAftersales"),
      tiles: [
        { label: t("admin.userData.statDisputesOpened"), value: s.disputesOpened, jump: "disputes" },
        { label: t("admin.userData.statDisputesInvolved"), value: s.disputesInvolved, jump: "disputes" },
        { label: t("admin.userData.statReviewsWritten"), value: s.reviewsWritten, jump: "reviews" },
        { label: t("admin.userData.statReviewsReceived"), value: s.reviewsReceived, jump: "reviews" },
      ],
    },
    {
      title: t("admin.userData.groupRisk"),
      tiles: [
        { label: t("admin.userData.statReportsFiled"), value: s.reportsFiled },
      ],
    },
  ];

  const u = overview.user;
  return (
    <ScrollView contentContainerStyle={styles.sectionContent}>
      <View style={styles.profileCard}>
        <UserAvatar uri={u.avatarUrl} name={u.username} size={44} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={styles.profileName}>{u.username || `#${u.id}`}</Text>
          <Text style={styles.profileMeta}>
            {[`ID: ${u.id}`, u.phone, u.email].filter(Boolean).join(" · ")}
          </Text>
          <Text style={styles.profileMeta}>
            {[
              u.location,
              u.createdAt
                ? t("admin.userData.registeredAt", {
                    date: new Date(u.createdAt).toLocaleDateString(),
                  })
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      </View>

      {groups.map((group) => (
        <View key={group.title} style={styles.statGroup}>
          <Text style={styles.statGroupTitle}>{group.title}</Text>
          <View style={styles.statGrid}>
            {group.tiles.map((tile) => (
              <Pressable
                key={tile.label}
                style={[styles.statTile, tile.jump && styles.statTileTappable]}
                onPress={tile.jump ? () => onJump(tile.jump!) : undefined}
                disabled={!tile.jump}
              >
                <Text style={styles.statTileValue}>{tile.value}</Text>
                <View style={styles.statTileLabelRow}>
                  <Text style={styles.statTileLabel} numberOfLines={1}>
                    {tile.label}
                  </Text>
                  {tile.jump ? (
                    <Ionicons
                      name="chevron-forward"
                      size={10}
                      color={theme.colors.gray300}
                    />
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

// ============================== 聊天 ==============================

const ChatsSection: React.FC<{ userId: number }> = ({ userId }) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  // 内嵌「会话列表 ↔ 消息流」两级导航, 避免 Modal 套 Modal
  const [activeConv, setActiveConv] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminChatConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetcher = useCallback(
    async (page: number) => {
      const res = await adminService.getAdminChatConversations({
        userId,
        page,
        pageSize: PAGE_SIZE,
      });
      return { items: res.conversations, total: res.total, page: res.page };
    },
    [userId]
  );
  const { items, loading, loaded, onLoadMore } = usePagedLoader(fetcher);

  const openConversation = async (conversationId: number) => {
    setActiveConv(conversationId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await adminService.getAdminChatConversationDetail(
        conversationId,
        { limit: 200 }
      );
      setDetail(res);
    } catch (err) {
      console.error("conversation detail load failed:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  if (activeConv != null) {
    return (
      <View style={{ flex: 1 }}>
        <Pressable
          style={styles.backRow}
          onPress={() => {
            setActiveConv(null);
            setDetail(null);
          }}
        >
          <Ionicons name="chevron-back" size={16} color={theme.colors.text} />
          <Text style={styles.backRowText}>
            {detail
              ? participantsLabel(detail.conversation.participants)
              : t("admin.chatMonitor.convIdLabel", { id: activeConv })}
          </Text>
        </Pressable>
        {detailLoading || !detail ? (
          <LoadingView />
        ) : (
          <FlatList
            data={detail.messages}
            keyExtractor={(m) => `m-${m.id}`}
            renderItem={({ item }) => <MessageRow message={item} />}
            contentContainerStyle={styles.sectionContent}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <EmptyView
                icon="chatbubbles-outline"
                text={t("admin.chatMonitor.noMessages")}
              />
            }
          />
        )}
      </View>
    );
  }

  if (loading && items.length === 0 && !loaded) return <LoadingView />;
  return (
    <FlatList
      data={items}
      keyExtractor={(c: AdminChatConversation) => `c-${c.id}`}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.listRow}
          activeOpacity={0.7}
          onPress={() => openConversation(item.id)}
        >
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
          <Text style={styles.rowMeta}>
            {t("admin.chatMonitor.convIdLabel", { id: item.id })} ·{" "}
            {t("admin.chatMonitor.messageCount", { count: item.messageCount })}
          </Text>
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.sectionContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.4}
      ListFooterComponent={<ListFooter loading={loading} hasItems={items.length > 0} />}
      ListEmptyComponent={
        <EmptyView icon="chatbubbles-outline" text={t("admin.userData.noChats")} />
      }
    />
  );
};

const MessageRow: React.FC<{ message: AdminChatMessage }> = ({ message }) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const isCard = !!CARD_LABELS[message.messageType];
  return (
    <View style={styles.msgRow}>
      <UserAvatar uri={message.senderAvatar} name={message.senderName} size={24} />
      <View style={{ flex: 1 }}>
        <View style={styles.rowHeader}>
          <Text style={styles.msgSender} numberOfLines={1}>
            {message.senderName || `#${message.senderId}`}
          </Text>
          <Text style={styles.rowTime}>
            {message.createdAt ? formatDate(message.createdAt) : ""}
          </Text>
        </View>
        <View
          style={[styles.msgBubble, message.isDeleted && styles.msgBubbleDeleted]}
        >
          {message.isDeleted ? (
            <Text style={styles.msgDeleted}>
              {t("admin.chatMonitor.deletedMessage")}
            </Text>
          ) : (
            <Text style={styles.msgContent}>{previewContent(message)}</Text>
          )}
          {!message.isDeleted && isCard ? (
            <Text style={styles.msgRaw} numberOfLines={4}>
              {message.content}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

// ============================== 订单 ==============================

const OrdersSection: React.FC<{ userId: number }> = ({ userId }) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const formatPrice = useFormatPrice();

  const fetcher = useCallback(
    async (page: number) => {
      const res = await adminService.getAdminOrders({
        userId,
        page,
        pageSize: PAGE_SIZE,
      });
      return { items: res.items, total: res.total, page: res.page };
    },
    [userId]
  );
  const { items, loading, loaded, onLoadMore } = usePagedLoader(fetcher);

  const orderStatusLabel = (status: string) => {
    const key = `trading.orderStatus.${status}`;
    const translated = t(key);
    return translated !== key ? translated : status;
  };

  if (loading && items.length === 0 && !loaded) return <LoadingView />;
  return (
    <FlatList
      data={items}
      keyExtractor={(o: AdminOrder) => `o-${o.id}`}
      renderItem={({ item }) => {
        const statusColor = ORDER_STATUS_COLORS[item.status] || theme.colors.gray300;
        const isBuyer = item.buyerUserId === userId;
        return (
          <View style={styles.card}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {item.orderNo || `#${item.id}`}
              </Text>
              <View
                style={[styles.badge, { backgroundColor: statusColor + "20" }]}
              >
                <Text style={[styles.badgeText, { color: statusColor }]}>
                  {orderStatusLabel(item.status)}
                </Text>
              </View>
            </View>
            <View style={styles.orderBody}>
              {item.product?.coverImage ? (
                <OptimizedImage
                  uri={item.product.coverImage}
                  style={styles.orderCover}
                  size={ImageSize.THUMBNAIL}
                />
              ) : (
                <View style={[styles.orderCover, styles.orderCoverPlaceholder]}>
                  <Ionicons name="cube-outline" size={18} color={theme.colors.gray300} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.product?.title || t("admin.userData.unknownProduct")}
                </Text>
                {item.product?.brand ? (
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.product.brand}
                  </Text>
                ) : null}
                <Text style={styles.orderPrice}>
                  {formatPrice(item.paidPriceCents, item.currency)}
                </Text>
              </View>
              <View
                style={[
                  styles.roleBadge,
                  isBuyer ? styles.roleBadgeBuyer : styles.roleBadgeSeller,
                ]}
              >
                <Text style={styles.roleBadgeText}>
                  {isBuyer
                    ? t("admin.userData.roleBuyer")
                    : t("admin.userData.roleSeller")}
                </Text>
              </View>
            </View>
            <Text style={styles.rowMeta}>
              {[
                item.buyer
                  ? `${t("admin.userData.buyerLabel")}: ${item.buyer.username || `#${item.buyer.id}`}`
                  : null,
                item.seller
                  ? `${t("admin.userData.sellerLabel")}: ${item.seller.username || `#${item.seller.id}`}`
                  : null,
                item.createdAt ? formatDate(item.createdAt) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        );
      }}
      contentContainerStyle={styles.sectionContent}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.4}
      ListFooterComponent={<ListFooter loading={loading} hasItems={items.length > 0} />}
      ListEmptyComponent={
        <EmptyView icon="cart-outline" text={t("admin.userData.noOrders")} />
      }
    />
  );
};

// ============================== 帖子 ==============================

const PostsSection: React.FC<{ userId: number }> = ({ userId }) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  const fetcher = useCallback(
    async (page: number) => {
      const res = await adminService.getAllPosts({
        userId,
        page,
        pageSize: PAGE_SIZE,
      });
      return { items: res.posts, total: res.total, page: res.page };
    },
    [userId]
  );
  const { items, loading, loaded, onLoadMore } = usePagedLoader(fetcher);

  if (loading && items.length === 0 && !loaded) return <LoadingView />;
  return (
    <FlatList
      data={items}
      keyExtractor={(p: Post) => `p-${p.id}`}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.title || t("admin.userData.untitledPost")}
            </Text>
            <Text style={styles.rowTime}>
              {item.createdAt ? formatDate(item.createdAt) : ""}
            </Text>
          </View>
          {item.contentText ? (
            <Text style={styles.rowPreview} numberOfLines={2}>
              {item.contentText}
            </Text>
          ) : null}
          <View style={styles.chipRow}>
            <View style={styles.badgeMuted}>
              <Text style={styles.badgeMutedText}>#{item.id}</Text>
            </View>
            <View style={styles.badgeMuted}>
              <Text style={styles.badgeMutedText}>{item.status}</Text>
            </View>
            {item.auditStatus ? (
              <View style={styles.badgeMuted}>
                <Text style={styles.badgeMutedText}>{item.auditStatus}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="heart-outline" size={11} color={theme.colors.gray300} />
              <Text style={styles.rowTime}>{item.likeCount}</Text>
              <Ionicons
                name="chatbubble-outline"
                size={11}
                color={theme.colors.gray300}
                style={{ marginLeft: 6 }}
              />
              <Text style={styles.rowTime}>{item.commentCount}</Text>
            </View>
          </View>
        </View>
      )}
      contentContainerStyle={styles.sectionContent}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.4}
      ListFooterComponent={<ListFooter loading={loading} hasItems={items.length > 0} />}
      ListEmptyComponent={
        <EmptyView icon="document-text-outline" text={t("admin.userData.noPosts")} />
      }
    />
  );
};

// ============================== 评论 ==============================

const CommentsSection: React.FC<{ userId: number }> = ({ userId }) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminService
      .getCommentsByUser(userId)
      .then((res) => {
        if (!cancelled) setComments(res);
      })
      .catch((err) => console.error("comments load failed:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) return <LoadingView />;
  return (
    <FlatList
      data={comments}
      keyExtractor={(c) => `cm-${c.id}`}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {t("admin.userData.onPost", {
                title: item.postTitle || `#${item.postId}`,
              })}
            </Text>
            <Text style={styles.rowTime}>
              {item.createdAt ? formatDate(item.createdAt) : ""}
            </Text>
          </View>
          <Text style={styles.rowContent}>{item.content}</Text>
        </View>
      )}
      contentContainerStyle={styles.sectionContent}
      ListEmptyComponent={
        <EmptyView
          icon="chatbox-ellipses-outline"
          text={t("admin.userData.noComments")}
        />
      }
    />
  );
};

// ============================== 评价 ==============================

const ReviewsSection: React.FC<{ userId: number }> = ({ userId }) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [role, setRole] = useState<"all" | "written" | "received">("all");

  const fetcher = useCallback(
    async (page: number) => {
      const res = await adminService.getAdminUserTradeReviews(userId, {
        role,
        page,
        pageSize: PAGE_SIZE,
      });
      return { items: res.reviews, total: res.total, page: res.page };
    },
    [userId, role]
  );
  const { items, loading, loaded, onLoadMore } = usePagedLoader(fetcher);

  const roleFilters: { key: typeof role; label: string }[] = [
    { key: "all", label: t("common.all") },
    { key: "written", label: t("admin.userData.reviewsWritten") },
    { key: "received", label: t("admin.userData.reviewsReceived") },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filterRow}>
        {roleFilters.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.tabChip, role === f.key && styles.tabChipActive]}
            onPress={() => setRole(f.key)}
          >
            <Text
              style={[
                styles.tabChipText,
                role === f.key && styles.tabChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading && items.length === 0 && !loaded ? (
        <LoadingView />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r: AdminTradeReview) => `r-${r.id}`}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.rowHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons
                      key={n}
                      name={n <= item.rating ? "star" : "star-outline"}
                      size={12}
                      color={n <= item.rating ? "#F59E0B" : theme.colors.gray300}
                    />
                  ))}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {!item.visible ? (
                    <View style={styles.badgeMuted}>
                      <Text style={styles.badgeMutedText}>
                        {t("admin.userData.reviewHidden")}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.rowTime}>
                    {item.submittedAt ? formatDate(item.submittedAt) : ""}
                  </Text>
                </View>
              </View>
              {item.comment ? (
                <Text style={styles.rowContent}>{item.comment}</Text>
              ) : null}
              <Text style={styles.rowMeta}>
                {t("admin.userData.reviewDirection", {
                  from: item.reviewerName || `#${item.reviewerUserId}`,
                  to: item.targetName || `#${item.targetUserId}`,
                })}
                {item.orderNo ? ` · ${item.orderNo}` : ""}
              </Text>
            </View>
          )}
          contentContainerStyle={styles.sectionContent}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <ListFooter loading={loading} hasItems={items.length > 0} />
          }
          ListEmptyComponent={
            <EmptyView icon="star-outline" text={t("admin.userData.noReviews")} />
          }
        />
      )}
    </View>
  );
};

// ============================== 仲裁 ==============================

const DisputesSection: React.FC<{ userId: number }> = ({ userId }) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  const fetcher = useCallback(
    async (page: number) => {
      const res = await adminService.getAdminUserDisputes(userId, {
        page,
        pageSize: PAGE_SIZE,
      });
      return { items: res.disputes, total: res.total, page: res.page };
    },
    [userId]
  );
  const { items, loading, loaded, onLoadMore } = usePagedLoader(fetcher);

  const statusLabel = (status: string) => {
    const key = `admin.disputeStatus.${status}`;
    const translated = t(key);
    return translated !== key ? translated : status;
  };
  const reasonLabel = (reason: string) => {
    const key = `admin.disputeReason.${reason}`;
    const translated = t(key);
    return translated !== key ? translated : reason;
  };

  if (loading && items.length === 0 && !loaded) return <LoadingView />;
  return (
    <FlatList
      data={items}
      keyExtractor={(d: AdminUserDispute) => `d-${d.id}`}
      renderItem={({ item }) => {
        const color = DISPUTE_STATUS_COLORS[item.status] || theme.colors.gray300;
        return (
          <View style={styles.card}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {reasonLabel(item.reason)}
              </Text>
              <View style={[styles.badge, { backgroundColor: color + "20" }]}>
                <Text style={[styles.badgeText, { color }]}>
                  {statusLabel(item.status)}
                </Text>
              </View>
            </View>
            {item.description ? (
              <Text style={styles.rowPreview} numberOfLines={3}>
                {item.description}
              </Text>
            ) : null}
            {item.csDecision ? (
              <Text style={styles.rowContent}>
                {t("admin.userData.csDecision", { decision: item.csDecision })}
              </Text>
            ) : null}
            <Text style={styles.rowMeta}>
              {[
                item.orderNo || `${t("admin.userData.orderLabel")} #${item.orderId}`,
                t("admin.userData.openerLabel", {
                  name: item.openerName || `#${item.openerUserId}`,
                }),
                item.createdAt ? formatDate(item.createdAt) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        );
      }}
      contentContainerStyle={styles.sectionContent}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.4}
      ListFooterComponent={<ListFooter loading={loading} hasItems={items.length > 0} />}
      ListEmptyComponent={
        <EmptyView icon="shield-outline" text={t("admin.userData.noDisputes")} />
      }
    />
  );
};

// ============================== 样式 ==============================

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingVertical: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    headerTitle: {
      ...t.typography.h4,
      fontSize: 15,
      lineHeight: 20,
      color: t.colors.text,
      flex: 1,
      textAlign: "center",
      marginHorizontal: t.spacing.sm,
    },
    tabBar: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    tabChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 4,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    tabChipActive: {
      backgroundColor: t.colors.text,
      borderColor: t.colors.text,
    },
    tabChipText: {
      ...t.typography.caption,
      fontSize: 11,
      lineHeight: 14,
      color: t.colors.gray400,
      fontWeight: "500",
    },
    tabChipTextActive: {
      color: t.colors.textInverted,
      fontWeight: "600",
    },
    sectionContent: {
      padding: 10,
      flexGrow: 1,
    },
    // 总览
    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.card,
      borderRadius: 4,
      padding: 10,
      marginBottom: 10,
      ...t.shadows.sm,
    },
    profileName: {
      ...t.typography.body,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "600",
      color: t.colors.text,
    },
    profileMeta: {
      ...t.typography.caption,
      fontSize: 11,
      lineHeight: 14,
      color: t.colors.gray300,
      marginTop: 2,
    },
    statGroup: {
      marginBottom: 10,
    },
    statGroupTitle: {
      ...t.typography.caption,
      fontSize: 11,
      lineHeight: 14,
      color: t.colors.gray400,
      fontWeight: "600",
      marginBottom: 6,
    },
    statGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    statTile: {
      width: "31.5%",
      backgroundColor: t.colors.card,
      borderRadius: 4,
      paddingVertical: 8,
      paddingHorizontal: 8,
      ...t.shadows.sm,
    },
    statTileTappable: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    statTileValue: {
      fontSize: 16,
      fontWeight: "700",
      color: t.colors.text,
    },
    statTileLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 2,
    },
    statTileLabel: {
      ...t.typography.caption,
      fontSize: 10,
      lineHeight: 13,
      color: t.colors.gray300,
      flexShrink: 1,
    },
    // 列表通用
    listRow: {
      paddingVertical: 8,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.border,
    },
    card: {
      backgroundColor: t.colors.card,
      borderRadius: 4,
      padding: 10,
      marginBottom: t.spacing.sm,
      ...t.shadows.sm,
    },
    rowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    rowTitle: {
      ...t.typography.body,
      fontSize: 13,
      lineHeight: 17,
      color: t.colors.text,
      fontWeight: "600",
      flex: 1,
    },
    rowTime: {
      ...t.typography.caption,
      fontSize: 11,
      lineHeight: 14,
      color: t.colors.gray300,
    },
    rowPreview: {
      ...t.typography.bodySmall,
      fontSize: 12,
      lineHeight: 16,
      color: t.colors.gray400,
      marginTop: 3,
    },
    rowContent: {
      ...t.typography.bodySmall,
      fontSize: 12,
      lineHeight: 16,
      color: t.colors.text,
      marginTop: 4,
    },
    rowMeta: {
      ...t.typography.caption,
      fontSize: 11,
      lineHeight: 14,
      color: t.colors.gray300,
      marginTop: 4,
    },
    chipRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 6,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeText: {
      ...t.typography.caption,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "600",
    },
    badgeMuted: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: t.colors.gray100,
    },
    badgeMutedText: {
      ...t.typography.caption,
      fontSize: 10,
      lineHeight: 13,
      color: t.colors.gray400,
      fontWeight: "500",
    },
    filterRow: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 10,
      paddingTop: 8,
    },
    // 聊天
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    backRowText: {
      ...t.typography.body,
      fontSize: 13,
      lineHeight: 17,
      color: t.colors.text,
      fontWeight: "600",
      flex: 1,
    },
    msgRow: {
      flexDirection: "row",
      gap: 6,
      alignItems: "flex-start",
    },
    msgSender: {
      ...t.typography.caption,
      fontSize: 11,
      lineHeight: 14,
      color: t.colors.text,
      fontWeight: "600",
      flex: 1,
    },
    msgBubble: {
      backgroundColor: t.colors.card,
      borderRadius: 4,
      padding: 7,
      marginTop: 3,
    },
    msgBubbleDeleted: {
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderStyle: "dashed",
    },
    msgContent: {
      ...t.typography.bodySmall,
      fontSize: 12,
      lineHeight: 16,
      color: t.colors.text,
    },
    msgDeleted: {
      ...t.typography.bodySmall,
      fontSize: 12,
      lineHeight: 16,
      color: t.colors.gray300,
      fontStyle: "italic",
    },
    msgRaw: {
      ...t.typography.caption,
      fontSize: 11,
      lineHeight: 14,
      color: t.colors.gray300,
      marginTop: 4,
    },
    // 订单
    orderBody: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
    },
    orderCover: {
      width: 44,
      height: 44,
      borderRadius: 4,
      backgroundColor: t.colors.gray100,
    },
    orderCoverPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    orderPrice: {
      fontSize: 13,
      fontWeight: "700",
      color: t.colors.text,
      marginTop: 2,
    },
    roleBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 6,
    },
    roleBadgeBuyer: {
      backgroundColor: "#3B82F620",
    },
    roleBadgeSeller: {
      backgroundColor: "#10B98120",
    },
    roleBadgeText: {
      ...t.typography.caption,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "600",
      color: t.colors.gray400,
    },
  });

export default UserDataModal;
