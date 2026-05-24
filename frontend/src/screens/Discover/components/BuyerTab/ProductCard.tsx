/**
 * 单品卡片：图片 + 角标 + 标题 + 店铺名 + 价格 + 心形收藏按钮。
 *
 * 价格展示走 `useFormatPrice()`：
 *   - 源币种来自后端 `store_products.currency`（默认 CNY，少量 USD 商品）；
 *   - 展示币种由 `useCurrencyStore` 决定（用户在 Settings 里选过 → 用选择值；
 *     未选过 → 按 locale，zh* → CNY，其它 → USD），切换后整页自动 rerender；
 *   - 整数元金额走千分位（"¥ 5,890"），带小数固定 2 位（"$ 58.90"）。
 *
 * 角标颜色按 BADGE 区分：
 *   - NEW   → 白底黑字（简洁）
 *   - SALE  → 黑底白字（促销）
 *   - EVENT → 深米色（活动感）
 */
import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Pressable, Text } from "../../../../components/ui";
import { OptimizedImage } from "../../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../../../theme";
import { useFormatPrice } from "../../../../utils/currency";
import { BuyerStoreProduct, ProductBadge } from "./types";
import { PLAYFAIR } from "./playfair";

interface ProductCardProps {
  product: BuyerStoreProduct;
  storeName: string;
  isFavorited: boolean;
  onPress: (productId: string) => void;
  onFavoriteToggle: (productId: string) => void;
}

const ProductCardImpl: React.FC<ProductCardProps> = ({
  product,
  storeName,
  isFavorited,
  onPress,
  onFavoriteToggle,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  // 注意：BuyerStoreProduct 当前还没有透传后端的 currency 字段，先按 CNY 兜底；
  // 后续把 currency 串到 view model 后改成 product.currency 即可，无需改组件逻辑。
  const formatPrice = useFormatPrice();
  const formatPriceCents = (cents: number) => formatPrice(cents, "CNY");
  // BADGE_STYLE must be recomputed per render so the badge colors stay
  // theme-reactive (the legacy module-scope object captured frozen colors at
  // load time). `theme.colors.white` and `theme.colors.black` auto-invert
  // between modes so the NEW vs SALE visual contrast holds.
  const badgeStyle = useMemo<
    Record<ProductBadge, { container: object; text: object }>
  >(
    () => ({
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
    }),
    [theme]
  );

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
          <Box style={[styles.badge, badgeStyle[product.badge].container]}>
            <Text style={[styles.badgeText, badgeStyle[product.badge].text]}>
              {product.badge}
            </Text>
          </Box>
        )}
      </Box>
      <Box px={0} pt={10}>
        <Text
          numberOfLines={2}
          style={styles.title}
        >
          {product.title}
        </Text>
        <Text numberOfLines={1} style={styles.storeName}>
          {storeName}
        </Text>
        <HStack alignItems="center" justifyContent="space-between" mt={6}>
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
              size={20}
              color={isFavorited ? theme.colors.error : theme.colors.gray200}
            />
          </Pressable>
        </HStack>
      </Box>
    </Pressable>
  );
};

export const ProductCard = React.memo(ProductCardImpl);

const makeStyles = (t: AppTheme) => StyleSheet.create({
  card: {
    flex: 1,
    paddingBottom: 16,
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: t.colors.gray100,
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
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 3,
  },
  badgeText: {
    fontFamily: PLAYFAIR.bold,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 13,
    fontWeight: "600",
    color: t.colors.text,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  storeName: {
    fontFamily: PLAYFAIR.regular,
    fontSize: 11,
    color: t.colors.gray300,
    marginTop: 4,
  },
  price: {
    fontFamily: PLAYFAIR.bold,
    fontSize: 14,
    fontWeight: "700",
    color: t.colors.text,
    letterSpacing: -0.2,
  },
  priceDiscounted: {
    color: t.colors.error,
  },
  priceOriginal: {
    fontFamily: PLAYFAIR.regular,
    fontSize: 11,
    color: t.colors.gray300,
    textDecorationLine: "line-through",
  },
});

export default ProductCard;
