/**
 * TradingContent —— Profile 「购买」/「在售」一级 tab 下的内容区。
 *
 * 改版后 (2026-05): 「购买」「在售」从 TopTabBar 直接是一级 tab, 这里
 * 不再渲染二级 buying/selling sub-tab strip, 只剩「状态 chip + 订单卡
 * 列表」两层。父组件通过 `mode` prop 告诉本组件当前是买家视角还是卖家
 * 视角, 内部按需懒加载对应订单列表。
 *
 * 结构:
 *   - 状态 chip: 购买视角 = 全部 / 待付款 / 待发货 / 待收货 / 待评价
 *               在售视角 = 全部 / 进行中 / 待支付 / 待发货 / 已收货 /
 *                           已完成 / 已取消
 *   - 列表: OrderCard
 *
 * 数据策略:
 *   - 进入 tab 时一次性拉「全部」的 buying / selling 订单 (pageSize=50),
 *     在前端按 chip 做客户端过滤。理由:
 *       1) 个人用户的订单总量不会很多, 一次拉够 vs 每次切 chip 重拉的体验
 *          差距非常明显;
 *       2) chip 上要显示「全部 X / 待付款 Y …」的角标计数, 客户端聚合更稳。
 *   - 把 100% 的订单状态映射写在 Profile/types.ts 的 BUYING_FILTER_TO_STATUSES
 *     / SELLING_FILTER_TO_STATUSES 表里, 这层只关心 UI 渲染。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { Box, HStack, VStack, Text } from "../../../components/ui";
import {
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";
import {
  Order,
  listMyOrders,
  listMySales,
} from "../../../services/orderService";
import {
  BuyingFilterType,
  SellingFilterType,
  BUYING_FILTER_TO_STATUSES,
  SELLING_FILTER_TO_STATUSES,
} from "../types";
import { OrderCard } from "./OrderCard";
import { AnimatedChip } from "../../../components/ui";

type Mode = "buying" | "selling";

const buyingFilters: BuyingFilterType[] = [
  "all",
  "pending_payment",
  "paid",
  "shipped",
  "delivered",
];

const sellingFilters: SellingFilterType[] = [
  "all",
  "in_progress",
  "pending_payment",
  "paid",
  "delivered",
  "completed",
  "canceled",
];

const useFilterCounts = (
  orders: Order[],
  mode: Mode,
): Record<string, number> => {
  return useMemo(() => {
    const map: Record<string, number> = { all: orders.length };
    const table =
      mode === "buying" ? BUYING_FILTER_TO_STATUSES : SELLING_FILTER_TO_STATUSES;
    for (const key of Object.keys(table)) {
      if (key === "all") continue;
      const allowed = table[key as keyof typeof table];
      if (!allowed) continue;
      const set = new Set(allowed);
      map[key] = orders.filter((o) => set.has(o.status)).length;
    }
    return map;
  }, [orders, mode]);
};

const filterOrdersByChip = (
  orders: Order[],
  chip: BuyingFilterType | SellingFilterType,
  mode: Mode,
): Order[] => {
  const table =
    mode === "buying" ? BUYING_FILTER_TO_STATUSES : SELLING_FILTER_TO_STATUSES;
  const allowed = table[chip as keyof typeof table];
  if (!allowed) return orders;
  const set = new Set(allowed);
  return orders.filter((o) => set.has(o.status));
};

interface Props {
  /** 当前展示买家订单还是卖家订单。父级 (Profile/index.tsx) 直接用
   *  顶部 TopTabBar 控制 mode, 这里不再 owns sub-tab。 */
  mode: Mode;
  buyingFilter: BuyingFilterType;
  setBuyingFilter: (v: BuyingFilterType) => void;
  sellingFilter: SellingFilterType;
  setSellingFilter: (v: SellingFilterType) => void;
}

