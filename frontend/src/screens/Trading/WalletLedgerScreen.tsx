/**
 * WalletLedgerScreen —— 卖家资金流水。
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import ScreenHeader from "../../components/ScreenHeader";
import { makeWalletScreenStyles } from "../../components/trading/TradingFormShared";
import {
  formatLedgerReason,
  LedgerEntry,
  listLedger,
} from "../../services/walletService";
import { useFormatWalletAmount } from "../../utils/currency";
import { useAppTheme, useThemedStyles } from "../../theme";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

export default function WalletLedgerScreen() {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeWalletScreenStyles);
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
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        edges={["top"]}
      >
        <ScreenHeader title={t("trading.wallet.ledgerHeader")} showBack />
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={theme.colors.gray300} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={["top"]}
    >
      <ScreenHeader title={t("trading.wallet.ledgerHeader")} showBack />

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={[styles.emptyText, { marginTop: 48 }]}>
            {t("trading.wallet.ledgerEmpty")}
          </Text>
        }
        renderItem={({ item }) => {
          const isCredit = item.direction === "credit";
          const sign = isCredit ? "+" : "-";
          const color = isCredit ? theme.colors.text : theme.colors.gray300;
          return (
            <View style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listRowTitle}>
                  {formatLedgerReason(item.reason)}
                </Text>
                <Text style={styles.listRowDate}>
                  {formatDate(item.createdAt)}
                </Text>
              </View>
              <Text style={[styles.listRowAmount, { color }]}>
                {sign} {formatPrice(Math.abs(item.amountCents), item.currency)}
              </Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
