/**
 * WalletLedgerScreen —— 卖家资金流水。
 *
 * 渲染 settlement_ledger 中归属当前用户的所有 credit / debit 流水。
 * reason 通过 i18n 映射到友好文案：
 *   pending_lock        确认收货 · 待解冻
 *   pending_release     解冻入账
 *   withdrawal          提现
 *   withdrawal_reverse  提现退回
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
  formatLedgerReason,
  LedgerEntry,
  listLedger,
} from "../../services/walletService";
import { useFormatWalletAmount } from "../../utils/currency";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

export default function WalletLedgerScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const formatPrice = useFormatWalletAmount();

  const [items, setItems] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listLedger(1, 100);
      setItems(res.items);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
  };

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
          {t("trading.wallet.ledgerHeader")}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {t("trading.wallet.ledgerEmpty")}
          </Text>
        }
        renderItem={({ item }) => {
          const isCredit = item.direction === "credit";
          const sign = isCredit ? "+" : "-";
          const color = isCredit ? theme.colors.text : theme.colors.gray300;
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reason}>
                  {formatLedgerReason(item.reason)}
                </Text>
                <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
              </View>
              <Text style={[styles.amount, { color }]}>
                {sign} {formatPrice(Math.abs(item.amountCents), item.currency)}
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
    row: {
      flexDirection: "row",
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    reason: { fontSize: 14, color: t.colors.text },
    date: { fontSize: 11, color: t.colors.gray300, marginTop: 4 },
    amount: { fontSize: 14, fontWeight: "600" },
    empty: { textAlign: "center", color: t.colors.gray300, marginTop: 64 },
  });
