/**
 * BuyerTabContent —— "买手店" Tab 的根组件。
 *
 * 职责分工：
 *   - 所有数据、选中态、收藏/关注态由 `useBuyerTabData` 管理；
 *   - 本组件负责把各小块 UI 按设计稿组合、把回调透传给 hook；
 *   - 产品点击 / Banner 点击 / 搜索 等导航行为通过 props 从
 *     DiscoverScreen 透传下来（那里握有 `navigation` 实例）；
 *   - 滚动事件仍经 `onScroll` 汇聚到 DiscoverHeader 的折叠动画，
 *     与 TabContent 保持一致，避免买手店 Tab 单独不折叠 Header 的割裂感。
 *
 * 为什么不走 `MasonryFlashList`：
 *   - 买手店 Tab 的内容是 "顶部多段固定头 + 单品网格"，网格行数有限
 *     （Mock 下固定 8 条；未来后端接入后也会是一页完整数据，不是无限下拉），
 *     FlatList(numColumns=2) 就够了，Masonry 带来的复杂度 / 估算开销
 *     在这里是反收益。
 */
import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  Image as RNImage,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Pressable, ScrollView, Text, VStack } from "../../../../components/ui";
import { theme } from "../../../../theme";
import { Alert } from "../../../../utils/Alert";
import { SCREEN_WIDTH } from "../../constants";
import { StoreSelector } from "./StoreSelector";
import { SearchBar } from "./SearchBar";
import { StoreProfileCard } from "./StoreProfileCard";
import { CategoryCards } from "./CategoryCards";
import { NewArrivalBanner } from "./NewArrivalBanner";
import { ProductCard } from "./ProductCard";
import { StorePostCard } from "./StorePostCard";
import { useBuyerTabData } from "./hooks/useBuyerTabData";
import { recordBannerClick } from "../../../../services/storeMerchantService";
import type { Post as ApiPost } from "../../../../services/postService";
import type { BuyerStoreProduct, StoreEntryCardView } from "./types";
import { PLAYFAIR } from "./playfair";

/**
 * 入口卡片派发到商品列表屏的参数。和 StoreProductListScreen 的 RouteParams
 * 保持一致（`mode` + 可选 `categoryId` / `initialSearchQuery`），让 Discover
 * 层只做 `navigate(name, params)` 的转发，不重新翻译业务语义。
 */
export interface OpenProductListPayload {
  storeId: string;
  storeName?: string;
  mode: "ALL" | "CLASSIFICATION" | "DISCOUNT" | "NEW_ARRIVAL";
  categoryId?: number | null;
}

export interface BuyerTabContentProps {
  /**
   * 当前 Tab 是否激活。传入后买手店数据才会懒加载 —— 与 forum / following
   * 两个 Tab 走 `loadTabData` 的语义对齐，避免在冷启动瞬间和推荐 Feed
   * 一起挤压同一批 HTTP 下载槽。
   */
  isActive: boolean;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onSearchPress: () => void;
  onStorePress: (storeId: string) => void;
  onProductPress: (product: BuyerStoreProduct) => void;
  /**
   * 店铺帖子（migration 055）卡片点击 → PostDetail. 由 DiscoverScreen
   * 透传 navigation, 避免本组件持有 navigation 实例。
   */
  onPostPress?: (postId: number) => void;
  /** 点击顶部横向选择条末尾的"查看全部"入口时触发。 */
  onOpenAllStores: () => void;
  /**
   * 入口卡片分流：Phase 4 起 `CLASSIFICATION` / `DISCOUNT` / `NEW_ARRIVAL`
   * 都走这一条回调；`EVENT` 暂无独立屏，当前仍落到 `onStorePress`。
   */
  onOpenProductList: (payload: OpenProductListPayload) => void;
}

/**
 * 2 列网格间距，设计稿列间距约 12，左右外边距 16。
 */
const GRID_HORIZONTAL_PADDING = 16;
const GRID_GAP = 12;

