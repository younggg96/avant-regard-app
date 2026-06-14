/**
 * MyWalletScreen —— 卖家钱包首屏（可提现 / 待解冻 / 总收入）。
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import ScreenHeader from "../../components/ScreenHeader";
import { makeWalletScreenStyles } from "../../components/trading/TradingFormShared";
import {
  getWalletSummary,
  listPendingPayouts,
  PendingPayoutItem,
  WalletSummary,
} from "../../services/walletService";
import { useFormatWalletAmount } from "../../utils/currency";
import { useAppTheme, useThemedStyles } from "../../theme";

const ACTION_ITEMS = [
  { key: "kyc", icon: "shield-checkmark-outline" as const, route: "KycVerification" },
  { key: "payoutAccounts", icon: "card-outline" as const, route: "PayoutAccounts" },
  { key: "ledger", icon: "list-outline" as const, route: "WalletLedger" },
  { key: "withdrawals", icon: "swap-horizontal-outline" as const, route: "WithdrawalHistory" },
];

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

export default function MyWalletScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeWalletScreenStyles);
  const { t } = useTranslation();
  const formatPrice = useFormatWalletAmount();

  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [pending, setPending] = useState<PendingPayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        getWalletSummary(),
        listPendingPayouts().catch(() => ({ items: [] })),
      ]);
      setSummary(s);
      setPending(p.items);
    } catch {
      // 静默
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading && !summary) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        edges={["top"]}
      >
        <ScreenHeader title={t("trading.wallet.headerTitle")} showBack />
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={theme.colors.gray300} />
        </View>
      </SafeAreaView>
    );
  }

  const balance = summary?.balance;
  const currency = balance?.currency || "CNY";
  const canWithdraw =
    !!balance &&
    balance.availableCents > 0 &&
    summary?.kycStatus === "approved" &&
    summary?.hasDefaultPayoutAccount;

  const withdrawDisabledReason =
    !summary?.kycStatus || summary.kycStatus !== "approved"
      ? t("trading.wallet.withdrawDisabledKyc")
      : !summary?.hasDefaultPayoutAccount
      ? t("trading.wallet.withdrawDisabledNoAccount")
      : balance && balance.availableCents <= 0
      ? t("trading.wallet.withdrawDisabledNoFunds")
      : "";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={["top"]}
    >
      <ScreenHeader title={t("trading.wallet.headerTitle")} showBack />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {summary &&
        (summary.kycStatus !== "approved" || !summary.hasDefaultPayoutAccount) ? (
          <Pressable
            style={styles.walletBanner}
            onPress={() => {
              if (summary.kycStatus !== "approved") {
                navigation.navigate("KycVerification");
              } else {
                navigation.navigate("PayoutAccounts");
              }
            }}
          >
            <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
            <Text style={styles.walletBannerText}>
              {summary.kycStatus !== "approved"
                ? t("trading.wallet.bannerNeedKyc")
                : t("trading.wallet.bannerNeedPayoutAccount")}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.colors.error}
            />
          </Pressable>
        ) : null}

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>
            {t("trading.wallet.balanceCardTitle")}
          </Text>
          <Text style={styles.balanceValue}>
            {formatPrice(balance?.availableCents ?? 0, currency)}
          </Text>
          {summary && summary.upcomingReleaseCents > 0 ? (
            <Text style={styles.balanceHint}>
              <Ionicons name="hourglass-outline" size={12} />{" "}
              {t("trading.wallet.upcomingReleaseLabel", {
                amount: formatPrice(summary.upcomingReleaseCents, currency),
              })}
            </Text>
          ) : null}

          <View style={styles.balanceRow}>
            <BalanceCell
              label={t("trading.wallet.pendingLabel")}
              value={formatPrice(balance?.pendingCents ?? 0, currency)}
            />
            <BalanceCell
              label={t("trading.wallet.totalPayoutLabel")}
              value={formatPrice(balance?.totalPayoutCents ?? 0, currency)}
            />
            <BalanceCell
              label={t("trading.wallet.totalWithdrawnLabel")}
              value={formatPrice(balance?.totalWithdrawnCents ?? 0, currency)}
            />
          </View>

          <Pressable
            style={[styles.withdrawCta, !canWithdraw && styles.withdrawDisabled]}
            disabled={!canWithdraw}
            onPress={() => navigation.navigate("WithdrawRequest")}
          >
            <Text
              style={[
                styles.withdrawCtaText,
                !canWithdraw && styles.withdrawCtaTextDisabled,
              ]}
            >
              {canWithdraw
                ? t("trading.wallet.withdrawCta")
                : withdrawDisabledReason}
            </Text>
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          {ACTION_ITEMS.map((item) => (
            <Pressable
              key={item.key}
              style={styles.actionItem}
              onPress={() => navigation.navigate(item.route)}
            >
              <View style={styles.actionIcon}>
                <Ionicons name={item.icon} size={20} color={theme.colors.text} />
              </View>
              <Text style={styles.actionLabel}>
                {t(`trading.wallet.actions.${item.key}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("trading.wallet.pendingSectionTitle")}
          </Text>
          {pending.length === 0 ? (
            <Text style={styles.emptyText}>
              {t("trading.wallet.pendingEmpty")}
            </Text>
          ) : (
            pending.map((p) => (
              <Pressable
                key={p.id}
                style={styles.listRow}
                onPress={() =>
                  navigation.navigate("OrderDetail", { orderId: p.orderId })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.listRowTitle}>
                    {p.orderNo
                      ? t("trading.wallet.pendingItem", {
                          no: p.orderNo,
                          date: formatDate(p.releaseAt),
                        })
                      : t("trading.wallet.pendingItemFallback", {
                          id: p.orderId,
                          date: formatDate(p.releaseAt),
                        })}
                  </Text>
                </View>
                <Text style={styles.listRowAmount}>
                  + {formatPrice(p.amountCents, p.currency)}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BalanceCell({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeWalletScreenStyles);
  return (
    <View style={styles.balanceCell}>
      <Text style={styles.balanceCellLabel}>{label}</Text>
      <Text style={styles.balanceCellValue}>{value}</Text>
    </View>
  );
}
