/**
 * PaymentScreen —— PRD 模块四「结算 → 支付」分离后的支付页。
 *
 * 入口：
 *   1. CheckoutScreen 提交订单后 → navigation.replace("Payment", { orderId })
 *   2. OrderDetailScreen 待支付订单 → navigation.navigate("Payment", { orderId })
 *   3. MyOffersScreen accept 成功 → navigation.navigate("Payment", { orderId })
 *
 * 支付通道：
 *   - 中国（CNY）：支付宝 / 微信支付
 *   - 美国及其它（USD/...）：Stripe
 *   - 开发环境额外暴露 mock，方便联调
 *
 * 流程：
 *   - GET /orders/:id/payment-options 拉可用 provider
 *   - 用户选 provider → POST /orders/:id/pay → 拿到 provider intent / clientSecret / orderString / prepayId
 *   - 调起原生 SDK（待真实接入；当前直接 confirm 闭环）
 *   - POST /orders/:id/pay/confirm → 订单 → paid
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  confirmPayment,
  getOrder,
  listPaymentOptions,
  Order,
  PaymentOption,
  PaymentProviderId,
  startPayment,
} from "../../services/orderService";
import { useFormatPrice } from "../../utils/currency";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type RouteParams = { Payment: { orderId: number } };

const PROVIDER_ICON: Record<
  PaymentProviderId,
  { name: keyof typeof Ionicons.glyphMap; color: string }
> = {
  alipay: { name: "logo-alipay", color: "#1677FF" },
  wechat: { name: "logo-wechat", color: "#1AAD19" },
  stripe: { name: "card", color: "#635BFF" },
  mock: { name: "construct", color: "#9A9A9A" },
};

/**
 * 库存锁定时长(分钟)。与后端 order_service.HOLD_TTL_MINUTES 保持一致。
 * 到期后买家未付款,cron expire_holds_due 会把订单转 refunded_auto 并释放库存。
 */
const HOLD_TTL_MINUTES = 30;

