/**
 * PlusSubscribeScreen —— PRD 模块 8 Plus 订阅与权益。
 *
 * 权益：
 *   - 抽佣折扣 8% → 6%
 *   - 鉴定免费券 / 优惠（接 P5 鉴定流程；当前为占位）
 *   - Archive 数据画像面板解锁
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useStripe } from "@stripe/stripe-react-native";

import {
  getPlusStatus,
  subscribePlus,
  confirmPlusMock,
  cancelPlus,
  PlusStatus,
  PlusPlan,
} from "../../services/archivePlusService";
import { formatPriceDisplay } from "../../utils/currency";
import {
  playfairFonts,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import { config as envConfig, IS_NA } from "../../config/env";

/** Plus 套餐定价 —— 中美版各用本地币种展示,不再做汇率换算混显。 */
const PLUS_PLAN_PRICING = {
  monthly: { cnyCents: 2900, usdCents: 2900 },
  annual: { cnyCents: 29800, usdCents: 29800 },
} as const;

const plusDisplayCurrency = IS_NA ? "USD" : "CNY";

function formatPlusAmount(cents: number): string {
  return formatPriceDisplay(cents, plusDisplayCurrency, plusDisplayCurrency, {
    trimZeroFraction: true,
  });
}

const BENEFITS: { icon: any; title: string; desc: string }[] = [
  { icon: "trending-down", title: "抽佣折扣", desc: "8% → 6%，每笔订单立省 2 个点" },
  { icon: "shield-checkmark", title: "鉴定优惠", desc: "每月 1 次免费标准鉴定" },
  {
    icon: "stats-chart",
    title: "藏品数据画像",
    desc: "解锁品牌 / 年代 / 价格分布全维面板",
  },
  { icon: "gift", title: "专属客服", desc: "Plus 通道 4 小时响应承诺" },
];

