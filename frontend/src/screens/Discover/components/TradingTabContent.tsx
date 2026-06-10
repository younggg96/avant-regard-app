/**
 * TradingTabContent —— Discover「交易」子 Tab。
 *
 * 新版（PRD + 设计稿 p.4 二期 + 用户反馈 2026-05）结构：
 *   - 顶部 ChipBar：分类 / 尺码 / 价格 / 成色 / 筛选（最右带漏斗 icon + 已选数量 badge）。
 *     各 chip 激活态用一条短下划线表示；带 chevron-down 的 chip 按下时弹出单项快捷 Sheet。
 *   - 热门品牌 (`popularBrandsTitle`)：横向滚动圆形头像 + 品牌名（来自后端
 *     `GET /api/marketplace/popular-brands`，每天 UTC 日期为种子在前 30 名候选池
 *     里洗牌，每天首屏顺序不同；按「全部品牌」展开 `MarketplaceAllBrandsSheet`，
 *     展示平台所有已录入的品牌。
 *   - 大家都在看 (`popularPicksTitle`)：管理员后台手动策展的精选单品 4-up 横滑
 *     小卡片（来自 `GET /api/marketplace/curated`），点击进商品详情。
 *   - 精选推荐 (`featuredTitle`)：双列 4:5 瀑布流，按 sort=featured 拉取，
 *     按「信息完整度」(completeness_score) 倒序展示——和主页推荐贴的
 *     A→B→C→D 思路一致：图片齐全 / 5 视角图 / 描述充足的单品稳定排前面。
 *     支持上拉分页。每张卡含 favorite heart 角标 + 收藏计数。
 *
 * 设计规范：所有圆角统一 4pt；颜色全部走 theme（兼容 DarkTheme / LightTheme）；
 * 文案走 i18n。
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
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, HStack, Pressable, Text, VStack, AnimatedChip, chipRowStyle } from "../../../components/ui";
import { OptimizedImage } from "../../../components/ui/OptimizedImage";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { resolveAvatarUrl } from "../../../utils/avatarUtils";
import {
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";
import {
  getCuratedProducts,
  getPopularBrands,
  searchMarketplace,
  type MarketplaceFilter,
  type PlatformBrand,
  type PopularBrand,
  type StoreProduct,
} from "../../../services/storeProductService";
import MarketplaceFilterSheet from "../../Marketplace/MarketplaceFilterSheet";
import MarketplaceChipSheet, {
  type ChipFilterKey,
} from "../../Marketplace/MarketplaceChipSheet";
import MarketplaceAllBrandsSheet from "../../Marketplace/MarketplaceAllBrandsSheet";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../constants";
import { useFormatPrice } from "../../../utils/currency";

// ====== 卡片尺寸 ======
// 设计稿（PDF p.4 + 用户反馈 2026-05）参考点：
//   - 大家都在看横滑卡片：4 张一屏，正方形主图，与品牌头像下面的间距 12pt
//   - 热门品牌头像：6 个一屏，圆形 48pt
//   - 精选推荐：2 列瀑布流，主图比例 4:5
//   - 圆角统一 4pt（CARD_RADIUS）：与 marketplace / discover 二期规范对齐。
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
const CARD_RADIUS = 4;

// ====== Chip 配置 ======
interface QuickChip {
  id: keyof MarketplaceFilter | "filter";
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
  // 用户偏好币种格式化器（整数 → 千分位无小数；带小数 → 固定 2 位）。
  // 沿用本组件原本的"紧凑格式"语义，所以 trimZeroFraction: true。
  const formatPrice = useFormatPrice();
  const formatMarketplacePrice = useCallback(
    (cents: number | null | undefined, currency?: string | null) =>
      formatPrice(cents, currency, { trimZeroFraction: true }),
    [formatPrice]
  );

  // ====== State ======
  const [filter, setFilter] = useState<MarketplaceFilter>({ sort: "featured" });
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  // 单字段快捷弹窗（点击分类 / 尺码 / 价格 / 成色 chip 时弹出，只编辑该字段）
  const [chipSheetKey, setChipSheetKey] = useState<ChipFilterKey | null>(null);
  // 「热门品牌 → 更多」展开模态框：展示平台所有已录入品牌
  const [allBrandsSheetVisible, setAllBrandsSheetVisible] = useState(false);

  const [popularBrands, setPopularBrands] = useState<PopularBrand[]>([]);
  // 「大家都在看」管理员策展单品列表（替代旧版「最新上架」段）
  const [curatedItems, setCuratedItems] = useState<StoreProduct[]>([]);
  const [featuredItems, setFeaturedItems] = useState<StoreProduct[]>([]);

  const [headerLoading, setHeaderLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const hasLoadedRef = useRef(false);

  // ====== 计算 ======
  const activeFilterCount = useMemo(() => {
    let count = 0;
    const brands = filter.brands?.length || (filter.brand ? 1 : 0);
    const cats =
      (filter.categoryKinds?.length ?? 0) +
      (filter.categoryIds?.length ?? 0) +
      (filter.categoryId != null ? 1 : 0);
    const sizes = filter.sizes?.length || (filter.size ? 1 : 0);
    const colors = filter.colors?.length || (filter.color ? 1 : 0);
    const conds = filter.conditions?.length || (filter.condition ? 1 : 0);
    if (brands) count += brands;
    if (cats) count += cats;
    if (sizes) count += sizes;
    if (colors) count += colors;
    if (conds) count += conds;
    if (filter.sellerKind) count++;
    if (filter.priceMinCents != null || filter.priceMaxCents != null) count++;
    return count;
  }, [filter]);
  const hasActiveFilter = activeFilterCount > 0;

  const chips: QuickChip[] = useMemo(
    () => [
      { id: "brand", label: t("trading.marketplace.chipBrand"), caret: true },
      { id: "categoryId", label: t("trading.marketplace.chipCategory"), caret: true },
      { id: "size", label: t("trading.marketplace.chipSize"), caret: true },
      { id: "priceMinCents", label: t("trading.marketplace.chipPrice"), caret: true },
      { id: "condition", label: t("trading.marketplace.chipCondition"), caret: true },
      { id: "filter", label: t("trading.marketplace.chipFilter") },
    ],
    [t],
  );

  // ====== 数据加载 ======
  // - getPopularBrands: 默认 daily-rotate，每天 UTC 日期为种子洗牌；多次刷新当天顺序一致
  // - getCuratedProducts: 「大家都在看」管理员后台手动策展，无策展返回空数组
  const loadHeaderSections = useCallback(async () => {
    setHeaderLoading(true);
    try {
      const [brandsRes, curatedRes] = await Promise.all([
        getPopularBrands(5).catch(() => [] as PopularBrand[]),
        getCuratedProducts(10).catch(() => [] as StoreProduct[]),
      ]);
      setPopularBrands(brandsRes);
      setCuratedItems(curatedRes);
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

  // 把 chip id 映射到 MarketplaceChipSheet 支持的 key；返回 null 表示走全屏筛选 Sheet。
  const chipIdToChipKey = (
    chipId: QuickChip["id"],
  ): ChipFilterKey | null => {
    switch (chipId) {
      case "brand":
        return "brand";
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
    (navigation as any).navigate("BrandDetail", {
      name: brand.name,
      initialTab: "onsale",
    });
  };

  const handleProductPress = (product: StoreProduct) =>
    navigation.navigate("StoreProductDetail", { productId: product.id });

  // 点击卡片 footer 的卖家区域：跳到卖家个人主页（与帖子卡片点作者一致）。
  // merchant 卖家在列表里拿不到 user_id，此时 Pressable 处于 disabled，点击落到整卡。
  const handleSellerPress = (product: StoreProduct) => {
    if (!product.sellerUserId) return;
    (navigation as any).navigate("UserProfile", { userId: product.sellerUserId });
  };

  const handleBrandMorePress = () => {
    setAllBrandsSheetVisible(true);
  };

  // 「全部品牌」模态框选中一个品牌：关闭 sheet → 跳转品牌 archive 在售 tab
  const handleAllBrandsSelect = (brand: PlatformBrand) => {
    setAllBrandsSheetVisible(false);
    (navigation as any).navigate("BrandDetail", {
      name: brand.name,
      initialTab: "onsale",
    });
  };

  // ====== 渲染：filter chips ======
  const renderChipBar = () => (
    <View style={styles.chipBar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipBarContent}
      >
        <View style={chipRowStyle}>
          {chips.map((item) => {
            const isFilter = item.id === "filter";
            const chipIsActive = (id: typeof item.id): boolean => {
              if (id === "brand") {
                return (filter.brands?.length ?? 0) > 0 || !!filter.brand;
              }
              if (id === "priceMinCents") {
                return filter.priceMinCents != null || filter.priceMaxCents != null;
              }
              if (id === "categoryId") {
                return (
                  (filter.categoryKinds?.length ?? 0) > 0 ||
                  (filter.categoryIds?.length ?? 0) > 0 ||
                  filter.categoryId != null
                );
              }
              if (id === "size") {
                return (filter.sizes?.length ?? 0) > 0 || !!filter.size;
              }
              if (id === "condition") {
                return (filter.conditions?.length ?? 0) > 0 || !!filter.condition;
              }
              return !isFilter && (filter as any)[id] != null;
            };
            const isActiveChip = chipIsActive(item.id);
            return (
              <AnimatedChip
                key={item.id}
                label={item.label}
                isActive={isActiveChip}
                borderless
                size="md"
                onPress={() => handleChipPress(item.id)}
                count={
                  isFilter && activeFilterCount > 0 ? activeFilterCount : undefined
                }
                accessory={
                  item.caret ? (
                    <Ionicons
                      name="chevron-down"
                      size={8}
                      color={
                        isActiveChip ? theme.colors.text : theme.colors.gray300
                      }
                    />
                  ) : isFilter ? (
                    <Ionicons
                      name="options-outline"
                      size={10}
                      color={theme.colors.gray300}
                    />
                  ) : undefined
                }
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
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
              {t("trading.marketplace.allBrandsTitle")}
            </Text>
          </Pressable>
        }
      />
    </VStack>
  );

  // ====== 渲染：大家都在看（管理员策展） ======
  // 数据源：GET /api/marketplace/curated（is_curated=TRUE 的 active 单品，
  // 按 curated_sort_order asc 排序）。
  // 用户没有任何策展数据时整段隐藏，不显示空槽位。
  const renderPopularPicks = () => (
    <VStack style={styles.section} space="sm">
      <HStack alignItems="center" style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          {t("trading.marketplace.popularPicksTitle")}
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
        data={curatedItems}
        keyExtractor={(p) => `curated_${p.id}`}
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
        </View>
        <VStack style={styles.featuredMeta} space="xs">
          <Text style={styles.featuredBrand} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.featuredTitle} numberOfLines={1}>
            {buildCardSubtitle(item, t)}
          </Text>
          <Text style={styles.featuredPrice} numberOfLines={1}>
            {formatMarketplacePrice(item.priceCents, item.currency)}
          </Text>
          {/* 卡片底部：与帖子卡片同款 footer —— 左侧卖家头像 + 名字，右侧爱心计数 */}
          <HStack alignItems="center" style={styles.featuredFooter}>
            <Pressable
              style={styles.featuredSellerPressable}
              disabled={!item.sellerUserId}
              onPress={() => handleSellerPress(item)}
            >
              <HStack alignItems="center" space="xs">
                <UserAvatar
                  uri={resolveAvatarUrl(item.sellerAvatarUrl)}
                  name={item.sellerName ?? "?"}
                  size={20}
                />
                <Text style={styles.featuredSeller} numberOfLines={1}>
                  {item.sellerName ?? "—"}
                </Text>
              </HStack>
            </Pressable>
            {item.favoriteCount > 0 ? (
              <HStack alignItems="center" space="xs">
                <Ionicons name="heart" size={14} color={theme.colors.error} />
                <Text style={styles.featuredFav}>{item.favoriteCount}</Text>
              </HStack>
            ) : null}
          </HStack>
        </VStack>
      </Pressable>
    );
  };

  // ====== ListHeader：当无 filter 时显示 brands + 大家都在看 + featured 标题 ======
  const ListHeader = () => {
    if (hasActiveFilter) {
      return null;
    }
    return (
      <VStack>
        {popularBrands.length > 0 ? renderPopularBrands() : null}
        {curatedItems.length > 0 ? renderPopularPicks() : null}
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

      <MarketplaceAllBrandsSheet
        visible={allBrandsSheetVisible}
        onClose={() => setAllBrandsSheetVisible(false)}
        onSelectBrand={handleAllBrandsSelect}
      />
    </View>
  );
};

