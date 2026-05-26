/**
 * CheckoutScreen —— PRD 模块四「立即购买」结算页(填地址 + 复核)。
 *
 * 进入路径:详情页 → 立即购买 → 这里 → 提交订单 → PaymentScreen 选支付方式。
 *
 * 地址来源(PRD 「支付环节地址管理」):
 *   1. 首次加载尝试 getDefaultAddress(),命中即预填;
 *   2. 用户可点"更换地址"打开 AddressPickerSheet 从地址簿选;
 *   3. 也可选择"手动输入新地址",此时下单不会回写地址簿(只作为订单快照)。
 *
 * 订单上的地址永远是「下单瞬间快照」,跟地址簿条目解耦——
 * 用户事后改 / 删地址簿不会影响已存在的订单。
 */
import React, { useEffect, useState } from "react";
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
import {
  getDefaultAddress,
  UserAddress,
} from "../../services/addressService";
import { useFormatPrice } from "../../utils/currency";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { AddressPickerSheet } from "../../components/AddressPickerSheet";
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

type Mode = "selected" | "manual";

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
  const formatPrice = useFormatPrice();
  const styles = useThemedStyles(makeStyles);

  // 地址相关状态
  const [mode, setMode] = useState<Mode>("manual");
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // 手动输入字段(mode === 'manual' 时使用)
  const [receiverName, setReceiverName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [step, setStep] = useState<"form" | "submitting">("form");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 首次加载时尝试拉默认地址。命中就切到 selected 模式,
  // 拉不到(404 / 网络 / 没地址)就保持手动输入。
  useEffect(() => {
    let cancelled = false;
    getDefaultAddress()
      .then((addr) => {
        if (cancelled || !addr) return;
        setSelectedAddress(addr);
        setMode("selected");
      })
      .catch(() => {
        // 静默失败,用户用手动模式
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = (addr: UserAddress) => {
    setSelectedAddress(addr);
    setMode("selected");
    setPickerOpen(false);
  };

  const submit = async () => {
    const payload =
      mode === "selected" && selectedAddress
        ? {
            receiverName: selectedAddress.receiverName,
            phone: selectedAddress.phone,
            address: selectedAddress.fullText,
          }
        : {
            receiverName: receiverName.trim(),
            phone: phone.trim(),
            address: address.trim(),
          };

    if (!payload.receiverName || !payload.phone || !payload.address) {
      setErrorMsg(t("trading.checkout.fillAllFields"));
      return;
    }
    setErrorMsg(null);
    setStep("submitting");
    try {
      const { order } = await buyNow(productId, payload);
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
        <Text style={styles.headerTitle}>
          {t("trading.checkout.headerTitle")}
        </Text>
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t("trading.checkout.shippingSection")}
            </Text>
            <Pressable onPress={() => setPickerOpen(true)} hitSlop={8}>
              <Text style={styles.linkText}>
                {mode === "selected"
                  ? t("trading.checkout.changeAddress")
                  : t("trading.checkout.useSavedAddress")}
              </Text>
            </Pressable>
          </View>

          {mode === "selected" && selectedAddress ? (
            <Pressable
              style={styles.selectedCard}
              onPress={() => setPickerOpen(true)}
            >
              <View style={styles.selectedRow}>
                <Text style={styles.selectedName}>
                  {selectedAddress.receiverName}
                </Text>
                <Text style={styles.selectedPhone}>{selectedAddress.phone}</Text>
                {selectedAddress.isDefault ? (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>
                      {t("trading.addressBook.defaultBadge")}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.selectedFull} numberOfLines={3}>
                {selectedAddress.fullText}
              </Text>
              <View style={styles.modeSwitchRow}>
                <Pressable onPress={() => setMode("manual")} hitSlop={6}>
                  <Text style={styles.linkTextSmall}>
                    {t("trading.checkout.manualEntry")}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          ) : (
            <>
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
            </>
          )}
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
          style={[
            styles.primaryBtn,
            step === "submitting" && styles.primaryBtnDisabled,
          ]}
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

      <AddressPickerSheet
        visible={pickerOpen}
        selectedId={selectedAddress?.id ?? null}
        onSelect={handleSelect}
        onClose={() => setPickerOpen(false)}
      />
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
    coverImage: { width: 80, height: 80, borderRadius: 8, marginRight: 12 },
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
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.text,
    },
    linkText: { color: t.colors.accent, fontSize: 13, fontWeight: "600" },
    linkTextSmall: { color: t.colors.accent, fontSize: 12 },
    selectedCard: {
      backgroundColor: t.colors.background,
      borderRadius: 8,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    selectedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
      flexWrap: "wrap",
    },
    selectedName: { fontSize: 14, fontWeight: "600", color: t.colors.text },
    selectedPhone: { fontSize: 13, color: t.colors.gray300 },
    defaultBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      backgroundColor: t.colors.accent,
      borderRadius: 4,
    },
    defaultBadgeText: {
      fontSize: 10,
      color: t.colors.textInverted,
      fontWeight: "600",
    },
    selectedFull: { fontSize: 13, color: t.colors.text, lineHeight: 18 },
    modeSwitchRow: { marginTop: 10, alignItems: "flex-end" },
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
    error: { color: t.colors.error, marginTop: 12, fontSize: 13 },
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