export default function PlusSubscribeScreen() {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const [status, setStatus] = useState<PlusStatus | null>(null);
  const [plan, setPlan] = useState<PlusPlan>("annual");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getPlusStatus();
      setStatus(s);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const subscribe = async () => {
    setBusy(true);
    try {
      const sub = await subscribePlus(plan);

      // 1) 真实 Stripe 支付路径: source=stripe + 拿到 clientSecret 才走 PaymentSheet
      const isRealStripe =
        sub.source === "stripe" &&
        sub.clientSecret &&
        !sub.clientSecret.startsWith("stripe_stub_") &&
        !sub.clientSecret.startsWith("stripe_err_") &&
        !!envConfig.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      if (isRealStripe) {
        const initRes = await initPaymentSheet({
          merchantDisplayName: "Avant Regard",
          paymentIntentClientSecret: sub.clientSecret!,
          applePay: { merchantCountryCode: "US" },
          googlePay: { merchantCountryCode: "US", testEnv: __DEV__ },
          returnURL: "avantregard://stripe-redirect",
        });
        if (initRes.error) throw new Error(initRes.error.message);
        const presentRes = await presentPaymentSheet();
        if (presentRes.error) {
          if (presentRes.error.code === "Canceled") return;
          throw new Error(presentRes.error.message);
        }
        // 付款成功 → 实际激活由 webhook 完成 (plus_service.confirm_by_intent),
        // 这里不再调 confirm-mock; 给后端一个心跳的小延时再 reload 状态。
        await new Promise((r) => setTimeout(r, 1200));
        Alert.alert("订阅成功", "Plus 权益将在数秒内生效");
        load();
        return;
      }

      // 2) DEV 联调路径 (mock provider / 没配 stripe key): 直接 confirm-mock。
      // 生产环境后端会 404, 这种情况会落到 catch 提示错误。
      await confirmPlusMock(sub.id);
      Alert.alert("订阅成功", "Plus 权益已生效");
      load();
    } catch (e: any) {
      Alert.alert("失败", e?.message ?? "订阅失败");
    } finally {
      setBusy(false);
    }
  };

  const planCents = (kind: "monthly" | "annual") =>
    IS_NA ? PLUS_PLAN_PRICING[kind].usdCents : PLUS_PLAN_PRICING[kind].cnyCents;

  const monthlyPrice = formatPlusAmount(planCents("monthly"));
  const annualPrice = formatPlusAmount(planCents("annual"));
  const annualPerMonthPrice = formatPlusAmount(Math.round(planCents("annual") / 12));

  const cancel = async () => {
    if (!status?.subscription) return;
    setBusy(true);
    try {
      await cancelPlus(status.subscription.id);
      Alert.alert("已取消", "Plus 将在到期后失效");
      load();
    } catch (e: any) {
      Alert.alert("失败", e?.message ?? "操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScreenHeader
        title={t("trading.plus.headerTitle")}
        showBack
        borderless
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t("trading.plus.heroTitle")}</Text>
          <Text style={styles.heroSub}>
            为认真对待档案的藏家而设
          </Text>
          {status?.isActive ? (
            <Text style={styles.activeBadge}>
              当前生效中 · 到期 {status.subscription?.periodEnd.slice(0, 10)}
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>{t("trading.plus.benefits")}</Text>
        {BENEFITS.map((b) => (
          <View key={b.title} style={styles.benefitRow}>
            <View style={styles.benefitIcon}>
              <Ionicons name={b.icon} size={18} color={theme.colors.plusGold} />
            </View>
            <View style={styles.benefitBody}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitDesc}>{b.desc}</Text>
            </View>
          </View>
        ))}

        {!status?.isActive ? (
          <>
            <Text style={styles.sectionTitle}>{t("trading.plus.selectPlan")}</Text>
            <View style={styles.planRow}>
              <Pressable
                style={[
                  styles.planCard,
                  plan === "monthly" && styles.planCardActive,
                ]}
                onPress={() => setPlan("monthly")}
              >
                <View
                  style={[styles.radio, plan === "monthly" && styles.radioActive]}
                >
                  {plan === "monthly" ? (
                    <Ionicons
                      name="checkmark"
                      size={12}
                      color={theme.colors.textInverted}
                    />
                  ) : null}
                </View>
                <Text style={styles.planName}>{t("trading.plus.planMonthly")}</Text>
                <Text style={styles.planPrice}>{monthlyPrice}</Text>
                <Text style={styles.planMeta}>{t("trading.plus.billedMonthly")}</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.planCard,
                  plan === "annual" && styles.planCardActive,
                ]}
                onPress={() => setPlan("annual")}
              >
                <Text style={styles.planTag}>{t("trading.plus.recommended")}</Text>
                <View
                  style={[styles.radio, plan === "annual" && styles.radioActive]}
                >
                  {plan === "annual" ? (
                    <Ionicons
                      name="checkmark"
                      size={12}
                      color={theme.colors.textInverted}
                    />
                  ) : null}
                </View>
                <Text style={styles.planName}>{t("trading.plus.planYearly")}</Text>
                <Text style={styles.planPrice}>{annualPrice}</Text>
                <Text style={styles.planMeta}>
                  {t("trading.plus.planPerMonth", { price: annualPerMonthPrice })}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {status?.isActive ? (
          <Pressable
            style={[styles.ghostBtn, busy && { opacity: 0.5 }]}
            onPress={cancel}
            disabled={busy}
          >
            <Text style={styles.ghostBtnText}>
              {t("trading.plus.cancelAutoRenew")}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.primaryBtn, busy && { opacity: 0.5 }]}
            onPress={subscribe}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={theme.colors.textInverted} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {plan === "monthly"
                  ? t("trading.plus.subscribeMonthly", { price: monthlyPrice })
                  : t("trading.plus.subscribeAnnual", { price: annualPrice })}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.colors.background },
    scroll: { padding: 16, paddingBottom: 120 },
    hero: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: t.borderRadius.sm,
      padding: 20,
      marginBottom: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    heroTitle: {
      ...t.typography.h2,
      fontFamily: playfairFonts.bold,
      color: t.colors.plusGold,
    },
    heroSub: {
      ...t.typography.bodySmall,
      fontFamily: playfairFonts.regular,
      color: t.colors.textSecondary,
      marginTop: 6,
    },
    activeBadge: {
      ...t.typography.bodySmall,
      fontFamily: playfairFonts.medium,
      color: t.colors.plusGold,
      marginTop: 12,
    },
    sectionTitle: {
      ...t.typography.caption,
      fontFamily: playfairFonts.medium,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: t.colors.gray300,
      marginTop: 20,
      marginBottom: 10,
    },
    benefitRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 14,
      backgroundColor: t.colors.cardElevated,
      borderRadius: t.borderRadius.sm,
      marginBottom: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    benefitIcon: {
      width: 36,
      height: 36,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    benefitBody: { flex: 1 },
    benefitTitle: {
      ...t.typography.bodySmall,
      fontFamily: playfairFonts.medium,
      color: t.colors.text,
    },
    benefitDesc: {
      ...t.typography.caption,
      fontFamily: playfairFonts.regular,
      color: t.colors.textSecondary,
      marginTop: 2,
    },
    planRow: { flexDirection: "row", gap: 10 },
    planCard: {
      flex: 1,
      backgroundColor: t.colors.cardElevated,
      borderRadius: t.borderRadius.sm,
      padding: 16,
      paddingTop: 36,
      borderWidth: 1,
      borderColor: t.colors.border,
      position: "relative",
    },
    planCardActive: { borderColor: t.colors.accent },
    radio: {
      position: "absolute",
      top: 12,
      left: 12,
      width: 20,
      height: 20,
      borderRadius: t.borderRadius.full,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      alignItems: "center",
      justifyContent: "center",
    },
    radioActive: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
    },
    planTag: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: t.colors.plusGold,
      color: t.mode === "dark" ? "#1A1100" : "#FFFFFF",
      ...t.typography.caption,
      fontSize: 10,
      fontFamily: playfairFonts.medium,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: t.borderRadius.sm,
      overflow: "hidden",
    },
    planName: {
      ...t.typography.caption,
      fontFamily: playfairFonts.medium,
      marginBottom: 6,
      color: t.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    planPrice: {
      fontSize: 22,
      lineHeight: 28,
      fontFamily: playfairFonts.bold,
      color: t.colors.text,
    },
    planMeta: {
      ...t.typography.caption,
      fontFamily: playfairFonts.regular,
      color: t.colors.textSecondary,
      marginTop: 4,
    },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
      backgroundColor: t.colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    primaryBtn: {
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
    },
    primaryBtnText: {
      ...t.typography.button,
      fontSize: 15,
      fontFamily: playfairFonts.medium,
      color: t.colors.textInverted,
    },
    ghostBtn: {
      paddingVertical: 14,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    ghostBtnText: {
      ...t.typography.button,
      fontSize: 15,
      fontFamily: playfairFonts.medium,
      color: t.colors.gray400,
    },
  });
