/**
 * PayoutAccountsScreen —— 卖家放款账户列表 + 新建账户。
 *
 * 业务规则：
 *   - 必须实名通过才能新增账户
 *   - 持卡人需与实名一致（后端 KYCService.create_payout_account 校验）
 *   - 同时只能有一个 is_default 账户
 *
 * 北美版(IS_NA)：主推 Stripe Connect；手动绑卡仅保留银行账户，
 * 字段按美国逻辑（Routing Number + Account Number），隐藏支付宝/微信。
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";

import ScreenHeader from "../../components/ScreenHeader";
import {
  makeWalletScreenStyles,
  TradingFormDefaultToggle,
  TradingFormField,
  TradingFormInput,
} from "../../components/trading/TradingFormShared";
import { IS_NA } from "../../config/env";
import {
  createPayoutAccount,
  deletePayoutAccount,
  getMyKyc,
  listPayoutAccounts,
  PayoutAccount,
  PayoutAccountType,
  setDefaultPayoutAccount,
} from "../../services/kycService";
import {
  getConnectStatus,
  refreshConnectStatus,
  startConnectOnboarding,
  type ConnectAccountStatus,
} from "../../services/walletService";
import { useAppTheme, useThemedStyles } from "../../theme";
import { summarizeStripeRequirements } from "../../utils/stripeRequirements";

function resolveAppScheme(): string {
  const expoCfg: any = (Constants.expoConfig ?? Constants.manifest) as any;
  const s = expoCfg?.scheme;
  if (Array.isArray(s) && s.length > 0) return String(s[0]);
  if (typeof s === "string" && s.length > 0) return s;
  return "avantregard";
}

const TYPE_OPTIONS: PayoutAccountType[] = IS_NA
  ? ["bank"]
  : ["bank", "alipay", "wechat"];

export default function PayoutAccountsScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeWalletScreenStyles);
  const { t } = useTranslation();

  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string>("none");
  const [showAdd, setShowAdd] = useState(false);
  const [connect, setConnect] = useState<ConnectAccountStatus | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, kyc, conn] = await Promise.all([
        listPayoutAccounts(),
        getMyKyc().catch(() => null),
        getConnectStatus().catch(() => null),
      ]);
      setAccounts(list.items);
      setKycStatus(kyc?.status ?? "none");
      setConnect(conn);
    } finally {
      setLoading(false);
    }
  }, []);

  const onboardConnect = useCallback(async () => {
    if (connectBusy) return;
    setConnectBusy(true);
    try {
      const appScheme = resolveAppScheme();
      const { url } = await startConnectOnboarding({ appScheme });
      await WebBrowser.openAuthSessionAsync(
        url,
        `${appScheme}://connect/return`,
      );
      try {
        const fresh = await refreshConnectStatus();
        setConnect(fresh);
        if (fresh.status === "active" && fresh.stripeAccountId) {
          try {
            await createPayoutAccount({
              accountType: "stripe_connect",
              holderName: "Stripe Connect",
              accountNo: fresh.stripeAccountId,
              isDefault: accounts.length === 0,
            });
          } catch (_) {
            // 已经绑过了,忽略
          }
        }
      } finally {
        load();
      }
    } catch (e: any) {
      Alert.alert(t("common.failed"), e?.message ?? "");
    } finally {
      setConnectBusy(false);
    }
  }, [connectBusy, accounts.length, load, t]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const setDefault = async (id: number) => {
    try {
      await setDefaultPayoutAccount(id);
      await load();
    } catch (e: any) {
      Alert.alert(t("common.failed"), e?.message ?? "");
    }
  };

  const remove = async (id: number) => {
    Alert.alert(t("trading.payoutAccount.removeConfirm"), "", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("trading.payoutAccount.remove"),
        style: "destructive",
        onPress: async () => {
          try {
            await deletePayoutAccount(id);
            await load();
          } catch (e: any) {
            Alert.alert(t("common.failed"), e?.message ?? "");
          }
        },
      },
    ]);
  };

  const handleAddPress = () => {
    if (kycStatus !== "approved") {
      Alert.alert(t("trading.payoutAccount.kycRequired"), "", [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("trading.withdraw.goKyc"),
          onPress: () => navigation.navigate("KycVerification"),
        },
      ]);
      return;
    }
    setShowAdd(true);
  };

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        edges={["top"]}
      >
        <ScreenHeader
          title={t("trading.payoutAccount.headerTitle")}
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
        title={t("trading.payoutAccount.headerTitle")}
        showBack
        rightActions={[
          { icon: "add", onPress: handleAddPress, style: "ghost" },
        ]}
      />

      <ScrollView contentContainerStyle={styles.listContent}>
        <ConnectCard
          status={connect}
          busy={connectBusy}
          onPress={onboardConnect}
        />
        {accounts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons
              name="card-outline"
              size={56}
              color={theme.colors.gray300}
            />
            <Text style={styles.emptyText}>
              {t("trading.payoutAccount.empty")}
            </Text>
            {IS_NA ? (
              <Text style={styles.emptyHint}>
                {t("trading.payoutAccount.naManualHint")}
              </Text>
            ) : null}
            <Pressable
              style={[styles.primaryBtn, { marginTop: 16 }]}
              onPress={handleAddPress}
            >
              <Text style={styles.primaryBtnText}>
                {t("trading.payoutAccount.addCta")}
              </Text>
            </Pressable>
          </View>
        ) : (
          accounts.map((acct) => (
            <View key={acct.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.cardIcon}>
                  <Ionicons
                    name={accountIcon(acct.accountType)}
                    size={20}
                    color={theme.colors.text}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {acct.bankName ||
                      t(
                        `trading.payoutAccount.type${capitalize(
                          acct.accountType,
                        )}`,
                      )}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {acct.holderName} · {acct.accountNoMasked}
                  </Text>
                  {acct.branchName && !IS_NA ? (
                    <Text style={styles.cardSubtitle}>{acct.branchName}</Text>
                  ) : null}
                </View>
                {acct.isDefault ? (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>
                      {t("trading.payoutAccount.default")}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.cardActions}>
                {!acct.isDefault ? (
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => setDefault(acct.id)}
                  >
                    <Text style={styles.actionBtnText}>
                      {t("trading.payoutAccount.setDefault")}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnDanger]}
                  onPress={() => remove(acct.id)}
                >
                  <Text
                    style={[
                      styles.actionBtnText,
                      { color: theme.colors.error },
                    ]}
                  >
                    {t("trading.payoutAccount.remove")}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <AddAccountModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmitted={() => {
          setShowAdd(false);
          load();
        }}
      />
    </SafeAreaView>
  );
}

function AddAccountModal({
  visible,
  onClose,
  onSubmitted,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeWalletScreenStyles);
  const { t } = useTranslation();
  const [type, setType] = useState<PayoutAccountType>("bank");
  const [holder, setHolder] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setType("bank");
    setHolder("");
    setAccountNo("");
    setBankName("");
    setBranchName("");
    setIsDefault(true);
  };

  const submit = async () => {
    if (!holder.trim() || !accountNo.trim()) {
      Alert.alert(t("trading.payoutAccount.fillRequired"));
      return;
    }
    if (IS_NA && type === "bank" && !branchName.trim()) {
      Alert.alert(t("trading.payoutAccount.fillRequired"));
      return;
    }
    setSubmitting(true);
    try {
      await createPayoutAccount({
        accountType: type,
        holderName: holder.trim(),
        accountNo: accountNo.trim(),
        bankName: bankName.trim() || undefined,
        branchName: branchName.trim() || undefined,
        isDefault,
      });
      reset();
      onSubmitted();
    } catch (e: any) {
      Alert.alert(
        t("common.failed"),
        e?.message ?? t("trading.payoutAccount.submitFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <ScrollView
          style={styles.modalSheet}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>
            {t("trading.payoutAccount.addHeader")}
          </Text>

          {IS_NA ? (
            <Text style={[styles.emptyHint, { marginBottom: 12, paddingHorizontal: 0 }]}>
              {t("trading.payoutAccount.naManualHint")}
            </Text>
          ) : null}

          {!IS_NA || TYPE_OPTIONS.length > 1 ? (
            <>
              <Text style={styles.fieldLabel}>
                {t("trading.payoutAccount.typeLabel")}
              </Text>
              <View style={styles.typeRow}>
                {TYPE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    style={[
                      styles.typePill,
                      type === opt && styles.typePillActive,
                    ]}
                    onPress={() => setType(opt)}
                  >
                    <Text
                      style={[
                        styles.typePillText,
                        type === opt && styles.typePillTextActive,
                      ]}
                    >
                      {t(`trading.payoutAccount.type${capitalize(opt)}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <TradingFormField
            label={t("trading.payoutAccount.holderLabel")}
          >
            <TradingFormInput
              value={holder}
              onChangeText={setHolder}
              autoCapitalize="words"
            />
          </TradingFormField>
          <Text style={[styles.fieldLabel, { marginTop: -4, marginBottom: 8 }]}>
            {t("trading.payoutAccount.holderHint")}
          </Text>

          <TradingFormField
            label={
              IS_NA && type === "bank"
                ? t("trading.payoutAccount.accountNoLabelNA")
                : t("trading.payoutAccount.accountNoLabel")
            }
          >
            <TradingFormInput
              value={accountNo}
              onChangeText={setAccountNo}
              placeholder={t("trading.payoutAccount.accountNoPlaceholder")}
              autoCapitalize="none"
              keyboardType={type === "bank" ? "number-pad" : "default"}
            />
          </TradingFormField>

          {type === "bank" ? (
            <>
              <TradingFormField
                label={
                  IS_NA
                    ? t("trading.payoutAccount.bankNameLabelNA")
                    : t("trading.payoutAccount.bankNameLabel")
                }
              >
                <TradingFormInput
                  value={bankName}
                  onChangeText={setBankName}
                  autoCapitalize="words"
                />
              </TradingFormField>
              <TradingFormField
                label={
                  IS_NA
                    ? t("trading.payoutAccount.routingLabel")
                    : t("trading.payoutAccount.branchLabel")
                }
              >
                <TradingFormInput
                  value={branchName}
                  onChangeText={setBranchName}
                  placeholder={
                    IS_NA
                      ? t("trading.payoutAccount.routingPlaceholder")
                      : t("trading.payoutAccount.branchPlaceholder")
                  }
                  keyboardType={IS_NA ? "number-pad" : "default"}
                />
              </TradingFormField>
            </>
          ) : null}

          <TradingFormDefaultToggle
            checked={isDefault}
            label={t("trading.payoutAccount.isDefaultLabel")}
            onToggle={() => setIsDefault((v) => !v)}
          />

          <Pressable
            style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={theme.colors.textInverted} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {t("trading.payoutAccount.submit")}
              </Text>
            )}
          </Pressable>
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ConnectCard({
  status,
  busy,
  onPress,
}: {
  status: ConnectAccountStatus | null;
  busy: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeWalletScreenStyles);
  const { t } = useTranslation();
  const s = status?.status ?? "none";
  const titleKey = `trading.payoutAccount.stripeConnect.status.${s}`;
  const ctaKey =
    s === "active"
      ? "trading.payoutAccount.stripeConnect.manage"
      : s === "restricted" || s === "pending"
      ? "trading.payoutAccount.stripeConnect.continue"
      : "trading.payoutAccount.stripeConnect.start";

  return (
    <Pressable style={styles.connectCard} onPress={onPress} disabled={busy}>
      <View style={styles.connectIcon}>
        {busy ? (
          <ActivityIndicator color={theme.colors.textInverted} />
        ) : (
          <Ionicons
            name="globe-outline"
            size={20}
            color={theme.colors.textInverted}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.connectTitle}>
          {t("trading.payoutAccount.stripeConnect.title")}
        </Text>
        <Text style={styles.connectSubtitle}>
          {t(titleKey, {
            defaultValue: t("trading.payoutAccount.stripeConnect.status.none"),
          })}
        </Text>
        {(status?.requirementsCurrentlyDue ?? []).length > 0 ? (
          <Text style={styles.connectSubtitle}>
            {t("trading.payoutAccount.stripeConnect.needs", {
              items: summarizeStripeRequirements(
                status!.requirementsCurrentlyDue,
                t,
              ),
            })}
          </Text>
        ) : null}
      </View>
      <View style={styles.connectCta}>
        <Text style={styles.connectCtaText}>{t(ctaKey)}</Text>
      </View>
    </Pressable>
  );
}

function accountIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === "alipay") return "logo-alipay";
  if (type === "wechat") return "logo-wechat";
  if (type === "stripe_connect") return "globe-outline";
  return "card-outline";
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
