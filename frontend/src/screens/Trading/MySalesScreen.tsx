/**
 * MySalesScreen —— 我作为卖家的订单列表（含 C2C + 买手店两种身份合并显示）。
 *
 * 卖家可在这里：
 *   - paid 状态：去发货（OrderDetail）
 *   - shipped/delivered：查看物流
 *   - completed/settled：查看结算金额
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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  listMySales,
  Order,
  OrderStatus,
  formatOrderStatus,
} from "../../services/orderService";
import { formatPrice } from "../../services/storeProductService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type TabKey = "all" | OrderStatus;

type MySalesRouteParams = { initialStatus?: TabKey };

export default function MySalesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, MySalesRouteParams>, string>>();
  const initialStatus = route.params?.initialStatus;
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const TABS = useMemo(
    (): { key: TabKey; label: string }[] => [
      { key: "all", label: t("trading.sales.tabAll") },
      { key: "paid", label: t("trading.sales.tabPaid") },
      { key: "shipped", label: t("trading.sales.tabShipped") },
      { key: "delivered", label: t("trading.sales.tabDelivered") },
      { key: "completed", label: t("trading.sales.tabCompleted") },
      { key: "settled", label: t("trading.sales.tabSettled") },
    ],
    [t],
  );

  const [tab, setTab] = useState<TabKey>(initialStatus ?? "all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMySales({
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
        <Text style={styles.headerTitle}>{t("trading.sales.headerTitle")}</Text>
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
            <Pressable
              style={styles.card}
              onPress={() =>
                navigation.navigate("OrderDetail", { orderId: item.id })
              }
            >
              <View style={styles.cardHeader}>
                <Text style={styles.orderNo}>#{item.orderNo}</Text>
                <Text style={styles.statusText}>
                  {formatOrderStatus(item.status)}
                </Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.coverPlaceholder}>
                  <Text style={{ color: theme.colors.gray300 }}>
                    {t("trading.sales.imagePlaceholder")}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>
                    {t("trading.sales.productLabel", { id: item.productId })}
                  </Text>
                  <Text style={styles.price}>
                    {t("trading.sales.paidLabel", {
                      price: formatPrice(item.paidPriceCents),
                    })}
                  </Text>
                  <Text style={styles.meta}>
                    {t("trading.sales.payoutLabel", {
                      price: formatPrice(item.sellerPayoutCents),
                    })}{" "}
                    · {item.createdAt?.slice(0, 16)}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>{t("trading.sales.empty")}</Text>
          }
        />
      )}
    </SafeAreaView>
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
