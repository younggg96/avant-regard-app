/**
 * OrderCard —— 订单卡片(Profile「交易」tab 用)。
 *
 * 视觉参考 image 2: 左侧封面 + 状态 pill, 中间品牌 / 标题 / 标价, 右侧根据
 * 状态显示主操作按钮 (去支付 / 查看物流 / 确认收货 等)。所有颜色 / 间距
 * 通过 useAppTheme + useThemedStyles 让深色 / 浅色主题自适应。
 *
 * 业务字段两个来源:
 *   - 订单本身 (`order.status` / `paidPriceCents` / `createdAt` …)
 *   - 后端在 `/api/orders/me` 返回里挂的 `order.product` 摘要 (品牌 / 标题 /
 *     封面图 / 标价)。后者缺失时降级为占位图 + 「商品 #id」标题。
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import { formatPrice } from "../../../services/storeProductService";

type OrderRole = "buyer" | "seller";

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
}

interface StatusPillStyle {
  /** 角标文案的 i18n 已经在 `formatOrderStatus` 里覆盖, pill 上只显示一个
   * 简短的中文/英文 label 即可, 颜色用 accent 系列代表「需要用户操作」。 */
  pillBg: string;
  pillFg: string;
}

const getStatusPillStyle = (
  status: OrderStatus,
  role: OrderRole,
  theme: AppTheme,
): StatusPillStyle => {
  if (status === "pending_payment") {
    return { pillBg: theme.colors.error, pillFg: theme.colors.white };
  }
  if (status === "paid") {
    return { pillBg: theme.colors.accent, pillFg: theme.colors.textInverted };
  }
  if (status === "shipped") {
    return { pillBg: theme.colors.gray500, pillFg: theme.colors.white };
  }
  if (status === "delivered") {
    return { pillBg: theme.colors.gray400, pillFg: theme.colors.white };
  }
  if (status === "completed" || status === "settled") {
    return { pillBg: theme.colors.gray200, pillFg: theme.colors.gray600 };
  }
  // refunded / refunded_auto / disputed
  return { pillBg: theme.colors.gray100, pillFg: theme.colors.gray400 };
};

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
    "onPay" | "onViewShipment" | "onConfirmReceipt" | "onShip" | "onReview"
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
    if (
      (status === "shipped" || status === "delivered") &&
      handlers.onViewShipment
    ) {
      return {
        label: t("trading.tradingTab.viewShipment"),
        onPress: handlers.onViewShipment,
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
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const product = order.product ?? null;
  const cover = product?.coverImage || null;
  const brand = product?.brand || "";
  const title =
    product?.title ||
    t("trading.orders.productLabel", { id: order.productId });
  const price = order.paidPriceCents || product?.priceCents || 0;
  const currency = order.currency || product?.currency || "CNY";

  const pillStyle = getStatusPillStyle(order.status, role, theme);
  const primaryAction = pickPrimaryAction(order, role, t, {
    onPay,
    onViewShipment,
    onConfirmReceipt,
    onShip,
    onReview,
  });

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {/* 顶部状态 pill —— 与图 2 一致放在卡片左上方, 不放在封面上是为了
          dark 模式下深色封面 + 浅色 pill 视觉对比更稳。 */}
      <View style={styles.statusRow}>
        <View style={[styles.statusPill, { backgroundColor: pillStyle.pillBg }]}>
          <Text style={[styles.statusPillText, { color: pillStyle.pillFg }]}>
            {formatOrderStatus(order.status)}
          </Text>
        </View>
        {!!order.createdAt && (
          <Text style={styles.timeText}>{order.createdAt.slice(5, 10)}</Text>
        )}
      </View>

      <HStack alignItems="center" space="md" style={styles.body}>
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
                size={26}
                color={theme.colors.gray300}
              />
            </View>
          )}
        </Box>

        <VStack flex={1} space="xs">
          {!!brand && (
            <Text style={styles.brand} numberOfLines={1}>
              {brand}
            </Text>
          )}
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.price}>{formatPrice(price, currency)}</Text>
        </VStack>

        {primaryAction ? (
          <Pressable
            style={styles.actionBtn}
            onPress={(e: any) => {
              e?.stopPropagation?.();
              primaryAction.onPress();
            }}
          >
            <Text style={styles.actionBtnText}>{primaryAction.label}</Text>
          </Pressable>
        ) : null}
      </HStack>
    </Pressable>
  );
};
OrderCard.displayName = "OrderCard";

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: "600",
      lineHeight: 14,
    },
    timeText: {
      fontSize: 11,
      color: t.colors.gray400,
    },
    body: { width: "100%" },
    coverWrap: {
      width: 76,
      height: 76,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: t.colors.skeleton,
    },
    cover: { width: "100%", height: "100%" },
    coverPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    brand: {
      fontSize: 14,
      fontWeight: "700",
      color: t.colors.text,
    },
    title: {
      fontSize: 12,
      color: t.colors.gray600,
      lineHeight: 16,
    },
    price: {
      fontSize: 14,
      fontWeight: "700",
      color: t.colors.text,
      marginTop: 2,
    },
    actionBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 4,
      backgroundColor: t.colors.text,
    },
    actionBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.textInverted,
    },
  });

export default OrderCard;
