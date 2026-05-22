/**
 * TradingTabContent —— Discover「交易」子 Tab。
 *
 * 新版（PRD + 设计稿 p.4 二期）结构：
 *   - 顶部 ChipBar：全部 / 分类 / 尺码 / 价格 / 成色 / 筛选（最右带漏斗 icon）。
 *     「全部」激活态用一条短下划线表示；其余 chip 用 chevron-down 暗示「拍下时弹出
 *     完整筛选 Sheet」。
 *   - 热门品牌 (`popularBrandsTitle`)：横向滚动圆形头像 + 品牌名（来自后端
 *     `GET /api/marketplace/popular-brands`，按当前在售单品数量排序）。
 *   - 最新上架 (`latestArrivalsTitle`) + 「查看全部」：横向滚动 4-up 小卡片
 *     （sort=newest），点击进商品详情，「查看全部」跳到完整 MarketplaceScreen。
 *   - 精选推荐 (`featuredTitle`)：双列 4:5 瀑布流，按 sort=featured 拉取，支持
 *     上拉分页。每张卡含 favorite heart 角标 + 收藏计数。
 *
 * 用户启用任意筛选项时（≥1 chip 或 sheet 中应用），自动隐藏前两段，把页面收敛
 * 为「过滤后的 2 列结果」，避免上下文混乱。
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
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, HStack, Pressable, Text, VStack } from "../../../components/ui";
import { OptimizedImage } from "../../../components/ui/OptimizedImage";
import {
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";
import {
  getPopularBrands,
  searchMarketplace,
  type MarketplaceFilter,
  type PopularBrand,
  type StoreProduct,
} from "../../../services/storeProductService";
import MarketplaceFilterSheet from "../../Marketplace/MarketplaceFilterSheet";
import MarketplaceChipSheet, {
  type ChipFilterKey,
} from "../../Marketplace/MarketplaceChipSheet";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../constants";

// ====== 卡片尺寸 ======
// 设计稿（PDF p.4）参考点：
//   - 最新上架横滑卡片：4 张一屏，正方形主图，与品牌头像下面的间距 12pt
//   - 热门品牌头像：6 个一屏，圆形 ~48pt
//   - 精选推荐：2 列瀑布流，主图比例 4:5
const SECTION_GUTTER = 10;
const PAGE_PADDING = 16;
const FEATURED_GUTTER = 12;
const FEATURED_CARD_W = (SCREEN_WIDTH - PAGE_PADDING * 2 - FEATURED_GUTTER) / 2;
const FEATURED_CARD_IMG_H = (FEATURED_CARD_W * 5) / 4;
// 4 卡 1 屏：(屏宽 - 左右各 PAGE_PADDING - 3 个间隔) / 4
const LATEST_CARD_W =
  (SCREEN_WIDTH - PAGE_PADDING * 2 - SECTION_GUTTER * 3) / 4;
const LATEST_CARD_IMG_H = LATEST_CARD_W;
const BRAND_AVATAR_SIZE = 48;
const BRAND_AVATAR_RADIUS = BRAND_AVATAR_SIZE / 2;

// ====== Chip 配置 ======
interface QuickChip {
  id: keyof MarketplaceFilter | "all" | "filter";
  label: string;
  caret?: boolean;
}

interface Props {
  isActive: boolean;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const TradingTabContent: React.FC<Props> = ({ isActive, onScroll }) => {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  // ====== State ======
  const [filter, setFilter] = useState<MarketplaceFilter>({ sort: "featured" });
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  // 单字段快捷弹窗（点击分类 / 尺码 / 价格 / 成色 chip 时弹出，只编辑该字段）
  const [chipSheetKey, setChipSheetKey] = useState<ChipFilterKey | null>(null);

  const [popularBrands, setPopularBrands] = useState<PopularBrand[]>([]);
  const [latestItems, setLatestItems] = useState<StoreProduct[]>([]);
  const [featuredItems, setFeaturedItems] = useState<StoreProduct[]>([]);

  const [headerLoading, setHeaderLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const hasLoadedRef = useRef(false);

  // ====== 计算 ======
  const activeFilterCount = useMemo(
    () =>
      [
        "brand",
        "categoryId",
        "size",
        "color",
        "condition",
        "sellerKind",
        "priceMinCents",
        "priceMaxCents",
      ].filter((k) => (filter as any)[k] != null && (filter as any)[k] !== "")
        .length,
    [filter],
  );
  const hasActiveFilter = activeFilterCount > 0;

  const chips: QuickChip[] = useMemo(
    () => [
      { id: "all", label: t("trading.marketplace.chipAll") },
      { id: "categoryId", label: t("trading.marketplace.chipCategory"), caret: true },
      { id: "size", label: t("trading.marketplace.chipSize"), caret: true },
      { id: "priceMinCents", label: t("trading.marketplace.chipPrice"), caret: true },
      { id: "condition", label: t("trading.marketplace.chipCondition"), caret: true },
      { id: "filter", label: t("trading.marketplace.chipFilter") },
    ],
    [t],
  );

  // ====== 数据加载 ======
  const loadHeaderSections = useCallback(async () => {
    setHeaderLoading(true);
    try {
      const [brandsRes, latestRes] = await Promise.all([
        getPopularBrands(5).catch(() => [] as PopularBrand[]),
        searchMarketplace({ sort: "newest", page: 1, pageSize: 10 }).catch(
          () => ({ products: [] } as any),
        ),
      ]);
      setPopularBrands(brandsRes);
      setLatestItems(latestRes.products || []);
    } finally {
      setHeaderLoading(false);
    }
  }, []);

  const loadFeed = useCallback(
    async (nextPage: number, currentFilter: MarketplaceFilter) => {
      setLoading(true);
      try {
        const res = await searchMarketplace({
          ...currentFilter,
          page: nextPage,
          pageSize: 20,
        });
        const newItems = res.products || [];
        if (nextPage === 1) {
          setFeaturedItems(newItems);
        } else {
          setFeaturedItems((prev) => [...prev, ...newItems]);
        }
        setHasMore(
          newItems.length === 20 &&
            nextPage * 20 < (res.total ?? Number.POSITIVE_INFINITY),
        );
        setPage(nextPage);
      } catch (e) {
        if (nextPage === 1) setFeaturedItems([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // 首次激活拉数据
  useEffect(() => {
    if (!isActive) return;
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadHeaderSections();
    loadFeed(1, filter);
  }, [isActive, loadHeaderSections, loadFeed, filter]);

  // ====== 交互 ======
  const reload = useCallback(
    (next: MarketplaceFilter) => {
      setFilter(next);
      loadFeed(1, next);
    },
    [loadFeed],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadHeaderSections(), loadFeed(1, filter)]);
    setRefreshing(false);
  };

  const onEndReached = () => {
    if (!loading && hasMore && featuredItems.length > 0) {
      loadFeed(page + 1, filter);
    }
  };

  // 把 chip id 映射到 MarketplaceChipSheet 支持的 key；返回 null 表示
  // 该 chip 不属于「快捷单项」（即「全部」或「筛选」）。
  const chipIdToChipKey = (
    chipId: QuickChip["id"],
  ): ChipFilterKey | null => {
    switch (chipId) {
      case "categoryId":
        return "category";
      case "size":
        return "size";
      case "priceMinCents":
        return "price";
      case "condition":
        return "condition";
      default:
        return null;
    }
  };

  const handleChipPress = (chipId: QuickChip["id"]) => {
    if (chipId === "all") {
      reload({ sort: "featured" });
      return;
    }
    if (chipId === "filter") {
      setFilterSheetVisible(true);
      return;
    }
    const key = chipIdToChipKey(chipId);
    if (key) {
      setChipSheetKey(key);
    } else {
      // 兜底：未知 chip 走完整 sheet
      setFilterSheetVisible(true);
    }
  };

  const handleBrandPress = (brand: PopularBrand) => {
    reload({
      sort: "featured",
      brand: brand.name,
    });
  };

  const handleProductPress = (product: StoreProduct) =>
    navigation.navigate("StoreProductDetail", { productId: product.id });

  const handleBrandMorePress = () => {
    navigation.navigate("Main", { screen: "Archive" });
  };

  // ====== 渲染：filter chips ======
  const renderChipBar = () => (
    <HStack style={styles.chipBar} alignItems="center">
      {chips.map((item) => {
        const isAll = item.id === "all";
        const isFilter = item.id === "filter";
        const isActiveChip = isAll
          ? !hasActiveFilter
          : item.id === "priceMinCents"
            ? filter.priceMinCents != null || filter.priceMaxCents != null
            : (filter as any)[item.id] != null;
        return (
          <TouchableOpacity
            key={item.id}
            style={styles.chip}
            onPress={() => handleChipPress(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.chipContent}>
              <Text
                style={[
                  styles.chipText,
                  isActiveChip && styles.chipTextActive,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              {item.caret ? (
                <Ionicons
                  name="chevron-down"
                  size={8}
                  color={
                    isActiveChip ? theme.colors.text : theme.colors.gray300
                  }
                  style={{ marginLeft: 1 }}
                />
              ) : null}
              {isFilter ? (
                <Ionicons
                  name="options-outline"
                  size={10}
                  color={
                    isActiveChip ? theme.colors.text : theme.colors.gray300
                  }
                  style={{ marginLeft: 1 }}
                />
              ) : null}
              {isActiveChip ? <View style={styles.chipUnderline} /> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </HStack>
  );

  // ====== 渲染：热门品牌 ======
  const renderPopularBrands = () => (
    <VStack style={styles.section} space="sm">
      <HStack alignItems="center" style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          {t("trading.marketplace.popularBrandsTitle")}
        </Text>
      </HStack>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.brandsRow}
        data={popularBrands}
        keyExtractor={(b, i) => `brand_${b.name}_${i}`}
        renderItem={({ item }) => {
          const isActiveBrand = filter.brand === item.name;
          return (
            <Pressable
              style={styles.brandItem}
              onPress={() => handleBrandPress(item)}
            >
              <View
                style={[
                  styles.brandAvatarWrap,
                  isActiveBrand && styles.brandAvatarActive,
                ]}
              >
                {item.imageUrl ? (
                  <OptimizedImage
                    uri={item.imageUrl}
                    style={styles.brandAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={styles.brandAvatarFallback}>
                    {item.name?.[0]?.toUpperCase() ?? "?"}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.brandName,
                  isActiveBrand && styles.brandNameActive,
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Pressable
            style={styles.brandItem}
            onPress={handleBrandMorePress}
          >
            <View style={[styles.brandAvatarWrap, styles.brandAvatarMore]}>
              <Ionicons
                name="chevron-down"
                size={20}
                color={theme.colors.text}
              />
            </View>
            <Text style={styles.brandName} numberOfLines={1}>
              {t("trading.marketplace.brandMore")}
            </Text>
          </Pressable>
        }
      />
    </VStack>
  );

  // ====== 渲染：最新上架 ======
  const renderLatestArrivals = () => (
    <VStack style={styles.section} space="sm">
      <HStack alignItems="center" style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          {t("trading.marketplace.latestArrivalsTitle")}
        </Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => navigation.navigate("Marketplace")}>
          <Text style={styles.viewAll}>
            {t("trading.marketplace.viewAll")}
          </Text>
        </TouchableOpacity>
      </HStack>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.latestRow}
        data={latestItems}
        keyExtractor={(p) => `latest_${p.id}`}
        renderItem={({ item }) => (
          <Pressable
            style={styles.latestCard}
            onPress={() => handleProductPress(item)}
          >
            <View style={styles.latestImageWrap}>
              {item.images?.[0] ? (
                <OptimizedImage
                  uri={item.images[0]}
                  style={styles.latestImage}
                />
              ) : (
                <Box style={[styles.latestImage, styles.imgEmpty]} />
              )}
            </View>
            <Text style={styles.latestBrand} numberOfLines={1}>
              {item.brand ?? "—"}
            </Text>
            <Text style={styles.latestTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.latestPrice} numberOfLines={1}>
              {formatMarketplacePrice(item.priceCents, item.currency)}
            </Text>
            <Text style={styles.latestTime} numberOfLines={1}>
              {formatRelativeTime(item.publishedAt ?? item.createdAt, t)}
            </Text>
          </Pressable>
        )}
      />
    </VStack>
  );

  // ====== 渲染：精选推荐 卡片 ======
  const renderFeaturedCard = ({
    item,
    index,
  }: {
    item: StoreProduct;
    index: number;
  }) => {
    const isRightCol = index % 2 === 1;
    return (
      <Pressable
        style={[
          styles.featuredCard,
          {
            marginLeft: isRightCol ? FEATURED_GUTTER / 2 : 0,
            marginRight: isRightCol ? 0 : FEATURED_GUTTER / 2,
          },
        ]}
        onPress={() => handleProductPress(item)}
      >
        <View style={styles.featuredImgWrap}>
          {item.images?.[0] ? (
            <OptimizedImage uri={item.images[0]} style={styles.featuredImg} />
          ) : (
            <Box style={[styles.featuredImg, styles.imgEmpty]} />
          )}
          <TouchableOpacity style={styles.heartBadge}>
            <Ionicons
              name={item.favoritedByMe ? "heart" : "heart-outline"}
              size={18}
              color={
                item.favoritedByMe ? theme.colors.error : theme.colors.text
              }
            />
          </TouchableOpacity>
        </View>
        <VStack style={styles.featuredMeta} space="xs">
          <Text style={styles.featuredBrand} numberOfLines={1}>
            {item.brand ?? "—"}
          </Text>
          <Text style={styles.featuredTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {/* 卖家行：暂时用 sellerKind 图标 + brand 首字母作为伪头像，
              真实头像/用户名需后端 JOIN 后再补（PRD 模块二 v2）。 */}
          <HStack alignItems="center" space="xs">
            <View style={styles.sellerDot}>
              <Text style={styles.sellerDotText}>
                {(item.brand?.[0] ?? "?").toUpperCase()}
              </Text>
            </View>
            <Text style={styles.featuredSeller} numberOfLines={1}>
              {item.sellerKind === "merchant"
                ? t("trading.marketplace.sellerMerchant")
                : t("trading.marketplace.sellerIndividual")}
            </Text>
          </HStack>
          <HStack alignItems="center">
            <Text style={styles.featuredPrice}>
              {formatMarketplacePrice(item.priceCents, item.currency)}
            </Text>
            <View style={{ flex: 1 }} />
            {item.favoriteCount > 0 ? (
              <HStack alignItems="center" space="xs">
                <Ionicons name="heart" size={12} color={theme.colors.error} />
                <Text style={styles.featuredFav}>{item.favoriteCount}</Text>
              </HStack>
            ) : null}
          </HStack>
        </VStack>
      </Pressable>
    );
  };

  // ====== ListHeader：当无 filter 时显示 brands + latest + featured 标题 ======
  const ListHeader = () => {
    if (hasActiveFilter) {
      return null;
    }
    return (
      <VStack>
        {popularBrands.length > 0 ? renderPopularBrands() : null}
        {latestItems.length > 0 ? renderLatestArrivals() : null}
        <HStack
          alignItems="center"
          style={[styles.sectionHeaderRow, styles.featuredHeader]}
        >
          <Text style={styles.sectionTitle}>
            {t("trading.marketplace.featuredTitle")}
          </Text>
        </HStack>
      </VStack>
    );
  };

  return (
    <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
      {renderChipBar()}

      <FlatList
        data={featuredItems}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        renderItem={renderFeaturedCard}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.column}
        ListHeaderComponent={ListHeader}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        ListEmptyComponent={
          loading || headerLoading ? (
            <Box style={styles.center}>
              <ActivityIndicator color={theme.colors.accent} />
            </Box>
          ) : (
            <Box style={styles.center}>
              <Ionicons
                name="cube-outline"
                size={48}
                color={theme.colors.gray300}
              />
              <Text style={styles.empty}>
                {t("trading.marketplace.empty")}
              </Text>
            </Box>
          )
        }
        ListFooterComponent={
          loading && featuredItems.length > 0 ? (
            <Box style={{ padding: 16 }}>
              <ActivityIndicator color={theme.colors.gray300} />
            </Box>
          ) : null
        }
      />

      <MarketplaceFilterSheet
        visible={filterSheetVisible}
        initial={filter}
        onClose={() => setFilterSheetVisible(false)}
        onApply={(next) => {
          setFilterSheetVisible(false);
          reload(next);
        }}
      />

      <MarketplaceChipSheet
        visible={chipSheetKey !== null}
        chipKey={chipSheetKey}
        initial={filter}
        onClose={() => setChipSheetKey(null)}
        onApply={(patch) => {
          // 合并增量字段后整体 reload，保持 sort/brand 等其余筛选项不变
          reload({ ...filter, ...patch });
        }}
      />
    </View>
  );
};

