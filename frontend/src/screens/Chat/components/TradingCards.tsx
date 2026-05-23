/**
 * PRD 模块 7 · IM 4 种富媒体卡片渲染器。
 *
 * 4 种 message_type：
 *   - product_listing  商品卡片
 *   - offer            出价卡片
 *   - order_status     订单状态卡片
 *   - dispute          争议卡片
 *
 * content 字段统一约定为 JSON 字符串；解析失败时返回 null，由 MessageBubble 回退到文本渲染。
 */
import React from "react";
import {
  TouchableOpacity,
  View,
  Text,
  Image,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatPrice } from "../../../services/storeProductService";
import {
  formatOrderStatus,
  formatOfferStatus,
  OrderStatus,
  OfferStatus,
} from "../../../services/orderService";
import {
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";

// ---------- payload types ----------

export interface ProductListingCard {
  productId: number;
  title: string;
  priceCents: number;
  coverImage?: string;
  brand?: string;
}

export interface OfferCard {
  offerId: number;
  productId: number;
  priceCents: number;
  status: OfferStatus;
  expiresAt?: string;
  parentOfferId?: number | null;
  product?: {
    productId: number;
    title?: string | null;
    brand?: string | null;
    priceCents?: number | null;
    coverImage?: string | null;
  } | null;
}

export interface OrderStatusCard {
  orderId: number;
  orderNo: string;
  status: OrderStatus;
  paidPriceCents: number;
}

export interface DisputeCard {
  disputeId: number;
  orderId: number;
  reason: string;
  status: string;
}

// ---------- parse helpers ----------

export function tryParseProductListingCard(
  content: string,
): ProductListingCard | null {
  try {
    const o = JSON.parse(content);
    if (typeof o?.productId === "number" && typeof o?.title === "string") {
      return o as ProductListingCard;
    }
  } catch {}
  return null;
}

export function tryParseOfferCard(content: string): OfferCard | null {
  try {
    const o = JSON.parse(content);
    if (typeof o?.offerId === "number" && typeof o?.priceCents === "number") {
      return o as OfferCard;
    }
  } catch {}
  return null;
}

export function tryParseOrderStatusCard(
  content: string,
): OrderStatusCard | null {
  try {
    const o = JSON.parse(content);
    if (typeof o?.orderId === "number" && typeof o?.orderNo === "string") {
      return o as OrderStatusCard;
    }
  } catch {}
  return null;
}

export function tryParseDisputeCard(content: string): DisputeCard | null {
  try {
    const o = JSON.parse(content);
    if (typeof o?.disputeId === "number" && typeof o?.orderId === "number") {
      return o as DisputeCard;
    }
  } catch {}
  return null;
}

// ---------- renderers ----------

export function ProductListingCardView({
  data,
  isMine,
  onPress,
}: {
  data: ProductListingCard;
  isMine: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isMine ? styles.cardMine : styles.cardOther,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        {data.coverImage ? (
          <Image source={{ uri: data.coverImage }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons
              name="image-outline"
              size={28}
              color={theme.colors.gray300}
            />
          </View>
        )}
        <View style={styles.col}>
          <Text style={styles.label}>商品</Text>
          <Text style={styles.title} numberOfLines={2}>
            {data.title}
          </Text>
          {data.brand ? (
            <Text style={styles.muted}>{data.brand}</Text>
          ) : null}
          <Text style={styles.price}>{formatPrice(data.priceCents)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function OfferCardView({
  data,
  isMine,
  onPress,
}: {
  data: OfferCard;
  isMine: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const isCounter = (data.parentOfferId ?? null) !== null;
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isMine ? styles.cardMine : styles.cardOther,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.headerRow}>
        <Ionicons
          name="swap-horizontal"
          size={18}
          color={theme.colors.text}
        />
        <Text style={styles.headerLabel}>
          {isCounter ? "还价" : "出价"} #{data.offerId}
        </Text>
        <Text style={styles.statusPill}>{formatOfferStatus(data.status)}</Text>
      </View>
      {data.product ? (
        <View style={styles.productLine}>
          {data.product.coverImage ? (
            <Image
              source={{ uri: data.product.coverImage }}
              style={styles.miniThumb}
            />
          ) : (
            <View style={[styles.miniThumb, styles.thumbPlaceholder]}>
              <Ionicons
                name="image-outline"
                size={14}
                color={theme.colors.gray300}
              />
            </View>
          )}
          <Text style={styles.miniTitle} numberOfLines={1}>
            {data.product.title ?? `#${data.productId}`}
          </Text>
        </View>
      ) : null}
      <Text style={styles.bigPrice}>{formatPrice(data.priceCents)}</Text>
      {data.expiresAt ? (
        <Text style={styles.muted}>
          到期 {data.expiresAt.slice(0, 16)}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export function OrderStatusCardView({
  data,
  isMine,
  onPress,
}: {
  data: OrderStatusCard;
  isMine: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isMine ? styles.cardMine : styles.cardOther,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.headerRow}>
        <Ionicons
          name="receipt-outline"
          size={18}
          color={theme.colors.text}
        />
        <Text style={styles.headerLabel}>订单 #{data.orderNo}</Text>
        <Text style={styles.statusPill}>{formatOrderStatus(data.status)}</Text>
      </View>
      <Text style={styles.bigPrice}>{formatPrice(data.paidPriceCents)}</Text>
      <Text style={styles.muted}>点击查看订单详情</Text>
    </TouchableOpacity>
  );
}

export function DisputeCardView({
  data,
  isMine,
  onPress,
}: {
  data: DisputeCard;
  isMine: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[
        styles.card,
        styles.cardWarn,
        isMine ? styles.cardMine : styles.cardOther,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.headerRow}>
        <Ionicons
          name="alert-circle"
          size={18}
          color={theme.colors.error}
        />
        <Text style={[styles.headerLabel, { color: theme.colors.error }]}>
          争议 #{data.disputeId}
        </Text>
        <Text style={[styles.statusPill, { color: theme.colors.error }]}>
          {data.status}
        </Text>
      </View>
      <Text style={styles.title}>原因：{data.reason}</Text>
      <Text style={styles.muted}>订单 #{data.orderId}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      minWidth: 220,
      maxWidth: 280,
      borderRadius: 12,
      padding: 12,
      backgroundColor: t.colors.cardElevated,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    cardMine: { borderColor: t.colors.accent },
    cardOther: {},
    cardWarn: {
      borderColor: t.mode === "dark" ? "#4A1E1E" : "#F1C0C0",
      backgroundColor: t.mode === "dark" ? "#2A1414" : "#FFF5F5",
    },
    row: { flexDirection: "row", gap: 12 },
    col: { flex: 1 },
    thumb: { width: 60, height: 60, borderRadius: 8 },
    thumbPlaceholder: {
      backgroundColor: t.colors.skeleton,
      alignItems: "center",
      justifyContent: "center",
    },
    label: { fontSize: 11, color: t.colors.gray300 },
    title: { fontSize: 14, color: t.colors.text, marginVertical: 4 },
    muted: { fontSize: 12, color: t.colors.gray300 },
    price: {
      fontSize: 16,
      fontWeight: "700",
      color: t.colors.text,
      marginTop: 4,
    },
    bigPrice: {
      fontSize: 22,
      fontWeight: "700",
      color: t.colors.text,
      marginVertical: 8,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    headerLabel: {
      flex: 1,
      fontSize: 12,
      color: t.colors.text,
      fontWeight: "600",
    },
    statusPill: { fontSize: 11, color: t.colors.gray300 },
    productLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    miniThumb: { width: 24, height: 24, borderRadius: 4 },
    miniTitle: { flex: 1, fontSize: 12, color: t.colors.gray400 },
  });
