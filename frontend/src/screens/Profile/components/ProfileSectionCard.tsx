/**
 * ProfileSectionCard —— 个人主页紧凑卡片容器（图二样式）。
 *
 * 标题在卡片内顶部；支持 embedded 模式用于双列并排。
 */
import React, { type ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Box, HStack, Pressable, Text } from "../../../components/ui";
import {
  playfairFonts,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export interface ProfileSectionCardProps {
  /** 卡片内顶部标题（图二：等级进度 / 任务中心） */
  cardTitle?: string;
  cardTitleCount?: number;
  headerTrailing?: ReactNode;
  headerIcon?: IoniconName;
  headerTitle?: string;
  headerBadge?: number;
  showChevron?: boolean;
  onPress?: () => void;
  children?: ReactNode;
  style?: ViewStyle;
  cardStyle?: ViewStyle;
  /** 双列布局时去掉左右外边距 */
  embedded?: boolean;
  /** 并排时列宽权重，默认 1 */
  embeddedFlex?: number;
}

export const ProfileSectionCard: React.FC<ProfileSectionCardProps> = ({
  cardTitle,
  cardTitleCount,
  headerTrailing,
  headerIcon,
  headerTitle,
  headerBadge,
  showChevron = false,
  onPress,
  children,
  style,
  cardStyle,
  embedded = false,
  embeddedFlex = 1,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const hasLegacyHeader = !!(headerIcon || headerTitle);
  const hasCardTitle = !!cardTitle;

  const cardBody = (
    <Box
      style={[
        styles.card,
        embedded && styles.cardEmbedded,
        cardStyle,
      ]}
    >
      {hasCardTitle ? (
        <HStack
          justifyContent="between"
          alignItems="center"
          style={[styles.cardTitleRow, embedded && styles.cardTitleRowEmbedded]}
        >
          <Text
            style={[styles.cardTitle, embedded && styles.cardTitleEmbedded]}
            numberOfLines={embedded ? 2 : 1}
          >
            {cardTitle}
          </Text>
          <HStack alignItems="center" space="xs" style={styles.cardTitleTrailing}>
            {cardTitleCount != null ? (
              <Text
                style={[
                  styles.cardTitleCount,
                  embedded && styles.cardTitleCountEmbedded,
                ]}
              >
                {cardTitleCount}
              </Text>
            ) : null}
            {headerTrailing ??
              (showChevron ? (
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={theme.colors.gray300}
                />
              ) : null)}
          </HStack>
        </HStack>
      ) : null}

      {hasLegacyHeader ? (
        <HStack
          justifyContent="between"
          alignItems="center"
          style={hasCardTitle ? styles.legacyHeaderAfterTitle : undefined}
        >
          <HStack space="xs" alignItems="center" flex={1}>
            {headerIcon ? (
              <Ionicons
                name={headerIcon}
                size={14}
                color={theme.colors.text}
              />
            ) : null}
            {headerTitle ? (
              <Text style={styles.headerTitle} numberOfLines={1}>
                {headerTitle}
              </Text>
            ) : null}
            {headerBadge != null && headerBadge > 0 ? (
              <Box style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{headerBadge}</Text>
              </Box>
            ) : null}
          </HStack>
          {showChevron ? (
            <Ionicons
              name="chevron-forward"
              size={14}
              color={theme.colors.gray300}
            />
          ) : null}
        </HStack>
      ) : null}

      {children ? (
        <View
          style={[
            styles.body,
            (hasCardTitle || hasLegacyHeader) && children
              ? [styles.bodyWithHeader, embedded && styles.bodyWithHeaderEmbedded]
              : null,
          ]}
        >
          {children}
        </View>
      ) : null}
    </Box>
  );

  return (
    <View
      style={[
        styles.section,
        embedded && styles.sectionEmbedded,
        embedded && embeddedFlex !== 1 && { flex: embeddedFlex },
        style,
      ]}
    >
      {onPress ? (
        <Pressable onPress={onPress}>{cardBody}</Pressable>
      ) : (
        cardBody
      )}
    </View>
  );
};
ProfileSectionCard.displayName = "ProfileSectionCard";

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    section: {
      paddingTop: t.spacing.xs,
      paddingBottom: t.spacing.xs,
    },
    sectionEmbedded: {
      paddingTop: 0,
      paddingBottom: 0,
      flex: 1,
      minWidth: 0,
      alignSelf: "stretch",
    },
    card: {
      marginHorizontal: t.spacing.md,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
      borderRadius: t.borderRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    cardEmbedded: {
      marginHorizontal: 0,
      flex: 1,
      alignSelf: "stretch",
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.sm,
    },
    cardTitleRow: {
      marginBottom: t.spacing.sm,
    },
    cardTitleRowEmbedded: {
      marginBottom: t.spacing.sm,
    },
    cardTitle: {
      ...t.typography.bodySmall,
      fontFamily: playfairFonts.medium,
      color: t.colors.text,
      textAlign: "left",
      flex: 1,
      paddingRight: t.spacing.xs,
    },
    cardTitleEmbedded: {
      ...t.typography.caption,
    },
    cardTitleTrailing: {
      flexShrink: 0,
    },
    cardTitleCount: {
      ...t.typography.bodySmall,
      fontFamily: playfairFonts.medium,
      color: t.colors.gray300,
      lineHeight: 16,
    },
    cardTitleCountEmbedded: {
      ...t.typography.caption,
      lineHeight: 16,
    },
    legacyHeaderAfterTitle: {
      marginTop: t.spacing.xs,
    },
    headerTitle: {
      ...t.typography.caption,
      fontFamily: playfairFonts.medium,
      color: t.colors.text,
      letterSpacing: 0.3,
    },
    headerBadge: {
      minWidth: 16,
      height: 16,
      paddingHorizontal: t.spacing.xs,
      borderRadius: t.borderRadius.full,
      backgroundColor: t.colors.text,
      alignItems: "center",
      justifyContent: "center",
    },
    headerBadgeText: {
      ...t.typography.caption,
      fontFamily: playfairFonts.bold,
      fontSize: 10,
      lineHeight: 12,
      color: t.colors.textInverted,
    },
    body: {},
    bodyWithHeader: {
      marginTop: t.spacing.xs,
    },
    bodyWithHeaderEmbedded: {
      marginTop: 0,
      alignSelf: "stretch",
    },
  });

export default ProfileSectionCard;
