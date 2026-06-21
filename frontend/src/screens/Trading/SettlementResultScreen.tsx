/**
 * SettlementResultScreen —— 买家「确认收货 → 结算完成」回执页。
 *
 * 入口：
 *   - ConfirmReceiptScreen 调 confirmOrder 成功后 replace 过来。
 *
 * 渲染：
 *   - 顶部勾选 hero
 *   - 结算明细：订单号 / 成交金额
 *   - 「单品已加入 MY ARCHIVE」二级卡片
 *   - 行动：去评价 / 查看典藏 / 查看订单 / 完成
 */
import React, { useState } from "react";
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

import type { ConfirmReceiptSettlement, Order } from "../../services/orderService";
import { buildTradeReviewParams } from "../../services/aftersalesService";
import { transferOrderToArchive } from "../../services/archivePlusService";
import { useFormatWalletAmount } from "../../utils/currency";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type RouteParams = {
  SettlementResult: {
    order: Order;
    settlement: ConfirmReceiptSettlement;
    product?: {
      id: number;
      title?: string | null;
      brand?: string | null;
      cover?: string | null;
    } | null;
  };
};

export default function SettlementResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "SettlementResult">>();
  const { order, settlement, product } = route.params;
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const formatPrice = useFormatWalletAmount();

  const currency = settlement.currency || "CNY";
  const [archiveLoading, setArchiveLoading] = useState(false);

  const goReview = () => {
    navigation.replace("TradeReview", buildTradeReviewParams(order));
  };

  const goOrder = () => {
    navigation.replace("OrderDetail", { orderId: order.id });
  };

  const goArchive = async () => {
    if (archiveLoading) return;
    setArchiveLoading(true);
    try {
      await transferOrderToArchive(order.id);
    } catch (e: any) {
      Alert.alert(
        t("common.error"),
        e?.message ?? t("trading.review.archiveFailed"),
      );
    } finally {
      setArchiveLoading(false);
      navigation.navigate("MyArchive");
    }
  };

  const goHome = () => {
    navigation.navigate("Main", { screen: "Profile" });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={{ width: 26 }} />
        <Text style={styles.headerTitle}>
          {t("trading.settlement.successHeader")}
        </Text>
        <Pressable onPress={goHome} hitSlop={8}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Ionicons
              name="checkmark"
              size={42}
              color={theme.colors.textInverted}
            />
          </View>
          <Text style={styles.heroTitle}>
            {t("trading.settlement.successTitle")}
          </Text>
          <Text style={styles.heroSubtitle}>
            {t("trading.settlement.successSubtitle")}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.orderNoRow}>
            <Text style={styles.muted}>
              {t("trading.settlement.orderNoLabel")}
            </Text>
            <Text style={styles.orderNoValue} numberOfLines={1}>
              {settlement.orderNo}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>
            {t("trading.settlement.amountSection")}
          </Text>
          <InfoRow
            label={t("trading.settlement.buyerPaid")}
            value={formatPrice(settlement.grossAmountCents, currency)}
          />
        </View>

        <Pressable
          style={styles.archiveCard}
          onPress={goArchive}
          disabled={archiveLoading}
        >
          {archiveLoading ? (
            <ActivityIndicator
              color={theme.colors.gray300}
              style={{ marginRight: 12 }}
            />
          ) : product?.cover ? (
            <OptimizedImage
              uri={product.cover}
              size={ImageSize.THUMBNAIL}
              style={styles.archiveCover}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.archiveCover, styles.archiveCoverPlaceholder]}>
              <Ionicons
                name="archive-outline"
                size={26}
                color={theme.colors.gray300}
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.archiveTitle}>
              {t("trading.settlement.archiveAddedTitle")}
            </Text>
            <Text style={styles.archiveSubtitle} numberOfLines={2}>
              {product?.title ?? t("trading.settlement.archiveAddedSubtitle")}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.colors.gray300}
          />
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.secondaryBtn} onPress={goOrder}>
          <Text style={styles.secondaryBtnText}>
            {t("trading.settlement.viewOrderCta")}
          </Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={goReview}>
          <Text style={styles.primaryBtnText}>
            {t("trading.settlement.reviewCta")}
          </Text>
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
    },
    headerTitle: { fontSize: 16, fontWeight: "600", color: t.colors.text },
    scroll: { padding: 16, paddingBottom: 120 },
    hero: { alignItems: "center", paddingVertical: 32 },
    heroIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: t.colors.success,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    heroTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: t.colors.text,
      marginBottom: 6,
    },
    heroSubtitle: {
      fontSize: 13,
      color: t.colors.gray300,
      textAlign: "center",
      paddingHorizontal: 24,
      lineHeight: 20,
    },
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
    orderNoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 12,
      marginBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    orderNoValue: {
      fontSize: 12,
      color: t.colors.text,
      fontWeight: "500",
      maxWidth: "65%",
    },
    muted: { fontSize: 13, color: t.colors.gray300 },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
    },
    infoLabel: { fontSize: 13, color: t.colors.text, flex: 1 },
    infoLabelMuted: { color: t.colors.gray300 },
    infoValue: { fontSize: 13, color: t.colors.text },
    infoValueBold: { fontWeight: "700", fontSize: 16 },
    infoValueMuted: { color: t.colors.gray300 },
    archiveCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.cardElevated,
    },
    archiveCover: { width: 56, height: 56, borderRadius: 8 },
    archiveCoverPlaceholder: {
      backgroundColor: t.colors.skeleton,
      alignItems: "center",
      justifyContent: "center",
    },
    archiveTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 2,
    },
    archiveSubtitle: { fontSize: 12, color: t.colors.gray300, lineHeight: 18 },
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
    },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: "center",
    },
    secondaryBtnText: { color: t.colors.text, fontSize: 14, fontWeight: "500" },
  });
