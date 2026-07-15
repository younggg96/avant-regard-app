/**
 * BrandCollections —— "BRAND COLLECTIONS" 品牌图集区块（migration 057）。
 *
 * 数据流：
 *   - 卡片来自商家配置的 `store_brand_collections`（BuyerTab hook 的
 *     `brandCollections`），未配置时返回 null 隐藏整段；
 *   - 点开某个品牌卡片 → 就地展开该品牌下的单品面板（`getStoreProducts`
 *     按 brand 精确过滤），再点一次 / 点关闭按钮收起；
 *   - 单品行是"左图右文"卡片，点击跳 StoreProductDetail（经 onProductPress）。
 *
 * 动效（reanimated）：
 *   - 品牌卡片按压弹性缩放（withSpring）；
 *   - 选中卡片的圆形箭头旋转 90°，卡片描边浮起；
 *   - 展开面板 3D 翻折入场（Keyframe rotateX）+ 单品行左滑甩入（阶梯延迟）；
 *   - 横向滚动驱动卡片 3D 透视倾角 + 封面视差；选中卡黑白反转 + 高光扫过；
 *   - 区块整体挂 LinearTransition，展开/收起时下方内容平滑让位。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInRight,
  FadeOut,
  interpolate,
  interpolateColor,
  Keyframe,
  LinearTransition,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { SCREEN_WIDTH } from "../../constants";
import { Box, HStack, Pressable, ScrollView, Text, VStack } from "../../../../components/ui";
import { OptimizedImage } from "../../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../../../theme";
import {
  formatPrice,
  getStoreProducts,
  StoreBrandCollection,
  StoreProduct,
} from "../../../../services/storeProductService";
import type { BuyerStoreProduct } from "./types";
import { PLAYFAIR } from "./playfair";

interface BrandCollectionsProps {
  storeId: string;
  collections: StoreBrandCollection[];
  onProductPress: (product: BuyerStoreProduct) => void;
}

const CARD_WIDTH = 150;
const CARD_GAP = 10;
/** 画廊里相邻两张卡的横向步长（含间距），滚动视差按它换算卡片位置 */
const CARD_STRIDE = CARD_WIDTH + CARD_GAP;
const GALLERY_PADDING = 16;
const PANEL_PAGE_SIZE = 12;

// ---------------------------------------------------------------------------
// 入场 Keyframe —— 比预置的 FadeInDown 更有"编辑排版"味道的自定义轨迹
// ---------------------------------------------------------------------------

/** 展开面板：3D 翻折下来（rotateX 从 -10° 展平）+ 轻微缩放回弹 */
const panelEntering = new Keyframe({
  0: {
    opacity: 0,
    transform: [
      { perspective: 800 },
      { translateY: -16 },
      { rotateX: "-10deg" },
      { scale: 0.96 },
    ],
  },
  100: {
    opacity: 1,
    transform: [
      { perspective: 800 },
      { translateY: 0 },
      { rotateX: "0deg" },
      { scale: 1 },
    ],
    // Keyframe 的 easing 只收纯函数，Easing.bezier 返回 factory —— 用 bezierFn
    easing: Easing.bezierFn(0.22, 1, 0.36, 1),
  },
}).duration(420);

/** 单品行：从左滑切进来，带一点旋转的"甩入"感，按行号阶梯延迟 */
const rowEntering = (index: number) =>
  new Keyframe({
    0: {
      opacity: 0,
      transform: [{ translateX: -32 }, { rotateZ: "-1.5deg" }],
    },
    70: {
      opacity: 1,
      transform: [{ translateX: 4 }, { rotateZ: "0.4deg" }],
    },
    100: {
      opacity: 1,
      transform: [{ translateX: 0 }, { rotateZ: "0deg" }],
      easing: Easing.bezierFn(0.22, 1, 0.36, 1),
    },
  })
    .duration(460)
    .delay(index * 70);

const toProductView = (p: StoreProduct): BuyerStoreProduct => ({
  id: `remote-${p.id}`,
  realProductId: p.id,
  title: p.title,
  brand: p.brand?.trim() || p.categoryName?.trim() || "—",
  image: p.images?.[0] ?? "",
  priceCents: p.priceCents,
  discountPriceCents: p.discountPriceCents ?? undefined,
  badge: p.hasDiscount ? "SALE" : p.isNew ? "NEW" : undefined,
  isFavorited: !!p.likedByMe,
});