const BuyerTabContentImpl: React.FC<BuyerTabContentProps> = ({
  isActive,
  onScroll,
  onSearchPress,
  onStorePress,
  onProductPress,
  onPostPress,
  onOpenAllStores,
  onOpenProductList,
}) => {
  const { t } = useTranslation();
  const {
    stores,
    selectedStoreId,
    selectedStore,
    selectedProfile,
    entryCards,
    banner,
    products,
    storePosts,
    isStorePostsLoading,
    isFollowed,
    isLoading,
    isProductsLoading,
    isRefreshing,
    error,
    setSelectedStoreId,
    toggleFollow,
    toggleProductFavorite,
    favoritedProductIds,
    refresh,
    refreshSelectedStoreProducts,
  } = useBuyerTabData({ enabled: isActive });

  // 店铺内容 tab 切换 (migration 055): "products" | "posts"
  // 默认 "products"; 切换到不同 store 后保留用户上次选的 tab, 这样浏览
  // 多家店时不会被强制弹回 products. 但当一家店没有商品却有帖子时, 智能
  // 默认到 posts (避免空 tab); 详见下面 useEffect.
  const [contentTab, setContentTab] = useState<"products" | "posts">("products");
  const [contentTabUserSet, setContentTabUserSet] = useState(false);
  const handleContentTabChange = useCallback(
    (next: "products" | "posts") => {
      setContentTab(next);
      setContentTabUserSet(true);
    },
    [],
  );

  // 切店时如果当前店没商品但有帖子, 自动切到 posts; 同理反过来.
  // 用户手动切过 (contentTabUserSet=true) 后不再自动覆盖, 尊重用户选择.
  // 切到下一家店时重置 user-set 标志 — 不同店是不同上下文, 智能默认要重新生效.
  useEffect(() => {
    setContentTabUserSet(false);
  }, [selectedStoreId]);

  useEffect(() => {
    if (contentTabUserSet) return;
    if (isProductsLoading || isStorePostsLoading) return; // 等数据回来再决定, 避免抖动
    if (products.length === 0 && storePosts.length > 0) {
      setContentTab("posts");
    } else if (storePosts.length === 0 && products.length > 0) {
      setContentTab("products");
    }
  }, [
    contentTabUserSet,
    products.length,
    storePosts.length,
    isProductsLoading,
    isStorePostsLoading,
  ]);

  // 用户从 StoreProductDetail 改了 like / favorite / want 后回到 Discover，
  // 需要让卡片心形即时和后端同步。useFocusEffect 在 Discover 屏获得焦点时
  // 触发；isActive 守门避免别的 Discover 子 Tab（Forum/For You）借机刷新
  // 买手店数据。只刷新 products，不动 profile/cards/banners (轻量、高频)。
  useFocusEffect(
    useCallback(() => {
      if (!isActive) return;
      if (!selectedStoreId) return;
      refreshSelectedStoreProducts();
    }, [isActive, selectedStoreId, refreshSelectedStoreProducts])
  );

  // Phase 4 —— 入口卡片点击后按 cardType 真实分流到 StoreProductList。
  // EVENT 类型暂无独立屏（活动列表是 Phase 5+ 的事），仍回退到 StoreDetail；
  // 其它三种都走新 StoreProductList 屏，由它根据 mode + 可选 categoryId 渲染。
  const handleCategoryPress = useCallback(
    (card: StoreEntryCardView) => {
      if (!selectedStoreId) return;
      if (__DEV__) {
        const tag = card.isRemote ? "remote" : "mock";
        console.log(
          `[BuyerTab] entry card pressed [${tag}] type=${card.cardType}`
        );
      }
      const storeName = selectedStore?.name;
      switch (card.cardType) {
        case "CLASSIFICATION":
          onOpenProductList({
            storeId: selectedStoreId,
            storeName,
            mode: "CLASSIFICATION",
            categoryId: card.targetCategoryId ?? null,
          });
          return;
        case "DISCOUNT":
          onOpenProductList({
            storeId: selectedStoreId,
            storeName,
            mode: "DISCOUNT",
          });
          return;
        case "NEW_ARRIVAL":
          onOpenProductList({
            storeId: selectedStoreId,
            storeName,
            mode: "NEW_ARRIVAL",
          });
          return;
        case "EVENT":
          // 活动列表独立屏尚未落地，先继续走 StoreDetail。
          onStorePress(selectedStoreId);
          return;
        default:
          onStorePress(selectedStoreId);
      }
    },
    [selectedStoreId, selectedStore, onOpenProductList, onStorePress]
  );

  const handleStorePress = useCallback(() => {
    if (!selectedStoreId) return;
    onStorePress(selectedStoreId);
  }, [selectedStoreId, onStorePress]);

  const handleFollowToggle = useCallback(async () => {
    const willFollow = !isFollowed;
    const consumed = await toggleFollow();
    if (!consumed) {
      // 未登录 —— 全局 favorites store 不会动，提示用户登录。
      Alert.show(t("engagement.pleaseLogin"));
      return;
    }
    Alert.show(
      willFollow
        ? t("discover.buyerFollowSuccess")
        : t("discover.buyerUnfollowed")
    );
  }, [toggleFollow, isFollowed, t]);

  const handleMorePress = useCallback(() => {
    Alert.show(t("discover.buyerMoreComingSoon"));
  }, [t]);

  // 点击 Banner 时异步打埋点（失败静默），再落到店铺详情页。埋点走 fire-&-forget
  // 的原因：商家 banner 的点击/曝光统计是后端的业务指标，对前端用户体验来说
  // 不是阻塞路径；等待它返回会让导航感觉"卡一下"。
  const handleBannerPress = useCallback(() => {
    if (!selectedStore) return;
    if (banner?.bannerId) {
      recordBannerClick(banner.bannerId).catch((err) => {
        if (__DEV__) {
          console.warn("[BuyerTab] recordBannerClick failed:", err);
        }
      });
    }
    onStorePress(selectedStore.id);
  }, [selectedStore, onStorePress, banner]);

  const handleProductPress = useCallback(
    (productId: string) => {
      const product = products.find((item) => item.id === productId);
      if (!product) return;
      onProductPress(product);
    },
    [products, onProductPress]
  );

  const handleProductFavorite = useCallback(
    (productId: string) => {
      toggleProductFavorite(productId);
    },
    [toggleProductFavorite]
  );

  // 店铺帖子卡片点击 → PostDetail. 没传 onPostPress 兜底跳到 StoreDetail
  // (用户至少能看到帖子所在的店铺), 比静默无响应好.
  const handlePostPress = useCallback(
    (postId: number) => {
      if (onPostPress) {
        onPostPress(postId);
      } else if (selectedStoreId) {
        onStorePress(selectedStoreId);
      }
    },
    [onPostPress, onStorePress, selectedStoreId]
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={refresh}
        colors={[theme.colors.accent]}
        tintColor={theme.colors.accent}
      />
    ),
    [isRefreshing, refresh]
  );

  // ---------------------- 首屏 loading / error / 空态 ---------------------
  // 懒加载 idle：Tab 尚未被激活过就占位一个透明空白，避免暂时的"没有数据"
  // 提示误导用户。激活态下一帧就会切换到 loading → 正常渲染。
  if (!isActive && stores.length === 0 && !isLoading && !error) {
    return <Box style={styles.root} />;
  }

  if (isLoading && stores.length === 0) {
    return (
      <Box style={styles.center}>
        <RNImage
          source={require("../../../../../assets/gif/profile-loading.gif")}
          style={styles.loadingGif}
          resizeMode="contain"
        />
      </Box>
    );
  }

  if (error && stores.length === 0) {
    return (
      <Box style={styles.centerPadded}>
        <Ionicons name="cloud-offline-outline" size={40} color={theme.colors.gray300} />
        <Text fontSize="$md" fontWeight="$semibold" color="$black" mt="$sm" style={styles.errorTitle}>
          {t("discover.buyerLoadFailed")}
        </Text>
        <Text fontSize="$xs" color="$gray300" mt="$xs" textAlign="center" style={styles.errorDetail}>
          {error}
        </Text>
        <Pressable onPress={refresh} px="$lg" py="$sm" mt="$md" bg="$black" rounded="$md">
          <Text color="$white" fontWeight="$semibold" fontSize="$sm" style={styles.errorRetryLabel}>
            {t("discover.buyerTapRetry")}
          </Text>
        </Pressable>
      </Box>
    );
  }

  // ---------------------- 主体内容（整屏单 ScrollView） ---------------------
  //
  // 这里故意用 ScrollView 而不是 FlatList。买手店 Tab 的内容几乎全是
  // 固定头 + 最多 8 条单品（mock）；未来后端接入也是一页数据，没有
  // 无限下拉。把单品渲染成普通 map 比 FlatList-in-ScrollView 更简单，
  // 也避免 FlashList 触发 "VirtualizedList should never be nested in
  // ScrollView" 警告。
  return (
    <Box style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={32}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        <StoreSelector
          stores={stores}
          selectedStoreId={selectedStoreId}
          onSelect={setSelectedStoreId}
          onOpenAll={onOpenAllStores}
          isLoading={isLoading}
        />

        {selectedProfile && (
          <StoreProfileCard
            profile={selectedProfile}
            postsCount={storePosts.length}
            isFollowed={isFollowed}
            onFollowToggle={handleFollowToggle}
            onDetailPress={handleStorePress}
            onMorePress={handleMorePress}
          />
        )}

        <CategoryCards cards={entryCards} onPress={handleCategoryPress} />

        {banner && <NewArrivalBanner banner={banner} onPress={handleBannerPress} />}

        {/* 店铺内容 tab 切换条 (migration 055) —— Products / Posts.
            视觉风格: 类似 StoreDetailScreen, 选中态用黑色加粗 + 数量徽章.
            两个 tab 始终都显示, 即使一边数据为 0, 让用户感知"这家店有/没有
            帖子"也是信息; 选中空 tab 时下面走空态文案. */}
        <ContentTabBar
          activeTab={contentTab}
          onChange={handleContentTabChange}
          productsCount={products.length}
          postsCount={storePosts.length}
        />

        {contentTab === "products" ? (
          <ProductGrid
            products={products}
            storeName={selectedStore?.name ?? ""}
            favoritedIds={favoritedProductIds}
            isLoading={isProductsLoading}
            onProductPress={handleProductPress}
            onFavoriteToggle={handleProductFavorite}
          />
        ) : (
          <PostGrid
            posts={storePosts}
            isLoading={isStorePostsLoading}
            onPostPress={handlePostPress}
          />
        )}
      </ScrollView>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// ContentTabBar —— Products / Posts 二选一切换条
// ---------------------------------------------------------------------------
// 复刻 StoreDetailScreen 的 tab 视觉规范 (大写字母 + 数字徽章), 让用户在
// Discover 和 StoreDetail 两个上下文里看到同一种交互模式.
//
// 使用 letterSpacing + 大写排版而不是常见 Pill 样式, 是和 BuyerTab 整体的
// "杂志感"基调对齐 (店主页 / 入口卡片都是大写 sans).

interface ContentTabBarProps {
  activeTab: "products" | "posts";
  onChange: (next: "products" | "posts") => void;
  productsCount: number;
  postsCount: number;
}

const ContentTabBarImpl: React.FC<ContentTabBarProps> = ({
  activeTab,
  onChange,
  productsCount,
  postsCount,
}) => {
  const { t } = useTranslation();
  return (
    <HStack
      mx={GRID_HORIZONTAL_PADDING}
      mt="$md"
      mb="$sm"
      gap="$xl"
      alignItems="flex-end"
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor="$gray100"
    >
      <Pressable
        onPress={() => onChange("products")}
        style={tabStyles.tabHit}
      >
        <Text style={[tabStyles.label, activeTab === "products" && tabStyles.labelActive]}>
          {t("discover.buyerTabProducts").toUpperCase()}
          {productsCount > 0 ? ` · ${productsCount}` : ""}
        </Text>
        {activeTab === "products" && <Box style={tabStyles.activeBar} />}
      </Pressable>
      <Pressable
        onPress={() => onChange("posts")}
        style={tabStyles.tabHit}
      >
        <Text style={[tabStyles.label, activeTab === "posts" && tabStyles.labelActive]}>
          {t("discover.buyerTabPosts").toUpperCase()}
          {postsCount > 0 ? ` · ${postsCount}` : ""}
        </Text>
        {activeTab === "posts" && <Box style={tabStyles.activeBar} />}
      </Pressable>
    </HStack>
  );
};

const ContentTabBar = React.memo(ContentTabBarImpl);

const tabStyles = StyleSheet.create({
  tabHit: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
  },
  label: {
    fontFamily: PLAYFAIR.medium,
    fontSize: 13,
    color: theme.colors.gray300,
    fontWeight: "500",
    letterSpacing: 1.2,
  },
  labelActive: {
    fontFamily: PLAYFAIR.bold,
    color: theme.colors.black,
    fontWeight: "700",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: theme.colors.black,
  },
});

