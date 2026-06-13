/**
 * WithdrawalHistoryScreen —— 卖家提现申请历史。
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
  formatWithdrawalStatus,
  listMyWithdrawals,
  Withdrawal,
} from "../../services/walletService";
import { useFormatWalletAmount } from "../../utils/currency";
import { useAppTheme, useThemedStyles } from "../../theme";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

export default function WithdrawalHistoryScreen() {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeWalletScreenStyles);
  const { t } = useTranslation();
  const formatPrice = useFormatWalletAmount();

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
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        edges={["top"]}
      >
        <ScreenHeader
          title={t("trading.wallet.withdrawalsHeader")}
          showBack
        />
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
      <ScreenHeader
        title={t("trading.wallet.withdrawalsHeader")}
        showBack
      />

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
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
          <Text style={[styles.emptyText, { marginTop: 48 }]}>
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
            <View style={[styles.card, { marginBottom: 10 }]}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: "PlayfairDisplay-Bold",
                    color: theme.colors.text,
                  }}
                >
                  - {formatPrice(item.amountCents, item.currency)}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "PlayfairDisplay-Medium",
                    color: statusColor,
                  }}
                >
                  {formatWithdrawalStatus(item.status)}
                </Text>
              </View>
              {item.payoutAccountSummary ? (
                <Text style={styles.cardSubtitle}>
                  {t("trading.wallet.withdrawalAccountLabel")}:{" "}
                  {item.payoutAccountSummary}
                </Text>
              ) : null}
              {item.note ? (
                <Text style={styles.cardSubtitle}>{item.note}</Text>
              ) : null}
              {item.status === "rejected" && item.rejectReason ? (
                <Text
                  style={[styles.cardSubtitle, { color: theme.colors.error }]}
                >
                  {item.rejectReason}
                </Text>
              ) : null}
              <Text style={[styles.listRowDate, { marginTop: 6 }]}>
                {formatDate(item.createdAt)}
                {item.processedAt ? ` · ${formatDate(item.processedAt)}` : ""}
              </Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
