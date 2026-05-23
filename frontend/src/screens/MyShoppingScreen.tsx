/**
 * MyShoppingScreen —— 买家「我的购物」总入口。
 *
 * 设计目标:
 *   - 把原本散落在「设置 → 商家中心」中的买家相关入口（订单 / 出价 /
 *     收藏 / 钱包 / 鉴定 / Plus）抽出成一个独立页, 让用户进入「我」
 *     底部 tab 后能一步直达, 而不必先打开设置。
 *   - 顶部 4 张状态卡片来源于 `/api/orders/me/summary`, 直接深链到
 *     MyOrdersScreen 的对应 status tab(借助 initialStatus route param)。
 *   - 余下入口复用 SettingsScreen 上的 menu item 视觉(`Box + Pressable +
 *     Ionicons`), 全程跟 useAppTheme 切深色 / 浅色, 全部文案走 i18n,
 *     避免再造一套样式。
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  Box,
  Text,
  Pressable,
  HStack,
  VStack,
  ScrollView,
} from "../components/ui";
import ScreenHeader from "../components/ScreenHeader";
import {
  theme,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../theme";
import {
  getMyOrdersSummary,
  type OrderStatusSummary,
  type OrderStatus,
} from "../services/orderService";

interface StatusCardConfig {
  id: "pending_payment" | "paid" | "shipped" | "delivered" | "refund";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** 这张卡片对应的 OrderStatus；点击后通过 initialStatus 深链 MyOrders。 */
  status: OrderStatus | "all";
  /** 取自 summary.counts 的角标数。 */
  count: number;
}