// ---------------------------------------------------------------------------
// PostGrid —— 2 列店铺帖子网格 (migration 055)
// ---------------------------------------------------------------------------
// 和 ProductGrid 共用 GRID_HORIZONTAL_PADDING / GRID_GAP, 视觉对齐;
// 显式分行渲染避开 FlatList-in-ScrollView 警告 (同 ProductGrid 的注释).

interface PostGridProps {
  posts: ApiPost[];
  isLoading: boolean;
  onPostPress: (postId: number) => void;
}

const PostGridImpl: React.FC<PostGridProps> = ({ posts, isLoading, onPostPress }) => {
  const { t } = useTranslation();
  const rows = useMemo(() => {
    const grouped: ApiPost[][] = [];
    for (let i = 0; i < posts.length; i += 2) {
      grouped.push(posts.slice(i, i + 2));
    }
    return grouped;
  }, [posts]);

  if (isLoading) {
    return (
      <Box
        mx={GRID_HORIZONTAL_PADDING}
        mb="$lg"
        py="$lg"
        alignItems="center"
        justifyContent="center"
      >
        <RNImage
          source={require("../../../../../assets/gif/profile-loading.gif")}
          style={styles.gridLoadingGif}
          resizeMode="contain"
        />
      </Box>
    );
  }

  if (posts.length === 0) {
    return (
      <Box
        mx="$md"
        mb="$lg"
        py="$lg"
        my="$lg"
        alignItems="center"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$gray100"
        rounded="$lg"
        style={styles.emptyPanelContainer}
      >
        <Ionicons name="albums-outline" size={28} color={theme.colors.gray300} />
        <Text fontSize="$sm" fontWeight="$semibold" color="$black" mt="$sm" style={styles.emptyPanelTitle}>
          {t("discover.buyerNoStorePosts")}
        </Text>
        <Text fontSize="$xs" color="$gray300" mt="$xs" style={styles.emptyPanelHint}>
          {t("discover.buyerNoStorePostsHint")}
        </Text>
      </Box>
    );
  }

  return (
    <VStack mx={GRID_HORIZONTAL_PADDING} mb="$lg" gap={GRID_GAP}>
      {rows.map((row, rowIdx) => (
        <HStack key={`post-row-${rowIdx}`} gap={GRID_GAP}>
          {row.map((post) => (
            <Box key={post.id} flex={1}>
              <StorePostCard post={post} onPress={onPostPress} />
            </Box>
          ))}
          {row.length === 1 && <Box flex={1} />}
        </HStack>
      ))}
    </VStack>
  );
};

