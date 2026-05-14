/**
 * AI Studio 编辑式头部 (V3 #25.5)。
 *
 * 取代 ScreenHeader, 走杂志页眉风格:
 *   - 左上 "AI STUDIO ✦" 品牌标记 + 小返回箭头 (合并入品牌行, 不抢视觉)
 *   - 右上 "1/4" 椭圆胶囊作为页码指示, 替代旧版底部进度条
 *   - 右上配额徽章 (复用既有 QuotaBadge)
 *
 * 设计取舍:
 *   - 不再做对称三段 (back / title / right) 布局, 因为标题搬到了 Hero 里。
 *   - 返回按钮和 brand 同行, 用 hairline 分隔, 视觉权重弱于品牌标。
 *   - 全部黑白 + Playfair, 与档案/秀场页保持一致。
 */

import React from "react";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Box, HStack, Pressable, Text } from "../../../components/ui";
import { playfairFonts, theme, useThemedStyles, type AppTheme, useAppTheme } from "../../../theme";

interface EditorialHeaderProps {
  current: number;
  total: number;
  onBack?: () => void;
  rightComponent?: React.ReactNode;
}

const EditorialHeader: React.FC<EditorialHeaderProps> = ({
  current,
  total,
  onBack,
  rightComponent,
}) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  return (
    <HStack
      alignItems="center"
      justifyContent="between"
      px="$lg"
      py="$md"
      style={{ backgroundColor: theme.colors.white }}
    >
      <HStack alignItems="center" gap="$sm">
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={theme.colors.black}
            />
          </Pressable>
        ) : null}
        <Text style={styles.brandText}>{t("aiPost.studio.brand")}</Text>
        <Ionicons
          name="sparkles-outline"
          size={12}
          color={theme.colors.gray300}
        />
      </HStack>

      <HStack alignItems="center" gap="$sm">
        {rightComponent}
        <Box style={styles.pagePill}>
          <Text style={styles.pageText}>
            {t("aiPost.studio.pageIndicator", { current, total })}
          </Text>
        </Box>
      </HStack>
    </HStack>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    brandText: {
      fontFamily: playfairFonts.medium,
      fontSize: 11,
      letterSpacing: 2,
      color: t.colors.text,
    },
    pagePill: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.colors.border,
      minWidth: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    pageText: {
      fontFamily: playfairFonts.regular,
      fontSize: 11,
      letterSpacing: 1,
      color: t.colors.gray400,
    },
  });

export default EditorialHeader;
