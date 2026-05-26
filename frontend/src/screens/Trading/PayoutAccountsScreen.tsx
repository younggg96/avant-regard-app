/**
 * PayoutAccountsScreen —— 卖家放款账户列表 + 新建账户。
 *
 * 业务规则：
 *   - 必须实名通过才能新增账户
 *   - 持卡人需与实名一致（后端 KYCService.create_payout_account 校验）
 *   - 同时只能有一个 is_default 账户
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
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

import {
  createPayoutAccount,
  deletePayoutAccount,
  getMyKyc,
  listPayoutAccounts,
  PayoutAccount,
  PayoutAccountType,
  setDefaultPayoutAccount,
} from "../../services/kycService";

// 与 App.tsx / PaymentScreen 同样的 scheme 解析逻辑 — 决定 Stripe Connect
// 跳板页应该跳哪个 App variant 的 deep link。
function resolveAppScheme(): string {
  const expoCfg: any = (Constants.expoConfig ?? Constants.manifest) as any;
  const s = expoCfg?.scheme;
  if (Array.isArray(s) && s.length > 0) return String(s[0]);
  if (typeof s === "string" && s.length > 0) return s;
  return "avantregard";
}
import {
  getConnectStatus,
  refreshConnectStatus,
  startConnectOnboarding,
  type ConnectAccountStatus,
} from "../../services/walletService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

const TYPE_OPTIONS: PayoutAccountType[] = ["bank", "alipay", "wechat"];

export default function PayoutAccountsScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
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
      // openAuthSessionAsync(url, redirectUrl):
      //   - iOS  使用 ASWebAuthenticationSession,看到 location 跳到
      //     redirectUrl(scheme 完全匹配)就 dismiss
      //   - Android 使用 Custom Tabs,行为一致
      // 我们后端的 /api/connect/return HTML 会 JS 跳到
      // {appScheme}://connect/return, 所以这里要把同一个 scheme 显式传过去,
      // 否则 native session 不会自动关闭,用户得手动点 "Done"。
      const result = await WebBrowser.openAuthSessionAsync(
        url,
        `${appScheme}://connect/return`,
      );
      // 不论用户是 dismiss 还是完成,都拉一次最新状态;
      // 如果还是 pending(没完成 KYC), refresh 也会反映出来。
      try {
        const fresh = await refreshConnectStatus();
        setConnect(fresh);
        if (fresh.status === "active" && fresh.stripeAccountId) {
          // 自动把 acct 同步到 payout_accounts 表里(后端 createPayoutAccount
          // 内部会校验 stripe_account_id 与 connect_row 一致)。
          // 已存在则后端会返回 400,这里吞掉。
          try {
            await createPayoutAccount({
              accountType: "stripe_connect",
              // Connect 类型对 holderName 不做强校验, 但占位写一个稳定值,
              // 防止后续展示空白。
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
      if (result?.type === "cancel") {
        // 用户主动取消,不报错
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
    Alert.alert(
      t("trading.payoutAccount.removeConfirm"),
      "",
      [
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
      ],
    );
  };

  const handleAddPress = () => {
    if (kycStatus !== "approved") {
      Alert.alert(
        t("trading.payoutAccount.kycRequired"),
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
    setShowAdd(true);
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
          {t("trading.payoutAccount.headerTitle")}
        </Text>
        <Pressable onPress={handleAddPress} hitSlop={8}>
          <Ionicons name="add" size={26} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <ConnectCard
          status={connect}
          busy={connectBusy}
          onPress={onboardConnect}
          theme={theme}
          styles={styles}
          t={t}
        />
        {accounts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name="card-outline"
              size={56}
              color={theme.colors.gray300}
            />
            <Text style={styles.emptyText}>
              {t("trading.payoutAccount.empty")}
            </Text>
            <Pressable style={styles.addCta} onPress={handleAddPress}>
              <Text style={styles.addCtaText}>
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
                  {acct.branchName ? (
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
  const styles = useThemedStyles(makeStyles);
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
        <ScrollView style={styles.modalSheet} keyboardShouldPersistTaps="handled">
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>
            {t("trading.payoutAccount.addHeader")}
          </Text>

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

          <Field
            label={t("trading.payoutAccount.holderLabel")}
            hint={t("trading.payoutAccount.holderHint")}
          >
            <TextInput
              style={styles.input}
              value={holder}
              onChangeText={setHolder}
              placeholderTextColor={theme.colors.placeholder}
              autoCapitalize="none"
            />
          </Field>
          <Field label={t("trading.payoutAccount.accountNoLabel")}>
            <TextInput
              style={styles.input}
              value={accountNo}
              onChangeText={setAccountNo}
              placeholder={t("trading.payoutAccount.accountNoPlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              autoCapitalize="none"
              keyboardType={type === "bank" ? "number-pad" : "default"}
            />
          </Field>
          {type === "bank" ? (
            <>
              <Field label={t("trading.payoutAccount.bankNameLabel")}>
                <TextInput
                  style={styles.input}
                  value={bankName}
                  onChangeText={setBankName}
                  placeholderTextColor={theme.colors.placeholder}
                />
              </Field>
              <Field label={t("trading.payoutAccount.branchLabel")}>
                <TextInput
                  style={styles.input}
                  value={branchName}
                  onChangeText={setBranchName}
                  placeholder={t("trading.payoutAccount.branchPlaceholder")}
                  placeholderTextColor={theme.colors.placeholder}
                />
              </Field>
            </>
          ) : null}

          <Pressable
            style={styles.checkboxRow}
            onPress={() => setIsDefault((v) => !v)}
          >
            <View
              style={[
                styles.checkbox,
                isDefault && styles.checkboxChecked,
              ]}
            >
              {isDefault ? (
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={theme.colors.textInverted}
                />
              ) : null}
            </View>
            <Text style={styles.checkboxText}>
              {t("trading.payoutAccount.isDefaultLabel")}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.primaryBtn, submitting && styles.disabled]}
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function accountIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === "alipay") return "logo-alipay";
  if (type === "wechat") return "logo-wechat";
  if (type === "stripe_connect") return "globe-outline";
  return "card-outline";
}

function ConnectCard({
  status,
  busy,
  onPress,
  theme,
  styles,
  t,
}: {
  status: ConnectAccountStatus | null;
  busy: boolean;
  onPress: () => void;
  theme: AppTheme;
  styles: ReturnType<typeof makeStyles>;
  t: (k: string, opts?: any) => string;
}) {
  const s = status?.status ?? "none";
  const titleKey = `trading.payoutAccount.stripeConnect.status.${s}`;
  const ctaKey =
    s === "active"
      ? "trading.payoutAccount.stripeConnect.manage"
      : s === "restricted" || s === "pending"
      ? "trading.payoutAccount.stripeConnect.continue"
      : "trading.payoutAccount.stripeConnect.start";
  return (
    <Pressable
      style={styles.connectCard}
      onPress={onPress}
      disabled={busy}
    >
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
              defaultValue: "需补充: ",
            })}
            {status!.requirementsCurrentlyDue.slice(0, 3).join(", ")}
          </Text>
        ) : null}
      </View>
      <View style={styles.connectCta}>
        <Text style={styles.connectCtaText}>{t(ctaKey)}</Text>
      </View>
    </Pressable>
  );
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
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
    empty: {
      alignItems: "center",
      paddingVertical: 56,
    },
    emptyText: {
      marginTop: 12,
      color: t.colors.gray300,
      fontSize: 13,
    },
    addCta: {
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 4,
      backgroundColor: t.colors.accent,
    },
    addCtaText: {
      color: t.colors.textInverted,
      fontWeight: "600",
    },
    card: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    cardIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: t.colors.skeleton,
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitle: { fontSize: 14, color: t.colors.text, fontWeight: "600" },
    cardSubtitle: {
      fontSize: 12,
      color: t.colors.gray300,
      marginTop: 2,
    },
    defaultBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      backgroundColor: t.colors.text,
    },
    defaultBadgeText: {
      color: t.colors.textInverted,
      fontSize: 11,
      fontWeight: "600",
    },
    cardActions: {
      flexDirection: "row",
      gap: 12,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    connectCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 12,
      marginBottom: 14,
      backgroundColor: t.colors.cardElevated,
      borderWidth: 1,
      borderColor: t.colors.accent,
    },
    connectIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: t.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    connectTitle: {
      fontSize: 14,
      color: t.colors.text,
      fontWeight: "600",
    },
    connectSubtitle: {
      fontSize: 12,
      color: t.colors.gray300,
      marginTop: 2,
    },
    connectCta: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: t.colors.accent,
    },
    connectCtaText: {
      color: t.colors.textInverted,
      fontSize: 12,
      fontWeight: "600",
    },
    actionBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    actionBtnDanger: { borderColor: t.colors.error },
    actionBtnText: { fontSize: 12, color: t.colors.text },
    modalBackdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    modalSheet: {
      maxHeight: "85%",
      backgroundColor: t.colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    modalHandle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border,
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 16,
    },
    typeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    typePill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: t.colors.gray100,
    },
    typePillActive: { backgroundColor: t.colors.accent },
    typePillText: { color: t.colors.gray300, fontSize: 13 },
    typePillTextActive: {
      color: t.colors.textInverted,
      fontWeight: "600",
    },
    field: { marginBottom: 12 },
    fieldLabel: {
      fontSize: 12,
      color: t.colors.gray300,
      marginBottom: 6,
    },
    fieldHint: { marginTop: 4, fontSize: 11, color: t.colors.gray300 },
    input: {
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontSize: 14,
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
    },
    checkboxRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 8,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: t.colors.gray200,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    checkboxChecked: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
    },
    checkboxText: { fontSize: 13, color: t.colors.text },
    primaryBtn: {
      marginTop: 12,
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
