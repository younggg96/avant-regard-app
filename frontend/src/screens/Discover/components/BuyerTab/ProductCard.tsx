/**
 * 单品卡片：图片 + 角标 + 标题 + 店铺名 + 价格 + 心形收藏按钮。
 *
 * 设计稿价格有 `¥ 5,890`、`¥ 3,290` 等，这里用 `Intl.NumberFormat` 统一千分位，
 * 避免手写字符串拼出错。角标颜色按 BADGE 区分：
 *   - NEW   → 白底黑字（简洁）
 *   - SALE  → 黑底白字（促销）
 *   - EVENT → 深米色（活动感）
 *
 * Phase 4 接入真实后端商品后：
 *   - 金额单位改为"分"（`priceCents` / `discountPriceCents`），和
 *     `store_products.price_cents` 一致；
 *   - 折扣商品：折扣价加粗醒目，原价以 strike-through 小字展示；
 *   - 整数元金额用千分位（"¥ 5,890"）；带小数时固定 2 位（"¥ 58.90"）
 *     —— 两种格式切换对消费者信任感更好。
 */
import React from "react";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Pressable, Text } from "../../../../components/ui";
import { OptimizedImage } from "../../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../../utils/imageUtils";
import { theme } from "../../../../theme";
import { BuyerStoreProduct, ProductBadge } from "./types";

interface ProductCardProps {
  product: BuyerStoreProduct;
  storeName: string;
  isFavorited: boolean;
  onPress: (productId: string) => void;
  onFavoriteToggle: (productId: string) => void;
}

const PRICE_FORMATTER = new Intl.NumberFormat("zh-CN");

/**
 * 把"分"金额格式化成展示字符串：
 *   - 整数元：千分位（`¥ 5,890`）
 *   - 含小数：固定 2 位（`¥ 58.90`）
 */
const formatPriceCents = (cents: number): string => {
  if (cents == null || Number.isNaN(cents)) return "";
  if (cents % 100 === 0) {
    return `¥ ${PRICE_FORMATTER.format(Math.round(cents / 100))}`;
  }
  return `¥ ${(cents / 100).toFixed(2)}`;
};

const BADGE_STYLE: Record<
  ProductBadge,
  { container: object; text: object }
> = {
  NEW: {
    container: { backgroundColor: theme.colors.white },
    text: { color: theme.colors.black },
  },
  SALE: {
    container: { backgroundColor: theme.colors.black },
    text: { color: theme.colors.white },
  },
  EVENT: {
    container: { backgroundColor: "#D9C9A3" },
    text: { color: theme.colors.black },
  },
};

const ProductCardImpl: React.FC<ProductCardProps> = ({
  product,
  storeName,
  isFavorited,
  onPress,
  onFavoriteToggle,
}) => {
  // 折扣分支：discountPriceCents 作为主价、priceCents 作为 strike-through 原价。
  const hasDiscount =
    product.discountPriceCents != null &&
    product.discountPriceCents < product.priceCents;
  const mainPriceCents = hasDiscount
    ? (product.discountPriceCents as number)
    : product.priceCents;

  return (
    <Pressable
      onPress={() => onPress(product.id)}
      style={styles.card}
    >
      <Box style={styles.imageWrapper}>
        <OptimizedImage
          uri={product.image}
          size={ImageSize.MEDIUM}
          style={styles.image}
          contentFit="cover"
          lazy
        />
        {product.badge && (
          <Box style={[styles.badge, BADGE_STYLE[product.badge].container]}>
            <Text style={[styles.badgeText, BADGE_STYLE[product.badge].text]}>
              {product.badge}
            </Text>
          </Box>
        )}
      </Box>
      <Box px={2} pt={8}>
        <Text
          numberOfLines={2}
          style={styles.title}
        >
          {product.title}
        </Text>
        <Text numberOfLines={1} style={styles.storeName}>
          {storeName}
        </Text>
        <HStack alignItems="center" justifyContent="space-between" mt={4}>
          <HStack alignItems="baseline" gap={6} flex={1}>
            <Text
              style={[styles.price, hasDiscount && styles.priceDiscounted]}
              numberOfLines={1}
            >
              {formatPriceCents(mainPriceCents)}
            </Text>
            {hasDiscount && (
              <Text style={styles.priceOriginal} numberOfLines={1}>
                {formatPriceCents(product.priceCents)}
              </Text>
            )}
          </HStack>
          <Pressable
            onPress={(e: any) => {
              e?.stopPropagation?.();
              onFavoriteToggle(product.id);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isFavorited ? "heart" : "heart-outline"}
              size={18}
              color={isFavorited ? theme.colors.error : theme.colors.gray300}
            />
          </Pressable>
        </HStack>
      </Box>
    </Pressable>
  );
};

export const ProductCard = React.memo(ProductCardImpl);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    paddingBottom: 12,
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: theme.colors.gray100,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.black,
    lineHeight: 16,
  },
  storeName: {
    fontSize: 10,
    color: theme.colors.gray300,
    marginTop: 2,
  },
  price: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.black,
  },
  priceDiscounted: {
    color: theme.colors.error,
  },
  priceOriginal: {
    fontSize: 11,
    color: theme.colors.gray300,
    textDecorationLine: "line-through",
  },
});

export default ProductCard;