// ---------------------------------------------------------------------------
// 辅助：精选卡片副标题 —— 尺码 · 颜色 · N 人想要
// ---------------------------------------------------------------------------
// 主标题改为单品名后，副标题汇总该单品的关键属性。任一字段缺失时跳过，
// 全部缺失时回退到品牌名，避免出现空行。
function buildCardSubtitle(
  item: StoreProduct,
  t: (key: string, opts?: any) => string,
): string {
  const parts: string[] = [];
  if (item.size) parts.push(item.size);
  if (item.color) parts.push(item.color);
  if (item.wantCount > 0) {
    parts.push(t("trading.marketplace.wantCountLabel", { count: item.wantCount }));
  }
  if (parts.length === 0) return item.brand ?? "—";
  return parts.join(" · ");
}

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


const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    // ====== Chip bar ======
    chipBar: {
      backgroundColor: t.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    chipBarContent: {
      paddingHorizontal: PAGE_PADDING,
      paddingVertical: 8,
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
    // ====== 大家都在看（管理员策展，原「最新上架」段） ======
    latestRow: { paddingRight: PAGE_PADDING, gap: SECTION_GUTTER },
    latestCard: { width: LATEST_CARD_W },
    latestImageWrap: {
      width: LATEST_CARD_W,
      height: LATEST_CARD_IMG_H,
      borderRadius: CARD_RADIUS,
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
      borderRadius: CARD_RADIUS,
      overflow: "hidden",
    },
    featuredImgWrap: {
      width: FEATURED_CARD_W,
      height: FEATURED_CARD_IMG_H,
      backgroundColor: t.colors.skeleton,
    },
    featuredImg: { width: "100%", height: "100%" },
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
    featuredPrice: {
      fontSize: 15,
      fontWeight: "700",
      color: t.colors.text,
    },
    featuredFav: { fontSize: 12, color: t.colors.gray300 },
    // 帖子卡片同款 footer：左侧卖家（avatar 20 + 名字），右侧爱心计数
    featuredFooter: {
      marginTop: 4,
      justifyContent: "space-between",
    },
    featuredSellerPressable: {
      flex: 1,
      marginRight: 8,
    },
    featuredSeller: {
      flex: 1,
      fontSize: 12,
      fontWeight: "500",
      color: t.colors.textSecondary,
    },

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
