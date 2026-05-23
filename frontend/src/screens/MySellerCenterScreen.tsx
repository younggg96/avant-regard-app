/**
 * MySellerCenterScreen —— 卖家「卖家中心」总入口。
 *
 * 与 MyShoppingScreen 对偶: 把「设置 → 商家中心」里所有面向卖家的入口
 * (店铺 / 在售 / 销售 / 鉴定) 集中在一个独立页, 让卖家不必再走设置。
 *
 * 顶部 4 张状态卡片用 `/api/orders/me/sales/summary` 驱动: 数据已合并
 * 个人卖家身份 + 关联买手店身份, 与 MySalesScreen 列表口径完全一致。
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
  getMySalesSummary,
  type OrderStatusSummary,
  type OrderStatus,
} from "../services/orderService";

interface StatusCardConfig {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: OrderStatus | "all";
  count: number;
}

interface MenuItem {
  id: string;
  label: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  rightText?: string;
  rightColor?: string;
  onPress: () => void;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const MySellerCenterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const activeTheme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [summary, setSummary] = useState<OrderStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    try {
      const data = await getMySalesSummary();
      setSummary(data);
    } catch (err) {
      console.warn("[MySellerCenter] load summary failed", err);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary]),
  );

  const counts = summary?.counts ?? {};

  const goSales = (status: OrderStatus | "all") => {
    navigation.navigate("MySales", {
      initialStatus: status === "all" ? "all" : status,
    });
  };

  // 把卖家最关心的「待发货 / 运送中(shipped+delivered) / 待结算 / 已结算」
  // 4 个状态做成顶部卡片;「运送中」需要把 shipped + delivered 两态求和,
  // 因为对卖家而言这两个都属于「东西已发出, 在等买家点确认」。
  const inTransitCount = (counts.shipped ?? 0) + (counts.delivered ?? 0);
  const statusCards: StatusCardConfig[] = [
    {
      id: "toShip",
      label: t("trading.sellerCenter.statusToShip"),
      icon: "cube-outline",
      status: "paid",
      count: counts.paid ?? 0,
    },
    {
      id: "inTransit",
      label: t("trading.sellerCenter.statusInTransit"),
      icon: "car-outline",
      status: "shipped",
      count: inTransitCount,
    },
    {
      id: "toSettle",
      label: t("trading.sellerCenter.statusToSettle"),
      icon: "hourglass-outline",
      status: "completed",
      count: counts.completed ?? 0,
    },
    {
      id: "settled",
      label: t("trading.sellerCenter.statusSettled"),
      icon: "checkmark-done-outline",
      status: "settled",
      count: counts.settled ?? 0,
    },
  ];

  const sections: MenuSection[] = [
    {
      title: t("trading.sellerCenter.sectionStore"),
      items: [
        {
          id: "myStores",
          label: t("trading.sellerCenter.myStores"),
          hint: t("trading.sellerCenter.myStoresHint"),
          icon: "storefront-outline",
          rightText: t("settings.merchantEntry"),
          rightColor: "#F57C00",
          onPress: () => navigation.navigate("MyMerchantStores"),
        },
        {
          id: "sellerListings",
          label: t("trading.sellerCenter.myListings"),
          hint: t("trading.sellerCenter.myListingsHint"),
          icon: "pricetag-outline",
          onPress: () => navigation.navigate("SellerListings"),
        },
        {
          id: "publishListing",
          label: t("trading.sellerCenter.publishListing"),
          hint: t("trading.sellerCenter.publishListingHint"),
          icon: "add-circle-outline",
          onPress: () => navigation.navigate("PublishListingStep1"),
        },
      ],
    },
    {
      title: t("trading.sellerCenter.sectionSales"),
      items: [
        {
          id: "mySales",
          label: t("settings.mySales"),
          hint: t("trading.sellerCenter.mySalesHint"),
          icon: "cash-outline",
          onPress: () => goSales("all"),
        },
        {
          id: "incomingOffers",
          label: t("trading.sellerCenter.incomingOffers"),
          hint: t("trading.sellerCenter.incomingOffersHint"),
          icon: "swap-horizontal-outline",
          onPress: () =>
            // MyOffers 在已实现的列表里通过 tab 切「我的出价 / 收到的出价」,
            // 这里默认进入页面后让它自己根据「卖家收件箱」选中默认 tab,
            // 不传 param 也不影响。
            navigation.navigate("MyOffers", { initialRole: "incoming" }),
        },
      ],
    },
    {
      title: t("trading.sellerCenter.sectionAssets"),
      items: [
        {
          id: "myWallet",
          label: t("trading.sellerCenter.myWallet"),
          hint: t("trading.sellerCenter.myWalletHint"),
          icon: "wallet-outline",
          onPress: () => navigation.navigate("MyWallet"),
        },
        {
          id: "authentication",
          label: t("trading.sellerCenter.authentication"),
          hint: t("trading.sellerCenter.authenticationHint"),
          icon: "shield-checkmark-outline",
          onPress: () => navigation.navigate("Authentication"),
        },
      ],
    },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: activeTheme.colors.background }]}
      edges={["top"]}
    >
      <ScreenHeader title={t("trading.sellerCenter.title")} showBack={true} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Box style={styles.overviewCard}>
          <HStack justifyContent="between" alignItems="center" style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>
              {t("trading.sellerCenter.overviewTitle")}
            </Text>
            <Pressable onPress={() => goSales("all")}>
              <HStack alignItems="center" space="xs">
                <Text style={styles.overviewLink}>
                  {t("trading.sellerCenter.overviewSeeAll")}
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
                  onPress={() => goSales(card.status)}
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
                  <HStack alignItems="center" space="xs">
                    {item.rightText ? (
                      <Text
                        style={{
                          ...theme.typography.caption,
                          fontWeight: "500",
                          color: item.rightColor ?? activeTheme.colors.gray400,
                        }}
                      >
                        {item.rightText}
                      </Text>
                    ) : null}
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={activeTheme.colors.gray300}
                    />
                  </HStack>
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
    overviewLoading: { paddingVertical: 24, alignItems: "center" },
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

export default MySellerCenterScreen;
