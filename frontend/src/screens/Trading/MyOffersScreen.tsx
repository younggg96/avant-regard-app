/**
 * MyOffersScreen —— 出价中心。
 *
 * 两个 Tab：
 *   - 我的出价   GET /api/offers/me
 *   - 待我处理   GET /api/offers/me/incoming
 *
 * 卖家可对 incoming 的 pending offer 接受 / 拒绝 / 还价。
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import {
  listMyOffers,
  listIncomingOffers,
  Offer,
  formatOfferStatus,
  acceptOffer,
  rejectOffer,
  withdrawOffer,
} from "../../services/orderService";
import { formatPrice } from "../../services/storeProductService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type Mode = "outgoing" | "incoming";

export default function MyOffersScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [mode, setMode] = useState<Mode>("outgoing");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res =
        mode === "outgoing"
          ? await listMyOffers({ pageSize: 50 })
          : await listIncomingOffers({ pageSize: 50 });
      setOffers(res.items);
    } catch (e) {
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  const onAccept = async (id: number) => {
    try {
      const res = await acceptOffer(id);
      Alert.alert("已接受", "已为买家生成订单", [
        {
          text: "查看订单",
          onPress: () =>
            navigation.navigate("OrderDetail", { orderId: res.order.id }),
        },
        { text: "确定" },
      ]);
      load();
    } catch (e: any) {
      Alert.alert("失败", e?.message ?? "操作失败");
    }
  };

  const onReject = async (id: number) => {
    try {
      await rejectOffer(id);
      load();
    } catch (e: any) {
      Alert.alert("失败", e?.message ?? "操作失败");
    }
  };

  const onWithdraw = async (id: number) => {
    try {
      await withdrawOffer(id);
      load();
    } catch (e: any) {
      Alert.alert("失败", e?.message ?? "操作失败");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>出价</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, mode === "outgoing" && styles.tabActive]}
          onPress={() => setMode("outgoing")}
        >
          <Text
            style={[
              styles.tabText,
              mode === "outgoing" && styles.tabTextActive,
            ]}
          >
            我的出价
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === "incoming" && styles.tabActive]}
          onPress={() => setMode("incoming")}
        >
          <Text
            style={[
              styles.tabText,
              mode === "incoming" && styles.tabTextActive,
            ]}
          >
            待我处理
          </Text>
        </Pressable>
      </View>

      {loading && offers.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.title}>单品 #{item.productId}</Text>
                <Text style={styles.status}>{formatOfferStatus(item.status)}</Text>
              </View>
              <Text style={styles.price}>{formatPrice(item.priceCents)}</Text>
              {item.message ? (
                <Text style={styles.message}>“{item.message}”</Text>
              ) : null}
              <Text style={styles.meta}>
                到期 {item.expiresAt?.slice(0, 16)}
              </Text>

              {item.status === "pending" ? (
                <View style={styles.actions}>
                  {mode === "incoming" ? (
                    <>
                      <Pressable
                        style={styles.ghostBtn}
                        onPress={() => onReject(item.id)}
                      >
                        <Text style={styles.ghostBtnText}>拒绝</Text>
                      </Pressable>
                      <Pressable
                        style={styles.primaryBtn}
                        onPress={() => onAccept(item.id)}
                      >
                        <Text style={styles.primaryBtnText}>接受</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      style={styles.ghostBtn}
                      onPress={() => onWithdraw(item.id)}
                    >
                      <Text style={styles.ghostBtnText}>撤回</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>暂无出价</Text>
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
      flexDirection: "row",
      backgroundColor: t.colors.card,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: 14,
      marginHorizontal: 4,
      backgroundColor: t.colors.gray100,
    },
    tabActive: { backgroundColor: t.colors.accent },
    tabText: { fontSize: 13, color: t.colors.gray300 },
    tabTextActive: { color: t.colors.textInverted, fontWeight: "600" },
    card: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    title: { fontSize: 14, fontWeight: "600", color: t.colors.text },
    status: { fontSize: 12, color: t.colors.gray300 },
    price: {
      fontSize: 22,
      fontWeight: "700",
      color: t.colors.text,
      marginBottom: 8,
    },
    message: { fontSize: 13, color: t.colors.gray400, marginBottom: 8 },
    meta: { fontSize: 11, color: t.colors.gray300 },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 12,
      gap: 12,
    },
    ghostBtn: {
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.colors.gray200,
    },
    ghostBtnText: { color: t.colors.gray400 },
    primaryBtn: {
      paddingVertical: 8,
      paddingHorizontal: 22,
      borderRadius: 18,
      backgroundColor: t.colors.accent,
    },
    primaryBtnText: { color: t.colors.textInverted, fontWeight: "600" },
    empty: { textAlign: "center", color: t.colors.gray300, marginTop: 32 },
  });
