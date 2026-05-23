/**
 * CheckoutScreen —— PRD 模块四「立即购买」结算页（填地址 + 复核）。
 *
 * 进入路径：详情页 → 立即购买 → 这里 → 提交订单 → PaymentScreen 选支付方式。
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
import { useTranslation } from "react-i18next";

import { buyNow } from "../../services/orderService";
import { formatPrice } from "../../services/storeProductService";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type RouteParams = {
  Checkout: {
    productId: number;
    title?: string;
    brand?: string | null;
    priceCents: number;
    currency?: string;
    coverImage?: string | null;
  };
};

export default function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "Checkout">>();
  const {
    productId,
    title,
    brand,
    priceCents,
    currency = "CNY",
    coverImage,
  } = route.params;
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [receiverName, setReceiverName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [step, setStep] = useState<"form" | "submitting">("form");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async () => {
    if (!receiverName.trim() || !phone.trim() || !address.trim()) {
      setErrorMsg(t("trading.checkout.fillAllFields"));
      return;
    }
    setErrorMsg(null);
    setStep("submitting");
    try {
      const { order } = await buyNow(productId, {
        receiverName: receiverName.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      navigation.replace("Payment", { orderId: order.id });
    } catch (e: any) {
      setErrorMsg(e?.message ?? t("trading.checkout.submitFailed"));
      setStep("form");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("trading.checkout.headerTitle")}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.productCard}>
          {coverImage ? (
            <OptimizedImage
              uri={coverImage}
              size={ImageSize.THUMBNAIL}
              style={styles.coverImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.coverImage, styles.coverPlaceholder]}>
              <Ionicons
                name="image-outline"
                size={28}
                color={theme.colors.gray300}
              />
            </View>
          )}
          <View style={styles.productInfo}>
            {brand ? (
              <Text style={styles.brand} numberOfLines={1}>
                {brand}
              </Text>
            ) : null}
            <Text style={styles.productTitle} numberOfLines={2}>
              {title ?? t("trading.orders.productLabel", { id: productId })}
            </Text>
            <Text style={styles.productPrice}>
              {formatPrice(priceCents, currency)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("trading.checkout.shippingSection")}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t("trading.checkout.receiverName")}
            placeholderTextColor={theme.colors.placeholder}
            value={receiverName}
            onChangeText={setReceiverName}
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder={t("trading.checkout.phone")}
            placeholderTextColor={theme.colors.placeholder}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder={t("trading.checkout.address")}
            placeholderTextColor={theme.colors.placeholder}
            value={address}
            onChangeText={setAddress}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.notice}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={theme.colors.gray300}
          />
          <Text style={styles.noticeText}>
            {t("trading.checkout.paymentNextStepHint")}
          </Text>
        </View>

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.footerLabel}>
            {t("trading.payment.payNowLabel")}
          </Text>
          <Text style={styles.footerPrice}>
            {formatPrice(priceCents, currency)}
          </Text>
        </View>
        <Pressable
          style={[styles.primaryBtn, step === "submitting" && styles.primaryBtnDisabled]}
          onPress={submit}
          disabled={step === "submitting"}
        >
          {step === "submitting" ? (
            <ActivityIndicator color={theme.colors.textInverted} />
          ) : (
            <Text style={styles.primaryBtnText}>
              {t("trading.checkout.submitOrder")}
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
    scroll: { padding: 16, paddingBottom: 120 },
    productCard: {
      flexDirection: "row",
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    coverImage: {
      width: 80,
      height: 80,
      borderRadius: 8,
      marginRight: 12,
    },
    coverPlaceholder: {
      backgroundColor: t.colors.skeleton,
      alignItems: "center",
      justifyContent: "center",
    },
    productInfo: { flex: 1, justifyContent: "center" },
    brand: {
      fontSize: 11,
      color: t.colors.gray300,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    productTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 6,
      lineHeight: 20,
    },
    productPrice: { fontSize: 18, fontWeight: "700", color: t.colors.text },
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
      marginBottom: 4,
      color: t.colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginTop: 10,
      fontSize: 14,
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
    },
    inputMultiline: { minHeight: 88 },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      paddingHorizontal: 4,
      marginTop: 4,
    },
    noticeText: {
      flex: 1,
      fontSize: 12,
      color: t.colors.gray300,
      lineHeight: 18,
    },
    error: {
      color: t.colors.error,
      marginTop: 12,
      fontSize: 13,
    },
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
    footerLeft: { flex: 1, marginRight: 12 },
    footerLabel: { fontSize: 11, color: t.colors.gray300 },
    footerPrice: { fontSize: 20, fontWeight: "700", color: t.colors.text },
    primaryBtn: {
      backgroundColor: t.colors.accent,
      paddingHorizontal: 28,
      paddingVertical: 12,
      borderRadius: 4,
      minWidth: 132,
      alignItems: "center",
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
  });
