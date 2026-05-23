/**
 * WithdrawalHistoryScreen —— 卖家提现申请历史。
 */
import React, { useCallback, useEffect, useState } from "react";
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
  formatWithdrawalStatus,
  listMyWithdrawals,
  Withdrawal,
} from "../../services/walletService";
import { formatPrice } from "../../services/storeProductService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

export default function WithdrawalHistoryScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const [items, setItems] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listMyWithdrawals(1, 100);
      setItems(res.items);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator
          style={{ marginTop: 48 }}
          color={theme.colors.gray300}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t("trading.wallet.withdrawalsHeader")}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {t("trading.wallet.withdrawalsEmpty")}
          </Text>
        }
        renderItem={({ item }) => {
          const statusColor =
            item.status === "paid"
              ? theme.colors.success
              : item.status === "rejected"
              ? theme.colors.error
              : theme.colors.gray300;
          return (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.amount}>
                  - {formatPrice(item.amountCents, item.currency)}
                </Text>
                <Text style={[styles.status, { color: statusColor }]}>
                  {formatWithdrawalStatus(item.status)}
                </Text>
              </View>
              {item.payoutAccountSummary ? (
                <Text style={styles.subline}>
                  {t("trading.wallet.withdrawalAccountLabel")}:{" "}
                  {item.payoutAccountSummary}
                </Text>
              ) : null}
              {item.note ? (
                <Text style={styles.subline}>{item.note}</Text>
              ) : null}
              {item.status === "rejected" && item.rejectReason ? (
                <Text style={[styles.subline, { color: theme.colors.error }]}>
                  {item.rejectReason}
                </Text>
              ) : null}
              <Text style={styles.date}>
                {formatDate(item.createdAt)}
                {item.processedAt
                  ? ` · ${formatDate(item.processedAt)}`
                  : ""}
              </Text>
            </View>
          );
        }}
      />
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
    card: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    cardHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    amount: { fontSize: 16, fontWeight: "700", color: t.colors.text },
    status: { fontSize: 12, fontWeight: "600" },
    subline: { fontSize: 12, color: t.colors.gray300, marginBottom: 4 },
    date: { fontSize: 11, color: t.colors.gray300, marginTop: 6 },
    empty: { textAlign: "center", marginTop: 64, color: t.colors.gray300 },
  });
