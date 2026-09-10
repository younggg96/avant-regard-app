/**
 * 首页 Chrome 搜索入口：点进去 Search 页，自身不持有输入态。
 */
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "../../../components/ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../../theme";

const PLACEHOLDER_FONT = Platform.OS === "ios" ? "PingFang SC" : "sans-serif";

interface DiscoverSearchBarProps {
  placeholder: string;
  onPress: () => void;
}

export const DiscoverSearchBar: React.FC<DiscoverSearchBarProps> = ({
  placeholder,
  onPress,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        style={styles.bar}
        accessibilityRole="button"
        accessibilityLabel={placeholder}
      >
        <Ionicons name="search" size={16} color={theme.colors.gray400} />
        <Text style={styles.placeholder} numberOfLines={1}>
          {placeholder}
        </Text>
      </Pressable>
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 8,
    },
    bar: {
      height: 36,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      gap: 8,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.gray50,
    },
    placeholder: {
      flex: 1,
      fontSize: 15,
      fontFamily: PLACEHOLDER_FONT,
      color: t.colors.gray400,
    },
  });

export default DiscoverSearchBar;
