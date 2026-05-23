/**
 * MyWalletScreen —— 卖家钱包首屏（可提现 / 待解冻 / 总收入）。
 *
 * 入口：
 *   - 个人主页设置卡片「我的钱包」
 *   - 销售订单详情 / 结算回执的「查看钱包」深链
 *
 * 区块：
 *   - 余额 Hero（available + pending + total payout / withdrawn）
 *   - KYC / 默认放款账户状态提示
 *   - 待解冻款项（pending_payouts）
 *   - 快捷入口：实名认证 / 放款账户 / 资金流水 / 提现记录
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  getWalletSummary,
  listPendingPayouts,
  PendingPayoutItem,
  WalletSummary,
} from "../../services/walletService";
import { formatPrice } from "../../services/storeProductService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

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
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

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
      // 静默；显示 empty
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
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 48 }} color={theme.colors.gray300} />
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("trading.wallet.headerTitle")}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>
            {t("trading.wallet.balanceCardTitle")}
          </Text>
          <Text style={styles.balanceValue}>
            {formatPrice(balance?.availableCents ?? 0, currency)}
          </Text>
          {summary && summary.upcomingReleaseCents > 0 ? (
            <Text style={styles.upcoming}>
              <Ionicons
                name="hourglass-outline"
                size={12}
                color={theme.colors.gray300}
              />{" "}
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
            <Text style={styles.withdrawCtaText}>
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
            <Text style={styles.empty}>
              {t("trading.wallet.pendingEmpty")}
            </Text>
          ) : (
            pending.map((p) => (
              <Pressable
                key={p.id}
                style={styles.pendingItem}
                onPress={() =>
                  navigation.navigate("OrderDetail", { orderId: p.orderId })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingTitle}>
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
                <Text style={styles.pendingAmount}>
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
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.balanceCell}>
      <Text style={styles.balanceCellLabel}>{label}</Text>
      <Text style={styles.balanceCellValue}>{value}</Text>
    </View>
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
    scroll: { padding: 16, paddingBottom: 32 },
    balanceCard: {
      backgroundColor: t.colors.text,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
    },
    balanceLabel: {
      color: t.colors.textInverted,
      fontSize: 13,
      opacity: 0.7,
      marginBottom: 6,
    },
    balanceValue: {
      color: t.colors.textInverted,
      fontSize: 32,
      fontWeight: "700",
      letterSpacing: -0.5,
    },
    upcoming: {
      color: t.colors.textInverted,
      opacity: 0.7,
      fontSize: 11,
      marginTop: 6,
    },
    balanceRow: {
      flexDirection: "row",
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.mode === "dark" ? "#3A3A3A" : "rgba(255,255,255,0.18)",
    },
    balanceCell: { flex: 1 },
    balanceCellLabel: {
      color: t.colors.textInverted,
      opacity: 0.7,
      fontSize: 11,
      marginBottom: 4,
    },
    balanceCellValue: {
      color: t.colors.textInverted,
      fontSize: 13,
      fontWeight: "600",
    },
    withdrawCta: {
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: 4,
      alignItems: "center",
      backgroundColor: t.colors.background,
    },
    withdrawDisabled: { opacity: 0.5 },
    withdrawCtaText: { color: t.colors.text, fontSize: 14, fontWeight: "600" },
    actionRow: {
      flexDirection: "row",
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    actionItem: { flex: 1, alignItems: "center", paddingVertical: 4 },
    actionIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: t.colors.skeleton,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    actionLabel: { fontSize: 11, color: t.colors.text },
    section: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 12,
    },
    empty: {
      textAlign: "center",
      color: t.colors.gray300,
      fontSize: 12,
      paddingVertical: 24,
    },
    pendingItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    pendingTitle: { fontSize: 13, color: t.colors.text },
    pendingAmount: { fontSize: 14, fontWeight: "600", color: t.colors.text },
  });