export default function PaymentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "Payment">>();
  const { orderId } = route.params;
  const { t } = useTranslation();
  const theme = useAppTheme();
  const formatPrice = useFormatPrice();
  const styles = useThemedStyles(makeStyles);

  const [order, setOrder] = useState<Order | null>(null);
  const [options, setOptions] = useState<PaymentOption[]>([]);
  const [selected, setSelected] = useState<PaymentProviderId | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  // 支付倒计时:order.createdAt + 30 分钟。
  // 到 0 时禁用 pay 按钮 + 显眼提示;实际状态推进由 cron 完成,UI 只是同步告警。
  useEffect(() => {
    if (!order?.createdAt) {
      setRemainingMs(null);
      return;
    }
    if (order.status !== "pending_payment") {
      setRemainingMs(null);
      return;
    }
    const deadline = new Date(order.createdAt).getTime() + HOLD_TTL_MINUTES * 60_000;
    const tick = () => setRemainingMs(deadline - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [order?.createdAt, order?.status]);

  const countdownExpired = remainingMs !== null && remainingMs <= 0;
  const countdownLabel = (() => {
    if (remainingMs === null) return null;
    if (remainingMs <= 0) return "00:00";
    const total = Math.floor(remainingMs / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  })();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, opts] = await Promise.all([
        getOrder(orderId),
        listPaymentOptions(orderId),
      ]);
      setOrder(o);
      setOptions(opts.items);
      setSelected(opts.items[0]?.provider ?? null);
    } catch (e: any) {
      Alert.alert(
        t("trading.payment.loadFailedTitle"),
        e?.message ?? t("common.failed"),
      );
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePay = async () => {
    if (!order || !selected) return;
    setPaying(true);
    try {
      // 1. 创建/刷新 provider intent
      const refreshed = await startPayment(order.id, selected);
      setOrder(refreshed);

      // 2. 拉起原生 SDK 占位：真实接入时根据 provider 走不同 flow
      //    Stripe → Stripe RN SDK PaymentSheet
      //    Alipay → alipay-react-native
      //    WeChat → react-native-wechat
      //    当前 stub 直接走 confirm 闭环
      const confirmed = await confirmPayment(order.id);
      setOrder(confirmed);

      Alert.alert(
        t("trading.payment.successTitle"),
        t("trading.payment.successMessage"),
        [
          {
            text: t("trading.payment.viewOrder"),
            onPress: () =>
              navigation.replace("OrderDetail", { orderId: order.id }),
          },
        ],
      );
    } catch (e: any) {
      Alert.alert(
        t("trading.payment.failedTitle"),
        e?.message ?? t("trading.payment.failedMessage"),
      );
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }
  if (!order) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>{t("trading.payment.orderMissing")}</Text>
      </SafeAreaView>
    );
  }

  const isPaid = order.status !== "pending_payment";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t("trading.payment.headerTitle")}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {countdownLabel && !isPaid ? (
          <View
            style={[
              styles.countdownBox,
              countdownExpired && styles.countdownBoxExpired,
            ]}
          >
            <Ionicons
              name={countdownExpired ? "alert-circle" : "time-outline"}
              size={16}
              color={
                countdownExpired ? theme.colors.error : theme.colors.text
              }
            />
            <Text style={styles.countdownText}>
              {countdownExpired
                ? t("trading.payment.holdExpired")
                : t("trading.payment.holdCountdown", { time: countdownLabel })}
            </Text>
          </View>
        ) : null}

        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>
            {t("trading.payment.amountLabel")}
          </Text>
          <Text style={styles.amount}>
            {formatPrice(order.paidPriceCents, order.currency)}
          </Text>
          <Text style={styles.orderNo}>
            {t("trading.payment.orderNoLabel", { no: order.orderNo })}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          {t("trading.payment.choosePaymentMethod")}
        </Text>

        {options.length === 0 ? (
          <Text style={styles.empty}>{t("trading.payment.noOptions")}</Text>
        ) : (
          options.map((opt) => {
            const active = selected === opt.provider;
            const meta = PROVIDER_ICON[opt.provider] ?? PROVIDER_ICON.mock;
            const labelKey = `trading.payment.providers.${opt.provider}`;
            return (
              <Pressable
                key={opt.provider}
                style={[styles.optionRow, active && styles.optionRowActive]}
                onPress={() => setSelected(opt.provider)}
                disabled={paying || isPaid}
              >
                <View style={[styles.iconWrap, { backgroundColor: meta.color + "1A" }]}>
                  <Ionicons name={meta.name} size={22} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionName}>
                    {t(labelKey, { defaultValue: opt.name })}
                  </Text>
                  <Text style={styles.optionDesc}>
                    {t(`trading.payment.providerDesc.${opt.provider}`, {
                      defaultValue: "",
                    })}
                  </Text>
                </View>
                <Ionicons
                  name={active ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={active ? theme.colors.text : theme.colors.gray200}
                />
              </Pressable>
            );
          })
        )}

        <View style={styles.notice}>
          <Ionicons
            name="shield-checkmark"
            size={16}
            color={theme.colors.gray300}
          />
          <Text style={styles.noticeText}>
            {t("trading.payment.escrowNotice")}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerLabel}>
            {t("trading.payment.payNowLabel")}
          </Text>
          <Text style={styles.footerAmount}>
            {formatPrice(order.paidPriceCents, order.currency)}
          </Text>
        </View>
        <Pressable
          style={[
            styles.primaryBtn,
            (paying || isPaid || !selected || countdownExpired) &&
              styles.primaryBtnDisabled,
          ]}
          onPress={handlePay}
          disabled={paying || isPaid || !selected || countdownExpired}
        >
          {paying ? (
            <ActivityIndicator color={theme.colors.textInverted} />
          ) : (
            <Text style={styles.primaryBtnText}>
              {isPaid
                ? t("trading.payment.alreadyPaid")
                : t("trading.payment.payNow")}
            </Text>
          )}
        </Pressable>
      </View>
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
    scroll: { padding: 16, paddingBottom: 140 },
    countdownBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: t.colors.cardElevated,
      borderRadius: 8,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    countdownBoxExpired: {
      borderColor: t.colors.error,
      backgroundColor: t.colors.error + "10",
    },
    countdownText: {
      flex: 1,
      fontSize: 13,
      color: t.colors.text,
      fontWeight: "600",
    },
    amountBlock: {
      alignItems: "center",
      paddingVertical: 32,
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      marginBottom: 20,
    },
    amountLabel: { fontSize: 12, color: t.colors.gray300 },
    amount: {
      fontSize: 36,
      fontWeight: "700",
      color: t.colors.text,
      marginVertical: 8,
    },
    orderNo: { fontSize: 11, color: t.colors.gray300 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 12,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: "transparent",
    },
    optionRowActive: { borderColor: t.colors.text },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    optionName: { fontSize: 14, fontWeight: "600", color: t.colors.text },
    optionDesc: { fontSize: 11, color: t.colors.gray300, marginTop: 2 },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginTop: 16,
      paddingHorizontal: 4,
    },
    noticeText: { flex: 1, fontSize: 11, color: t.colors.gray300, lineHeight: 16 },
    empty: { textAlign: "center", color: t.colors.gray300, marginVertical: 32 },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 24,
      backgroundColor: t.colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    footerLabel: { fontSize: 11, color: t.colors.gray300 },
    footerAmount: { fontSize: 18, fontWeight: "700", color: t.colors.text },
    primaryBtn: {
      backgroundColor: t.colors.accent,
      paddingVertical: 12,
      paddingHorizontal: 28,
      borderRadius: 4,
      minWidth: 140,
      alignItems: "center",
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
  });
