/**
 * QuickEntriesGrid —— 个人主页核心快捷入口（PRD 2026-05 改版）。
 *
 * 把买/卖两侧最高频的 4 个入口提到主页头部，避免用户每次都要进设置或翻到
 * Settings → Shopping / Merchant Center 才能找到：
 *
 *   1. 我的订单     →  Profile (initialTopTab=buying)，订单卡内含「联系卖家」
 *   2. 我的钱包     →  MyWallet（卖家收入 + 提现）
 *   3. 我的在售     →  SellerListings（卖家在售/草稿/审核中）
 *   4. MY ARCHIVE   →  MyArchive（个人交易档案）
 *
 * 视觉与 design.md 一致：
 *   - 单卡承载，与 LevelProgressCard 同款 `profileInsetCard` 样式
 *   - 4pt grid 间距；Ionicons line-style；Playfair Display 字族
 *   - 颜色全部走 theme tokens，自动兼容 light / dark
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { Pressable, Text } from "../../../components/ui";
import {
  playfairFonts,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";
import { useProfileStyles } from "../styles";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface QuickEntry {
  id: "orders" | "wallet" | "selling" | "archive";
  icon: IoniconName;
  label: string;
  onPress: () => void;
}

export const QuickEntriesGrid: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const profileStyles = useProfileStyles();
  const styles = useThemedStyles(makeStyles);

  const entries: QuickEntry[] = [
    {
      id: "orders",
      icon: "receipt-outline",
      label: t("profile.quickEntries.orders"),
      onPress: () =>
        navigation.navigate("Main", {
          screen: "Profile",
          params: { initialTopTab: "buying" },
        }),
    },
    {
      id: "wallet",
      icon: "wallet-outline",
      label: t("profile.quickEntries.wallet"),
      onPress: () => navigation.navigate("MyWallet"),
    },
    {
      id: "selling",
      icon: "pricetag-outline",
      label: t("profile.quickEntries.selling"),
      onPress: () => navigation.navigate("SellerListings"),
    },
    {
      id: "archive",
      icon: "albums-outline",
      label: t("trading.archiveEntry.title"),
      onPress: () => navigation.navigate("MyArchive"),
    },
  ];

  return (
    <View style={[profileStyles.profileInsetCard, styles.card]}>
      {entries.map((entry, index) => (
        <Pressable
          key={entry.id}
          style={styles.cell}
          onPress={entry.onPress}
          accessibilityRole="button"
          accessibilityLabel={entry.label}
        >
          <View style={styles.iconWrap}>
            <Ionicons
              name={entry.icon}
              size={22}
              color={theme.colors.text}
            />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {entry.label}
          </Text>
          {index < entries.length - 1 ? (
            <View style={styles.divider} pointerEvents="none" />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
};
QuickEntriesGrid.displayName = "QuickEntriesGrid";

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      marginTop: t.spacing.sm,
      marginBottom: t.spacing.xs,
      paddingHorizontal: 0,
      paddingVertical: t.spacing.sm,
      flexDirection: "row",
      alignItems: "stretch",
    },
    cell: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: t.spacing.xs,
      gap: 6,
      position: "relative",
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: t.borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surface,
    },
    label: {
      fontFamily: playfairFonts.medium,
      fontSize: 12,
      lineHeight: 16,
      color: t.colors.text,
      letterSpacing: 0.2,
      textAlign: "center",
    },
    divider: {
      position: "absolute",
      right: 0,
      top: "20%",
      bottom: "20%",
      width: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.border,
    },
  });

export default QuickEntriesGrid;
