import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";

export type ShareCategory =
  | "post"
  | "store"
  | "brand"
  | "show"
  | "user";

interface CategoryConfig {
  key: ShareCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/*
 * Categories share the same monochrome treatment – consistent with the app's
 * minimalist black/white editorial language (see theme/index.ts).
 */
const CATEGORIES: CategoryConfig[] = [
  { key: "post",  label: "帖子",   icon: "document-text-outline" },
  { key: "store", label: "买手店", icon: "storefront-outline" },
  { key: "brand", label: "品牌",   icon: "pricetag-outline" },
  { key: "show",  label: "秀场",   icon: "sparkles-outline" },
  { key: "user",  label: "用户",   icon: "person-outline" },
];

interface SharePickerSheetProps {
  visible: boolean;
  onSelect: (category: ShareCategory) => void;
}

export const SharePickerSheet: React.FC<SharePickerSheetProps> = ({
  visible,
  onSelect,
}) => {
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
            <Text style={styles.label}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.gray100,
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
    borderRadius: theme.borderRadius.md, // 8 px – matches app card / button radius
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.gray50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.gray100,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
});

export default SharePickerSheet;
