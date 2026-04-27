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
} from "react-native";
import { MasonryFlashList, MasonryListRenderItemInfo } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, ScrollView, Pressable, VStack, HStack } from "../../../components/ui";
import { theme } from "../../../theme";
import PostCard, { Post } from "../../../components/PostCard";
import ForumPostCard from "../../../components/ForumPostCard";
import BannerCarousel from "../../../components/BannerCarousel";
import { Banner } from "../../../services/bannerService";
import { CommunityListResponse } from "../../../services/communityService";
import { DisplayPost, TabType } from "../types";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../constants";
import { PopularCommunities } from "./PopularCommunities";
import { BrandSection } from "./BrandSection";
import { clampAspectRatio } from "../../../utils/useMediaAspectRatio";
import { ImageSize } from "../../../utils/imageUtils";

type RenderablePost = Post & { renderKey?: string };


interface TabContentProps {
  tab: TabType;
  tabPosts: DisplayPost[];
  banners: Banner[];
  communities: CommunityListResponse | null;
  error: string | null;
  refreshing: boolean;
  tabLoading: boolean;
  tabLoaded: boolean;
  onRefresh: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onPostPress: (post: Post) => void;
  onAuthorPress: (authorId: string) => void;
  onLike: (postId: string) => void;
  onBannerPress: (banner: Banner) => void;
  isActive?: boolean;
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

const GifLoading: React.FC = () => (
  <View style={loadingStyles.container}>
    <Image
      source={require("../../../../assets/gif/home-loading.gif")}
      style={loadingStyles.gif}
      resizeMode="contain"
    />
  </View>
);

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.white,
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

const LoadMoreFooter: React.FC = React.memo(() => (
  <View style={listFooterStyles.wrapper}>
    <ActivityIndicator size="small" color={theme.colors.gray400} />
    <Text fontSize="$sm" color="$gray400">
      加载中...
    </Text>
  </View>
));
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
    image: post.content.images[0] || "https://picsum.photos/id/1/600/800",
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

// Shared per-card height constants, used both for (a) pre-balancing the
// feed (`arrangeForNaiveMasonry`) and (b) giving the inner column FlashLists
// precise item heights via `overrideItemLayout`. Keep in sync with
// `masonryItemStyles.wrapper` and the fixed chrome of `PostCard`
// (title 2 lines + author row + paddings).
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
 * Pre-arrange a post list so that the naïve `i % numColumns` masonry
 * distribution produces visually balanced columns.
 *
 * Why not `MasonryFlashList.optimizeItemArrangement`?
 *   That flag lets the list push items to the shortest column, but it also
 *   lets one column grow substantially more items than the other. The outer
 *   FlashList's `estimatedItemSize` is hard-coded to
 *   `dataSet[0].length × estimatedItemSize` (see
 *   `@shopify/flash-list/src/MasonryFlashList.tsx:176`) — it ignores our
 *   per-item `overrideItemLayout`. Skewed column counts therefore make the
 *   outer/inner layout estimates diverge, producing the "big gap on top,
 *   cards peeking at the bottom" rendering bug we hit in production.
 *
 * Strategy:
 *   Simulate a two-column greedy placement locally using each post's
 *   estimated height, then interleave the two columns back into the feed
 *   array — even indices go to the conceptual "left" column, odd to
 *   "right". The naïve `i % 2` split inside MasonryFlashList then lands
 *   every post on the column we already balanced it toward, guaranteeing
 *   `dataSet[0].length ≈ dataSet[1].length` and keeping column heights
 *   within one card's worth of each other.
 *
 * Ordering contract:
 *   Feed recommendation order is preserved within each column (items stay
 *   in their relative position among same-column peers). Adjacent pairs
 *   may swap left/right, which is acceptable for a visual feed.
 */
const MASONRY_COLUMNS = 2;
const MASONRY_DRAW_DISTANCE = Math.round(SCREEN_HEIGHT * 0.35);
const arrangeForNaiveMasonry = <T extends Post>(posts: T[]): T[] => {
  if (posts.length <= MASONRY_COLUMNS) return posts;

  const columns: T[][] = [[], []];
  const heights: number[] = [0, 0];

  for (const post of posts) {
    const h = estimateCardHeight(post);
    const target = heights[0] <= heights[1] ? 0 : 1;
    columns[target].push(post);
    heights[target] += h;
  }

  const merged: T[] = [];
  const maxLen = Math.max(columns[0].length, columns[1].length);
  for (let i = 0; i < maxLen; i++) {
    if (i < columns[0].length) merged.push(columns[0][i]);
    if (i < columns[1].length) merged.push(columns[1][i]);
  }
  return merged;
};

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
 * Tab 内容组件 — 使用 MasonryFlashList 实现高性能瀑布流
 */
const TabContentInner: React.FC<TabContentProps> = ({
  tab,
  tabPosts,
  banners,
  communities,
  error,
  refreshing,
  tabLoading,
  tabLoaded,
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
  const flatListRef = useRef<FlatList<Post>>(null);
  const masonryListRef = useRef<any>(null);

  const currentPosts = useMemo(() => {
    if (!Array.isArray(tabPosts)) return [];
    const mapped = tabPosts.map(convertToPost);
    const keyed = withStableRenderKeys(mapped);
    // Only the masonry tabs benefit from (and survive) pre-balancing. The
    // forum tab is single-column so reshuffling would only scramble order.
    if (tab === "forum") return keyed;
    return arrangeForNaiveMasonry(keyed);
  }, [tabPosts, tab]);

  const keyExtractor = useCallback(
    (item: RenderablePost) => item.renderKey ?? item.id,
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
            coverImageSize={ImageSize.THUMBNAIL}
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
  // recycle/scroll smoothly even when card aspect ratios vary a lot. We do
  // NOT pair this with `optimizeItemArrangement` — see `arrangeForNaiveMasonry`
  // for why. With column pre-balancing done upstream and a naïve `i % 2`
  // column assignment, `overrideItemLayout` is pure scroll-perf polish; the
  // outer FlashList's crude estimate stays honest because column lengths
  // stay symmetric.
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
        return { title: "暂无论坛帖子", subtitle: "快来发布第一篇帖子吧" };
      case "recommend":
        return { title: "暂无发现内容", subtitle: "下拉刷新获取最新内容" };
      case "following":
        return { title: "暂无关注内容", subtitle: "关注更多用户查看他们的动态" };
      default:
        return { title: "暂无内容", subtitle: "" };
    }
  };

  if (tabLoading || !tabLoaded) {
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
            <Text fontSize="$lg" color="$black" fontWeight="$medium" mb="$sm" mt="$md" textAlign="center">
              加载失败
            </Text>
            <Text color="$gray400" textAlign="center" lineHeight="$lg" mb="$md">
              {error}
            </Text>
            <Pressable onPress={onRefresh} px="$lg" py="$sm" bg="$black" rounded="$md">
              <Text color="$white" fontWeight="$medium">点击重试</Text>
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
            <Text fontSize="$lg" color="$black" fontWeight="$medium" mb="$sm" mt="$md" textAlign="center">
              {emptyState.title}
            </Text>
            <Text color="$gray400" textAlign="center" lineHeight="$lg">
              {emptyState.subtitle}
            </Text>
          </VStack>
        </ScrollView>
      </View>
    );
  }

