/**
 * 特色 Banner。数据源是商家在商家管理页发布的 `StoreBanner`，由
 * `useBuyerTabData` 经 `buildFeatureBanner` 适配成本组件消费的
 * `BuyerStoreFeatureBanner` shape。
 *
 * 字段只保证 `image`；`title` / `subtitle` / `cta` 都条件渲染——商家如果
 * 只上了一张图，左侧文案区就整体收起，避免显示一排空串。"查看详情"是
 * 默认 CTA（没配 linkUrl 也保留，让用户知道可以点）。
 */
import React from "react";
import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Pressable, Text, VStack } from "../../../../components/ui";
import { OptimizedImage } from "../../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../../../theme";
import { BuyerStoreFeatureBanner } from "./types";
import { PLAYFAIR } from "./playfair";

interface NewArrivalBannerProps {
  banner: BuyerStoreFeatureBanner;
  onPress: () => void;
}

const NewArrivalBannerImpl: React.FC<NewArrivalBannerProps> = ({
  banner,
  onPress,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const hasText = !!(banner.title || banner.subtitle || banner.cta);

  return (
    <Box mx="$md" mb="$lg" mt="$xs">
      <Pressable onPress={onPress} style={styles.container}>
        <HStack flex={1} alignItems="center">
          {hasText && (
            <VStack flex={1} pl={18} pr={10} py={14} justifyContent="center">
              {banner.subtitle && (
                <Text style={styles.subtitle}>{banner.subtitle}</Text>
              )}
              {banner.title && (
                <Text style={styles.title} numberOfLines={2}>
                  {banner.title}
                </Text>
              )}
              <HStack alignItems="center" mt={10} gap={6}>
                <Text style={styles.cta}>{banner.cta || t("discover.buyerViewDetails")}</Text>
                <Ionicons
                  name="arrow-forward"
                  size={13}
                  color={theme.colors.text}
                />
              </HStack>
            </VStack>
          )}
          <Box style={[styles.imageWrapper, !hasText && styles.imageFull]}>
            <OptimizedImage
              uri={banner.image}
              size={ImageSize.MEDIUM}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              lazy
            />
          </Box>
        </HStack>
      </Pressable>
    </Box>
  );
};

export const NewArrivalBanner = React.memo(NewArrivalBannerImpl);

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: {
    // The designer-cream "#F2F2F0" reads as a soft tinted surface; swap to
    // the theme's gray50 token so it auto-inverts to a soft dark surface
    // (#121212) under dark mode rather than staying cream-on-black.
    backgroundColor: t.colors.gray50,
    borderRadius: 8,
    overflow: "hidden",
    flexDirection: "row",
  },
  subtitle: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    color: t.colors.gray400,
  },
  title: {
    fontFamily: PLAYFAIR.bold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: t.colors.text,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  cta: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 12,
    fontWeight: "600",
    color: t.colors.text,
    letterSpacing: 0.2,
  },
  // 固定宽高，避免竖图把整卡撑得很高、左侧文字区留大片空底。
  imageWrapper: {
    width: 118,
    height: 132,
    alignSelf: "center",
    overflow: "hidden",
  },
  // 商家只给了图、没给任何文案时，让图片铺满整条 banner，避免左侧
  // 出现一块空白。
  imageFull: {
    flex: 1,
    width: "100%",
    height: 148,
    alignSelf: "stretch",
  },
});

export default NewArrivalBanner;