export const TradingContent: React.FC<Props> = ({
  mode,
  buyingFilter,
  setBuyingFilter,
  sellingFilter,
  setSellingFilter,
}) => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [buyOrders, setBuyOrders] = useState<Order[]>([]);
  const [sellOrders, setSellOrders] = useState<Order[]>([]);
  const [loadingBuy, setLoadingBuy] = useState(false);
  const [loadingSell, setLoadingSell] = useState(false);
  const listProgress = useSharedValue(1);

  const activeFilter = mode === "buying" ? buyingFilter : sellingFilter;

  useEffect(() => {
    listProgress.value = 0;
    listProgress.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeFilter, mode, listProgress]);

  const listAnimStyle = useAnimatedStyle(() => ({
    opacity: listProgress.value,
    transform: [
      {
        translateY: interpolate(
          listProgress.value,
          [0, 1],
          [6, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const loadBuying = useCallback(async () => {
    setLoadingBuy(true);
    try {
      const res = await listMyOrders({ page: 1, pageSize: 50 });
      setBuyOrders(res.items);
    } catch (e) {
      console.warn("[TradingContent] load buy orders failed", e);
      setBuyOrders([]);
    } finally {
      setLoadingBuy(false);
    }
  }, []);

  const loadSelling = useCallback(async () => {
    setLoadingSell(true);
    try {
      const res = await listMySales({ page: 1, pageSize: 50 });
      setSellOrders(res.items);
    } catch (e) {
      console.warn("[TradingContent] load sell orders failed", e);
      setSellOrders([]);
    } finally {
      setLoadingSell(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "buying") loadBuying();
    else loadSelling();
  }, [mode, loadBuying, loadSelling]);

  const buyingCounts = useFilterCounts(buyOrders, "buying");
  const sellingCounts = useFilterCounts(sellOrders, "selling");

  const goOrderDetail = (orderId: number) =>
    navigation.navigate("OrderDetail", { orderId });

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Ionicons
        name="receipt-outline"
        size={28}
        color={theme.colors.gray300}
      />
      <Text style={styles.emptyText}>{t("trading.tradingTab.empty")}</Text>
    </View>
  );

  const renderLoading = () => (
    <View style={styles.empty}>
      <ActivityIndicator color={theme.colors.gray400} />
    </View>
  );

  return (
    <VStack>
      {/* 状态 chip 条 —— 与「笔记」chip 视觉一致, 同色系填充 */}
      <View style={styles.chipScrollRow}>
        <HStack space="xs" style={styles.chipRow}>
          {(mode === "buying" ? buyingFilters : sellingFilters).map((chip) => {
            const isActive =
              mode === "buying" ? buyingFilter === chip : sellingFilter === chip;
            const count =
              (mode === "buying" ? buyingCounts : sellingCounts)[
                chip as string
              ] ?? 0;
            const label =
              chip === "all"
                ? t("trading.tradingTab.chipAll")
                : mode === "buying"
                  ? t(`trading.tradingTab.buyChip.${chip}`)
                  : t(`trading.tradingTab.sellChip.${chip}`);
              return (
                <AnimatedChip
                  key={chip}
                  label={label}
                  count={count > 0 ? count : undefined}
                  isActive={isActive}
                  style={styles.chipItem}
                  onPress={() => {
                    if (mode === "buying") {
                      setBuyingFilter(chip as BuyingFilterType);
                    } else {
                      setSellingFilter(chip as SellingFilterType);
                    }
                  }}
                />
              );
          })}
        </HStack>
      </View>

      {/* 列表 —— chip 切换时淡入 */}
      <Animated.View style={[styles.listWrap, listAnimStyle]}>
        <Box>
        {mode === "buying" ? (
          loadingBuy && buyOrders.length === 0 ? (
            renderLoading()
          ) : (
            (() => {
              const list = filterOrdersByChip(buyOrders, buyingFilter, "buying");
              if (list.length === 0) return renderEmpty();
              return list.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  role="buyer"
                  onPress={() => goOrderDetail(order.id)}
                  onPay={
                    order.status === "pending_payment"
                      ? () =>
                          navigation.navigate("Payment", { orderId: order.id })
                      : undefined
                  }
                  onViewShipment={
                    order.status === "shipped" || order.status === "delivered"
                      ? () => goOrderDetail(order.id)
                      : undefined
                  }
                  onConfirmReceipt={
                    order.status === "delivered"
                      ? () =>
                          navigation.navigate("ConfirmReceipt", {
                            orderId: order.id,
                          })
                      : undefined
                  }
                  onReview={
                    order.status === "completed" || order.status === "settled"
                      ? () => goOrderDetail(order.id)
                      : undefined
                  }
                />
              ));
            })()
          )
        ) : loadingSell && sellOrders.length === 0 ? (
          renderLoading()
        ) : (
          (() => {
            const list = filterOrdersByChip(sellOrders, sellingFilter, "selling");
            if (list.length === 0) return renderEmpty();
            return list.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                role="seller"
                onPress={() => goOrderDetail(order.id)}
                onShip={
                  order.status === "paid"
                    ? () => goOrderDetail(order.id)
                    : undefined
                }
                onViewShipment={
                  order.status === "shipped" || order.status === "delivered"
                    ? () => goOrderDetail(order.id)
                    : undefined
                }
              />
            ));
          })()
        )}
        </Box>
      </Animated.View>
    </VStack>
  );
};
TradingContent.displayName = "TradingContent";

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    chipScrollRow: {
      paddingVertical: 10,
      paddingHorizontal: t.spacing.md,
    },
    chipRow: { flexWrap: "wrap" },
    chipItem: {
      marginBottom: 6,
    },
    listWrap: {
      paddingHorizontal: t.spacing.md,
      paddingTop: 4,
    },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
    },
    emptyText: {
      marginTop: 12,
      fontSize: 13,
      color: t.colors.gray400,
    },
  });

export default TradingContent;
