/**
 * AI Studio 编辑式列表行 (V3 #25.5)。
 *
 * 替代旧的两列 OptionCard 网格, 走杂志列表行布局:
 *   [thumbnail] [index?] [name + name_alt + chips/desc] [arrow]
 *
 * 三种 thumbnail 形状:
 *   - circle: 圆形头像 (Q1 风格步)
 *   - square: 方形封面 (Q2 品牌 / Q3 秀场)
 *   - icon:   纯灰色圆 + Ionicon (Q4 角度, 没有图片)
 *
 * 设计取舍:
 *   - 名字优先按 i18n 选 zh/en, 另一种语言以 small caps 形式紧跟在后,
 *     对应设计稿「先锋 AVANT-GARDE」「极简 MINIMALISM」的双语并列。
 *   - 标签 chips 只在 tags 非空时渲染。chip 样式参照档案页。
 *   - description 与 chips 互斥 (优先 chips), 避免一行塞两种次要信息。
 *   - 整行可点, 右侧描边圆形箭头按钮主要是视觉锚点, 不单独绑事件。
 */

import React from "react";
import { StyleSheet, Text as RNText } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  Box,
  HStack,
  OptimizedImage,
  Pressable,
  Text,
  VStack,
} from "../../../components/ui";
import { ImageSize } from "../../../utils/imageUtils";
import { playfairFonts, theme, useThemedStyles, type AppTheme } from "../../../theme";
import type { OptionCard } from "../../../services/aiPostService";

export type OptionListThumbVariant = "circle" | "square" | "icon";

interface OptionListRowProps {
  data: OptionCard;
  /** 序号 (从 1 开始), 仅在 variant=circle (Q1) 时显示。传 0 不显示。 */
  index?: number;
  variant?: OptionListThumbVariant;
  /** variant=icon 时使用的 Ionicon 名 */
  iconName?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** 是否在底部画一条 hairline (列表内部行之间) */
  showDivider?: boolean;
}

const PLACEHOLDER_BG = "#F0EDE6";

const OptionListRow: React.FC<OptionListRowProps> = ({
  data,
  index = 0,
  variant = "square",
  iconName = "sparkles-outline",
  onPress,
  showDivider = true,
}) => {
  const { i18n } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const isZh = i18n.language?.startsWith("zh");
  const primaryName = isZh && data.name_zh ? data.name_zh : data.name;
  const altName = isZh && data.name_zh ? data.name : data.name_zh || "";
  const tags = (data.tags || []).filter(Boolean);
  const description = data.description || data.subtitle || "";

  const getThumbStyle = (v: OptionListThumbVariant) => {
    if (v === "circle") return styles.thumbCircle;
    if (v === "icon") return styles.thumbIcon;
    return styles.thumbSquare;
  };

  return (
    <Pressable onPress={onPress}>
      <HStack
        alignItems="center"
        px="$lg"
        py="$md"
        gap="$md"
        borderBottomWidth={showDivider ? 1 : 0}
        borderBottomColor="$gray100"
      >
        {/* Thumbnail */}
        <Box style={getThumbStyle(variant)}>
          {data.cover_url && variant !== "icon" ? (
            <OptimizedImage
              uri={data.cover_url}
              size={ImageSize.THUMBNAIL}
              style={
                variant === "circle"
                  ? styles.thumbImageCircle
                  : styles.thumbImageSquare
              }
              contentFit="cover"
            />
          ) : variant === "icon" ? (
            <Ionicons
              name={iconName}
              size={20}
              color={theme.colors.gray300}
            />
          ) : (
            <RNText
              style={styles.thumbInitial}
              allowFontScaling={false}
              numberOfLines={1}
            >
              {primaryName.slice(0, 1)}
            </RNText>
          )}
        </Box>

        {/* Index column (Q1 only) */}
        {index > 0 ? (
          <Box minWidth={24} alignItems="start">
            <Text style={styles.indexText}>
              {index.toString().padStart(2, "0")}
            </Text>
          </Box>
        ) : null}

        {/* Body */}
        <VStack flex={1} gap="$xs">
          <HStack alignItems="center" gap="$xs" flexWrap="wrap">
            <Text style={styles.primaryName} numberOfLines={1}>
              {primaryName}
            </Text>
            {altName ? (
              <Text style={styles.altName} numberOfLines={1}>
                {altName}
              </Text>
            ) : null}
          </HStack>
          {tags.length > 0 ? (
            <HStack gap="$xs" flexWrap="wrap">
              {tags.slice(0, 4).map((tag) => (
                <Box key={tag} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {tag}
                  </Text>
                </Box>
              ))}
            </HStack>
          ) : description ? (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </VStack>

        {/* Arrow button */}
        <Box style={styles.arrowBtn}>
          <Ionicons
            name="arrow-forward"
            size={14}
            color={theme.colors.black}
          />
        </Box>
      </HStack>
    </Pressable>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    thumbCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: PLACEHOLDER_BG,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    thumbSquare: {
      width: 64,
      height: 80,
      borderRadius: 4,
      backgroundColor: PLACEHOLDER_BG,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    thumbIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.colors.gray100,
      alignItems: "center",
      justifyContent: "center",
    },
    thumbImageCircle: { width: "100%", height: "100%" },
    thumbImageSquare: { width: "100%", height: "100%" },
    thumbInitial: {
      fontSize: 22,
      fontWeight: "500",
      color: t.colors.gray300,
      textAlign: "center",
      fontFamily: playfairFonts.medium,
      lineHeight: 28,
    },
    indexText: {
      fontFamily: playfairFonts.regular,
      fontSize: 11,
      letterSpacing: 1,
      color: t.colors.gray300,
      lineHeight: 16,
    },
    primaryName: {
      fontFamily: playfairFonts.medium,
      fontSize: 15,
      lineHeight: 20,
      color: t.colors.text,
    },
    altName: {
      fontFamily: playfairFonts.regular,
      fontSize: 11,
      letterSpacing: 1.5,
      color: t.colors.gray300,
      textTransform: "uppercase",
    },
    chip: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: t.colors.gray100,
    },
    chipText: {
      fontFamily: playfairFonts.regular,
      fontSize: 11,
      lineHeight: 16,
      color: t.colors.gray400,
    },
    description: {
      fontFamily: playfairFonts.regular,
      fontSize: 12,
      lineHeight: 17,
      color: t.colors.gray300,
    },
    arrowBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
  });

export default OptionListRow;
