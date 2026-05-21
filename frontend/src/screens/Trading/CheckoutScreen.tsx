/**
 * CheckoutScreen —— PRD 模块四「立即购买」流程。
 *
 * 进入路径：详情页 → 立即购买 → 这里。
 * 后端发生：
 *   1. POST /api/orders/buy-now 创建库存锁（30 分钟）+ 订单（pending_payment）+ 支付意图（mock）
 *   2. 我方调 /pay-mock 模拟支付成功 → 状态切到 paid
 *
 * 上线接入真实支付通道时，仅需把 payOrderMock 换成 provider SDK 调用（Stripe / Alipay / WeChat），
 * 其余 UI 不动。
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { buyNow, payOrderMock } from "../../services/orderService";
import { formatPrice } from "../../services/storeProductService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type RouteParams = {
  Checkout: {
    productId: number;
    title?: string;
    priceCents: number;
    coverImage?: string | null;
  };
};

export default function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "Checkout">>();
  const { productId, title, priceCents, coverImage } = route.params;
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [receiverName, setReceiverName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [step, setStep] = useState<"form" | "paying" | "done">("form");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);

  const submit = async () => {
    if (!receiverName.trim() || !phone.trim() || !address.trim()) {
      setErrorMsg("请完整填写收货信息");
      return;
    }
    setErrorMsg(null);
    setStep("paying");
    try {
      const { order } = await buyNow(productId, {
        receiverName: receiverName.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      setOrderId(order.id);
      // mock 通道：立即 confirm 支付
      await payOrderMock(order.id);
      setStep("done");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "支付失败");
      setStep("form");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>结算</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        <View style={styles.productCard}>
          <View style={styles.coverBox}>
            <Text style={styles.coverPlaceholder}>图</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {title ?? `单品 #${productId}`}
            </Text>
            <Text style={styles.productPrice}>{formatPrice(priceCents)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>收货信息</Text>
          <TextInput
            style={styles.input}
            placeholder="收货人姓名"
            placeholderTextColor={theme.colors.placeholder}
            value={receiverName}
            onChangeText={setReceiverName}
          />
          <TextInput
            style={styles.input}
            placeholder="联系电话"
            placeholderTextColor={theme.colors.placeholder}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="详细地址"
            placeholderTextColor={theme.colors.placeholder}
            value={address}
            onChangeText={setAddress}
            multiline
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>支付方式</Text>
          <View style={styles.payRow}>
            <Ionicons name="card-outline" size={20} color={theme.colors.text} />
            <Text style={styles.payText}>Mock 支付（开发通道）</Text>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={theme.colors.success}
            />
          </View>
          <Text style={styles.hint}>
            上线后会切换成 Stripe / 支付宝 / 微信，下单流程不变。
          </Text>
        </View>

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        {step === "done" && orderId ? (
          <View style={styles.successBox}>
            <Ionicons
              name="checkmark-circle"
              size={56}
              color={theme.colors.success}
            />
            <Text style={styles.successTitle}>支付成功</Text>
            <Text style={styles.successHint}>卖家需在 72 小时内发货。</Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => navigation.replace("OrderDetail", { orderId })}
            >
              <Text style={styles.primaryBtnText}>查看订单</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {step !== "done" ? (
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerLabel}>实付</Text>
            <Text style={styles.footerPrice}>{formatPrice(priceCents)}</Text>
          </View>
          <Pressable
            style={[styles.primaryBtn, step === "paying" && { opacity: 0.5 }]}
            onPress={submit}
            disabled={step === "paying"}
          >
            {step === "paying" ? (
              <ActivityIndicator color={theme.colors.textInverted} />
            ) : (
              <Text style={styles.primaryBtnText}>提交订单</Text>
            )}
          </Pressable>
        </View>
      ) : null}
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
    scroll: { padding: 16, paddingBottom: 120 },
    productCard: {
      flexDirection: "row",
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    coverBox: {
      width: 80,
      height: 80,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: t.colors.skeleton,
      marginRight: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    coverPlaceholder: { color: t.colors.gray300 },
    productTitle: { fontSize: 14, color: t.colors.text, marginBottom: 8 },
    productPrice: { fontSize: 18, fontWeight: "700", color: t.colors.text },
    section: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      marginBottom: 8,
      color: t.colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 8,
      padding: 12,
      marginTop: 8,
      fontSize: 14,
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
    },
    inputMultiline: { minHeight: 80, textAlignVertical: "top" },
    payRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      gap: 12,
    },
    payText: { flex: 1, fontSize: 14, color: t.colors.text },
    hint: { fontSize: 12, color: t.colors.gray300, marginTop: 4 },
    error: { color: t.colors.error, marginBottom: 12 },
    successBox: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 24,
      alignItems: "center",
      marginBottom: 16,
    },
    successTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginTop: 12,
      color: t.colors.text,
    },
    successHint: { color: t.colors.gray300, marginVertical: 8 },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 24,
      backgroundColor: t.colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    footerLabel: { fontSize: 12, color: t.colors.gray300 },
    footerPrice: { fontSize: 20, fontWeight: "700", color: t.colors.text },
    primaryBtn: {
      backgroundColor: t.colors.accent,
      paddingHorizontal: 32,
      paddingVertical: 12,
      borderRadius: 24,
      marginTop: 12,
    },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
  });
