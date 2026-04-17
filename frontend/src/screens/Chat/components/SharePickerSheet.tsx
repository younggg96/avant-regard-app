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
  color: string;
}

const CATEGORIES: CategoryConfig[] = [
  { key: "post", label: "帖子", icon: "document-text-outline", color: "#FF6B6B" },
  { key: "store", label: "买手店", icon: "storefront-outline", color: "#4ECDC4" },
  { key: "brand", label: "品牌", icon: "pricetag-outline", color: "#FFA94D" },
  { key: "show", label: "秀场", icon: "sparkles-outline", color: "#845EF7" },
  { key: "user", label: "用户", icon: "person-outline", color: "#339AF0" },
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
            activeOpacity={0.7}
          >
            <View style={[styles.iconBubble, { backgroundColor: cat.color }]}>
              <Ionicons name={cat.icon} size={24} color={theme.colors.white} />
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
    gap: 6,
    flex: 1,
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
});

export default SharePickerSheet;
