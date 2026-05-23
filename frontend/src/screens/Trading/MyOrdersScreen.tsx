/**
 * MyOrdersScreen —— 我作为买家的订单列表。
 *
 * Tab 切换：全部 / 待发货 / 已发货 / 已完成 / 售后。
 * 点订单 → 进 OrderDetailScreen。
 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  listMyOrders,
  Order,
  OrderStatus,
  formatOrderStatus,
} from "../../services/orderService";
import { formatPrice } from "../../services/storeProductService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type TabKey = "all" | OrderStatus;

export default function MyOrdersScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const TABS = useMemo(
    (): { key: TabKey; label: string }[] => [
      { key: "all", label: t("trading.orders.tabAll") },
      { key: "pending_payment", label: t("trading.orders.tabPendingPayment") },
      { key: "paid", label: t("trading.orders.tabPaid") },
      { key: "shipped", label: t("trading.orders.tabShipped") },
      { key: "delivered", label: t("trading.orders.tabDelivered") },
      { key: "completed", label: t("trading.orders.tabCompleted") },
      { key: "refunded_auto", label: t("trading.orders.tabRefunded") },
    ],
    [t],
  );

  const [tab, setTab] = useState<TabKey>("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMyOrders({
        status: tab === "all" ? undefined : (tab as OrderStatus),
        page: 1,
        pageSize: 50,
      });
      setOrders(res.items);
    } catch (e) {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("trading.orders.headerTitle")}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.tabBar}>
        <FlatList
          horizontal
          data={TABS}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.tab, tab === item.key && styles.tabActive]}
              onPress={() => setTab(item.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === item.key && styles.tabTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        />
      </View>

      {loading && orders.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <OrderListCard
              order={item}
              onPress={() =>
                navigation.navigate("OrderDetail", { orderId: item.id })
              }
              onPay={
                item.status === "pending_payment"
                  ? () =>
                      navigation.navigate("Payment", { orderId: item.id })
                  : undefined
              }
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>{t("trading.orders.empty")}</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

function OrderListCard({
  order,
  onPress,
  onPay,
}: {
  order: Order;
  onPress: () => void;
  onPay?: () => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const pending = order.status === "pending_payment";
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNo}>#{order.orderNo}</Text>
        <Text
          style={[styles.statusText, pending && { color: theme.colors.plusGold }]}
        >
          {formatOrderStatus(order.status)}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.coverPlaceholder}>
          <Text style={{ color: theme.colors.gray300 }}>
            {t("trading.orders.imagePlaceholder")}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {t("trading.orders.productLabel", { id: order.productId })}
          </Text>
          <Text style={styles.price}>{formatPrice(order.paidPriceCents)}</Text>
          <Text style={styles.meta}>{order.createdAt?.slice(0, 16)}</Text>
        </View>
      </View>
      {onPay ? (
        <View style={styles.cardActions}>
          <Pressable
            style={styles.payBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onPay();
            }}
          >
            <Text style={styles.payBtnText}>{t("trading.payment.payNow")}</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.colors.background },
    header: {
      height: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      backgroundColor: t.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    headerTitle: { fontSize: 16, fontWeight: "600", color: t.colors.text },
    tabBar: {
      backgroundColor: t.colors.card,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      marginHorizontal: 4,
      borderRadius: 14,
      backgroundColor: t.colors.gray100,
    },
    tabActive: { backgroundColor: t.colors.accent },
    tabText: { fontSize: 13, color: t.colors.gray300 },
    tabTextActive: { color: t.colors.textInverted, fontWeight: "600" },
    card: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    orderNo: { color: t.colors.gray300, fontSize: 12 },
    statusText: { color: t.colors.text, fontSize: 12, fontWeight: "600" },
    cardBody: { flexDirection: "row", gap: 12 },
    coverPlaceholder: {
      width: 72,
      height: 72,
      borderRadius: 8,
      backgroundColor: t.colors.skeleton,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 14, color: t.colors.text, marginBottom: 4 },
    price: {
      fontSize: 16,
      fontWeight: "700",
      color: t.colors.text,
      marginBottom: 4,
    },
    meta: { fontSize: 11, color: t.colors.gray300 },
    cardActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 8,
    },
    payBtn: {
      paddingVertical: 6,
      paddingHorizontal: 16,
      borderRadius: 4,
      backgroundColor: t.colors.accent,
    },
    payBtnText: {
      color: t.colors.textInverted,
      fontWeight: "600",
      fontSize: 12,
    },
    empty: { textAlign: "center", color: t.colors.gray300, marginTop: 32 },
  });
