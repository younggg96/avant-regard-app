import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  RefreshControl,
  View,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  FlatList,
  ListRenderItemInfo,
  ActivityIndicator,
  InteractionManager,
  ViewToken,
} from "react-native";
import { MasonryFlashList, MasonryListRenderItemInfo } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, ScrollView, Pressable, VStack, HStack } from "../../../components/ui";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../../../theme";
import PostCard, { Post } from "../../../components/PostCard";
import ForumPostCard from "../../../components/ForumPostCard";
import BannerCarousel from "../../../components/BannerCarousel";
import { Banner } from "../../../services/bannerService";
import { CommunityListResponse } from "../../../services/communityService";
import { DisplayPost, TabType } from "../types";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../constants";
import { PopularCommunities } from "./PopularCommunities";
import {
  BannerCarouselSkeleton,
  PopularCommunitiesSkeleton,
  ForumTabSkeleton,
} from "./ForumSkeletons";
import { BrandSection } from "./BrandSection";
import { BuyerTabContent } from "./BuyerTab";
import type { BuyerStoreProduct } from "./BuyerTab/types";
import type { BuyerStore } from "../../../services/buyerStoreService";
import { clampAspectRatio } from "../../../utils/useMediaAspectRatio";
import { ImageSize } from "../../../utils/imageUtils";
import { prefetchImages } from "../../../utils/imagePrefetch";

type RenderablePost = Post & { renderKey?: string };


/**
 * 所有 Tab 都会用到的共用 props（滚动联动、激活标记）。
 */
interface TabContentBaseProps {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  isActive?: boolean;
}

/**
 * Posts 型 Tab (forum / recommend / following) 的 props。瀑布流 / 列表渲染
 * 需要的所有字段都在这里；买手店 Tab 用不到就不让它们进入类型系统。
 */
export interface PostsTabContentProps extends TabContentBaseProps {
  tab: "forum" | "recommend" | "following";
  tabPosts: DisplayPost[];
  banners: Banner[];
  communities: CommunityListResponse | null;
  error: string | null;
  refreshing: boolean;
  tabLoading: boolean;
  tabLoaded: boolean;
  /**
   * 论坛 Tab 头部独立 loading：仅 `tab === "forum"` 时才会读到。其它
   * Tab 也接收这两个字段是为了让上层 `TabContent` 调用点保持单一签名，
   * 渲染分支自己决定用不用。
   */
  bannersLoading?: boolean;
  communitiesLoading?: boolean;
  onRefresh: () => void;
  onPostPress: (post: Post) => void;
  onAuthorPress: (authorId: string) => void;
  onLike: (postId: string) => void;
  onBannerPress: (banner: Banner) => void;
  /**
   * 无限滚动：触底加载下一页（仅推荐 Tab 使用；不传则关闭）。
   */
  onEndReached?: () => void;
  /**
   * True while a `loadMore` network page is in flight. Drives the bottom
   * "加载中" footer so scrolling to the end never feels like the list is
   * stuck — the user sees a clear spinner during the request window.
   *
   * Only meaningful for tabs that paginate (recommend); others can leave
   * this undefined.
   */
  loadingMore?: boolean;
  /**
   * Incrementing signal from the parent to scroll this tab's list back to top.
   */
  scrollToTopSignal?: number;
}

/**
 * 买手店 Tab 透过 `<TabContent>` 调用时必须带上的 props。所有交互回调
 * 都在这里；`tabPosts` / `banners` / `onLike` 等 Posts 系字段对它都无意义，
 * 因此不在这个分支上出现。
 *
 * 命名用 `BuyerTabSlotProps` 避免和 `./BuyerTab/index.tsx` 里的
 * `BuyerTabContentProps`（那是子组件自己的 props 类型、不含 `tab` 判别
 * 字段）撞名。
 */