interface MenuItem {
  id: string;
  label: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const MyShoppingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const activeTheme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [summary, setSummary] = useState<OrderStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    try {
      const data = await getMyOrdersSummary();
      setSummary(data);
    } catch (err) {
      console.warn("[MyShopping] load summary failed", err);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // 从订单详情 / 支付 / 售后流程返回时刷新一次, 避免「待付款」角标
  // 显示成已经付款过的过期数字。
  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary]),
  );

  const counts = summary?.counts ?? {};

  const statusCards: StatusCardConfig[] = [
    {
      id: "pending_payment",
      label: t("trading.shoppingHub.statusPendingPayment"),
      icon: "wallet-outline",
      status: "pending_payment",
      count: counts.pending_payment ?? 0,
    },
    {
      id: "paid",
      label: t("trading.shoppingHub.statusPaid"),
      icon: "cube-outline",
      status: "paid",
      count: counts.paid ?? 0,
    },
    {
      id: "shipped",
      label: t("trading.shoppingHub.statusShipped"),
      icon: "car-outline",
      status: "shipped",
      count: counts.shipped ?? 0,
    },
    {
      id: "delivered",
      label: t("trading.shoppingHub.statusDelivered"),
      icon: "chatbubble-ellipses-outline",
      status: "delivered",
      count: counts.delivered ?? 0,
    },
  ];

  const goOrders = (status: OrderStatus | "all") => {
    navigation.navigate("MyOrders", {
      initialStatus: status === "all" ? "all" : status,
    });
  };

  const sections: MenuSection[] = [
    {
      title: t("trading.shoppingHub.sectionTransactions"),
      items: [
        {
          id: "myOrders",
          label: t("settings.myOrders"),
          hint: t("trading.shoppingHub.myOrdersHint"),
          icon: "receipt-outline",
          onPress: () => goOrders("all"),
        },
        {
          id: "myOffers",
          label: t("trading.shoppingHub.myOffers"),
          hint: t("trading.shoppingHub.myOffersHint"),
          icon: "swap-horizontal-outline",
          onPress: () => navigation.navigate("MyOffers"),
        },
        {
          id: "marketplace",
          label: t("trading.shoppingHub.marketplace"),
          hint: t("trading.shoppingHub.marketplaceHint"),
          icon: "cart-outline",
          onPress: () => navigation.navigate("Marketplace"),
        },
      ],
    },
    {
      title: t("trading.shoppingHub.sectionAssets"),
      items: [
        {
          id: "myCollections",
          label: t("trading.shoppingHub.myCollections"),
          hint: t("trading.shoppingHub.myCollectionsHint"),
          icon: "bookmark-outline",
          onPress: () => navigation.navigate("MyCollections"),
        },
        {
          id: "myArchive",
          label: t("trading.shoppingHub.myArchive"),
          hint: t("trading.shoppingHub.myArchiveHint"),
          icon: "albums-outline",
          onPress: () => navigation.navigate("MyArchive"),
        },
        {
          id: "myWallet",
          label: t("trading.shoppingHub.myWallet"),
          hint: t("trading.shoppingHub.myWalletHint"),
          icon: "wallet-outline",
          onPress: () => navigation.navigate("MyWallet"),
        },
      ],
    },
    {
      title: t("trading.shoppingHub.sectionServices"),
      items: [
        {
          id: "authentication",
          label: t("trading.shoppingHub.authentication"),
          hint: t("trading.shoppingHub.authenticationHint"),
          icon: "shield-checkmark-outline",
          onPress: () => navigation.navigate("Authentication"),
        },
        {
          id: "plusSubscribe",
          label: t("trading.shoppingHub.plusSubscribe"),
          hint: t("trading.shoppingHub.plusSubscribeHint"),
          icon: "star-outline",
          onPress: () => navigation.navigate("PlusSubscribe"),
        },
      ],
    },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: activeTheme.colors.background }]}
      edges={["top"]}
    >
      <ScreenHeader title={t("trading.shoppingHub.title")} showBack={true} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 订单状态总览 */}
        <Box style={styles.overviewCard}>
          <HStack justifyContent="between" alignItems="center" style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>
              {t("trading.shoppingHub.overviewTitle")}
            </Text>
            <Pressable onPress={() => goOrders("all")}>
              <HStack alignItems="center" space="xs">
                <Text style={styles.overviewLink}>
                  {t("trading.shoppingHub.overviewSeeAll")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={activeTheme.colors.gray400}
                />
              </HStack>
            </Pressable>
          </HStack>

          {loading ? (
            <Box style={styles.overviewLoading}>
              <ActivityIndicator size="small" color={activeTheme.colors.gray400} />
            </Box>
          ) : (
            <HStack style={styles.statusRow}>
              {statusCards.map((card) => (
                <Pressable
                  key={card.id}
                  style={styles.statusCell}
                  onPress={() => goOrders(card.status)}
                >
                  <Box style={styles.statusIconWrap}>
                    <Ionicons
                      name={card.icon}
                      size={22}
                      color={activeTheme.colors.text}
                    />
                    {card.count > 0 ? (
                      <Box style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>
                          {card.count > 99 ? "99+" : card.count}
                        </Text>
                      </Box>
                    ) : null}
                  </Box>
                  <Text style={styles.statusLabel} numberOfLines={1}>
                    {card.label}
                  </Text>
                </Pressable>
              ))}
            </HStack>
          )}
        </Box>

        {/* 分组入口 */}
        {sections.map((section) => (
          <Box key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Box style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <Pressable
                  key={item.id}
                  onPress={item.onPress}
                  style={[
                    styles.menuItem,
                    idx < section.items.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: activeTheme.colors.border,
                    },
                  ]}
                >
                  <HStack alignItems="center" style={styles.menuItemLeft} space="md">
                    <Box style={styles.menuIconWrap}>
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={activeTheme.colors.text}
                      />
                    </Box>
                    <VStack flex={1}>
                      <Text style={styles.menuItemLabel}>{item.label}</Text>
                      {item.hint ? (
                        <Text style={styles.menuItemHint} numberOfLines={1}>
                          {item.hint}
                        </Text>
                      ) : null}
                    </VStack>
                  </HStack>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={activeTheme.colors.gray300}
                  />
                </Pressable>
              ))}
            </Box>
          </Box>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xxl,
    },
    overviewCard: {
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.lg,
      padding: t.spacing.md,
      marginBottom: t.spacing.lg,
    },
    overviewHeader: { marginBottom: t.spacing.md },
    overviewTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: t.colors.text,
    },
    overviewLink: {
      ...theme.typography.caption,
      color: t.colors.gray400,
    },
    overviewLoading: {
      paddingVertical: 24,
      alignItems: "center",
    },
    statusRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    statusCell: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 4,
    },
    statusIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.colors.gray100,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
      position: "relative",
    },
    statusBadge: {
      position: "absolute",
      top: -4,
      right: -6,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: t.colors.error,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: t.colors.card,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: t.colors.white,
      lineHeight: 14,
    },
    statusLabel: {
      fontSize: 12,
      color: t.colors.gray600,
      textAlign: "center",
    },
    section: { marginBottom: t.spacing.lg },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.gray400,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: t.spacing.sm,
      paddingHorizontal: 4,
    },
    sectionCard: {
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.lg,
      overflow: "hidden",
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: t.spacing.md,
    },
    menuItemLeft: { flex: 1 },
    menuIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: t.colors.gray100,
      alignItems: "center",
      justifyContent: "center",
    },
    menuItemLabel: {
      fontSize: 15,
      color: t.colors.text,
      fontWeight: "500",
    },
    menuItemHint: {
      fontSize: 12,
      color: t.colors.gray400,
      marginTop: 2,
    },
  });

export default MyShoppingScreen;
