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
import React, { useState } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useFormatPrice } from "../../../utils/currency";
import {
  formatOrderStatus,
  formatOfferStatus,
  adminRefundOrder,
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
  currency?: string;
  shippingDueAt?: string;
  autoConfirmDueAt?: string;
  note?: string;
  product?: {
    productId: number;
    title?: string | null;
    brand?: string | null;
    priceCents?: number | null;
    coverImage?: string | null;
  } | null;
  shipment?: {
    carrier?: string | null;
    trackingNo?: string | null;
    signedAt?: string | null;
  } | null;
}

export interface DisputeCard {
  disputeId: number;
  orderId: number;
  /** 已经在后端做过中文化的展示文案（i18n 友好），缺省时回落到 rawReason */
  reason: string;
  /** 已经在后端做过中文化的展示文案，缺省时回落到 rawStatus */
  status: string;
  /** Enum 原值，便于前端按 key 做多语言或图标切换 */
  rawReason?: string;
  rawStatus?: string;
  note?: string | null;
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
  const { t } = useTranslation();
  const theme = useAppTheme();
  const formatPrice = useFormatPrice();
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
          <Text style={styles.label}>{t("trading.cards.productLabel")}</Text>
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
  const { t } = useTranslation();
  const theme = useAppTheme();
  const formatPrice = useFormatPrice();
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
          {t(
            isCounter
              ? "trading.cards.counterHeader"
              : "trading.cards.offerHeader",
            { id: data.offerId },
          )}
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
          {t("trading.cards.expiresAt", {
            date: data.expiresAt.slice(0, 16),
          })}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

/** 客服 IM 售后 v1：仅在 admin 视角且订单处于可退款状态下展示退款按钮。 */
const REFUNDABLE_STATUSES: Set<string> = new Set([
  "paid",
  "shipped",
  "delivered",
  "completed",
]);

export function OrderStatusCardView({
  data,
  isMine,
  isCustomerService = false,
  onPress,
  onPay,
  onRefunded,
}: {
  data: OrderStatusCard;
  isMine: boolean;
  /** 当前会话当事人为官方客服（admin）时才允许显示退款按钮。 */
  isCustomerService?: boolean;
  onPress: () => void;
  onPay?: () => void;
  /** 退款成功后回调，便于上层就地隐藏按钮 / 触发刷新。 */
  onRefunded?: (updatedStatus: OrderStatus) => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const formatPrice = useFormatPrice();
  const styles = useThemedStyles(makeStyles);
  const pending = data.status === "pending_payment";
  const hasShipment =
    !!data.shipment && (data.shipment.carrier || data.shipment.trackingNo);
  // 本地状态：成功后立刻替换 pill + 隐藏按钮，等后端推的新卡片到达后再覆盖一次。
  const [refundLoading, setRefundLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState<OrderStatus | null>(null);
  const effectiveStatus = (localStatus ?? data.status) as OrderStatus;
  const canRefund =
    isCustomerService && REFUNDABLE_STATUSES.has(effectiveStatus);

  const requestRefund = () => {
    Alert.alert(
      t("trading.aftersales.cs.refundConfirmTitle"),
      t("trading.aftersales.cs.refundConfirmMessage", { orderNo: data.orderNo }),
      [
        { text: t("trading.aftersales.cs.refundCancel"), style: "cancel" },
        {
          text: t("trading.aftersales.cs.refundSubmit"),
          style: "destructive",
          onPress: async () => {
            setRefundLoading(true);
            try {
              const updated = await adminRefundOrder(data.orderId);
              setLocalStatus(updated.status as OrderStatus);
              onRefunded?.(updated.status as OrderStatus);
              Alert.alert(t("trading.aftersales.cs.refundSuccess"));
            } catch (e: any) {
              Alert.alert(
                t("trading.aftersales.cs.refundFailed"),
                e?.message ?? "",
              );
            } finally {
              setRefundLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isMine ? styles.cardMine : styles.cardOther,
        pending && styles.cardPending,
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
        <Text style={styles.headerLabel}>
          {t("trading.cards.orderHeader", { no: data.orderNo })}
        </Text>
        <Text style={styles.statusPill}>{formatOrderStatus(effectiveStatus)}</Text>
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
            {data.product.title ?? `#${data.product.productId}`}
          </Text>
        </View>
      ) : null}
      <Text style={styles.bigPrice}>
        {formatPrice(data.paidPriceCents, data.currency)}
      </Text>
      {hasShipment ? (
        <View style={styles.shipmentBlock}>
          <View style={styles.shipmentRow}>
            <Ionicons
              name="cube-outline"
              size={14}
              color={theme.colors.gray300}
            />
            <Text style={styles.shipmentText} numberOfLines={1}>
              {[data.shipment?.carrier, data.shipment?.trackingNo]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          {data.shipment?.signedAt ? (
            <Text style={styles.shipmentSigned}>
              {t("trading.cards.signedAt", {
                date: data.shipment.signedAt.slice(0, 16),
              })}
            </Text>
          ) : null}
        </View>
      ) : null}
      {pending && onPay ? (
        <TouchableOpacity
          style={styles.payInlineBtn}
          onPress={(e) => {
            e.stopPropagation?.();
            onPay();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.payInlineBtnText}>
            {t("trading.payment.payNow")}
          </Text>
        </TouchableOpacity>
      ) : canRefund ? (
        <TouchableOpacity
          style={[styles.refundBtn, refundLoading && { opacity: 0.5 }]}
          onPress={(e) => {
            e.stopPropagation?.();
            if (!refundLoading) requestRefund();
          }}
          activeOpacity={0.7}
          disabled={refundLoading}
        >
          {refundLoading ? (
            <ActivityIndicator size="small" color={theme.colors.error} />
          ) : (
            <>
              <Ionicons
                name="return-down-back-outline"
                size={14}
                color={theme.colors.error}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.refundBtnText}>
                {t("trading.aftersales.cs.refundButton")}
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <Text style={styles.muted}>{t("trading.cards.tapToViewOrder")}</Text>
      )}
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
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  // 优先用 raw enum 做多语言；缺省时回落到后端给的展示文案
  const reasonText = data.rawReason
    ? t(`trading.cards.disputeReasons.${data.rawReason}`, {
        defaultValue: data.reason,
      })
    : data.reason;
  const statusText = data.rawStatus
    ? t(`trading.cards.disputeStatuses.${data.rawStatus}`, {
        defaultValue: data.status,
      })
    : data.status;

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
          {t("trading.cards.disputeHeader", { id: data.disputeId })}
        </Text>
        <Text style={[styles.statusPill, { color: theme.colors.error }]}>
          {statusText}
        </Text>
      </View>
      <Text style={styles.title}>
        {t("trading.cards.disputeReason", { reason: reasonText })}
      </Text>
      {data.note ? (
        <Text style={styles.muted} numberOfLines={2}>
          {data.note}
        </Text>
      ) : null}
      <Text style={styles.muted}>
        {t("trading.cards.disputeOrderRef", { id: data.orderId })}
      </Text>
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
    cardPending: {
      borderColor: t.colors.plusGold,
      backgroundColor: t.mode === "dark" ? "#1F1A0A" : "#FFFBEE",
    },
    payInlineBtn: {
      marginTop: 8,
      paddingVertical: 8,
      borderRadius: 4,
      backgroundColor: t.colors.accent,
      alignItems: "center",
    },
    payInlineBtnText: {
      color: t.colors.textInverted,
      fontSize: 13,
      fontWeight: "600",
    },
    refundBtn: {
      flexDirection: "row",
      marginTop: 8,
      paddingVertical: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.error,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    refundBtnText: {
      color: t.colors.error,
      fontSize: 13,
      fontWeight: "600",
    },
    shipmentBlock: {
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    shipmentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    shipmentText: {
      flex: 1,
      fontSize: 12,
      color: t.colors.gray400,
    },
    shipmentSigned: {
      fontSize: 11,
      color: t.colors.gray300,
      marginTop: 2,
    },
  });