// ---------------------------------------------------------------------------
// 辅助：相对时间格式化
// ---------------------------------------------------------------------------
function formatRelativeTime(
  iso: string | null | undefined,
  t: (key: string, opts?: any) => string,
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return t("trading.marketplace.timeJustNow");
  if (min < 60) return t("trading.marketplace.timeAgoMinute", { count: min });
  const hour = Math.floor(min / 60);
  if (hour < 24) return t("trading.marketplace.timeAgoHour", { count: hour });
  const day = Math.floor(hour / 24);
  return t("trading.marketplace.timeAgoDay", { count: day });
}

// ---------------------------------------------------------------------------
// 辅助：marketplace 用的紧凑价格格式（设计稿样式 "¥ 9,800"）
// ---------------------------------------------------------------------------
//   - 整数时不显示 .00；小数时保留 2 位
//   - 带千分位
//   - 与全局 formatPrice 区别：那个会一直追加 ".00"，对单品橱窗显示过于冗长
function formatMarketplacePrice(
  cents: number | null | undefined,
  currency: string = "CNY",
): string {
  if (cents == null || Number.isNaN(cents)) return "";
  const amount = cents / 100;
  const isWhole = Math.abs(amount - Math.round(amount)) < 1e-9;
  const formatted = isWhole
    ? amount.toLocaleString("zh-CN")
    : amount.toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  switch (currency) {
    case "USD":
      return `$ ${formatted}`;
    case "JPY":
      return `¥ ${Math.round(amount).toLocaleString()}`;
    default:
      return `¥ ${formatted}`;
  }
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    // ====== Chip bar ======
    chipBar: {
      flexGrow: 0,
      width: SCREEN_WIDTH,
      paddingVertical: 4,
      backgroundColor: t.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    chip: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 2,
    },
    chipContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      paddingBottom: 4,
    },
    chipText: {
      fontSize: 11,
      color: t.colors.gray300,
      letterSpacing: 0.1,
      flexShrink: 1,
    },
    chipTextActive: { color: t.colors.text, fontWeight: "700" },
    chipUnderline: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 1.5,
      borderRadius: 1,
      backgroundColor: t.colors.accent,
    },
    // ====== Sections shared ======
    section: { paddingTop: 8 },
    sectionHeaderRow: {
      paddingHorizontal: 0,
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: t.colors.text,
      letterSpacing: 0.2,
    },
    viewAll: { fontSize: 12, color: t.colors.textSecondary },
    featuredHeader: {
      marginTop: 4,
      marginBottom: 12,
    },

    // ====== 热门品牌 ======
    brandsRow: { paddingRight: PAGE_PADDING, gap: 8 },
    brandItem: {
      alignItems: "center",
      width: BRAND_AVATAR_SIZE + 8,
      flexShrink: 0,
    },
    brandAvatarWrap: {
      width: BRAND_AVATAR_SIZE,
      height: BRAND_AVATAR_SIZE,
      borderRadius: BRAND_AVATAR_RADIUS,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      flexShrink: 0,
    },
    brandAvatarActive: {
      borderColor: t.colors.accent,
    },
    brandAvatar: {
      width: BRAND_AVATAR_SIZE,
      height: BRAND_AVATAR_SIZE,
      borderRadius: BRAND_AVATAR_RADIUS,
      overflow: "hidden",
    },
    brandAvatarFallback: {
      // 品牌无封面图时的兜底：首字母（PlayfairDisplay-Bold 显得精致）
      fontFamily: "PlayfairDisplay-Bold",
      fontSize: 22,
      color: t.colors.text,
    },
    brandAvatarMore: {
      backgroundColor: t.colors.surface,
    },
    brandName: {
      marginTop: 8,
      fontSize: 10,
      color: t.colors.textSecondary,
      maxWidth: BRAND_AVATAR_SIZE + 8,
      textAlign: "center",
    },
    brandNameActive: {
      color: t.colors.text,
      fontWeight: "600",
    },
    // ====== 最新上架 ======
    latestRow: { paddingRight: PAGE_PADDING, gap: SECTION_GUTTER },
    latestCard: { width: LATEST_CARD_W },
    latestImageWrap: {
      width: LATEST_CARD_W,
      height: LATEST_CARD_IMG_H,
      borderRadius: 6,
      overflow: "hidden",
      backgroundColor: t.colors.skeleton,
      marginBottom: 8,
    },
    latestImage: { width: "100%", height: "100%" },
    imgEmpty: { backgroundColor: t.colors.skeleton },
    // 品牌名走 Playfair 体现"精品"质感（与设计稿一致）
    latestBrand: {
      fontFamily: "PlayfairDisplay-Bold",
      fontSize: 13,
      color: t.colors.text,
    },
    latestTitle: {
      fontFamily: "PlayfairDisplay-Regular",
      fontSize: 11,
      color: t.colors.textSecondary,
      marginTop: 2,
    },
    latestPrice: {
      fontSize: 13,
      fontWeight: "700",
      color: t.colors.text,
      marginTop: 4,
    },
    latestTime: {
      fontSize: 10,
      color: t.colors.gray300,
      marginTop: 2,
    },

    // ====== 精选推荐 ======
    listContent: {
      paddingHorizontal: PAGE_PADDING,
      paddingBottom: 32,
    },
    column: {
      justifyContent: "space-between",
      marginBottom: FEATURED_GUTTER,
    },
    featuredCard: {
      width: FEATURED_CARD_W,
      backgroundColor: t.colors.cardElevated,
      borderRadius: 10,
      overflow: "hidden",
    },
    featuredImgWrap: {
      width: FEATURED_CARD_W,
      height: FEATURED_CARD_IMG_H,
      backgroundColor: t.colors.skeleton,
    },
    featuredImg: { width: "100%", height: "100%" },
    heartBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: t.colors.cardElevated,
      alignItems: "center",
      justifyContent: "center",
      // 轻微阴影让 heart 浮起，与暗色封面区分开
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    featuredMeta: { padding: 10 },
    featuredBrand: {
      fontFamily: "PlayfairDisplay-Bold",
      fontSize: 14,
      color: t.colors.text,
    },
    featuredTitle: {
      fontFamily: "PlayfairDisplay-Regular",
      fontSize: 12,
      color: t.colors.textSecondary,
    },
    sellerDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    sellerDotText: {
      fontSize: 9,
      fontWeight: "600",
      color: t.colors.text,
    },
    featuredSeller: { fontSize: 11, color: t.colors.gray300 },
    featuredPrice: {
      fontSize: 15,
      fontWeight: "700",
      color: t.colors.text,
    },
    featuredFav: { fontSize: 11, color: t.colors.gray300 },

    center: {
      paddingTop: 48,
      paddingBottom: 48,
      alignItems: "center",
      gap: 12,
      width: SCREEN_WIDTH,
      minHeight: SCREEN_HEIGHT * 0.35,
      justifyContent: "center",
    },
    empty: { color: t.colors.gray300, fontSize: 14 },
  });

export default TradingTabContent;
