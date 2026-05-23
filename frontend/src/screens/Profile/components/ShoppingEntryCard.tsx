/**
 * ShoppingEntryCard —— Profile 上的「我的购物 + 卖家中心」入口卡片。
 *
 * 视觉跟 ArchiveEntryCard / LevelProgressCard 对齐 (复用 profileInsetCard
 * 样式 + useAppTheme), 在同一张卡里横向排两个圆角格子, 分别跳到
 * MyShoppingScreen / MySellerCenterScreen。
 *
 * 角标数据来自 `/api/orders/me/summary` + `/api/orders/me/sales/summary`,
 * 与两个新 Hub 页头部使用同一个数据口径, 只是这里只取 total 来当
 * 「待办总数」红点, 不再展开成 4 张状态卡, 让 Profile 主页保持紧凑。
 */
import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { Box, HStack, Text, Pressable, VStack } from "../../../components/ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../../theme";
import { useProfileStyles } from "../styles";
import {
  getMyOrdersSummary,
  getMySalesSummary,
} from "../../../services/orderService";

interface Props {
  isOwnProfile: boolean;
}

interface PendingTotals {
  shopping: number;
  selling: number;
}

/**
 * 把订单状态聚合成「需要买家关注的订单数」。
 *  - 待付款 / 待发货 / 待收货 / 待评价(=delivered) 都算待办；
 *  - completed 已经评价完, 退款 / 售后状态属于售后流程, 不进首页角标。
 */
const buyerPendingFromCounts = (counts: Record<string, number> = {}) =>
  (counts.pending_payment ?? 0) +
  (counts.paid ?? 0) +
  (counts.shipped ?? 0) +
  (counts.delivered ?? 0);

/**
 * 卖家维度的「待办」: paid (待发货) + shipped/delivered (运输中) + completed (待结算)。
 */
const sellerPendingFromCounts = (counts: Record<string, number> = {}) =>
  (counts.paid ?? 0) +
  (counts.shipped ?? 0) +
  (counts.delivered ?? 0) +
  (counts.completed ?? 0);

export const ShoppingEntryCard: React.FC<Props> = ({ isOwnProfile }) => {
  const theme = useAppTheme();
  const profileStyles = useProfileStyles();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingTotals>({ shopping: 0, selling: 0 });

  useEffect(() => {
    if (!isOwnProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const [buyer, seller] = await Promise.all([
          getMyOrdersSummary().catch(() => null),
          getMySalesSummary().catch(() => null),
        ]);
        if (cancelled) return;
        setPending({
          shopping: buyer ? buyerPendingFromCounts(buyer.counts as Record<string, number>) : 0,
          selling: seller ? sellerPendingFromCounts(seller.counts as Record<string, number>) : 0,
        });
      } catch (e) {
        console.warn("[ShoppingEntryCard] load failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile]);

  if (!isOwnProfile) return null;

  return (
    <Box style={[profileStyles.profileInsetCard, styles.card]}>
      <HStack space="sm">
        <Pressable
          style={styles.tile}
          onPress={() => navigation.navigate("MyShopping")}
        >
          <HStack alignItems="center" space="xs">
            <Ionicons
              name="bag-handle-outline"
              size={16}
              color={theme.colors.text}
            />
            <VStack flex={1}>
              <HStack alignItems="center" space="xs">
                <Text style={styles.tileTitle}>
                  {t("trading.shoppingHub.entryTitle")}
                </Text>
                {pending.shopping > 0 ? (
                  <Box style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {pending.shopping > 99 ? "99+" : pending.shopping}
                    </Text>
                  </Box>
                ) : null}
              </HStack>
              <Text style={styles.tileHint} numberOfLines={1}>
                {t("trading.shoppingHub.entryHint")}
              </Text>
            </VStack>
            <Ionicons
              name="chevron-forward"
              size={12}
              color={theme.colors.gray300}
            />
          </HStack>
        </Pressable>

        <Pressable
          style={styles.tile}
          onPress={() => navigation.navigate("MySellerCenter")}
        >
          <HStack alignItems="center" space="xs">
            <Ionicons
              name="storefront-outline"
              size={16}
              color={theme.colors.text}
            />
            <VStack flex={1}>
              <HStack alignItems="center" space="xs">
                <Text style={styles.tileTitle}>
                  {t("trading.sellerCenter.entryTitle")}
                </Text>
                {pending.selling > 0 ? (
                  <Box style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {pending.selling > 99 ? "99+" : pending.selling}
                    </Text>
                  </Box>
                ) : null}
              </HStack>
              <Text style={styles.tileHint} numberOfLines={1}>
                {t("trading.sellerCenter.entryHint")}
              </Text>
            </VStack>
            <Ionicons
              name="chevron-forward"
              size={12}
              color={theme.colors.gray300}
            />
          </HStack>
        </Pressable>
      </HStack>
    </Box>
  );
};
ShoppingEntryCard.displayName = "ShoppingEntryCard";

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      marginTop: t.spacing.xs,
      marginBottom: t.spacing.xs,
    },
    tile: {
      flex: 1,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: t.colors.cardElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    tileTitle: {
      fontSize: 11,
      fontWeight: "600",
      color: t.colors.text,
      letterSpacing: 0.3,
    },
    tileHint: {
      fontSize: 10,
      color: t.colors.gray400,
      marginTop: 2,
    },
    countBadge: {
      minWidth: 14,
      height: 14,
      paddingHorizontal: 4,
      borderRadius: 7,
      backgroundColor: t.colors.error,
      alignItems: "center",
      justifyContent: "center",
    },
    countBadgeText: {
      fontSize: 9,
      fontWeight: "700",
      color: t.colors.white,
      lineHeight: 12,
      textAlign: "center",
    },
  });

export default ShoppingEntryCard;
