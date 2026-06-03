/**
 * ShippingAddressModal —— offer 成交后补填收货地址的弹窗。
 *
 * 复用 ShippingAddressFields(收货人/电话/地址) + AddressPickerSheet(常用地址),
 * 与 CheckoutScreen 视觉一致。提交后写入订单 shipping_address_json。
 *
 * 由 Chat 屏在 `openShippingForOrderId` 路由参数存在时渲染并打开,
 * 这样能复用屏幕内的导航上下文(AddressPickerSheet → AddressBook)。
 */
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Text } from "../ui";
import {
  makeTradingFormStyles,
  ShippingAddressFields,
} from "./TradingFormShared";
import { AddressPickerSheet } from "../AddressPickerSheet";
import {
  getDefaultAddress,
  UserAddress,
} from "../../services/addressService";
import { setOrderShippingAddress, Order } from "../../services/orderService";
import { Alert } from "../../utils/Alert";
import { OptimizedImage } from "../ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

interface Props {
  visible: boolean;
  orderId: number;
  productTitle?: string | null;
  coverImage?: string | null;
  onClose: () => void;
  onSaved?: (order: Order) => void;
}

export function ShippingAddressModal({
  visible,
  orderId,
  productTitle,
  coverImage,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const formStyles = useThemedStyles(makeTradingFormStyles);
  const styles = useThemedStyles(makeModalStyles);

  const [receiverName, setReceiverName] = useState("");
  const [phone, setPhone] = useState("");
  const [fullText, setFullText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 打开时预填默认地址, 减少手填。
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getDefaultAddress()
      .then((addr) => {
        if (cancelled || !addr) return;
        setReceiverName(addr.receiverName);
        setPhone(addr.phone);
        setFullText(addr.fullText);
        setSelectedId(addr.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleSelect = (addr: UserAddress) => {
    setReceiverName(addr.receiverName);
    setPhone(addr.phone);
    setFullText(addr.fullText);
    setSelectedId(addr.id);
    setPickerOpen(false);
    setErrorMsg(null);
  };

  const submit = async () => {
    const payload = {
      receiverName: receiverName.trim(),
      phone: phone.trim(),
      address: fullText.trim(),
    };
    if (!payload.receiverName || !payload.phone || !payload.address) {
      setErrorMsg(t("trading.checkout.fillAllFields"));
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const order = await setOrderShippingAddress(orderId, payload);
      Alert.show(t("trading.addressPrompt.saved"));
      onSaved?.(order);
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.message ?? t("trading.addressPrompt.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <SafeAreaView edges={["bottom"]} style={styles.safe}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <Text style={styles.headerTitle}>
                  {t("trading.addressPrompt.modalTitle")}
                </Text>
                <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={theme.colors.text} />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {productTitle || coverImage ? (
                  <View style={styles.productRow}>
                    {coverImage ? (
                      <OptimizedImage
                        uri={coverImage}
                        size={ImageSize.THUMBNAIL}
                        style={styles.cover}
                        contentFit="cover"
                      />
                    ) : null}
                    <Text style={styles.productTitle} numberOfLines={2}>
                      {productTitle ?? ""}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.notice}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={theme.colors.gray300}
                  />
                  <Text style={formStyles.noticeText}>
                    {t("trading.addressPrompt.modalHint")}
                  </Text>
                </View>

                <Pressable
                  style={styles.savedLink}
                  onPress={() => setPickerOpen(true)}
                  hitSlop={6}
                >
                  <Ionicons
                    name="bookmark-outline"
                    size={16}
                    color={theme.colors.accent}
                  />
                  <Text style={formStyles.linkText}>
                    {t("trading.checkout.useSavedAddress")}
                  </Text>
                </Pressable>

                <ShippingAddressFields
                  receiverName={receiverName}
                  phone={phone}
                  fullText={fullText}
                  onChangeReceiverName={(v) => {
                    setReceiverName(v);
                    setSelectedId(null);
                  }}
                  onChangePhone={(v) => {
                    setPhone(v);
                    setSelectedId(null);
                  }}
                  onChangeFullText={(v) => {
                    setFullText(v);
                    setSelectedId(null);
                  }}
                />

                {errorMsg ? (
                  <Text style={formStyles.errorText}>{errorMsg}</Text>
                ) : null}
              </ScrollView>

              <Pressable
                style={[
                  formStyles.primaryBtn,
                  styles.submitBtn,
                  submitting && formStyles.primaryBtnDisabled,
                ]}
                onPress={submit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={theme.colors.textInverted} />
                ) : (
                  <Text style={formStyles.primaryBtnText}>
                    {t("trading.addressPrompt.save")}
                  </Text>
                )}
              </Pressable>
            </SafeAreaView>
          </View>
        </KeyboardAvoidingView>
        </View>
      </Modal>

      <AddressPickerSheet
        visible={pickerOpen}
        selectedId={selectedId}
        onSelect={handleSelect}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

const makeModalStyles = (t: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    backdropTouch: {
      ...StyleSheet.absoluteFillObject,
    },
    sheetWrap: {
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      maxHeight: "88%",
      overflow: "hidden",
    },
    safe: { flexShrink: 1 },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border,
      marginTop: 8,
      marginBottom: 4,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    headerTitle: {
      ...t.typography.h4,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
    },
    closeBtn: {
      width: 40,
      height: 40,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    scroll: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      gap: 12,
    },
    productRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: t.colors.cardElevated,
      borderRadius: t.borderRadius.sm,
      padding: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    cover: {
      width: 44,
      height: 44,
      borderRadius: t.borderRadius.sm,
    },
    productTitle: {
      flex: 1,
      ...t.typography.bodySmall,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.text,
    },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      paddingHorizontal: 4,
    },
    savedLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    submitBtn: {
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 8,
    },
  });
