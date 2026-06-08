/**
 * 交易聊天 header 下的「订单信息」区块。
 *
 * 行为（对应需求）：
 *   - 默认展示买卖双方之间「最新」的订单；
 *   - 多笔订单时可左右切换查看「之前」的订单；
 *   - 整个区块可折叠收起，但每次进入聊天都会重新展开（组件挂载即重置为展开）。
 *
 * 复用：OptimizedImage（封面）、useFormatPrice（金额）、formatOrderStatus（状态文案），
 * 颜色全部走主题，支持 DarkTheme / LightTheme；圆角统一 4。
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../../theme";
import { OptimizedImage } from "../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../utils/imageUtils";
import { useFormatPrice } from "../../../utils/currency";
import {
  listOrdersWithUser,
  formatOrderStatus,
  Order,
} from "../../../services/orderService";
import {
  buildTradeReviewParams,
  getOrderReviewStatus,
} from "../../../services/aftersalesService";

interface ChatOrderSectionProps {
  /** 对端用户 id；缺省 / 客服会话时不渲染。 */
  counterpartUserId?: number;
  /** 会话 id —— 变化即视为「进入新的聊天」，重置展开状态与选中项。 */
  conversationId: number;
  enabled?: boolean;
}

function formatOrderDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(i18n.language === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const ChatOrderSection = ({
  counterpartUserId,
  conversationId,
  enabled = true,
}: ChatOrderSectionProps) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const formatPrice = useFormatPrice();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [canReview, setCanReview] = useState(false);

  useEffect(() => {
    // 进入新会话：重置为「展开 + 选中最新（index 0）」。
    setCollapsed(false);
    setIndex(0);

    if (!enabled || !counterpartUserId) {
      setOrders([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listOrdersWithUser(counterpartUserId)
      .then((res) => {
        if (!cancelled) setOrders(res.items || []);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [counterpartUserId, conversationId, enabled]);

  const goNewer = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);
  const goOlder = useCallback(() => {
    setIndex((i) => Math.min(orders.length - 1, i + 1));
  }, [orders.length]);

  const openOrder = useCallback(
    (orderId: number) => {
      (navigation.navigate as any)("OrderDetail", { orderId });
    },
    [navigation],
  );

  const currentOrder = orders[Math.min(index, Math.max(orders.length - 1, 0))];

  useEffect(() => {
    if (!currentOrder) {
      setCanReview(false);
      return;
    }
    if (!["completed", "settled", "resolved"].includes(currentOrder.status)) {
      setCanReview(false);
      return;
    }
    let cancelled = false;
    getOrderReviewStatus(currentOrder.id)
      .then((st) => {
        if (!cancelled) setCanReview(st.canReview);
      })
      .catch(() => {
        if (!cancelled) setCanReview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentOrder?.id, currentOrder?.status]);

  const goReview = useCallback(() => {
    if (!currentOrder) return;
    (navigation.navigate as any)("TradeReview", buildTradeReviewParams(currentOrder));
  }, [currentOrder, navigation]);

  // 首次加载或无订单时不占位，避免聊天区抖动。
  if (!enabled || (!loading && orders.length === 0)) return null;
  if (loading && orders.length === 0) {
    return (
      <View style={styles.loadingBar}>
        <ActivityIndicator size="small" color={theme.colors.gray300} />
      </View>
    );
  }

  const total = orders.length;
  const safeIndex = Math.min(index, total - 1);
  const order = orders[safeIndex];
  const product = order.product;
  const dateStr = formatOrderDate(order.createdAt);
  const statusStr = formatOrderStatus(order.status);

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Ionicons name="receipt-outline" size={15} color={theme.colors.gray400} />
        <Text style={styles.headerTitle}>{t("chat.orderSection.title")}</Text>
        {total > 1 && (
          <View style={styles.pager}>
            <TouchableOpacity
              onPress={goNewer}
              disabled={safeIndex === 0}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="chevron-back"
                size={16}
                color={safeIndex === 0 ? theme.colors.gray200 : theme.colors.gray500}
              />
            </TouchableOpacity>
            <Text style={styles.pagerText}>{`${safeIndex + 1}/${total}`}</Text>
            <TouchableOpacity
              onPress={goOlder}
              disabled={safeIndex >= total - 1}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="chevron-forward"
                size={16}
                color={
                  safeIndex >= total - 1
                    ? theme.colors.gray200
                    : theme.colors.gray500
                }
              />
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity
          onPress={() => setCollapsed((c) => !c)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={
            collapsed ? t("chat.orderSection.expand") : t("chat.orderSection.collapse")
          }
          style={styles.collapseBtn}
        >
          <Ionicons
            name={collapsed ? "chevron-down" : "chevron-up"}
            size={18}
            color={theme.colors.gray400}
          />
        </TouchableOpacity>
      </View>

      {!collapsed && (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => openOrder(order.id)}
        >
          {product?.coverImage ? (
            <OptimizedImage
              uri={product.coverImage}
              size={ImageSize.THUMBNAIL}
              style={styles.thumb}
              contentFit="cover"
              lazy
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons name="image-outline" size={22} color={theme.colors.gray300} />
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.metaLine} numberOfLines={1}>
              {dateStr ? `${statusStr} · ${dateStr}` : statusStr}
            </Text>
            <Text style={styles.title} numberOfLines={1}>
              {product?.title || `#${order.orderNo}`}
            </Text>
            {product?.brand ? (
              <Text style={styles.brand} numberOfLines={1}>
                {product.brand}
              </Text>
            ) : null}
          </View>
          <View style={styles.right}>
            <Text style={styles.price}>
              {formatPrice(order.paidPriceCents, order.currency)}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.gray300} />
          </View>
        </TouchableOpacity>
      )}

      {!collapsed && canReview ? (
        <TouchableOpacity style={styles.reviewBtn} onPress={goReview} activeOpacity={0.8}>
          <Ionicons name="star-outline" size={14} color={theme.colors.textInverted} />
          <Text style={styles.reviewBtnText}>{t("chat.orderSection.writeReview")}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: t.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      paddingHorizontal: t.spacing.md,
      paddingTop: 8,
      paddingBottom: 10,
    },
    loadingBar: {
      backgroundColor: t.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      paddingVertical: 10,
      alignItems: "center",
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    headerTitle: {
      flex: 1,
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.gray500,
    },
    pager: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginRight: 4,
    },
    pagerText: {
      fontSize: 11,
      color: t.colors.gray400,
      minWidth: 26,
      textAlign: "center",
    },
    collapseBtn: {
      padding: 2,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      padding: 8,
      borderRadius: 4,
      backgroundColor: t.colors.cardElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    thumb: {
      width: 52,
      height: 52,
      borderRadius: 4,
      backgroundColor: t.colors.skeleton,
    },
    thumbPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    info: {
      flex: 1,
      marginLeft: 10,
    },
    metaLine: {
      fontSize: 11,
      color: t.colors.gray400,
      marginBottom: 2,
    },
    title: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
    },
    brand: {
      fontSize: 12,
      color: t.colors.gray300,
      marginTop: 1,
    },
    right: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      marginLeft: 8,
    },
    price: {
      fontSize: 15,
      fontWeight: "700",
      color: t.colors.text,
    },
    reviewBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 8,
      paddingVertical: 10,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.accent,
    },
    reviewBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.textInverted,
      lineHeight: 18,
    },
  });
