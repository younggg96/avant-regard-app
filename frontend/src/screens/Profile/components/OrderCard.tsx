/**
 * OrderCard —— 订单卡片(Profile「交易」tab 用)。
 *
 * 布局:
 *   - 买家: 三列 —— 左图 / 左对齐文案 / 右栏 status + 日期；底部操作右对齐
 *   - 卖家: 三列 —— 左图 / 中文案 / 右栏 status + 日期 + 操作按钮
 *
 * 业务字段两个来源:
 *   - 订单本身 (`order.status` / `paidPriceCents` / `createdAt` …)
 *   - 后端在 `/api/orders/me` 返回里挂的 `order.product` 摘要 (品牌 / 标题 /
 *     封面图 / 标价)。后者缺失时降级为占位图 + 「商品 #id」标题。
 */
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { Box, HStack, VStack, Text, Pressable } from "../../../components/ui";
import { OptimizedImage } from "../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../utils/imageUtils";
import {
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";
import {
  Order,
  OrderStatus,
  formatOrderStatus,
} from "../../../services/orderService";
import { orderStatusVisual } from "../../../utils/orderStatusVisual";
import { createConversation } from "../../../services/chatService";
import { useAuthStore } from "../../../store/authStore";
import { Alert } from "../../../utils/Alert";
import { useFormatPrice } from "../../../utils/currency";

type OrderRole = "buyer" | "seller";

const COVER_SIZE = 96;

interface OrderCardProps {
  order: Order;
  /** 控制底部主操作按钮的语义。买家视角 vs 卖家视角同一个状态下点法不同。 */
  role: OrderRole;
  onPress?: () => void;
  onPay?: () => void;
  onViewShipment?: () => void;
  onConfirmReceipt?: () => void;
  onShip?: () => void;
  onReview?: () => void;
  onViewAfterSales?: () => void;
}

const isSolidPrimaryAction = (
  status: OrderStatus,
  role: OrderRole,
): boolean =>
  (role === "seller" && status === "paid") ||
  (role === "buyer" && status === "pending_payment");

/**
 * 决定卡片右下角主按钮的角色 + 文案。
 * 同一状态在「买家视角」和「卖家视角」下含义不同 (例如 paid:
 *  买家 = 等卖家发货, 卖家 = 应该发货), 所以显式按 role 分支。
 */
const pickPrimaryAction = (
  order: Order,
  role: OrderRole,
  t: (k: string) => string,
  handlers: Pick<
    OrderCardProps,
    | "onPay"
    | "onViewShipment"
    | "onConfirmReceipt"
    | "onShip"
    | "onReview"
    | "onViewAfterSales"
  >,
): { label: string; onPress: () => void } | null => {
  const status = order.status;
  if (role === "buyer") {
    if (status === "pending_payment" && handlers.onPay) {
      return { label: t("trading.payment.payNow"), onPress: handlers.onPay };
    }
    if (status === "shipped" && handlers.onViewShipment) {
      return {
        label: t("trading.tradingTab.viewShipment"),
        onPress: handlers.onViewShipment,
      };
    }
    if (status === "delivered" && handlers.onConfirmReceipt) {
      return {
        label: t("trading.tradingTab.confirmReceipt"),
        onPress: handlers.onConfirmReceipt,
      };
    }
    if ((status === "completed" || status === "settled") && handlers.onReview) {
      return { label: t("trading.tradingTab.viewReview"), onPress: handlers.onReview };
    }
  } else {
    if (status === "paid" && handlers.onShip) {
      return { label: t("trading.tradingTab.ship"), onPress: handlers.onShip };
    }
    if (status === "shipped" && handlers.onViewShipment) {
      return {
        label: t("trading.tradingTab.viewShipment"),
        onPress: handlers.onViewShipment,
      };
    }
    if (
      (status === "completed" || status === "settled" || status === "delivered") &&
      handlers.onReview
    ) {
      return {
        label: t("trading.tradingTab.viewReview"),
        onPress: handlers.onReview,
      };
    }
    if (
      (status === "disputed" ||
        status === "refunded" ||
        status === "refunded_auto" ||
        status === "resolved") &&
      handlers.onViewAfterSales
    ) {
      return {
        label: t("trading.tradingTab.viewAfterSales"),
        onPress: handlers.onViewAfterSales,
      };
    }
  }
  return null;
};

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  role,
  onPress,
  onPay,
  onViewShipment,
  onConfirmReceipt,
  onShip,
  onReview,
  onViewAfterSales,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();
  const navigation = useNavigation<any>();
  const meUserId = useAuthStore((s) => s.user?.userId);
  const [contactLoading, setContactLoading] = useState(false);

  const product = order.product ?? null;
  const cover = product?.coverImage || null;
  const brand = product?.brand || "";
  const title =
    product?.title ||
    t("trading.orders.productLabel", { id: order.productId });
  const price = order.paidPriceCents || product?.priceCents || 0;
  const currency = order.currency || product?.currency || "CNY";

  const statusVisual = orderStatusVisual(order.status, theme);
  const primaryAction = pickPrimaryAction(order, role, t, {
    onPay,
    onViewShipment,
    onConfirmReceipt,
    onShip,
    onReview,
    onViewAfterSales,
  });

  // 「联系卖家 / 联系买家」—— 与 OrderDetailScreen.handleContactCounterparty
  // 同逻辑：买家拨给 sellerUserId，卖家拨给 buyerUserId。把入口直接挂到
  // OrderCard 上，让买家不必先点进订单详情就能私聊（符合「订单入口内需要
  // 有直接与卖家联系的能力」的产品诉求）。createConversation 接口幂等，
  // 重复点会复用既有 conversation。
  const counterpartyUserId =
    role === "buyer"
      ? order.sellerUserId ?? null
      : order.buyerUserId ?? null;
  const canContactCounterparty =
    counterpartyUserId != null &&
    counterpartyUserId > 0 &&
    counterpartyUserId !== meUserId;

  const handleContactCounterparty = async () => {
    if (!counterpartyUserId || contactLoading) return;
    try {
      setContactLoading(true);
      const { conversationId } = await createConversation(counterpartyUserId);
      navigation.navigate("Chat", {
        conversationId,
        otherUserName: t("profile.user"),
        otherUserId: counterpartyUserId,
      });
    } catch (e: any) {
      Alert.show(
        t("common.failed"),
        e?.message ?? t("trading.orderDetail.contactFailed"),
      );
    } finally {
      setContactLoading(false);
    }
  };

  const hasFooter =
    canContactCounterparty || (role === "buyer" && !!primaryAction);

  const renderStatusPill = () => (
    <View style={[styles.statusPill, { backgroundColor: statusVisual.bg }]}>
      <Text style={[styles.statusPillText, { color: statusVisual.fg }]}>
        {formatOrderStatus(order.status)}
      </Text>
    </View>
  );

  const renderDate = () =>
    order.createdAt ? (
      <Text style={styles.timeText}>{order.createdAt.slice(5, 10)}</Text>
    ) : null;

  const renderActionButton = (solid: boolean) =>
    primaryAction ? (
      <Pressable
        style={solid ? styles.actionBtnPrimary : styles.actionBtnOutline}
        onPress={primaryAction.onPress}
      >
        <Text
          style={solid ? styles.actionBtnPrimaryText : styles.actionBtnOutlineText}
          numberOfLines={1}
        >
          {primaryAction.label}
        </Text>
      </Pressable>
    ) : null;

  const coverBlock = (
    <Box style={styles.coverWrap}>
      {cover ? (
        <OptimizedImage
          uri={cover}
          size={ImageSize.THUMBNAIL}
          style={styles.cover}
          contentFit="cover"
          lazy
        />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Ionicons
            name="image-outline"
            size={32}
            color={theme.colors.gray300}
          />
        </View>
      )}
    </Box>
  );

  const renderStatusCol = (withAction: boolean) => (
    <VStack style={styles.statusCol} alignItems="flex-end">
      <VStack alignItems="flex-end" space="xs">
        {renderStatusPill()}
        {renderDate()}
      </VStack>
      {withAction ? (
        <>
          <View style={styles.statusColSpacer} />
          {renderActionButton(isSolidPrimaryAction(order.status, role))}
        </>
      ) : null}
    </VStack>
  );

  const detailsBlock = (
    <VStack flex={1} space="xs" style={styles.detailsCol}>
      {!!brand && (
        <Text
          style={role === "seller" ? styles.brandSeller : styles.brandBuyer}
          numberOfLines={1}
        >
          {brand}
        </Text>
      )}
      <Text
        style={role === "seller" ? styles.titleSeller : styles.titleBuyer}
        numberOfLines={2}
      >
        {title}
      </Text>
      <Text style={styles.price}>{formatPrice(price, currency)}</Text>
    </VStack>
  );

  return (
    <View style={styles.card}>
      <Pressable onPress={onPress}>
        <HStack alignItems="stretch" space="md" style={styles.body}>
          {coverBlock}
          {detailsBlock}
          {renderStatusCol(role === "seller")}
        </HStack>
      </Pressable>

      {hasFooter ? (
        <View style={styles.footerRow}>
          {canContactCounterparty ? (
            <Pressable
              style={styles.contactBtn}
              onPress={handleContactCounterparty}
              disabled={contactLoading}
              accessibilityRole="button"
              accessibilityLabel={
                role === "buyer"
                  ? t("trading.orderDetail.contactSeller")
                  : t("trading.orderDetail.contactBuyer")
              }
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={14}
                color={theme.colors.text}
              />
              <Text style={styles.contactBtnText} numberOfLines={1}>
                {role === "buyer"
                  ? t("trading.orderDetail.contactSeller")
                  : t("trading.orderDetail.contactBuyer")}
              </Text>
            </Pressable>
          ) : null}
          {role === "buyer" && primaryAction
            ? renderActionButton(isSolidPrimaryAction(order.status, role))
            : null}
        </View>
      ) : null}
    </View>
  );
};
OrderCard.displayName = "OrderCard";

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.borderRadius.md,
      padding: t.spacing.sm,
      marginBottom: t.spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      position: "relative",
    },
    statusPill: {
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.xs,
      borderRadius: t.borderRadius.sm,
    },
    statusPillText: {
      ...t.typography.caption,
      fontFamily: "PlayfairDisplay-Medium",
    },
    timeText: {
      ...t.typography.caption,
      color: t.colors.gray400,
    },
    body: { width: "100%" },
    detailsCol: {
      minWidth: 0,
      alignItems: "flex-start",
    },
    statusCol: {
      width: 72,
      minHeight: COVER_SIZE,
    },
    statusColSpacer: {
      flex: 1,
      minHeight: t.spacing.xs,
    },
    coverWrap: {
      width: COVER_SIZE,
      height: COVER_SIZE,
      borderRadius: t.borderRadius.md,
      overflow: "hidden",
      backgroundColor: t.colors.skeleton,
    },
    cover: { width: "100%", height: "100%" },
    coverPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    brandBuyer: {
      ...t.typography.bodySmall,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
    },
    brandSeller: {
      ...t.typography.caption,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.textSecondary,
    },
    titleBuyer: {
      ...t.typography.caption,
      color: t.colors.textSecondary,
    },
    titleSeller: {
      ...t.typography.bodySmall,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
    },
    price: {
      ...t.typography.bodySmall,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
      marginTop: t.spacing.xs,
    },
    footerRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: t.spacing.xs,
      marginTop: t.spacing.sm,
      paddingTop: t.spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    contactBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.xs,
      borderRadius: t.borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    contactBtnText: {
      ...t.typography.caption,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
    },
    actionBtnPrimary: {
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.xs,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.text,
      alignSelf: "flex-end",
    },
    actionBtnPrimaryText: {
      ...t.typography.caption,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.textInverted,
      textAlign: "center",
    },
    actionBtnOutline: {
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.xs,
      borderRadius: t.borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      alignSelf: "flex-end",
    },
    actionBtnOutlineText: {
      ...t.typography.caption,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
      textAlign: "center",
    },
  });

export default OrderCard;
