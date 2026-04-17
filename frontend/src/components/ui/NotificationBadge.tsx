import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";

type BadgeSize = "sm" | "md";

interface CountBadgeProps {
  variant?: "count";
  count: number;
  maxCount?: number;
  size?: BadgeSize;
  showBorder?: boolean;
  style?: ViewStyle;
}

interface IconBadgeProps {
  variant: "icon";
  icon: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  color: string;
  showBorder?: boolean;
  style?: ViewStyle;
}

export type NotificationBadgeProps = CountBadgeProps | IconBadgeProps;

const SIZE_CONFIG: Record<BadgeSize, { minWidth: number; height: number; fontSize: number; paddingH: number }> = {
  sm: { minWidth: 16, height: 16, fontSize: 10, paddingH: 4 },
  md: { minWidth: 20, height: 20, fontSize: 11, paddingH: 5 },
};

export const NotificationBadge: React.FC<NotificationBadgeProps> = (props) => {
  const { showBorder = false, style } = props;

  if (props.variant === "icon") {
    const { icon, iconSize = 10, color } = props;
    return (
      <View
        style={[
          styles.base,
          styles.iconContainer,
          { backgroundColor: color },
          showBorder && styles.border,
          style,
        ]}
      >
        <Ionicons name={icon} size={iconSize} color={theme.colors.white} />
      </View>
    );
  }

  const { count, maxCount = 99, size = "md" } = props;
  if (count <= 0) return null;

  const config = SIZE_CONFIG[size];
  const displayText = count > maxCount ? `${maxCount}+` : `${count}`;

  return (
    <View
      style={[
        styles.base,
        {
          minWidth: config.minWidth,
          height: config.height,
          borderRadius: config.height / 2,
          paddingHorizontal: config.paddingH,
          backgroundColor: theme.colors.error,
        },
        showBorder && styles.border,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { fontSize: config.fontSize, lineHeight: config.height - (showBorder ? 4 : 0) },
        ]}
        allowFontScaling={false}
      >
        {displayText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    position: "absolute",
    top: -4,
    right: -4,
    justifyContent: "center",
    alignItems: "center",
  },
  border: {
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  iconContainer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    top: undefined,
    right: -2,
    bottom: -2,
  },
  text: {
    color: theme.colors.white,
    fontWeight: "700",
    textAlign: "center",
    includeFontPadding: false,
  },
});
