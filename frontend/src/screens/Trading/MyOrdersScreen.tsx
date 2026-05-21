/**
 * MyOrdersScreen —— 我作为买家的订单列表。
 *
 * Tab 切换：全部 / 待发货 / 已发货 / 已完成 / 售后。
 * 点订单 → 进 OrderDetailScreen。
 */
import React, { useEffect, useState, useCallback } from "react";
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

import {
  listMyOrders,
  Order,
  OrderStatus,
  formatOrderStatus,
} from "../../services/orderService";
import { formatPrice } from "../../services/storeProductService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type TabKey = "all" | OrderStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "paid", label: "待发货" },
  { key: "shipped", label: "已发货" },
  { key: "delivered", label: "待确认" },
  { key: "completed", label: "已完成" },
  { key: "refunded_auto", label: "已退款" },
];

export default function MyOrdersScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
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
        <Text style={styles.headerTitle}>我的订单</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.tabBar}>
        <FlatList
          horizontal
          data={TABS}
          keyExtractor={(t) => t.key}
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
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>暂无订单</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

function OrderListCard({
  order,
  onPress,
}: {
  order: Order;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNo}>#{order.orderNo}</Text>
        <Text style={styles.statusText}>{formatOrderStatus(order.status)}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.coverPlaceholder}>
          <Text style={{ color: theme.colors.gray300 }}>图</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>单品 #{order.productId}</Text>
          <Text style={styles.price}>{formatPrice(order.paidPriceCents)}</Text>
          <Text style={styles.meta}>{order.createdAt?.slice(0, 16)}</Text>
        </View>
      </View>
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
    empty: { textAlign: "center", color: t.colors.gray300, marginTop: 32 },
  });