export interface BuyerTabSlotProps extends TabContentBaseProps {
  tab: "buyer";
  onSearchPress: () => void;
  onStorePress: (storeId: string) => void;
  onProductPress: (product: BuyerStoreProduct) => void;
  /**
   * 店铺帖子（migration 055）卡片点击 → PostDetail.
   * 留 optional, 让其它消费方不强制实现 (默认会回退到 onStorePress).
   */
  onPostPress?: (postId: number) => void;
  /** 点击顶部"查看全部"入口时触发；上游决定跳哪个屏。 */
  onOpenAllStores: () => void;
  /** 「在地图上查看」按钮点击 → 跳转买手店地图并聚焦该店。 */
  onViewStoreOnMap: (store: BuyerStore) => void;
  /**
   * Phase 4：入口卡片（分类 / 折扣 / 新品）→ 商品列表屏的分流回调。
   * 语义与 `BuyerTab/index.tsx` 的 `OpenProductListPayload` 一致。
   */
  onOpenProductList: (payload: {
    storeId: string;
    storeName?: string;
    mode: "ALL" | "CLASSIFICATION" | "DISCOUNT" | "NEW_ARRIVAL";
    categoryId?: number | null;
  }) => void;
}

/**
 * Discriminated union —— 通过 `tab` 字段让 TypeScript 在父组件调用处
 * 强制检查：tab="buyer" 时必须传买手店回调、Posts 系字段不接受；反之亦然。
 * 两种 Tab 共用同一个 `<TabContent />` 调用点，但内部实现完全解耦。
 */
type TabContentProps = PostsTabContentProps | BuyerTabSlotProps;

const GifLoading: React.FC = () => {
  const loadingStyles = useThemedStyles(makeLoadingStyles);
  return (
    <View style={loadingStyles.container}>
      <Image
        source={require("../../../../assets/gif/home-loading.gif")}
        style={loadingStyles.gif}
        resizeMode="contain"
      />
    </View>
  );
};

const makeLoadingStyles = (t: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: t.colors.background,
  },
  gif: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
});

/**
 * Bottom footer shown while a `loadMore` page is in flight.
 *
 * Small, non-intrusive spinner — it lives inside the scroll content so the
 * user sees "加载中" at the bottom as they scroll past the current page's
 * last row, replacing the previous "scroll silently freezes while waiting
 * for the next page" feel.
 *
 * Kept as a module-level stateless component so its identity is stable and
 * `ListFooterComponent` reference churn does not re-commit the list.
 */
const listFooterStyles = StyleSheet.create({
  wrapper: {
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
});

const LoadMoreFooterInner: React.FC = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={listFooterStyles.wrapper}>
      <ActivityIndicator size="small" color={theme.colors.gray400} />
      <Text fontSize="$sm" style={{ color: theme.colors.gray400 }}>
        {t("common.loading")}
      </Text>
    </View>
  );
};
const LoadMoreFooter: React.FC = React.memo(LoadMoreFooterInner);
LoadMoreFooter.displayName = "LoadMoreFooter";

// Memoize DisplayPost → Post adaption so that identical DisplayPost refs keep
// yielding identical Post refs. `useDiscoverData` already caches DisplayPost
// per feed id; without this second-stage cache the `tabPosts.map(convertToPost)`
// below would still mint new Post objects on every render, defeating the
// upstream work and making `PostCard` React.memo useless again.
//
// WeakMap so entries auto-GC once DisplayPost is evicted from the upstream
// cache — no manual invalidation required here.
const displayToPostCache = new WeakMap<DisplayPost, Post>();

