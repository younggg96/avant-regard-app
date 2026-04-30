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
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Pressable, Text, VStack } from "../../../../components/ui";
import { OptimizedImage } from "../../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../../utils/imageUtils";
import { theme } from "../../../../theme";
import { BuyerStoreFeatureBanner } from "./types";

interface NewArrivalBannerProps {
  banner: BuyerStoreFeatureBanner;
  onPress: () => void;
}

const NewArrivalBannerImpl: React.FC<NewArrivalBannerProps> = ({
  banner,
  onPress,
}) => {
  const hasText = !!(banner.title || banner.subtitle || banner.cta);

  return (
    <Box mx="$md" mb="$md">
      <Pressable onPress={onPress} style={styles.container}>
        <HStack flex={1} alignItems="center">
          {hasText && (
            <VStack flex={1} pl={16} py={14}>
              {banner.subtitle && (
                <Text style={styles.subtitle}>{banner.subtitle}</Text>
              )}
              {banner.title && (
                <Text style={styles.title} numberOfLines={2}>
                  {banner.title}
                </Text>
              )}
              <HStack alignItems="center" mt={8} gap={6}>
                <Text style={styles.cta}>{banner.cta || "查看详情"}</Text>
                <Ionicons
                  name="arrow-forward"
                  size={12}
                  color={theme.colors.black}
                />
              </HStack>
            </VStack>
          )}
          <View style={[styles.imageWrapper, !hasText && styles.imageFull]}>
            <OptimizedImage
              uri={banner.image}
              size={ImageSize.MEDIUM}
              style={styles.image}
              contentFit="cover"
              lazy
            />
          </View>
        </HStack>
      </Pressable>
    </Box>
  );
};

export const NewArrivalBanner = React.memo(NewArrivalBannerImpl);

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F2EDE5",
    borderRadius: 10,
    overflow: "hidden",
    height: 108,
    flexDirection: "row",
  },
  subtitle: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: theme.colors.gray400,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.black,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  cta: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.black,
  },
  imageWrapper: {
    width: 140,
    height: "100%",
  },
  // 商家只给了图、没给任何文案时，让图片铺满整条 banner，避免左侧
  // 出现一块空白。
  imageFull: {
    flex: 1,
    width: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

export default NewArrivalBanner;
