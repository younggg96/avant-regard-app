/**
 * StoreProductListScreen —— 买手店 Tab "入口卡片" 落地页。
 *
 * 覆盖 4 种消费者列表视图（由路由参数区分，对应 `EntryCardType`）：
 *   - CLASSIFICATION：分类商品（带 categoryId；未传 categoryId 时顶部显示分类
 *     Tab 让用户自选，默认展示全部单品）；
 *   - DISCOUNT：全部折扣商品；
 *   - NEW_ARRIVAL：全部新品；
 *   - ALL：不带筛选的全部商品（兜底路径，默认从 BuyerTab 直接跳"单品"卡片时用）。
 *
 * 技术决策：
 *   - 用同一屏幕对应 4 种筛选，是因为后端 `/store/{id}/products` 已经通过
 *     querystring 统一了筛选语义，前端没必要搞 4 个几乎相同的屏；
 *   - 使用 `FlatList numColumns=2` + 网格，和 `AllBuyerStoresScreen` 保持
 *     视觉节奏一致（`CARD_WIDTH = (SCREEN_WIDTH - 32 - 12) / 2`）；
 *   - 分类 Tab 只在 `mode === "CLASSIFICATION"` 且没有硬指定 `categoryId`
 *     时渲染；其它模式禁用分类 Tab，避免"我在看折扣，却被分类 Tab 重定向"
 *     的错乱；
 *   - 搜索走同接口 `searchQuery` 参数，不单独写搜索 API；
 *   - 所有错误静默 → 错误屏 + 重试，不影响其他屏。
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  ListRenderItem,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Pressable, Text, VStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import {
  getStoreProducts,
  getStoreProductCategories,
  StoreProduct,
  StoreProductCategory,
  formatPrice,
} from "../services/storeProductService";
import { SCREEN_WIDTH } from "./Discover/constants";

const PAGE_SIZE = 20;
const GRID_HORIZONTAL_PADDING = 16;
const GRID_GAP = 12;
const CARD_WIDTH =
  (SCREEN_WIDTH - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP) / 2;

/**
 * 本屏支持的筛选模式。与 `EntryCardType` 对齐再加一个 `ALL` 兜底。
 */
export type StoreProductListMode =
  | "ALL"
  | "CLASSIFICATION"
  | "DISCOUNT"
  | "NEW_ARRIVAL";

export interface StoreProductListRouteParams {
  storeId: string;
  storeName?: string;
  mode?: StoreProductListMode;
  /** CLASSIFICATION 模式的预设分类：有值时隐藏分类 Tab；无值时走分类 Tab 选择。 */
  categoryId?: number | null;
  /** 预置搜索词（外部埋点跳转时用；界面打开后用户可自由改）。 */
  initialSearchQuery?: string;
}

type NavigationProp = {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
};

type RouteProps = RouteProp<
  Record<string, StoreProductListRouteParams>,
  string
>;

/**
 * 特殊分类 id：用于分类 Tab 里的"全部"选项，避免把 0 或 null 当 sentinel。
 */
const ALL_CATEGORIES_SENTINEL = -1;

const titleForMode = (
  mode: StoreProductListMode,
  storeName?: string,
  categoryName?: string
): string => {
  if (mode === "DISCOUNT") return `${storeName ?? ""} · 折扣`;
  if (mode === "NEW_ARRIVAL") return `${storeName ?? ""} · 新品`;
  if (mode === "CLASSIFICATION" && categoryName) return categoryName;
  return storeName || "单品";
};

const StoreProductListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const {
    storeId,
    storeName,
    mode = "ALL",
    categoryId: presetCategoryId = null,
    initialSearchQuery = "",
  } = route.params ?? ({} as StoreProductListRouteParams);

  // ---------------------- 分类（仅 CLASSIFICATION 模式且未预置分类时启用） -----------
  const needCategoryTabs = mode === "CLASSIFICATION" && presetCategoryId == null;

  const [categories, setCategories] = useState<StoreProductCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number>(
    presetCategoryId ?? ALL_CATEGORIES_SENTINEL
  );

  // ---------------------- 列表分页状态 -------------------------------------
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------- 搜索 ----------------------------------------------
  const [searchInput, setSearchInput] = useState(initialSearchQuery);
  const [activeQuery, setActiveQuery] = useState(initialSearchQuery);
  const searchInputRef = useRef<TextInput>(null);

  // unmount 防御
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------- 分类拉取 -----------------------------------------
  // 仅在需要分类 Tab 的模式下请求；其它模式没必要打这一条接口。
  useEffect(() => {
    if (!needCategoryTabs || !storeId) return;
    let cancelled = false;
    getStoreProductCategories(storeId, true)
      .then((list) => {
        if (cancelled || !mountedRef.current) return;
        setCategories(list);
      })
      .catch((e) => {
        console.warn("[StoreProductList] load categories failed:", e);
      });
    return () => {
      cancelled = true;
    };
  }, [needCategoryTabs, storeId]);

  // ---------------------- 列表拉取 -----------------------------------------
  const load = useCallback(
    async (
      loadMode: "initial" | "refresh" | "more",
      overrideQuery?: string,
      overrideCategoryId?: number
    ) => {
      const queryForCall =
        overrideQuery !== undefined ? overrideQuery : activeQuery;
      const categoryForCall =
        overrideCategoryId !== undefined
          ? overrideCategoryId
          : activeCategoryId;
      try {
        if (loadMode === "initial") setIsLoading(true);
        else if (loadMode === "refresh") setIsRefreshing(true);
        else setIsLoadingMore(true);
        setError(null);

        const targetPage = loadMode === "more" ? page + 1 : 1;

        const categoryIdForApi =
          mode === "CLASSIFICATION"
            ? categoryForCall === ALL_CATEGORIES_SENTINEL
              ? null
              : categoryForCall
            : null;

        const result = await getStoreProducts({
          storeId,
          page: targetPage,
          pageSize: PAGE_SIZE,
          categoryId: categoryIdForApi,
          hasDiscount: mode === "DISCOUNT" ? true : undefined,
          isNew: mode === "NEW_ARRIVAL" ? true : undefined,
          searchQuery: queryForCall || undefined,
        });
        if (!mountedRef.current) return;

        setTotal(result.total);
        setPage(targetPage);

        const nextProducts =
          loadMode === "more" ? [...products, ...result.products] : result.products;
        setProducts(nextProducts);
        setHasMore(
          nextProducts.length < result.total && result.products.length > 0
        );
      } catch (e) {
        console.error("[StoreProductList] load failed:", e);
        if (!mountedRef.current) return;
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!mountedRef.current) return;
        if (loadMode === "initial") setIsLoading(false);
        else if (loadMode === "refresh") setIsRefreshing(false);
        else setIsLoadingMore(false);
      }
    },
    [storeId, mode, activeQuery, activeCategoryId, page, products]
  );

  // 首次挂载
  useEffect(() => {
    load("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------- 交互回调 -----------------------------------------
  const handleCategoryChange = useCallback(
    (newId: number) => {
      setActiveCategoryId(newId);
      load("initial", undefined, newId);
    },
    [load]
  );

  const handleSearchSubmit = useCallback(() => {
    const trimmed = searchInput.trim();
    Keyboard.dismiss();
    setActiveQuery(trimmed);
    load("initial", trimmed);
  }, [searchInput, load]);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setActiveQuery("");
    searchInputRef.current?.blur();
    Keyboard.dismiss();
    load("initial", "");
  }, [load]);

  const handleProductPress = useCallback(
    (productId: number) => {
      navigation.navigate("StoreProductDetail", { productId });
    },
    [navigation]
  );

  // ---------------------- 渲染辅助 -----------------------------------------
  const activeCategoryName = useMemo(() => {
    if (!needCategoryTabs) return undefined;
    if (activeCategoryId === ALL_CATEGORIES_SENTINEL) return "全部";
    return categories.find((c) => c.id === activeCategoryId)?.name;
  }, [needCategoryTabs, activeCategoryId, categories]);

  const headerTitle = titleForMode(mode, storeName, activeCategoryName);

  const renderItem = useCallback<ListRenderItem<StoreProduct>>(
    ({ item }) => <ProductCardItem product={item} onPress={handleProductPress} />,
    [handleProductPress]
  );

  const keyExtractor = useCallback(
    (item: StoreProduct) => String(item.id),
    []
  );

  // ---------------------- 分支渲染 -----------------------------------------
  if (isLoading && products.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <ScreenHeader title={headerTitle} showBack />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && products.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <ScreenHeader title={headerTitle} showBack />
        <View style={styles.center}>
          <Ionicons
            name="cloud-offline-outline"
            size={40}
            color={theme.colors.gray300}
          />
          <Text fontSize="$md" fontWeight="$semibold" color="$black" mt="$sm">
            加载失败
          </Text>
          <Text fontSize="$xs" color="$gray300" mt="$xs" textAlign="center">
            {error}
          </Text>
          <Pressable
            onPress={() => load("initial")}
            px="$lg"
            py="$sm"
            mt="$md"
            bg="$black"
            rounded="$md"
          >
            <Text color="$white" fontWeight="$semibold" fontSize="$sm">
              点击重试
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScreenHeader
        title={headerTitle}
        subtitle={total > 0 ? `共 ${total} 件` : undefined}
        showBack
      />

      {/* 搜索框 */}
      <Box mx="$md" my="$sm">
        <HStack style={styles.searchBar} alignItems="center" gap={8}>
          <Ionicons name="search" size={16} color={theme.colors.gray300} />
          <TextInput
            ref={searchInputRef}
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="搜索商品"
            placeholderTextColor={theme.colors.gray300}
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
            style={styles.searchInput}
          />
          {searchInput.length > 0 && (
            <Pressable onPress={handleClearSearch} hitSlop={8}>
              <Ionicons
                name="close-circle"
                size={16}
                color={theme.colors.gray300}
              />
            </Pressable>
          )}
        </HStack>
      </Box>

      {/* 分类 Tab 条 */}
      {needCategoryTabs && categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryBar}
        >
          <CategoryChip
            label="全部"
            active={activeCategoryId === ALL_CATEGORIES_SENTINEL}
            onPress={() => handleCategoryChange(ALL_CATEGORIES_SENTINEL)}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              label={
                c.productCount != null ? `${c.name} · ${c.productCount}` : c.name
              }
              active={activeCategoryId === c.id}
              onPress={() => handleCategoryChange(c.id)}
            />
          ))}
        </ScrollView>
      )}

      <FlatList
        data={products}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load("refresh")}
            colors={[theme.colors.accent]}
            tintColor={theme.colors.accent}
          />
        }
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (!isLoadingMore && hasMore && !isLoading) {
            load("more");
          }
        }}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={theme.colors.gray300} />
            </View>
          ) : !hasMore && products.length > 0 ? (
            <View style={styles.footerEnd}>
              <Text fontSize="$xs" color="$gray300">
                — 已经到底啦 —
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading && products.length === 0 ? (
            <Box py="$xl" alignItems="center">
              <Ionicons
                name="bag-handle-outline"
                size={32}
                color={theme.colors.gray300}
              />
              <Text fontSize="$sm" color="$gray300" mt="$sm">
                {activeQuery ? "没有匹配的商品" : "暂无商品"}
              </Text>
            </Box>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

// ============================================================================
// 分类 Chip
// ============================================================================

const CategoryChip: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
}> = React.memo(({ label, active, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[styles.categoryChip, active && styles.categoryChipActive]}
  >
    <Text
      fontSize={12}
      fontWeight={active ? "$semibold" : "$normal"}
      color={active ? "$white" : "$gray700"}
    >
      {label}
    </Text>
  </Pressable>
));
CategoryChip.displayName = "CategoryChip";

// ============================================================================
// 单品卡片
// ============================================================================

const ProductCardItemImpl: React.FC<{
  product: StoreProduct;
  onPress: (productId: number) => void;
}> = ({ product, onPress }) => {
  const cover = product.images?.[0];
  const hasDiscount =
    product.discountPriceCents != null &&
    product.discountPriceCents < product.priceCents;
  return (
    <Pressable onPress={() => onPress(product.id)} style={styles.card}>
      <View style={styles.cardCover}>
        {cover ? (
          <OptimizedImage
            uri={cover}
            size={ImageSize.MEDIUM}
            style={styles.cardImage}
            contentFit="cover"
            lazy
          />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Ionicons
              name="image-outline"
              size={32}
              color={theme.colors.gray300}
            />
          </View>
        )}
        {product.isNew && !hasDiscount && (
          <View style={[styles.badge, styles.badgeNew]}>
            <Text style={styles.badgeText}>NEW</Text>
          </View>
        )}
        {hasDiscount && (
          <View style={[styles.badge, styles.badgeSale]}>
            <Text style={[styles.badgeText, { color: theme.colors.white }]}>
              SALE
            </Text>
          </View>
        )}
      </View>
      <VStack px="$sm" py="$sm" gap={3}>
        <Text fontSize={13} fontWeight="$semibold" color="$black" numberOfLines={2}>
          {product.title}
        </Text>
        {!!product.brand && (
          <Text fontSize={10} color="$gray400" numberOfLines={1}>
            {product.brand}
          </Text>
        )}
        <HStack alignItems="baseline" gap={6} mt={2}>
          <Text
            fontSize={13}
            fontWeight="$bold"
            color={hasDiscount ? "$error" : "$black"}
          >
            {formatPrice(
              hasDiscount
                ? (product.discountPriceCents as number)
                : product.priceCents,
              product.currency
            )}
          </Text>
          {hasDiscount && (
            <Text
              fontSize={11}
              color="$gray300"
              style={{ textDecorationLine: "line-through" }}
            >
              {formatPrice(product.priceCents, product.currency)}
            </Text>
          )}
        </HStack>
      </VStack>
    </Pressable>
  );
};

const ProductCardItem = React.memo(ProductCardItemImpl);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  searchBar: {
    backgroundColor: theme.colors.gray50,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.black,
    padding: 0,
  },
  categoryBar: {
    paddingHorizontal: GRID_HORIZONTAL_PADDING,
    paddingBottom: 8,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: theme.colors.gray50,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.black,
  },
  listContent: {
    paddingHorizontal: GRID_HORIZONTAL_PADDING,
    paddingTop: 8,
    paddingBottom: 32,
    gap: GRID_GAP,
  },
  row: {
    gap: GRID_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.gray100,
    overflow: "hidden",
  },
  cardCover: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    backgroundColor: theme.colors.gray100,
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardImagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
  },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeNew: {
    backgroundColor: theme.colors.white,
  },
  badgeSale: {
    backgroundColor: theme.colors.black,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: theme.colors.black,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  footerEnd: {
    paddingVertical: 20,
    alignItems: "center",
  },
});

export default StoreProductListScreen;