const convertToPost = (post: DisplayPost): Post => {
  const cached = displayToPostCache.get(post);
  if (cached) return cached;
  const mapped: Post = {
    id: post.id,
    title: post.content.title,
    image: post.content.images[0] || "",
    auditStatus: post.auditStatus,
    author: {
      id: post.author.id,
      name: post.author.name,
      avatar: post.author.avatar,
    },
    content: {
      title: post.content.title,
      description: post.content.description,
      images: post.content.images,
      tags: post.content.tags,
      coverAspectRatio: post.content.coverAspectRatio,
    },
    engagement: {
      likes: post.engagement.likes,
      saves: post.engagement.saves,
      comments: post.engagement.comments,
      isLiked: post.engagement.isLiked,
      isSaved: post.engagement.isSaved,
    },
    likes: post.engagement.likes,
    isLiked: post.engagement.isLiked,
    timestamp: post.timestamp,
    communityId: post.communityId,
    communityName: post.communityName,
    storeId: post.storeId,
    storeName: post.storeName,
  };
  displayToPostCache.set(post, mapped);
  return mapped;
};

// Measured on a standard-size iPhone (SCREEN_WIDTH≈390, column width≈173):
//   image (aspectRatio 3/4) ≈ 230 + title 2 lines ≈ 36 + footer ≈ 36 + margin 12 ≈ 314.
// Slight over-estimate is better than under-estimate for MasonryFlashList
// recycling — prevents re-measure stutter on the first scroll.
const ESTIMATED_ITEM_SIZE = 320;

// Above-the-fold cards that should decode first so the user sees filled
// cells instead of gray placeholders on first paint. Double-column layout
// fills ~2–3 visible rows in that count plus one just-below-the-fold row,
// which matches the typical drawDistance below. Later cards drop to `low`
// so the downloader queue doesn't starve the fold on slower networks;
// expo-image promotes them once they actually scroll into view.
const ABOVE_FOLD_COUNT = 8;
// Keep exactly one screen of covers warm. Prefetching the whole page would
// compete with visible images and waste mobile data; 8 items cover roughly
// 3-4 rows in the two-column masonry.
const PREFETCH_AHEAD_COUNT = 8;

// Shared per-card height constants, used for `estimateCardHeight` /
// `overrideItemLayout` so MasonryFlashList can balance columns. Keep in sync
// with `masonryItemStyles.wrapper` and the fixed chrome of `PostCard`.
const CARD_WRAPPER_PADDING_H = 8; // wrapper paddingHorizontal × 2
const CARD_WRAPPER_MARGIN_B = 8; // wrapper marginBottom
const CARD_CHROME_HEIGHT = 80;   // title (2 lines ≈40) + author row (≈28) + vertical padding (≈12)
const COLUMN_WIDTH = SCREEN_WIDTH / 2;
const FALLBACK_RATIO = 3 / 4;

/**
 * Estimate a card's rendered height so column balancing is accurate.
 *
 * We prefer `post.content.coverAspectRatio` (backend-provided cover dims,
 * migration 037). Legacy posts with NULL dims fall back to the 3/4 portrait
 * default that `PostCard` uses as its placeholder ratio. Clamp bounds mirror
 * `PostCard` so the estimate matches the actual render.
 */
const estimateCardHeight = (post: Post): number => {
  const rawRatio = post.content?.coverAspectRatio ?? FALLBACK_RATIO;
  const ratio = clampAspectRatio(rawRatio);
  const imageWidth = COLUMN_WIDTH - CARD_WRAPPER_PADDING_H;
  const imageHeight = imageWidth / ratio;
  return imageHeight + CARD_CHROME_HEIGHT + CARD_WRAPPER_MARGIN_B;
};

/**
 * MasonryFlashList 在未开启优化时按「数据源下标 % 列数」拆列。旧的
 * `arrangeForNaiveMasonry` 先按高度贪心分两列再交错合并；一旦两列条数
 * 不一致，交错后的尾部元素会按 %2 落到错误的一列，出现一侧很长、另一侧
 * 大量留白的假象。改用官方 `optimizeItemArrangement` + `overrideItemLayout`
 *（按估算高度把每条放到当前更矮的一列），由库内与数据源顺序一致的逻辑
 * 分配列，避免手工交错与 %2 语义冲突。
 */