// ---------------------------------------------------------------------------
// 品牌卡片
// ---------------------------------------------------------------------------

// 动画文字用 RN 原生 Text（Animated.Text），自定义 ui/Text 是 styled 组件，
// createAnimatedComponent 对其 ref 转发不可靠。
const AnimatedText = Animated.Text;

const BrandCard: React.FC<{
  item: StoreBrandCollection;
  index: number;
  active: boolean;
  totalItemsLabel: string;
  scrollX: SharedValue<number>;
  onPress: (item: StoreBrandCollection) => void;
}> = React.memo(({ item, index, active, totalItemsLabel, scrollX, onPress }) => {
  const styles = useThemedStyles(makeStyles);
  const theme = useAppTheme();
  const pressed = useSharedValue(0);
  const activeSv = useSharedValue(active ? 1 : 0);
  const shine = useSharedValue(0);

  useEffect(() => {
    activeSv.value = withTiming(active ? 1 : 0, {
      duration: 320,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    // 选中时封面上循环扫一道高光；收起时立刻停掉，避免后台空转。
    if (active) {
      shine.value = 0;
      shine.value = withRepeat(
        withDelay(
          500,
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(shine);
      shine.value = 0;
    }
  }, [active, activeSv, shine]);

  // 按压下沉 + 轻微倾斜；选中上浮；随横向滚动加 3D 透视倾角（越靠屏幕
  // 边缘转角越大，居中时摆正）。transform 独立挂在内层，避免与外层
  // entering 布局动画争抢 transform（Reanimated 警告）。
  const cardAnimStyle = useAnimatedStyle(() => {
    const cardCenter =
      GALLERY_PADDING + index * CARD_STRIDE + CARD_WIDTH / 2 - scrollX.value;
    const offset = cardCenter - SCREEN_WIDTH / 2;
    const rotateY = interpolate(
      offset,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [5, 0, -5],
      "clamp"
    );
    return {
      transform: [
        { perspective: 700 },
        { rotateY: `${rotateY}deg` },
        // 选中放大约 8%，按压时略微下压；上浮配合放大避免被邻卡挡住
        {
          scale:
            1 - pressed.value * 0.05 + activeSv.value * 0.08,
        },
        { rotateZ: `${pressed.value * -1.2}deg` },
        { translateY: activeSv.value * -10 },
      ],
    };
  });

  // 选中态整卡黑白反转：底色翻黑、文字翻白 —— 呼应 app 的黑白杂志基调。
  const cardColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      activeSv.value,
      [0, 1],
      [theme.colors.gray50, theme.colors.text]
    ),
    shadowOpacity: 0.06 + activeSv.value * 0.18,
  }));

  const nameColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeSv.value,
      [0, 1],
      [theme.colors.text, theme.colors.textInverted]
    ),
    letterSpacing: 1 + activeSv.value * 1.5,
  }));

  const totalColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeSv.value,
      [0, 1],
      [theme.colors.gray400, theme.colors.textInverted]
    ),
  }));

  const dividerColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      activeSv.value,
      [0, 1],
      [theme.colors.text, theme.colors.textInverted]
    ),
    width: 22 + activeSv.value * 20,
  }));

  // 封面视差 + Ken-Burns：底图常态放大 1.15 倍，随滚动横移错位（编辑画册
  // 的景深感），选中时再放大一档。
  const imageAnimStyle = useAnimatedStyle(() => {
    const cardCenter =
      GALLERY_PADDING + index * CARD_STRIDE + CARD_WIDTH / 2 - scrollX.value;
    const offset = cardCenter - SCREEN_WIDTH / 2;
    const parallax = interpolate(
      offset,
      [-SCREEN_WIDTH, SCREEN_WIDTH],
      [12, -12],
      "clamp"
    );
    return {
      transform: [
        { translateX: parallax },
        { scale: 1.15 + activeSv.value * 0.1 },
      ],
    };
  });

  // 高光扫过：一道斜向白光从左划到右（仅选中态循环）。
  const shineStyle = useAnimatedStyle(() => ({
    opacity: activeSv.value * 0.9,
    transform: [
      {
        translateX: interpolate(
          shine.value,
          [0, 1],
          [-CARD_WIDTH * 1.2, CARD_WIDTH * 1.2]
        ),
      },
      { rotateZ: "18deg" },
    ],
  }));

  // 箭头翻转 90° 并黑白互换。
  const arrowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${activeSv.value * 90}deg` }],
    backgroundColor: interpolateColor(
      activeSv.value,
      [0, 1],
      [theme.colors.text, theme.colors.textInverted]
    ),
  }));

  const arrowIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - activeSv.value,
  }));
  const arrowIconActiveStyle = useAnimatedStyle(() => ({
    opacity: activeSv.value,
  }));

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 80)
        .springify()
        .damping(18)}
    >
      <Animated.View style={[styles.brandCardShadow, cardAnimStyle]}>
        <Animated.View style={[styles.brandCard, cardColorStyle]}>
          <Pressable
            onPressIn={() => {
              pressed.value = withSpring(1, { damping: 20, stiffness: 320 });
            }}
            onPressOut={() => {
              pressed.value = withSpring(0, { damping: 16, stiffness: 280 });
            }}
            onPress={() => onPress(item)}
          >
            <AnimatedText
              style={[styles.brandName, nameColorStyle]}
              numberOfLines={1}
            >
              {item.brandName.toUpperCase()}
            </AnimatedText>
            <Box style={styles.brandImageWrap}>
              <Animated.View style={[styles.brandImageInner, imageAnimStyle]}>
                <OptimizedImage
                  uri={item.coverImage}
                  size={ImageSize.MEDIUM}
                  style={styles.brandImage}
                  contentFit="cover"
                  lazy
                />
              </Animated.View>
              <Animated.View
                style={[styles.brandShine, shineStyle]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={[
                    "transparent",
                    "rgba(255,255,255,0.34)",
                    "transparent",
                  ]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.28)"]}
                style={styles.brandImageGradient}
                pointerEvents="none"
              />
            </Box>
            <Animated.View style={[styles.brandFooterDivider, dividerColorStyle]} />
            <HStack alignItems="center" justifyContent="space-between" mt={6}>
              <AnimatedText
                style={[styles.brandTotal, totalColorStyle]}
                numberOfLines={1}
              >
                {totalItemsLabel}
              </AnimatedText>
              <Animated.View style={[styles.arrowButton, arrowAnimStyle]}>
                <Animated.View style={[StyleSheet.absoluteFill, styles.arrowIconCenter, arrowIconStyle]}>
                  <Ionicons
                    name="arrow-forward"
                    size={13}
                    color={theme.colors.textInverted}
                  />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, styles.arrowIconCenter, arrowIconActiveStyle]}>
                  <Ionicons
                    name="arrow-forward"
                    size={13}
                    color={theme.colors.text}
                  />
                </Animated.View>
              </Animated.View>
            </HStack>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
});
BrandCard.displayName = "BrandCard";

// ---------------------------------------------------------------------------
// 展开面板里的"左图右文"单品行
// ---------------------------------------------------------------------------

const BrandProductRow: React.FC<{
  product: StoreProduct;
  index: number;
  onPress: (product: StoreProduct) => void;
}> = React.memo(({ product, index, onPress }) => {
  const styles = useThemedStyles(makeStyles);
  const theme = useAppTheme();
  const pressed = useSharedValue(0);

  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.02 }],
  }));

  const price = formatPrice(
    product.discountPriceCents ?? product.priceCents,
    product.currency
  );
  const originalPrice = product.discountPriceCents
    ? formatPrice(product.priceCents, product.currency)
    : null;

  // entering（布局动画）挂外层、transform 动画样式挂内层 —— 两者同挂一个
  // 视图会触发 Reanimated "transform may be overwritten" 警告。
  return (
    <Animated.View entering={rowEntering(index)}>
      <Animated.View style={rowAnimStyle}>
      <Pressable
        onPressIn={() => {
          pressed.value = withSpring(1, { damping: 20, stiffness: 300 });
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, { damping: 20, stiffness: 300 });
        }}
        onPress={() => onPress(product)}
        style={styles.productRow}
      >
        <Box style={styles.productImageWrap}>
          {product.images?.[0] ? (
            <OptimizedImage
              uri={product.images[0]}
              size={ImageSize.THUMBNAIL}
              style={styles.productImage}
              contentFit="cover"
              lazy
            />
          ) : (
            <Box style={[styles.productImage, styles.productImageFallback]}>
              <Ionicons name="image-outline" size={20} color={theme.colors.gray300} />
            </Box>
          )}
        </Box>
        <VStack flex={1} minWidth={0} justifyContent="center">
          {!!product.brand && (
            <Text style={styles.productBrand} numberOfLines={1}>
              {product.brand.toUpperCase()}
            </Text>
          )}
          <Text style={styles.productTitle} numberOfLines={2}>
            {product.title}
          </Text>
          <HStack alignItems="baseline" gap={6} mt={4}>
            <Text style={styles.productPrice}>{price}</Text>
            {!!originalPrice && (
              <Text style={styles.productOriginalPrice}>{originalPrice}</Text>
            )}
          </HStack>
        </VStack>
        <Ionicons name="chevron-forward" size={15} color={theme.colors.gray300} />
      </Pressable>
      </Animated.View>
    </Animated.View>
  );
});
BrandProductRow.displayName = "BrandProductRow";

// ---------------------------------------------------------------------------
// 区块主体
// ---------------------------------------------------------------------------

const BrandCollectionsImpl: React.FC<BrandCollectionsProps> = ({
  storeId,
  collections,
  onProductPress,
}) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const theme = useAppTheme();

  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  // 品牌 → 单品缓存。key 带 storeId：切店后不会串数据，也免手动清空。
  const [productsCache, setProductsCache] = useState<
    Record<string, StoreProduct[]>
  >({});
  const [loadingBrand, setLoadingBrand] = useState<string | null>(null);

  // 切店时收起面板
  useEffect(() => {
    setExpandedBrand(null);
  }, [storeId]);

  const cacheKey = useCallback(
    (brand: string) => `${storeId}::${brand.toLowerCase()}`,
    [storeId]
  );

  const loadBrandProducts = useCallback(
    async (brand: string) => {
      const key = cacheKey(brand);
      if (productsCache[key] !== undefined) return;

      setLoadingBrand(brand);
      try {
        const result = await getStoreProducts({
          storeId,
          brand,
          page: 1,
          pageSize: PANEL_PAGE_SIZE,
        });
        setProductsCache((prev) => ({ ...prev, [key]: result.products ?? [] }));
      } catch (err) {
        console.warn("[BrandCollections] load brand products failed:", err);
        setProductsCache((prev) => ({ ...prev, [key]: [] }));
      } finally {
        setLoadingBrand((prev) => (prev === brand ? null : prev));
      }
    },
    [storeId, cacheKey, productsCache]
  );

  const handleCardPress = useCallback(
    (item: StoreBrandCollection) => {
      setExpandedBrand((prev) =>
        prev === item.brandName ? null : item.brandName
      );
      loadBrandProducts(item.brandName);
    },
    [loadBrandProducts]
  );

  const handleProductPress = useCallback(
    (product: StoreProduct) => {
      onProductPress(toProductView(product));
    },
    [onProductPress]
  );

  const expandedProducts = useMemo(() => {
    if (!expandedBrand) return undefined;
    return productsCache[cacheKey(expandedBrand)];
  }, [expandedBrand, productsCache, cacheKey]);

  // 横向滚动位置驱动卡片的 3D 倾角和封面视差
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  if (collections.length === 0) return null;

  const isPanelLoading =
    !!expandedBrand &&
    (loadingBrand === expandedBrand || expandedProducts === undefined);

  return (
    <Animated.View layout={LinearTransition.springify().damping(20)}>
      <Box mt="$sm" mb="$md">
        <HStack
          mx={16}
          mb={0}
          alignItems="center"
          justifyContent="space-between"
        >
          <Text style={styles.sectionTitle}>
            {t("discover.brandCollections").toUpperCase()}
          </Text>
        </HStack>

        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.galleryContent}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={CARD_STRIDE}
          snapToAlignment="start"
        >
          {collections.map((item, idx) => (
            <Box key={item.id} style={{ marginRight: CARD_GAP }}>
              <BrandCard
                item={item}
                index={idx}
                active={expandedBrand === item.brandName}
                totalItemsLabel={t("discover.brandTotalItems", {
                  count: item.productCount ?? 0,
                })}
                scrollX={scrollX}
                onPress={handleCardPress}
              />
            </Box>
          ))}
        </Animated.ScrollView>

        {!!expandedBrand && (
          <Animated.View
            key={`panel-${storeId}-${expandedBrand}`}
            entering={panelEntering}
            exiting={FadeOut.duration(140)}
            layout={LinearTransition.springify().damping(20)}
            style={styles.panel}
          >
            <HStack alignItems="center" justifyContent="space-between" mb={8}>
              <Text style={styles.panelTitle} numberOfLines={1}>
                {expandedBrand.toUpperCase()}
              </Text>
              <Pressable
                onPress={() => setExpandedBrand(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.panelClose}
              >
                <Ionicons name="close" size={15} color={theme.colors.text} />
              </Pressable>
            </HStack>

            {isPanelLoading ? (
              <Box py="$lg" alignItems="center" justifyContent="center">
                <ActivityIndicator size="small" color={theme.colors.gray300} />
              </Box>
            ) : expandedProducts && expandedProducts.length > 0 ? (
              <VStack gap={8}>
                {expandedProducts.map((product, idx) => (
                  <BrandProductRow
                    key={product.id}
                    product={product}
                    index={idx}
                    onPress={handleProductPress}
                  />
                ))}
              </VStack>
            ) : (
              <Box py="$lg" alignItems="center">
                <Ionicons
                  name="pricetags-outline"
                  size={22}
                  color={theme.colors.gray300}
                />
                <Text style={styles.emptyText} mt={6}>
                  {t("discover.brandNoProducts")}
                </Text>
              </Box>
            )}
          </Animated.View>
        )}
      </Box>
    </Animated.View>
  );
};

export const BrandCollections = React.memo(BrandCollectionsImpl);

const makeStyles = (t: AppTheme) => StyleSheet.create({
  sectionTitle: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 13,
    fontWeight: "600",
    color: t.colors.text,
    letterSpacing: 1.6,
  },
  galleryContent: {
    paddingHorizontal: 16,
    // 选中卡放大 8% + 上浮，会向上溢出内容框；顶部留足空间避免裁切/压字，
    // 底部溢出几乎为 0（上浮抵消了放大），留小间距让面板贴近画廊
    paddingTop: 22,
    paddingBottom: 4,
  },
  brandCardShadow: {
    // 阴影挂在带 transform 的层上，跟随上浮一起变浓（shadowOpacity 由动画驱动）
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    shadowOpacity: 0.06,
    elevation: 3,
    borderRadius: 12,
  },
  brandCard: {
    width: CARD_WIDTH,
    borderRadius: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    overflow: "hidden",
  },
  brandName: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 10,
  },
  brandImageWrap: {
    width: "100%",
    height: CARD_WIDTH - 24,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: t.colors.gray100,
  },
  brandImageInner: {
    width: "100%",
    height: "100%",
  },
  brandImage: {
    width: "100%",
    height: "100%",
  },
  brandImageGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 48,
  },
  brandShine: {
    position: "absolute",
    top: -20,
    bottom: -20,
    width: 56,
    left: 0,
  },
  brandFooterDivider: {
    height: 2,
    marginTop: 10,
  },
  brandTotal: {
    fontFamily: PLAYFAIR.regular,
    fontSize: 10,
    flexShrink: 1,
    marginRight: 6,
  },
  arrowButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
  },
  arrowIconCenter: {
    justifyContent: "center",
    alignItems: "center",
  },
  panel: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  panelTitle: {
    fontFamily: PLAYFAIR.bold,
    fontSize: 14,
    fontWeight: "700",
    color: t.colors.text,
    letterSpacing: 1.2,
    flexShrink: 1,
    marginRight: 8,
  },
  panelClose: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 4,
    backgroundColor: t.colors.gray50,
  },
  productImageWrap: {
    width: 76,
    height: 76,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: t.colors.gray100,
    flexShrink: 0,
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  productImageFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  productBrand: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 9,
    fontWeight: "600",
    color: t.colors.gray400,
    letterSpacing: 1,
    marginBottom: 2,
  },
  productTitle: {
    fontFamily: PLAYFAIR.regular,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.text,
  },
  productPrice: {
    fontFamily: PLAYFAIR.bold,
    fontSize: 12,
    fontWeight: "700",
    color: t.colors.text,
  },
  productOriginalPrice: {
    fontFamily: PLAYFAIR.regular,
    fontSize: 10,
    color: t.colors.gray300,
    textDecorationLine: "line-through",
  },
  emptyText: {
    fontFamily: PLAYFAIR.regular,
    fontSize: 11,
    color: t.colors.gray400,
  },
});

export default BrandCollections;
