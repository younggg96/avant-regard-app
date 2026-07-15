import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../theme";

type BadgeSize = "xs" | "sm" | "md";
type BadgeTone = "error" | "neutral";

interface CountBadgeProps {
  variant?: "count";
  count: number;
  maxCount?: number;
  size?: BadgeSize;
  /** error = 红底（消息未读等）；neutral = text 反色底（Profile 快捷入口等） */
  tone?: BadgeTone;
  /** @deprecated 不再绘制描边，保留仅为兼容旧调用 */
  showBorder?: boolean;
  style?: ViewStyle;
}

interface IconBadgeProps {
  variant: "icon";
  icon: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  color: string;
  /** @deprecated 不再绘制描边，保留仅为兼容旧调用 */
  showBorder?: boolean;
  style?: ViewStyle;
}

export type NotificationBadgeProps = CountBadgeProps | IconBadgeProps;

const SIZE_CONFIG: Record<
  BadgeSize,
  { minWidth: number; height: number; fontSize: number; paddingH: number }
> = {
  xs: { minWidth: 12, height: 12, fontSize: 9, paddingH: 2 },
  sm: { minWidth: 16, height: 16, fontSize: 10, paddingH: 4 },
  md: { minWidth: 20, height: 20, fontSize: 11, paddingH: 5 },
};

export const NotificationBadge: React.FC<NotificationBadgeProps> = (props) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { style } = props;

  if (props.variant === "icon") {
    const { icon, iconSize = 10, color } = props;
    return (
      <View
        style={[
          styles.base,
          styles.iconContainer,
          { backgroundColor: color },
          style,
        ]}
      >
        <Ionicons name={icon} size={iconSize} color={theme.colors.textInverted} />
      </View>
    );
  }

  const { count, maxCount = 99, size = "md", tone = "error" } = props;
  if (count <= 0) return null;

  const config = SIZE_CONFIG[size];
  const displayText = count > maxCount ? `${maxCount}+` : `${count}`;
  const backgroundColor =
    tone === "neutral" ? theme.colors.text : theme.colors.error;
  // error 红底（两种模式都是红色）：数字始终用纯白 #FFFFFF。
  // 注意不能用 theme.colors.white / textInverted —— dark mode 下它们是近黑色，
  // 会让红底上的数字看不清。neutral 底色是主题 text 色，仍用 textInverted 反色。
  const textColor =
    tone === "neutral" ? theme.colors.textInverted : "#FFFFFF";

  return (
    <View
      style={[
        styles.base,
        {
          minWidth: config.minWidth,
          height: config.height,
          borderRadius: config.height / 2,
          paddingHorizontal: config.paddingH,
          backgroundColor,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            fontSize: config.fontSize,
            color: textColor,
          },
        ]}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {displayText}
      </Text>
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    base: {
      position: "absolute",
      top: -4,
      right: -4,
      justifyContent: "center",
      alignItems: "center",
    },
    iconContainer: {
      width: 18,
      height: 18,
      borderRadius: 9,
      top: undefined,
      right: -2,
      bottom: -2,
      borderWidth: 0,
    },
    text: {
      // 角标数字用系统字体（非 Playfair 衬线）：衬线字体在小尺寸下字形度量会把
      // 数字顶高。不设 lineHeight，由容器 flexbox 居中；iOS 上补偿 1px ascender 偏移。
      fontWeight: "600",
      color: t.colors.textInverted,
      textAlign: "center",
      ...(Platform.OS === "android"
        ? { includeFontPadding: false, textAlignVertical: "center" as const }
        : { marginTop: 1 }),
    },
  });