const MASONRY_COLUMNS = 2;
const MASONRY_DRAW_DISTANCE = Math.round(SCREEN_HEIGHT * 0.35);

// Only clones for *duplicate* ids (replay-mode looping). First occurrences
// pass through as-is so upstream reference stability is preserved — the
// old implementation spread every item unconditionally, minting a new object
// per card on every render even when nothing about that card had changed.
const withStableRenderKeys = (posts: Post[]): RenderablePost[] => {
  const seen = new Map<string, number>();
  const result: RenderablePost[] = new Array(posts.length);
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const occurrence = seen.get(post.id) ?? 0;
    seen.set(post.id, occurrence + 1);
    if (occurrence === 0) {
      result[i] = post as RenderablePost;
    } else {
      result[i] = { ...post, renderKey: `${post.id}-repeat-${occurrence}` };
    }
  }
  return result;
};

/**
 * Posts 型 Tab (forum / recommend / following) 的渲染实现。
 *
 * 这里集中所有 hooks 与 MasonryFlashList / FlatList 组装逻辑；买手店
 * Tab 由于数据模型完全不同，走独立的 `BuyerTabContent` 分支，不会进入
 * 这个函数——所以这里可以安全地把每一个 hook 放在函数顶层，符合
 * React `rules-of-hooks`。
 */
