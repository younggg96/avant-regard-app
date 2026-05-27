/**
 * CheckoutScreen —— PRD 模块四「立即购买」结算页(填地址 + 复核)。
 */
import React, { useEffect, useState } from "react";
import {
  View,
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
import ScreenHeader from "../../components/ScreenHeader";
import { Text } from "../../components/ui";
import {
  makeTradingFormStyles,
  TradingFormField,
  TradingFormInput,
  TradingFormTextArea,
  TRADING_FORM_PADDING,
} from "../../components/trading/TradingFormShared";
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
  const formStyles = useThemedStyles(makeTradingFormStyles);
  const styles = useThemedStyles(makeScreenStyles);

  const [mode, setMode] = useState<Mode>("manual");
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [receiverName, setReceiverName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [step, setStep] = useState<"form" | "submitting">("form");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDefaultAddress()
      .then((addr) => {
        if (cancelled || !addr) return;
        setSelectedAddress(addr);
        setMode("selected");
      })
      .catch(() => {});
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
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScreenHeader
        title={t("trading.checkout.headerTitle")}
        showBack
      />

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

        <View style={formStyles.section}>
          <View style={styles.sectionHeader}>
            <Text style={formStyles.sectionTitle}>
              {t("trading.checkout.shippingSection")}
            </Text>
            <Pressable onPress={() => setPickerOpen(true)} hitSlop={8}>
              <Text style={formStyles.linkText}>
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
                  <View style={formStyles.defaultBadge}>
                    <Text style={formStyles.defaultBadgeText}>
                      {t("trading.addressBook.defaultBadge")}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={formStyles.bodyText} numberOfLines={3}>
                {selectedAddress.fullText}
              </Text>
              <View style={styles.modeSwitchRow}>
                <Pressable onPress={() => setMode("manual")} hitSlop={6}>
                  <Text style={formStyles.linkText}>
                    {t("trading.checkout.manualEntry")}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          ) : (
            <>
              <TradingFormField label={t("trading.checkout.receiverName")}>
                <TradingFormInput
                  value={receiverName}
                  onChangeText={setReceiverName}
                  placeholder={t("trading.checkout.receiverName")}
                  autoCapitalize="words"
                />
              </TradingFormField>
              <TradingFormField label={t("trading.checkout.phone")}>
                <TradingFormInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={t("trading.checkout.phone")}
                  keyboardType="phone-pad"
                />
              </TradingFormField>
              <TradingFormField label={t("trading.checkout.address")}>
                <TradingFormTextArea
                  value={address}
                  onChangeText={setAddress}
                  placeholder={t("trading.checkout.address")}
                />
              </TradingFormField>
            </>
          )}
        </View>

        <View style={formStyles.notice}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={theme.colors.gray300}
          />
          <Text style={formStyles.noticeText}>
            {t("trading.checkout.paymentNextStepHint")}
          </Text>
        </View>

        {errorMsg ? (
          <Text style={formStyles.errorText}>{errorMsg}</Text>
        ) : null}
      </ScrollView>

      <View style={formStyles.footer}>
        <View style={styles.footerLeft}>
          <Text style={formStyles.footerLabel}>
            {t("trading.payment.payNowLabel")}
          </Text>
          <Text style={formStyles.footerPrice}>
            {formatPrice(priceCents, currency)}
          </Text>
        </View>
        <Pressable
          style={[
            formStyles.primaryBtn,
            step === "submitting" && formStyles.primaryBtnDisabled,
          ]}
          onPress={submit}
          disabled={step === "submitting"}
        >
          {step === "submitting" ? (
            <ActivityIndicator color={theme.colors.textInverted} />
          ) : (
            <Text style={formStyles.primaryBtnText}>
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

const makeScreenStyles = (t: AppTheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.colors.background },
    scroll: { padding: TRADING_FORM_PADDING, paddingBottom: 120 },
    productCard: {
      flexDirection: "row",
      backgroundColor: t.colors.cardElevated,
      borderRadius: t.borderRadius.sm,
      padding: 12,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    coverImage: {
      width: 80,
      height: 80,
      borderRadius: t.borderRadius.sm,
      marginRight: 12,
    },
    coverPlaceholder: {
      backgroundColor: t.colors.skeleton,
      alignItems: "center",
      justifyContent: "center",
    },
    productInfo: { flex: 1, justifyContent: "center" },
    brand: {
      ...t.typography.caption,
      color: t.colors.gray300,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    productTitle: {
      ...t.typography.bodySmall,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
      marginBottom: 6,
      lineHeight: 20,
    },
    productPrice: {
      ...t.typography.h4,
      color: t.colors.text,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    selectedCard: {
      backgroundColor: t.colors.background,
      borderRadius: t.borderRadius.sm,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      gap: 6,
    },
    selectedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    selectedName: {
      ...t.typography.bodySmall,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
    },
    selectedPhone: {
      ...t.typography.caption,
      color: t.colors.gray300,
    },
    modeSwitchRow: { marginTop: 4, alignItems: "flex-end" },
    footerLeft: { flex: 1, marginRight: 12 },
  });
