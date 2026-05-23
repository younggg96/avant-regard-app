import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../../../theme";

export type ShareCategory =
  | "post"
  | "store"
  | "brand"
  | "show"
  | "user"
  | "aftersales";

interface CategoryConfig {
  key: ShareCategory;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** 仅在与客服会话时显示 (other party `is_admin`)。 */
  csOnly?: boolean;
}

const CATEGORIES: CategoryConfig[] = [
  { key: "post",  labelKey: "chat.postLabel",  icon: "document-text-outline" },
  { key: "store", labelKey: "chat.storeLabel", icon: "storefront-outline" },
  { key: "brand", labelKey: "chat.brandLabel", icon: "pricetag-outline" },
  { key: "show",  labelKey: "chat.showLabel",  icon: "sparkles-outline" },
  { key: "user",  labelKey: "chat.userLabel",  icon: "person-outline" },
  // 售后入口：只在和客服对话时出现。点击 → 打开订单选择器 → 把订单卡片发给客服。
  { key: "aftersales", labelKey: "chat.aftersalesLabel", icon: "help-buoy-outline", csOnly: true },
];

interface SharePickerSheetProps {
  visible: boolean;
  /** 对方是否为官方客服（admin）。决定是否展示「售后」入口。 */
  otherIsAdmin?: boolean;
  onSelect: (category: ShareCategory) => void;
}

export const SharePickerSheet: React.FC<SharePickerSheetProps> = ({
  visible,
  otherIsAdmin = false,
  onSelect,
}) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  if (!visible) return null;

  const items = CATEGORIES.filter((c) => !c.csOnly || otherIsAdmin);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {items.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={styles.button}
            onPress={() => onSelect(cat.key)}
            activeOpacity={0.6}
          >
            <View style={styles.iconBubble}>
              <Ionicons name={cat.icon} size={22} color={theme.colors.black} />
            </View>
            <Text style={styles.label}>{t(cat.labelKey)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: {
    paddingHorizontal: t.spacing.md,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.sm,
    backgroundColor: t.colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
  },
  button: {
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: t.borderRadius.md, // 8 px – matches app card / button radius
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.gray50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  label: {
    ...t.typography.caption,
    color: t.colors.gray300,
  },
});

export default SharePickerSheet;