const PostsTabContentInner: React.FC<PostsTabContentProps> = ({
  tab,
  tabPosts,
  banners,
  communities,
  error,
  refreshing,
  tabLoading,
  tabLoaded,
  bannersLoading = false,
  communitiesLoading = false,
  onRefresh,
  onScroll,
  onPostPress,
  onAuthorPress,
  onLike,
  onBannerPress,
  onEndReached,
  loadingMore = false,
  scrollToTopSignal = 0,
}) => {
  const { t } = useTranslation();
  const flatListRef = useRef<FlatList<Post>>(null);
  const masonryListRef = useRef<any>(null);

  const currentPosts = useMemo(() => {
    if (!Array.isArray(tabPosts)) return [];
    const mapped = tabPosts.map(convertToPost);
    return withStableRenderKeys(mapped);
  }, [tabPosts]);

  const keyExtractor = useCallback(
    (item: RenderablePost) => item.renderKey ?? item.id,
    []
  );

  // ---------------------------------------------------------------------
  // 封面预取 —— 只把当前可见区域之后的一屏提前下到磁盘缓存。
  //
  // MasonryFlashList 的 drawDistance 只预渲染约 0.35 屏，用户快速下滑
  // 时超出这个窗口的卡片仍然要现场发起下载（表现为一片灰块）。不能
  // 一次预取整页：那会让二十多张低优先级图片与首屏争抢连接和蜂窝流量。
  //
  // 调度上挂在 `InteractionManager.runAfterInteractions` 之后：数据
  // append 的瞬间正是 masonry mount 30 张新卡片、JS 线程最忙的窗口，
  // 预取请求不该跟首屏解码抢资源。prefetchImages 内部按 URL 会话级
  // 去重，replay 循环同一批帖子时不会重复请求。
  //
  // 尺寸必须与 PostCard 实际显示的一致（FEED_CARD 640px WebP）——
  // URL 不同则缓存不共享，预取就白做了。
  // ---------------------------------------------------------------------
  const currentPostsRef = useRef(currentPosts);
  currentPostsRef.current = currentPosts;

  useEffect(() => {
    if (tab === "forum") return; // 论坛列表是小缩略图，windowing 已足够
    if (currentPosts.length <= ABOVE_FOLD_COUNT) return;

    const handle = InteractionManager.runAfterInteractions(() => {
      prefetchImages(
        currentPosts
          .slice(ABOVE_FOLD_COUNT, ABOVE_FOLD_COUNT + PREFETCH_AHEAD_COUNT)
          .map((post) => post.image),
        ImageSize.FEED_CARD
      );
    });
    return () => handle.cancel();
  }, [currentPosts, tab]);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      let maxVisibleIndex = -1;
      for (const token of viewableItems) {
        if (token.index != null && token.index > maxVisibleIndex) {
          maxVisibleIndex = token.index;
        }
      }
      if (maxVisibleIndex < 0) return;

      const posts = currentPostsRef.current;
      const start = maxVisibleIndex + 1;
      prefetchImages(
        posts
          .slice(start, start + PREFETCH_AHEAD_COUNT)
          .map((post) => post.image),
        ImageSize.FEED_CARD
      );
    },
    []
  );

  useEffect(() => {
    if (scrollToTopSignal <= 0) return;

    if (tab === "forum") {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      return;
    }

    masonryListRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  }, [scrollToTopSignal, tab]);

  const renderMasonryItem = useCallback(
    ({ item, index }: MasonryListRenderItemInfo<Post>) => {
      if (!item || !item.id || !item.author) return null;
      // Tiered image scheduling — the biggest lever against cold-start
      // "gray placeholder storm" on the recommend tab.
      //
      // Historical behaviour: every cover fetched with `priority="normal"`.
      // 26 first-page items × 2 (cover + avatar downgraded by `lazy`) =
      // a burst of 40+ concurrent image requests, all competing for the
      // same expo-image downloader slots and the system's ImageIO decode
      // queue while the masonry is mounting. The cards the user actually
      // sees first (top 2-3 rows, ~8 cards) got no preferential treatment
      // over cards 6 screens down.
      //
      // Fix: explicitly prioritise the above-the-fold window. `high` for
      // the first `ABOVE_FOLD_COUNT` items (decoded first), `low` for
      // everything else (decoded as they scroll into view — expo-image
      // promotes them automatically on mount). Same total bandwidth, but
      // the decoder pool spends its first ~200ms on cards the user is
      // actually looking at. PostCard's `React.memo` still bails out for
      // recycled cells because the priority for a given index is stable
      // as long as index is stable (masonry recycling preserves the
      // data-index → cell mapping on a per-dataset basis).
      const priority = index < ABOVE_FOLD_COUNT ? "high" : "low";
      // Plain View + StyleSheet avoids gluestack `sx` theme resolution on
      // every re-render, which adds up when Masonry mounts 30+ cards at once.
      return (
        <View style={masonryItemStyles.wrapper}>
          <PostCard
            post={item}
            onPress={onPostPress}
            onAuthorPress={onAuthorPress}
            onLike={onLike}
            // 640px WebP 覆盖两列卡片 @3x；实测样本由 61KB 降到 9.5KB。
            // URL 带缓存版本、OptimizedImage 禁止瞬态尺寸 downscale，避免
            // 历史版本的低清位图长期滞留在 SDImageCache。
            coverImageSize={ImageSize.FEED_CARD}
            coverImagePriority={priority}
            showCoverPlaceholder={false}
            coverImageTransition={0}
          />
        </View>
      );
    },
    [onPostPress, onAuthorPress, onLike]
  );

  const renderForumItem = useCallback(
    ({ item }: ListRenderItemInfo<Post>) => (
      <ForumPostCard
        post={item}
        onPress={onPostPress}
        onAuthorPress={onAuthorPress}
        onLike={onLike}
      />
    ),
    [onPostPress, onAuthorPress, onLike]
  );

  // Feed a precise per-item height to the inner column FlashLists so they
  // recycle/scroll smoothly. Required when `optimizeItemArrangement` is on:
  // MasonryFlashList uses these sizes to place each row on the shorter column.
  const overrideItemLayout = useCallback(
    (layout: { size?: number }, item: Post) => {
      layout.size = estimateCardHeight(item);
    },
    []
  );

  // -------------------------------------------------------------------------
  // onEndReached gate
  //
  // Why: MasonryFlashList emits a synthetic scroll on `onLoad` (see
  //   @shopify/flash-list/src/MasonryFlashList.tsx → onLoadForNestedLists),
  // and on every data append the nested column lists briefly report wrong
  // content heights while re-splitting. In both cases the outer FlashList's
  // "near end" heuristic can trip even when the user is sitting still at the
  // top — which we observed firing `onEndReached` 5× in ~2s, pulling 146
  // posts and thrashing layout into a blank screen.
  //
  // Fix (standard RN infinite-scroll pattern): require the user to actually
  // kick off a momentum scroll before `onEndReached` is allowed to invoke
  // `loadMore`. Re-arm on every momentum begin so legitimate continuous
  // scrolling still pages normally; disarm after each fire so a single
  // momentum gesture only pulls one page.
  // -------------------------------------------------------------------------
  const endReachedArmedRef = useRef(false);

  const handleMomentumScrollBegin = useCallback(() => {
    endReachedArmedRef.current = true;
  }, []);

  const handleEndReached = useCallback(() => {
    if (!onEndReached) return;
    if (!endReachedArmedRef.current) return;
    endReachedArmedRef.current = false;
    onEndReached();
  }, [onEndReached]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        colors={[theme.colors.accent]}
        tintColor={theme.colors.accent}
      />
    ),
    [refreshing, onRefresh]
  );

  // Stable footer slot: `undefined` means "don't mount footer at all" (avoids
  // the list reserving whitespace); a `<LoadMoreFooter />` element appears
  // only while a page is in flight. Using the module-level memoized
  // `LoadMoreFooter` keeps the reference identical across flips (null ↔ node)
  // so the internal FlashList doesn't re-measure the footer every append.
  const listFooter = useMemo(
    () => (loadingMore ? <LoadMoreFooter /> : null),
    [loadingMore]
  );

  const getEmptyStateText = () => {
    switch (tab) {
      case "forum":
        return { title: t("discover.noForumPosts"), subtitle: t("discover.noForumPostsHint") };
      case "recommend":
        return { title: t("discover.noRecommendContent"), subtitle: t("discover.noRecommendHint") };
      case "following":
        return { title: t("discover.noFollowingContent"), subtitle: t("discover.noFollowingHint") };
      default:
        return { title: t("common.empty"), subtitle: "" };
    }
  };

  if (tabLoading || !tabLoaded) {
    // 论坛 Tab 在 cache miss 路径走骨架屏：banner / 社区 / 帖子
    // 占位行同时显示，比起品牌 GIF 更贴近实际目标布局，避免「网络
    // 慢的时候用户盯着加载动画干等」的体感。其它 Tab（推荐 / 关注）
    // 仍保留 `home-loading.gif` 的品牌闪屏。
    if (tab === "forum") {
      return (
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <ForumTabSkeleton />
        </View>
      );
    }
    return (
      <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
        <GifLoading />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={refreshControl}
        >
          <VStack flex={1} justifyContent="center" alignItems="center" py="$2xl">
            <Ionicons name="cloud-offline-outline" size={48} color={theme.colors.gray400} />
            <Text fontSize="$lg" style={{ color: theme.colors.black }} fontWeight="$medium" mb="$sm" mt="$md" textAlign="center">
              {t("common.loadFailed")}
            </Text>
            <Text style={{ color: theme.colors.gray400 }} textAlign="center" lineHeight="$lg" mb="$md">
              {error}
            </Text>
            <Pressable onPress={onRefresh} px="$lg" py="$sm" style={{ backgroundColor: theme.colors.black }} rounded="$md">
              <Text style={{ color: theme.colors.white }} fontWeight="$medium">{t("discover.tapRetry")}</Text>
            </Pressable>
          </VStack>
        </ScrollView>
      </View>
    );
  }

  if (currentPosts.length === 0) {
    const emptyState = getEmptyStateText();
    return (
      <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={refreshControl}
        >
          <VStack flex={1} justifyContent="center" alignItems="center" py="$2xl">
            <Ionicons
              name={tab === "forum" ? "chatbubbles-outline" : "newspaper-outline"}
              size={48}
              color={theme.colors.gray400}
            />
            <Text fontSize="$lg" style={{ color: theme.colors.black }} fontWeight="$medium" mb="$sm" mt="$md" textAlign="center">
              {emptyState.title}
            </Text>
            <Text style={{ color: theme.colors.gray400 }} textAlign="center" lineHeight="$lg">
              {emptyState.subtitle}
            </Text>
          </VStack>
        </ScrollView>
      </View>
    );
  }

  // Forum tab — FlatList (single-column)
  if (tab === "forum") {
    // Banner / 热门社区在 forum Tab cache-hit 路径下是「帖子先到、
    // header 异步补」的节奏，所以即使帖子已经渲染、`tabLoaded.forum`
    // 翻 true 之后，header 仍然可能处于 `loading=true && data 空` 的
    // 中间态。两段三元条件分别处理：仍在加载 → 显示骨架；加载完毕
    // 且确实有数据 → 显示真实组件；加载完毕但数据为空 → 不渲染
    // （沿用原来的兜底，避免空 section 占位）。
    const forumHeader = (
      <>
        {bannersLoading && banners.length === 0 ? (
          <BannerCarouselSkeleton />
        ) : banners.length > 0 ? (
          <BannerCarousel banners={banners} onBannerPress={onBannerPress} />
        ) : null}
        {communitiesLoading && (!communities || communities.popular.length === 0) ? (
          <PopularCommunitiesSkeleton />
        ) : (
          <PopularCommunities communities={communities} />
        )}
      </>
    );

    return (
      <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={currentPosts}
          keyExtractor={keyExtractor}
          renderItem={renderForumItem}
          ListHeaderComponent={forumHeader}
          ListFooterComponent={listFooter}
          onScroll={onScroll}
          // 32ms (~30Hz) is enough to drive the header collapse/expand
          // animation and halves the JS-thread callback pressure during
          // scroll vs the default 16ms. The header direction-flip is the
          // only consumer of these events; reanimated runs the actual
          // height/opacity transition on the UI thread regardless.
          scrollEventThrottle={32}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={7}
          initialNumToRender={5}
        />
      </View>
    );
  }

  // Recommend / Following tab — MasonryFlashList (2-column waterfall)
  const masonryHeader = (
    <>
      {tab === "following" && <BrandSection />}
      {tab === "following" && currentPosts.length > 0 && (
        <HStack px="$md" pt={14} pb={10} gap={6} alignItems="center">
          <Text fontSize="$sm" fontWeight="$bold" style={{ color: theme.colors.gray400 }}>
            {t("discover.followingPosts")}
          </Text>
          <Text fontSize="$xs" fontWeight="$semibold" style={{ color: theme.colors.gray400 }}>
            {currentPosts.length}
          </Text>
        </HStack>
      )}
    </>
  );

  return (
    <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
      <MasonryFlashList
        ref={masonryListRef}
        data={currentPosts}
        numColumns={MASONRY_COLUMNS}
        optimizeItemArrangement
        keyExtractor={keyExtractor}
        renderItem={renderMasonryItem}
        estimatedItemSize={ESTIMATED_ITEM_SIZE}
        estimatedListSize={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
        drawDistance={MASONRY_DRAW_DISTANCE}
        overrideItemLayout={overrideItemLayout}
        onViewableItemsChanged={handleViewableItemsChanged}
        ListHeaderComponent={masonryHeader}
        ListFooterComponent={listFooter}
        onScroll={onScroll}
        // See FlatList branch: 32ms is enough for the header direction
        // detection and cuts the scroll-time JS callback rate in half,
        // which pairs well with the stable-reference work above so the
        // JS thread stays free for recycled-cell paint.
        scrollEventThrottle={32}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        onMomentumScrollBegin={handleMomentumScrollBegin}
      />
    </View>
  );
};

