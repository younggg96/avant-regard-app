/**
 * ConfirmReceiptScreen —— 买家确认收货前的「核对清单 + 结算明细预览」页。
 *
 * 入口：
 *   - OrderDetailScreen 「确认收货」按钮 → navigation.navigate("ConfirmReceipt", { orderId })
 *
 * 流程：
 *   - 拉订单 + 商品 → 展示买家支付金额
 *   - 用户勾选 3 项核对清单 → 「确认收货」可点
 *   - 调 confirmOrder → 拿到 settlement → navigation.replace("SettlementResult", { ... })
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  confirmOrder,
  getOrder,
  Order,
} from "../../services/orderService";
import {
  getStoreProductDetail,
  StoreProduct,
} from "../../services/storeProductService";
import { useFormatPrice } from "../../utils/currency";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { TradingNotFoundState } from "../../components/trading/TradingFormShared";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type RouteParams = { ConfirmReceipt: { orderId: number } };

const CHECK_KEYS = ["warning1", "warning2", "warning3"] as const;

export default function ConfirmReceiptScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "ConfirmReceipt">>();
  const { orderId } = route.params;
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();

  const [order, setOrder] = useState<Order | null>(null);
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const o = await getOrder(orderId);
      setOrder(o);
      if (o.productId) {
        try {
          const p = await getStoreProductDetail(o.productId);
          setProduct(p);
        } catch {
          setProduct(null);
        }
      }
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const allChecked = CHECK_KEYS.every((k) => checked[k]);

  const submit = async () => {
    if (!order) return;
    if (order.status === "completed" || order.status === "settled") {
      Alert.alert(
        t("common.notice"),
        t("trading.confirmReceipt.alreadyDone"),
      );
      navigation.goBack();
      return;
    }
    setSubmitting(true);
    try {
      const res = await confirmOrder(order.id);
      navigation.replace("SettlementResult", {
        order: res.order,
        settlement: res.settlement,
        product: product
          ? {
              id: product.id,
              title: product.title,
              brand: product.brand,
              cover: product.images?.[0],
            }
          : null,
      });
    } catch (e: any) {
      Alert.alert(
        t("common.failed"),
        e?.message ?? t("trading.confirmReceipt.confirmFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 48 }} color={theme.colors.gray300} />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <TradingNotFoundState
        headerTitle={t("trading.confirmReceipt.headerTitle")}
        title={t("trading.orderDetail.notFound")}
        hint={t("trading.notFoundState.orderHint")}
        icon="receipt-outline"
      />
    );
  }

  const currency = order.currency || product?.currency || "CNY";
  const cover = product?.images?.[0];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t("trading.confirmReceipt.headerTitle")}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>{t("trading.confirmReceipt.intro")}</Text>

        <View style={styles.productCard}>
          {cover ? (
            <OptimizedImage
              uri={cover}
              size={ImageSize.THUMBNAIL}
              style={styles.productCover}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.productCover, styles.productCoverPlaceholder]}>
              <Ionicons
                name="image-outline"
                size={24}
                color={theme.colors.gray300}
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            {product?.brand ? (
              <Text style={styles.productBrand} numberOfLines={1}>
                {product.brand}
              </Text>
            ) : null}
            <Text style={styles.productTitle} numberOfLines={2}>
              {product?.title ??
                t("trading.orders.productLabel", { id: order.productId })}
            </Text>
            <Text style={styles.productOrderNo}>#{order.orderNo}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("trading.confirmReceipt.warningTitle")}
          </Text>
          {CHECK_KEYS.map((key) => {
            const isChecked = !!checked[key];
            return (
              <Pressable
                key={key}
                style={styles.checkRow}
                onPress={() =>
                  setChecked((prev) => ({ ...prev, [key]: !isChecked }))
                }
              >
                <View
                  style={[
                    styles.checkBox,
                    isChecked && styles.checkBoxChecked,
                  ]}
                >
                  {isChecked ? (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={theme.colors.textInverted}
                    />
                  ) : null}
                </View>
                <Text style={styles.checkText}>
                  {t(`trading.confirmReceipt.${key}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("trading.confirmReceipt.summaryTitle")}
          </Text>
          <InfoRow
            label={t("trading.confirmReceipt.buyerPaid")}
            value={formatPrice(order.paidPriceCents, currency)}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => navigation.goBack()}
          disabled={submitting}
        >
          <Text style={styles.secondaryBtnText}>
            {t("trading.confirmReceipt.cancel")}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.primaryBtn,
            (!allChecked || submitting) && styles.primaryBtnDisabled,
          ]}
          onPress={submit}
          disabled={!allChecked || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.textInverted} />
          ) : (
            <Text style={styles.primaryBtnText}>
              {t("trading.confirmReceipt.confirmCta")}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, muted && styles.infoLabelMuted]}>
        {label}
      </Text>
      <Text
        style={[
          styles.infoValue,
          bold && styles.infoValueBold,
          muted && styles.infoValueMuted,
        ]}
      >
        {value}
      </Text>
    </View>
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
    intro: {
      fontSize: 13,
      color: t.colors.gray300,
      lineHeight: 20,
      marginBottom: 12,
    },
    productCard: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    productCover: { width: 72, height: 72, borderRadius: 8 },
    productCoverPlaceholder: {
      backgroundColor: t.colors.skeleton,
      alignItems: "center",
      justifyContent: "center",
    },
    productBrand: {
      fontSize: 11,
      color: t.colors.gray300,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    productTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 4,
    },
    productOrderNo: { fontSize: 11, color: t.colors.gray300 },
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
      color: t.colors.text,
      marginBottom: 12,
    },
    checkRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 6,
      gap: 10,
    },
    checkBox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: t.colors.gray200,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    checkBoxChecked: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
    },
    checkText: {
      flex: 1,
      fontSize: 13,
      color: t.colors.text,
      lineHeight: 19,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
    },
    infoLabel: { fontSize: 13, color: t.colors.text, flex: 1 },
    infoValue: { fontSize: 13, color: t.colors.text },
    empty: { textAlign: "center", marginTop: 48, color: t.colors.gray300 },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 24,
      backgroundColor: t.colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      flexDirection: "row",
      gap: 12,
    },
    primaryBtn: {
      flex: 1,
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
    secondaryBtn: {
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryBtnText: {
      color: t.colors.text,
      fontSize: 14,
      fontWeight: "500",
    },
  });