  // Forum tab — FlatList (single-column)
  if (tab === "forum") {
    const forumHeader = (
      <>
        {banners.length > 0 && (
          <BannerCarousel banners={banners} onBannerPress={onBannerPress} />
        )}
        <PopularCommunities communities={communities} />
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
          <Text fontSize="$sm" fontWeight="$bold" color="$gray400">
            关注的帖子
          </Text>
          <Text fontSize="$xs" fontWeight="$semibold" color="$gray400">
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
        keyExtractor={keyExtractor}
        renderItem={renderMasonryItem}
        estimatedItemSize={ESTIMATED_ITEM_SIZE}
        estimatedListSize={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
        drawDistance={MASONRY_DRAW_DISTANCE}
        overrideItemLayout={overrideItemLayout}
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

TabContentInner.displayName = "TabContent";

/**
 * Memoize `TabContent` so unrelated DiscoverScreen state churn (unread-count
 * polling, focus refresh, current-user-info fetch, scroll-to-top signal for
 * *another* tab) does not re-execute the function body of all three tab
 * instances. With the callback-stability work upstream (stable `onLike`,
 * `onRefresh`, `onPostPress`, `onAuthorPress`, `onScroll`, `onEndReached`)
 * all shallow-equal props reliably land memo hits on those re-renders.
 *
 * NOTE: Historical `TabContent.displayName = "TabContent"` + `export default
 * TabContent` pattern tripped a `react-refresh/babel` ×
 * `@babel/plugin-transform-typescript` scope-tracker interaction that produced
 * `ReferenceError: Property 'TabContent' doesn't exist` at runtime. Keeping
 * the displayName on the inner function and exposing only the named export
 * avoids that transform bug.
 */
export const TabContent = React.memo(TabContentInner);

const masonryItemStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 4,
    marginBottom: 8, // 等价于原 gluestack mb="$sm"
  },
});