PostsTabContentInner.displayName = "PostsTabContent";

/**
 * Memoize the Posts Tab so unrelated DiscoverScreen state churn (unread-count
 * polling, focus refresh, current-user-info fetch, scroll-to-top signal for
 * *another* tab) does not re-execute the function body of all three tab
 * instances. With the callback-stability work upstream (stable `onLike`,
 * `onRefresh`, `onPostPress`, `onAuthorPress`, `onScroll`, `onEndReached`)
 * all shallow-equal props reliably land memo hits on those re-renders.
 */
const PostsTabContent = React.memo(PostsTabContentInner);

/**
 * `TabContent` —— Discover 页 4 个 Tab 的统一入口（dispatcher）。
 *
 * 为什么这里只做 dispatcher、不把所有逻辑塞进一个函数：
 *   - Posts 型 Tab 的实现里挂了十几个 hook（useRef / useMemo / useCallback /
 *     useEffect），而 "买手店" Tab 的数据模型与之毫无交集；
 *   - 把两套逻辑放进同一个函数，要么强行共享 hook（破坏 SRP），要么用
 *     `if (tab === "buyer") return ...` 提前 return 再调 hook —— 后者
 *     违反 React `rules-of-hooks` (hook 必须出现在每次 render 的同一顺序)；
 *   - 拆成两个子组件（PostsTabContent / BuyerTabContent）之后，dispatcher
 *     只负责 3 行路由逻辑，两个子组件各自在自己的函数体顶层调 hook，
 *     eslint + React 运行时双重意义上的干净。
 *
 * Discriminated union (`props.tab` 做判别字段) 让上游调用点在写
 * `<TabContent tab="buyer" .../>` 时，TS 会强制要求必须传买手店回调、
 * 同时不接受 `tabPosts` 等 Posts 系字段；反之 `tab="recommend"` 也不接受
 * `onSearchPress` 等买手店系字段。
 *
 * NOTE — 这个 dispatcher 故意命名成 `TabContentInner`：
 *   react-refresh/babel 会把"被 React.memo 包裹的那个函数" 视作本文件的
 *   "primary component"，并通过 `$RefreshReg$(TabContentInner, ...)` 在 HMR
 *   注册表里长期驻留这个识别符。如果我们历次重构时这个识别符变来变去
 *   （比如 `TabContentInner` → `TabContentDispatcher`），Fast Refresh 在
 *   iOS Hermes 下会因为旧 bundle 的注册表还指着老名字而抛
 *   `ReferenceError: Property 'TabContentInner' doesn't exist`。
 *
 *   对外导出名 `TabContent` 没动；displayName 也保留在这个内部函数上，
 *   而不要放到 `React.memo(...)` 的返回值上 —— `react-refresh/babel` ×
 *   `@babel/plugin-transform-typescript` 的 scope-tracker 交互会把加在
 *   memo 结果上的 displayName 错误擦除，在 iOS Hermes 下产生
 *   `ReferenceError: Property 'TabContent' doesn't exist`。
 */
const TabContentInner: React.FC<TabContentProps> = (props) => {
  if (props.tab === "buyer") {
    return (
      <BuyerTabContent
        isActive={props.isActive ?? false}
        onScroll={props.onScroll}
        onSearchPress={props.onSearchPress}
        onStorePress={props.onStorePress}
        onProductPress={props.onProductPress}
        onPostPress={props.onPostPress}
        onOpenAllStores={props.onOpenAllStores}
        onViewStoreOnMap={props.onViewStoreOnMap}
        onOpenProductList={props.onOpenProductList}
      />
    );
  }
  return <PostsTabContent {...props} />;
};

TabContentInner.displayName = "TabContent";

export const TabContent = React.memo(TabContentInner);

const masonryItemStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 4,
    marginBottom: 8, // 等价于原 gluestack mb="$sm"
  },
});