const PostGrid = React.memo(PostGridImpl);

interface ProductGridProps {
  products: BuyerStoreProduct[];
  storeName: string;
  favoritedIds: Set<string>;
  /**
   * true 时渲染 loading GIF，跳过空态/网格分支。
   * 由父组件根据 `useBuyerTabData.isProductsLoading` 推入 —— 切店铺
   * 期间 products 也是 []，没有这个 flag 区分会被空态 UI 误判成"无商品"。
   */
  isLoading: boolean;
  onProductPress: (productId: string) => void;
  onFavoriteToggle: (productId: string) => void;
}

/**
 * 2 列网格包装。整块做空态/计数处理，ProductCard 本身只管单元渲染。
 */
const ProductGridImpl: React.FC<ProductGridProps> = ({
  products,
  storeName,
  favoritedIds,
  isLoading,
  onProductPress,
  onFavoriteToggle,
}) => {
  const { t } = useTranslation();
  // 两列等宽，FlatList 在 ScrollView 里嵌套会报警，所以手写 2 列 row。
  const rows = useMemo(() => {
    const grouped: BuyerStoreProduct[][] = [];
    for (let i = 0; i < products.length; i += 2) {
      grouped.push(products.slice(i, i + 2));
    }
    return grouped;
  }, [products]);

  // Loading 优先于空态：切店铺时 products 暂时为 [] 但实际还没拉回来，
  // 直接走空态会让用户看到一闪而过的"暂无商品"——用 GIF 占位更稳。
  if (isLoading) {
    return (
      <Box
        mx={GRID_HORIZONTAL_PADDING}
        mb="$lg"
        py="$lg"
        alignItems="center"
        justifyContent="center"
      >
        <RNImage
          source={require("../../../../../assets/gif/profile-loading.gif")}
          style={styles.gridLoadingGif}
          resizeMode="contain"
        />
      </Box>
    );
  }

  if (products.length === 0) {
    return (
      <Box mx="$md" mb="$lg" py="$lg" my="$lg" alignItems="center" borderWidth={StyleSheet.hairlineWidth} borderColor="$gray100" rounded="$lg" style={styles.emptyPanelContainer}>
        <Ionicons name="bag-handle-outline" size={28} color={theme.colors.gray300} />
        <Text fontSize="$sm" fontWeight="$semibold" color="$black" mt="$sm" style={styles.emptyPanelTitle}>
          {t("discover.buyerNoProducts")}
        </Text>
        <Text fontSize="$xs" color="$gray300" mt="$xs" style={styles.emptyPanelHint}>
          {t("discover.buyerStayTuned")}
        </Text>
      </Box>
    );
  }

  return (
    <VStack mx={GRID_HORIZONTAL_PADDING} mb="$lg" gap={GRID_GAP}>
      {rows.map((row, rowIdx) => (
        <HStack key={`row-${rowIdx}`} gap={GRID_GAP}>
          {row.map((product) => (
            <Box key={product.id} flex={1}>
              <ProductCard
                product={product}
                storeName={storeName}
                isFavorited={favoritedIds.has(product.id)}
                onPress={onProductPress}
                onFavoriteToggle={onFavoriteToggle}
              />
            </Box>
          ))}
          {row.length === 1 && <Box flex={1} />}
        </HStack>
      ))}
    </VStack>
  );
};

const ProductGrid = React.memo(ProductGridImpl);

export const BuyerTabContent = React.memo(BuyerTabContentImpl);

const styles = StyleSheet.create({
  root: {
    width: SCREEN_WIDTH,
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 56,
  },
  center: {
    flex: 1,
    width: SCREEN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
  },
  centerPadded: {
    flex: 1,
    width: SCREEN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingGif: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  // ProductGrid 内嵌的 loading 动画 —— 比首屏 loadingGif 略小，
  // 避免占满屏幕、和顶部已经渲染好的 StoreSelector / ProfileCard 抢视线。
  gridLoadingGif: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.6,
  },
  errorTitle: {
    fontFamily: PLAYFAIR.medium,
  },
  errorDetail: {
    fontFamily: PLAYFAIR.regular,
  },
  errorRetryLabel: {
    fontFamily: PLAYFAIR.medium,
  },
  emptyPanelTitle: {
    fontFamily: PLAYFAIR.medium,
  },
  emptyPanelHint: {
    fontFamily: PLAYFAIR.regular,
  },
  emptyPanelContainer: {
    height: 300,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default BuyerTabContent;
