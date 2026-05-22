/**
 * TradingActionBar —— 单品详情页的交易动作条（PDF p.4-6 设计要点）。
 *
 * 设计要求：
 *   - 「加入购物车」原稿是错的，实际为「发送 Offer」。这里以 Offer 为主 CTA，
 *     立即购买为次要选项。
 *   - 卖家自己看自己单品：显示「编辑 / 下架」，不显示交易按钮。
 *   - 状态机：active 可成交；frozen / sold / draft 全禁用并解释原因。
 *
 * 视觉系统：全部走 useAppTheme()，与 PublishListing / SettingsScreen 一致：
 *   - 圆形 chip 用 borderRadius 22 + accent 背景
 *   - 顶部 hairline 边线用 t.colors.border
 */
import React from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, HStack, Pressable, Text, VStack } from "./ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";
import {
  StoreProduct,
  formatPrice,
  calculateExpectedPayout,
} from "../services/storeProductService";

interface Props {
  product: StoreProduct;
  isOwner: boolean;
  isBusy?: boolean;
  onOffer: () => void;
  onBuyNow: () => void;
  onEdit: () => void;
  onTakeOffline: () => void;
}

const TradingActionBar: React.FC<Props> = ({
  product,
  isOwner,
  isBusy,
  onOffer,
  onBuyNow,
  onEdit,
  onTakeOffline,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const status = (product.status || "").toLowerCase();
  const isActive = status === "active";
  const isFrozen = status === "frozen";
  const isSold = status === "sold";

  // ---------------------- 卖家自己 ----------------------
  if (isOwner) {
    return (
      <HStack style={styles.bar} space="sm" alignItems="center">
        <VStack flex={1} style={styles.priceCol}>
          <Text style={styles.priceBig}>{formatPrice(product.priceCents)}</Text>
          <Text style={styles.priceMeta}>
            {t("trading.actionBar.expectedPayout", {
              price: formatPrice(calculateExpectedPayout(product.priceCents)),
            })}
          </Text>
        </VStack>
        <Pressable style={styles.ghostBtn} onPress={onEdit}>
          <Text style={styles.ghostBtnText}>
            {t("trading.actionBar.edit")}
          </Text>
        </Pressable>
        {isActive ? (
          <Pressable
            style={[styles.darkBtn, isBusy && styles.btnBusy]}
            onPress={onTakeOffline}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color={theme.colors.textInverted} />
            ) : (
              <Text style={styles.darkBtnText}>
                {t("trading.actionBar.takeOffline")}
              </Text>
            )}
          </Pressable>
        ) : null}
      </HStack>
    );
  }

  // ---------------------- 已售 / 冻结 / 草稿 ----------------------
  if (!isActive) {
    return (
      <HStack style={styles.bar} space="sm" alignItems="center">
        <VStack flex={1} style={styles.priceCol}>
          <Text style={styles.priceBig}>{formatPrice(product.priceCents)}</Text>
          <Text style={styles.priceMeta}>
            {isSold
              ? t("trading.actionBar.soldHint")
              : isFrozen
              ? t("trading.actionBar.frozenHint")
              : t("trading.actionBar.notForSaleHint")}
          </Text>
        </VStack>
        <Box style={[styles.darkBtn, styles.disabledBtn]}>
          <Text style={styles.darkBtnText}>
            {isSold
              ? t("trading.actionBar.sold")
              : isFrozen
              ? t("trading.actionBar.frozen")
              : t("trading.actionBar.notListed")}
          </Text>
        </Box>
      </HStack>
    );
  }

  // ---------------------- active：Offer-first ----------------------
  const acceptOffer = product.acceptOffer !== false;

  return (
    <HStack style={styles.bar} space="sm" alignItems="center">
      <VStack flex={1} style={styles.priceCol}>
        <Text style={styles.priceBig}>{formatPrice(product.priceCents)}</Text>
        <Text style={styles.priceMeta} numberOfLines={1}>
          {acceptOffer
            ? t("trading.actionBar.canOffer")
            : t("trading.actionBar.fixedPrice")}
        </Text>
      </VStack>

      <Pressable style={styles.ghostBtn} onPress={onBuyNow} disabled={isBusy}>
        <HStack space="xs" alignItems="center">
          <Ionicons
            name="bag-handle-outline"
            size={16}
            color={theme.colors.text}
          />
          <Text style={styles.ghostBtnText}>
            {t("trading.actionBar.buyNow")}
          </Text>
        </HStack>
      </Pressable>

      {acceptOffer ? (
        <Pressable
          style={[styles.darkBtn, isBusy && styles.btnBusy]}
          onPress={onOffer}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color={theme.colors.textInverted} />
          ) : (
            <HStack space="xs" alignItems="center">
              <Ionicons
                name="swap-horizontal"
                size={18}
                color={theme.colors.textInverted}
              />
              <Text style={styles.darkBtnText}>
                {t("trading.actionBar.sendOffer")}
              </Text>
            </HStack>
          )}
        </Pressable>
      ) : null}
    </HStack>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    bar: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: t.colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    priceCol: { minWidth: 0 },
    priceBig: { fontSize: 20, fontWeight: "700", color: t.colors.text },
    priceMeta: { fontSize: 11, color: t.colors.gray300, marginTop: 2 },
    ghostBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.text,
      backgroundColor: t.colors.card,
    },
    ghostBtnText: { color: t.colors.text, fontWeight: "600", fontSize: 14 },
    darkBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 4,
      backgroundColor: t.colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    darkBtnText: {
      color: t.colors.textInverted,
      fontWeight: "700",
      fontSize: 14,
    },
    btnBusy: { opacity: 0.5 },
    disabledBtn: { backgroundColor: t.colors.gray200 },
  });

export default TradingActionBar;
