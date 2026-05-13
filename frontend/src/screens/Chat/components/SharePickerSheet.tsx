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
  | "user";

interface CategoryConfig {
  key: ShareCategory;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const CATEGORIES: CategoryConfig[] = [
  { key: "post",  labelKey: "chat.postLabel",  icon: "document-text-outline" },
  { key: "store", labelKey: "chat.storeLabel", icon: "storefront-outline" },
  { key: "brand", labelKey: "chat.brandLabel", icon: "pricetag-outline" },
  { key: "show",  labelKey: "chat.showLabel",  icon: "sparkles-outline" },
  { key: "user",  labelKey: "chat.userLabel",  icon: "person-outline" },
];

interface SharePickerSheetProps {
  visible: boolean;
  onSelect: (category: ShareCategory) => void;
}

export const SharePickerSheet: React.FC<SharePickerSheetProps> = ({
  visible,
  onSelect,
}) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {CATEGORIES.map((cat) => (
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
