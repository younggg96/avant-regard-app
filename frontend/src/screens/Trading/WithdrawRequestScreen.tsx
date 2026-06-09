/**
 * WithdrawRequestScreen —— 卖家从可提现余额发起提款。
 *
 * 业务规则：
 *   - 必须 KYC.status == 'approved'
 *   - 必须存在默认放款账户
 *   - amountCents <= available_cents
 *   - 提交后立即从 available_cents 扣除（防重复提交），由后端在 admin 处理时再确认或退回
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  createWithdrawal,
  getWalletSummary,
  SellerBalance,
} from "../../services/walletService";
import {
  listPayoutAccounts,
  PayoutAccount,
} from "../../services/kycService";
import {
  getCurrencySymbol,
  normalizeCurrency,
  useFormatWalletAmount,
} from "../../utils/currency";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

export default function WithdrawRequestScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const formatPrice = useFormatWalletAmount();

  const [balance, setBalance] = useState<SellerBalance | null>(null);
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kycStatus, setKycStatus] = useState<string>("none");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, acctRes] = await Promise.all([
        getWalletSummary(),
        listPayoutAccounts(),
      ]);
      setBalance(summary.balance);
      setKycStatus(summary.kycStatus);
      setAccounts(acctRes.items);
      const def = acctRes.items.find((a) => a.isDefault);
      setSelectedAccountId(def?.id ?? acctRes.items[0]?.id ?? null);
    } catch (e: any) {
      Alert.alert(t("common.failed"), e?.message ?? t("common.networkError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const currency = balance?.currency || "CNY";
  // 输入框前缀的符号要跟随钱包真实币种，而不是用户的展示偏好，
  // 否则会出现「前缀是 ¥、可提现提示却是 $」的不一致。
  const currencySymbol = getCurrencySymbol(normalizeCurrency(currency));
  const available = balance?.availableCents ?? 0;

  const setMax = () => {
    setAmount((available / 100).toFixed(2));
  };

  const submit = async () => {
    if (kycStatus !== "approved") {
      Alert.alert(
        t("trading.withdraw.needKyc"),
        "",
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("trading.withdraw.goKyc"),
            onPress: () => navigation.navigate("KycVerification"),
          },
        ],
      );
      return;
    }
    if (!accounts.length) {
      Alert.alert(
        t("trading.withdraw.needAccount"),
        "",
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("trading.withdraw.goAccount"),
            onPress: () => navigation.navigate("PayoutAccounts"),
          },
        ],
      );
      return;
    }
    const numeric = parseFloat(amount);
    if (!numeric || numeric <= 0) {
      Alert.alert(t("trading.withdraw.amountInvalid"));
      return;
    }
    const cents = Math.round(numeric * 100);
    if (cents > available) {
      Alert.alert(t("trading.withdraw.amountExceed"));
      return;
    }
    if (!selectedAccountId) return;

    setSubmitting(true);
    try {
      await createWithdrawal({
        amountCents: cents,
        payoutAccountId: selectedAccountId,
        note: note.trim() || undefined,
      });
      Alert.alert(
        t("trading.withdraw.submitSuccessTitle"),
        t("trading.withdraw.submitSuccessMessage"),
        [{ text: t("common.confirm"), onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      Alert.alert(
        t("common.failed"),
        e?.message ?? t("trading.withdraw.submitFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 48 }} color={theme.colors.gray300} />
      </SafeAreaView>
    );
  }

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t("trading.withdraw.headerTitle")}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.section}>
          <View style={styles.amountRow}>
            <Text style={styles.fieldLabel}>
              {t("trading.withdraw.amountLabel")}
            </Text>
            <Pressable onPress={setMax}>
              <Text style={styles.maxBtn}>
                {t("trading.withdraw.max")}
              </Text>
            </Pressable>
          </View>
          <View style={styles.amountInputBox}>
            <Text style={styles.amountPrefix}>{currencySymbol}</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder={t("trading.withdraw.amountPlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              keyboardType="decimal-pad"
              style={styles.amountInput}
            />
          </View>
          <Text style={styles.availableHint}>
            {t("trading.withdraw.available", {
              amount: formatPrice(available, currency),
            })}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>
            {t("trading.withdraw.accountLabel")}
          </Text>
          {accounts.length === 0 ? (
            <Pressable
              style={styles.bindCta}
              onPress={() => navigation.navigate("PayoutAccounts")}
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={theme.colors.text}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.bindCtaText}>
                {t("trading.withdraw.goAccount")}
              </Text>
            </Pressable>
          ) : (
            accounts.map((acct) => {
              const active = acct.id === selectedAccountId;
              return (
                <Pressable
                  key={acct.id}
                  style={[styles.accountRow, active && styles.accountRowActive]}
                  onPress={() => setSelectedAccountId(acct.id)}
                >
                  <View style={styles.accountIcon}>
                    <Ionicons
                      name={accountIcon(acct.accountType)}
                      size={18}
                      color={theme.colors.text}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountTitle}>
                      {acct.bankName ||
                        t(`trading.payoutAccount.type${capitalize(acct.accountType)}`)}{" "}
                      · {acct.accountNoLast4 ?? acct.accountNoMasked}
                    </Text>
                    <Text style={styles.accountSubtitle}>
                      {acct.holderName}
                      {acct.isDefault
                        ? `  · ${t("trading.payoutAccount.default")}`
                        : ""}
                    </Text>
                  </View>
                  {active ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={theme.colors.text}
                    />
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>
            {t("trading.withdraw.noteLabel")}
          </Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder={t("trading.withdraw.notePlaceholder")}
            placeholderTextColor={theme.colors.placeholder}
            multiline
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryBtn, submitting && styles.disabled]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.textInverted} />
          ) : (
            <Text style={styles.primaryBtnText}>
              {t("trading.withdraw.submit")}{" "}
              {selectedAccount
                ? `· ${formatPrice(
                    Math.round(parseFloat(amount || "0") * 100) || 0,
                    currency,
                  )}`
                : ""}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function accountIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === "alipay") return "logo-alipay";
  if (type === "wechat") return "logo-wechat";
  return "card-outline";
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
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
    scroll: { padding: 16, paddingBottom: 120 },
    section: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 12,
    },
    amountRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    maxBtn: { fontSize: 12, color: t.colors.gray300 },
    amountInputBox: {
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: t.colors.inputBorder,
      paddingVertical: 8,
    },
    amountPrefix: {
      fontSize: 28,
      fontWeight: "300",
      color: t.colors.text,
      marginRight: 6,
    },
    amountInput: {
      flex: 1,
      fontSize: 28,
      color: t.colors.text,
      fontWeight: "500",
      padding: 0,
    },
    availableHint: { marginTop: 8, fontSize: 12, color: t.colors.gray300 },
    accountRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
      marginBottom: 8,
    },
    accountRowActive: { borderColor: t.colors.text },
    accountIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.skeleton,
      alignItems: "center",
      justifyContent: "center",
    },
    accountTitle: { fontSize: 14, color: t.colors.text, fontWeight: "500" },
    accountSubtitle: {
      fontSize: 11,
      color: t.colors.gray300,
      marginTop: 2,
    },
    bindCta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderStyle: "dashed",
    },
    bindCtaText: { color: t.colors.text, fontSize: 13 },
    noteInput: {
      minHeight: 60,
      padding: 10,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 8,
      fontSize: 13,
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
      textAlignVertical: "top",
    },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 24,
      backgroundColor: t.colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    primaryBtn: {
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: 4,
      alignItems: "center",
    },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
    disabled: { opacity: 0.5 },
  });
