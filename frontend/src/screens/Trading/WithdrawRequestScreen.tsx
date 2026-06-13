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

import ScreenHeader from "../../components/ScreenHeader";
import {
  makeWalletScreenStyles,
  TradingFormSection,
  TradingFormTextArea,
} from "../../components/trading/TradingFormShared";
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
import { useAppTheme, useThemedStyles } from "../../theme";

export default function WithdrawRequestScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeWalletScreenStyles);
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
  const currencySymbol = getCurrencySymbol(normalizeCurrency(currency));
  const available = balance?.availableCents ?? 0;

  const setMax = () => {
    setAmount((available / 100).toFixed(2));
  };

  const submit = async () => {
    if (kycStatus !== "approved") {
      Alert.alert(t("trading.withdraw.needKyc"), "", [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("trading.withdraw.goKyc"),
          onPress: () => navigation.navigate("KycVerification"),
        },
      ]);
      return;
    }
    if (!accounts.length) {
      Alert.alert(t("trading.withdraw.needAccount"), "", [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("trading.withdraw.goAccount"),
          onPress: () => navigation.navigate("PayoutAccounts"),
        },
      ]);
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
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        edges={["top"]}
      >
        <ScreenHeader title={t("trading.withdraw.headerTitle")} showBack />
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={theme.colors.gray300} />
        </View>
      </SafeAreaView>
    );
  }

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={["top"]}
    >
      <ScreenHeader title={t("trading.withdraw.headerTitle")} showBack />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]}>
        <TradingFormSection title={t("trading.withdraw.amountLabel")}>
          <View style={styles.amountRow}>
            <View />
            <Pressable onPress={setMax}>
              <Text style={styles.maxBtn}>{t("trading.withdraw.max")}</Text>
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
        </TradingFormSection>

        <TradingFormSection title={t("trading.withdraw.accountLabel")}>
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
                  <View style={styles.cardIcon}>
                    <Ionicons
                      name={accountIcon(acct.accountType)}
                      size={18}
                      color={theme.colors.text}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountTitle}>
                      {acct.bankName ||
                        t(
                          `trading.payoutAccount.type${capitalize(acct.accountType)}`,
                        )}{" "}
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
                      color={theme.colors.accent}
                    />
                  ) : null}
                </Pressable>
              );
            })
          )}
        </TradingFormSection>

        <TradingFormSection title={t("trading.withdraw.noteLabel")}>
          <TradingFormTextArea
            value={note}
            onChangeText={setNote}
            placeholder={t("trading.withdraw.notePlaceholder")}
          />
        </TradingFormSection>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.primaryBtn,
            { flex: 1 },
            submitting && styles.primaryBtnDisabled,
          ]}
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
