import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import {
  Animated,
  Linking,
  StatusBar,
  View,
} from "react-native";
import PagerView, {
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import Reanimated, { useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Box, ScrollView, VStack, HStack } from "../../components/ui";
import { Post } from "../../components/PostCard";
import { Banner } from "../../services/bannerService";
import { useDiscoverTabStore } from "../../store/discoverTabStore";
import { useMainBottomTabStore } from "../../store/mainBottomTabStore";
import { useAuthStore } from "../../store/authStore";
import { useNotificationStore } from "../../store/notificationStore";
import {
  TabType,
  TopTab,
  PostsSubTab,
  ArchiveSubTab,
  BuyerSubTab,
} from "./types";
import {
  TOP_TAB_PAGES,
  TOP_TAB_INDEX,
  DEFAULT_TOP_TAB_INDEX,
} from "./constants";
import { useDiscoverStyles } from "./styles";
import { useAppTheme } from "../../theme";
import { SkeletonPostCard, useSkeletonAnimation } from "./components/SkeletonPostCard";
import { DiscoverHeader } from "./components/DiscoverHeader";
import { DiscoverTabBar } from "./components/DiscoverTabBar";
import { TabContent } from "./components/TabContent";
import { PostsPage } from "./components/PostsPage";
import { MyArchivePage } from "./components/MyArchivePage";
import { EventsPage } from "./components/EventsPage";
import { BuyerPage } from "./components/BuyerPage";
import { useDiscoverData } from "./hooks/useDiscoverData";
import { useHeaderAnimation } from "./hooks/useHeaderAnimation";
import { useTradingEnabled } from "../../store/featureFlagsStore";
import { isChatNotification } from "../Interaction/utils";

const RECOMMEND_TAB_DOUBLE_TAP_MS = 700;

const SEARCH_PLACEHOLDER_KEY: Record<TopTab, string> = {
  forum: "discover.searchPlaceholderForum",
  posts: "discover.searchPlaceholderPosts",
  events: "discover.searchPlaceholderEvents",
  myArchive: "discover.searchPlaceholderArchive",
  buyer: "discover.searchPlaceholderBuyer",
};

const SEARCH_INITIAL_TYPE: Record<TopTab, "posts" | "stores"> = {
  forum: "posts",
  posts: "posts",
  events: "posts",
  myArchive: "posts",
  buyer: "stores",
};

/** 稳定在「当前 ±1」页的 React 挂载量，卸载远处 Tab 的重列表。 */
const neighborMountSet = (center: number, pageCount: number = TOP_TAB_PAGES.length): Set<number> => {
  const n = new Set<number>();
  for (let i = center - 1; i <= center + 1; i++) {
    if (i >= 0 && i < pageCount) n.add(i);
  }
  return n;
};

/**
 * 顶部一级 Tab + 内部二级 Tab → 写进 `discoverTabStore` 的数据层 Tab 标识。
 * 供底部「+」发布按钮判断当前发帖语境（论坛 / 帖子 / 买手店 / My Archive）。
 */
const resolveDataTab = (top: TopTab, postsSub: PostsSubTab): TabType => {
  switch (top) {
    case "forum":
      return "forum";
    case "posts":
      return postsSub === "following" ? "following" : "recommend";
    case "myArchive":
      return "myArchive";
    case "buyer":
      return "buyer";
    case "events":
      return "forum";
    default:
      return "recommend";
  }
};

/** 深链 / 路由参数里的数据层 Tab → 顶部一级 Tab + 二级 Tab。 */
const targetToTopTab = (
  tab: TabType,
): { top: TopTab; postsSub?: PostsSubTab } => {
  switch (tab) {
    case "forum":
      return { top: "forum" };
    case "recommend":
      return { top: "posts", postsSub: "recommend" };
    case "following":
      return { top: "posts", postsSub: "following" };
    case "buyer":
      return { top: "buyer" };
    case "myArchive":
      return { top: "myArchive" };
    case "events":
      return { top: "events" };
    default:
      return { top: "posts", postsSub: "recommend" };
  }
};

const SkeletonTabBar: React.FC<{
  opacity: Animated.AnimatedInterpolation<number>;
  surfaceColor: string;
  borderColor: string;
  blockColor: string;
}> = ({ opacity, surfaceColor, blockColor }) => (
  <Box style={{ backgroundColor: surfaceColor }}>
    <HStack justifyContent="center" alignItems="center" py="$xs">
      {[0, 1, 2, 3, 4].map((i) => (
        <Animated.View
          key={i}
          style={{
            width: 44,
            height: 18,
            borderRadius: 4,
            backgroundColor: blockColor,
            opacity,
            marginHorizontal: 14,
          }}
        />
      ))}
    </HStack>
  </Box>
);

const SkeletonHeader: React.FC<{
  opacity: Animated.AnimatedInterpolation<number>;
  surfaceColor: string;
  blockColor: string;
}> = ({ opacity, surfaceColor, blockColor }) => (
  <Box style={{ backgroundColor: surfaceColor }} px="$md" pt={2} pb={0}>
    <HStack alignItems="center" justifyContent="space-between">
      <Animated.View
        style={{
          width: 92,
          height: 30,
          borderRadius: 4,
          backgroundColor: blockColor,
          opacity,
        }}
      />
      <HStack alignItems="center" space="md">
        <Animated.View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: blockColor,
            opacity,
          }}
        />
        <Animated.View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: blockColor,
            opacity,
          }}
        />
      </HStack>
    </HStack>
  </Box>
);

/**
 * 首页（发现）—— Logo + 通知/头像 + 顶部五 Tab + 搜索栏 + 横向分页。
 * 搜索栏在一级 Tab 与二级筛选之间，点击进入 Search 页。
 *
 *   - 论坛：banner + 社区 + 论坛帖子
 *   - 帖子：推荐 / 关注 二级切换
 *   - 活动：时装日历 + 近期活动 + 活动回顾
 *   - My Archive：我的 / 世界 二级切换
 *   - 买手店：地图 / 详情 二级切换
 *   - 交易：隐藏（仍可从底部「消息」/ Marketplace 到达）
 *
 * 性能：`mountedPages` 仅挂载当前 Tab ±1。
 */
const DiscoverScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { t: i18nT } = useTranslation();
  const t = useAppTheme();
  const styles = useDiscoverStyles();
  const isDark = t.mode === "dark";
  const skeletonColor = isDark ? "#1F1F1F" : "#e5e5e5";

  const user = useAuthStore((s) => s.user);
  // 铃铛是「互动通知」，不含私信未读；底部「消息」Tab 才合计聊天 + 通知。
  const headerNotifUnread = useNotificationStore(
    (s) =>
      s.notifications.filter(
        (n) => !n.isRead && n.category == null && !isChatNotification(n)
      ).length
  );

  // 交易系统总开关：底部「消息」跳转是否带「交易」子 Tab（顶部不再有交易 Tab）
  const tradingEnabled = useTradingEnabled();

  const [pageIndex, setPageIndex] = useState<number>(DEFAULT_TOP_TAB_INDEX);
  const [mountedPages, setMountedPages] = useState(() => neighborMountSet(DEFAULT_TOP_TAB_INDEX));
  const [recommendScrollToTopSignal, setRecommendScrollToTopSignal] = useState(0);

  // 二级 Tab 状态
  const [postsSubTab, setPostsSubTab] = useState<PostsSubTab>("recommend");
  const [archiveSubTab, setArchiveSubTab] = useState<ArchiveSubTab>("mine");
  const [buyerSubTab, setBuyerSubTab] = useState<BuyerSubTab>("map");

  const lastPostsTabPressAt = useRef(0);
  const pagerRef = useRef<PagerView>(null);
  const pageIndexRef = useRef(pageIndex);
  pageIndexRef.current = pageIndex;
  const pendingPagerIndexRef = useRef<number | null>(null);
  const pagerPosition = useSharedValue(DEFAULT_TOP_TAB_INDEX);

  const activeTopTab: TopTab = TOP_TAB_PAGES[pageIndex] ?? "posts";

  const syncPagerToIndex = useCallback((idx: number) => {
    pagerRef.current?.setPageWithoutAnimation(idx);
  }, []);

  /** 点 Tab 后等买手店页挂上再 setPage，避免跳到尚未 mount 的页。 */
  useLayoutEffect(() => {
    const idx = pendingPagerIndexRef.current;
    if (idx == null) return;
    pendingPagerIndexRef.current = null;
    pagerRef.current?.setPage(idx);
  }, [pageIndex, mountedPages]);

  const handleChromeLayout = useCallback(() => {
    syncPagerToIndex(pageIndexRef.current);
    pagerPosition.value = pageIndexRef.current;
  }, [syncPagerToIndex, pagerPosition]);

  // 顶部 / 二级 Tab 变化 → 同步 discoverTabStore，供「+」发布按钮分流
  useEffect(() => {
    useDiscoverTabStore.getState().setActiveTab(resolveDataTab(activeTopTab, postsSubTab));
  }, [activeTopTab, postsSubTab]);

  useFocusEffect(
    useCallback(() => {
      useMainBottomTabStore.getState().setActiveMainTab("Home");
      useDiscoverTabStore.getState().setFocused(true);
      return () => useDiscoverTabStore.getState().setFocused(false);
    }, [])
  );

  const {
    recommendPosts,
    forumPosts,
    followingPosts,
    banners,
    communities,
    isInitialized,
    refreshing,
    error,
    userInfoCache,
    tabLoading,
    tabLoaded,
    bannersLoading,
    communitiesLoading,
    handleRefresh,
    handleLike,
    loadTabData,
    loadMoreRecommend,
    recommendLoadingMore,
  } = useDiscoverData();

  const { headerAnimatedStyle, handleVerticalScroll, notifyRefreshing } = useHeaderAnimation();

  useLayoutEffect(() => {
    notifyRefreshing(refreshing);
  }, [refreshing, notifyRefreshing]);

  const { skeletonOpacity } = useSkeletonAnimation();

  /** 顶部一级 Tab 对应的数据层懒加载。 */
  const loadDataForTop = useCallback(
    (top: TopTab, postsSub: PostsSubTab) => {
      if (top === "forum") {
        loadTabData("forum");
      } else if (top === "posts") {
        loadTabData(postsSub === "following" ? "following" : "recommend");
      }
      // events / buyer / myArchive 由各自组件按 isActive 自取数据
    },
    [loadTabData]
  );

  const augmentMountFromScrollFraction = useCallback((position: number, offset: number) => {
    const p = position + offset;
    const lo = Math.max(0, Math.min(TOP_TAB_PAGES.length - 1, Math.floor(p)));
    const hi = Math.max(0, Math.min(TOP_TAB_PAGES.length - 1, Math.ceil(p)));
    setMountedPages((prev) => {
      if (prev.has(lo) && prev.has(hi)) return prev;
      const n = new Set(prev);
      n.add(lo);
      n.add(hi);
      return n;
    });
  }, []);

  const onPageScroll = useCallback(
    (e: PagerViewOnPageScrollEvent) => {
      const { position, offset } = e.nativeEvent;
      pagerPosition.value = position + offset;
      augmentMountFromScrollFraction(position, offset);
    },
    [augmentMountFromScrollFraction, pagerPosition]
  );

  const onPageSelected = useCallback(
    (e: PagerViewOnPageSelectedEvent) => {
      const idx = Math.round(Number(e.nativeEvent.position));
      if (idx < 0 || idx >= TOP_TAB_PAGES.length) return;
      const top = TOP_TAB_PAGES[idx];
      pagerPosition.value = idx;
      setPageIndex(idx);
      setMountedPages(neighborMountSet(idx, TOP_TAB_PAGES.length));
      loadDataForTop(top, postsSubTab);
    },
    [loadDataForTop, postsSubTab, pagerPosition]
  );

  const refreshRecommendAndScrollToTop = useCallback(() => {
    setRecommendScrollToTopSignal((v) => v + 1);
    void handleRefresh("recommend").finally(() => {
      setRecommendScrollToTopSignal((v) => v + 1);
    });
  }, [handleRefresh]);

  const handleTopTabChange = useCallback(
    (top: TopTab) => {
      const now = Date.now();
      const isPostsTab = top === "posts";
      const isPostsReTap = isPostsTab && activeTopTab === "posts";
      const isPostsDoubleTap =
        isPostsTab && now - lastPostsTabPressAt.current <= RECOMMEND_TAB_DOUBLE_TAP_MS;
      lastPostsTabPressAt.current = isPostsTab ? now : 0;

      // 在「帖子·推荐」上再次点击 / 双击「帖子」→ 刷新推荐并回到顶部
      if ((isPostsReTap || isPostsDoubleTap) && postsSubTab === "recommend") {
        refreshRecommendAndScrollToTop();
        if (isPostsReTap) return;
      }

      const idx = TOP_TAB_INDEX[top];
      setMountedPages((prev) => {
        const n = new Set(prev);
        neighborMountSet(idx, TOP_TAB_PAGES.length).forEach((i) => n.add(i));
        return n;
      });
      pendingPagerIndexRef.current = idx;
      setPageIndex(idx);
      loadDataForTop(top, postsSubTab);
    },
    [activeTopTab, postsSubTab, refreshRecommendAndScrollToTop, loadDataForTop]
  );

  const handlePostsSubTabChange = useCallback(
    (sub: PostsSubTab) => {
      setPostsSubTab(sub);
      loadTabData(sub === "following" ? "following" : "recommend");
    },
    [loadTabData]
  );

  useEffect(() => {
    const targetTab = route.params?.targetDiscoverTab as TabType | undefined;
    if (!targetTab) return;
    // 顶部不再有「交易」Tab；深链落到底部「消息 · 交易」。
    if (targetTab === "trading") {
      (navigation as any).navigate("Interaction", {
        subTab: tradingEnabled ? "trading" : "messages",
      });
      (navigation as any).setParams?.({ targetDiscoverTab: undefined });
      return;
    }
    const { top, postsSub } = targetToTopTab(targetTab);
    if (postsSub) setPostsSubTab(postsSub);
    handleTopTabChange(top);
    (navigation as any).setParams?.({ targetDiscoverTab: undefined });
  }, [route.params?.targetDiscoverTab, handleTopTabChange, navigation, tradingEnabled]);

  // 下拉刷新按当前数据层 Tab 分流
  const dataTabRef = useRef<TabType>(resolveDataTab(activeTopTab, postsSubTab));
  dataTabRef.current = resolveDataTab(activeTopTab, postsSubTab);
  const onRefresh = useCallback(() => {
    handleRefresh(dataTabRef.current);
  }, [handleRefresh]);

  const handlePostPress = useCallback(
    (post: Post) => {
      (navigation.navigate as any)("PostDetail", { postId: post.id });
    },
    [navigation]
  );

  const recommendPostsRef = useRef(recommendPosts);
  recommendPostsRef.current = recommendPosts;
  const forumPostsRef = useRef(forumPosts);
  forumPostsRef.current = forumPosts;
  const followingPostsRef = useRef(followingPosts);
  followingPostsRef.current = followingPosts;

  const handleAuthorPress = useCallback(
    (authorId: string) => {
      const post =
        recommendPostsRef.current.find((p) => p.author.id === authorId) ||
        forumPostsRef.current.find((p) => p.author.id === authorId) ||
        followingPostsRef.current.find((p) => p.author.id === authorId);
      const userId = parseInt(authorId, 10);
      const cachedUserInfo = userInfoCache.current.get(userId);

      (navigation.navigate as any)("UserProfile", {
        userId,
        username: cachedUserInfo?.username || post?.author.name,
        avatar: cachedUserInfo?.avatarUrl || post?.author.avatar,
      });
    },
    [navigation, userInfoCache]
  );

  const handleBuyerStorePress = useCallback(
    (storeId: string) => {
      (navigation.navigate as any)("StoreDetail", { storeId });
    },
    [navigation]
  );

  const handleOpenAllBuyerStores = useCallback(() => {
    (navigation.navigate as any)("AllBuyerStores");
  }, [navigation]);

  const handleOpenProductList = useCallback(
    (payload: {
      storeId: string;
      storeName?: string;
      mode: "ALL" | "CLASSIFICATION" | "DISCOUNT" | "NEW_ARRIVAL";
      categoryId?: number | null;
    }) => {
      (navigation.navigate as any)("StoreProductList", payload);
    },
    [navigation]
  );

  const handleBuyerProductPress = useCallback(
    (product: { realProductId: number }) => {
      (navigation.navigate as any)("StoreProductDetail", {
        productId: product.realProductId,
      });
    },
    [navigation]
  );

  const handleBuyerPostPress = useCallback(
    (postId: number) => {
      (navigation.navigate as any)("PostDetail", { postId });
    },
    [navigation]
  );

  const handleBannerPress = useCallback(
    (banner: Banner) => {
      switch (banner.linkType) {
        case "POST":
          if (banner.linkValue) {
            (navigation.navigate as any)("PostDetail", { postId: banner.linkValue });
          }
          break;
        case "BRAND":
          if (banner.linkValue) {
            (navigation.navigate as any)("BrandDetail", { brandName: banner.linkValue });
          }
          break;
        case "SHOW":
          if (banner.linkValue) {
            (navigation.navigate as any)("CollectionDetail", {
              showId: parseInt(banner.linkValue),
            });
          }
          break;
        case "EXTERNAL":
          if (banner.linkValue) {
            Linking.openURL(banner.linkValue).catch((err) =>
              console.error("打开链接失败:", err)
            );
          }
          break;
        default:
          break;
      }
    },
    [navigation]
  );

  const handleSearchPress = useCallback(() => {
    (navigation.navigate as any)("Search", {
      initialType: SEARCH_INITIAL_TYPE[activeTopTab],
    });
  }, [navigation, activeTopTab]);

  const handleAvatarPress = useCallback(() => {
    (navigation.navigate as any)("Profile");
  }, [navigation]);

  const handleInteractionPress = useCallback(() => {
    (navigation.navigate as any)("Activity");
  }, [navigation]);

  const postsTabLoading = useMemo(
    () => ({ recommend: tabLoading.recommend, following: tabLoading.following }),
    [tabLoading.recommend, tabLoading.following]
  );
  const postsTabLoaded = useMemo(
    () => ({ recommend: tabLoaded.recommend, following: tabLoaded.following }),
    [tabLoaded.recommend, tabLoaded.following]
  );

  const renderPageSlot = (top: TopTab, index: number) => {
    if (!mountedPages.has(index)) {
      return <View style={{ flex: 1 }} />;
    }

    const isFocused = pageIndex === index;

    switch (top) {
      case "forum":
        return (
          <TabContent
            tab="forum"
            tabPosts={forumPosts}
            banners={banners}
            communities={communities}
            error={error}
            refreshing={refreshing}
            tabLoading={tabLoading.forum}
            tabLoaded={tabLoaded.forum}
            bannersLoading={bannersLoading}
            communitiesLoading={communitiesLoading}
            isActive={isFocused}
            onRefresh={onRefresh}
            onScroll={handleVerticalScroll}
            onPostPress={handlePostPress}
            onAuthorPress={handleAuthorPress}
            onLike={handleLike}
            onBannerPress={handleBannerPress}
          />
        );
      case "posts":
        return (
          <PostsPage
            isActive={isFocused}
            subTab={postsSubTab}
            onSubTabChange={handlePostsSubTabChange}
            recommendPosts={recommendPosts}
            followingPosts={followingPosts}
            banners={banners}
            communities={communities}
            error={error}
            refreshing={refreshing}
            tabLoading={postsTabLoading}
            tabLoaded={postsTabLoaded}
            onRefresh={onRefresh}
            onScroll={handleVerticalScroll}
            onPostPress={handlePostPress}
            onAuthorPress={handleAuthorPress}
            onLike={handleLike}
            onBannerPress={handleBannerPress}
            onEndReached={loadMoreRecommend}
            loadingMore={recommendLoadingMore}
            scrollToTopSignal={recommendScrollToTopSignal}
          />
        );
      case "events":
        return (
          <EventsPage
            isActive={isFocused}
            onScroll={handleVerticalScroll}
          />
        );
      case "myArchive":
        return (
          <MyArchivePage
            isActive={isFocused}
            subTab={archiveSubTab}
            onSubTabChange={setArchiveSubTab}
            onScroll={handleVerticalScroll}
          />
        );
      case "buyer":
        return (
          <BuyerPage
            isActive={isFocused}
            subTab={buyerSubTab}
            onSubTabChange={setBuyerSubTab}
            onScroll={handleVerticalScroll}
            onSearchPress={handleSearchPress}
            onStorePress={handleBuyerStorePress}
            onProductPress={handleBuyerProductPress}
            onPostPress={handleBuyerPostPress}
            onOpenAllStores={handleOpenAllBuyerStores}
            onOpenProductList={handleOpenProductList}
          />
        );
      default:
        return <View style={{ flex: 1 }} />;
    }
  };

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <SkeletonHeader
          opacity={skeletonOpacity}
          surfaceColor={t.colors.card}
          blockColor={skeletonColor}
        />
        <SkeletonTabBar
          opacity={skeletonOpacity}
          surfaceColor={t.colors.card}
          borderColor={t.colors.border}
          blockColor={skeletonColor}
        />
        <Box px="$md" pt={4} pb="$sm" style={{ backgroundColor: t.colors.card }}>
          <Animated.View
            style={{
              height: 32,
              borderRadius: 6,
              backgroundColor: skeletonColor,
              opacity: skeletonOpacity,
            }}
          />
        </Box>
        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <HStack px="$sm" pt="$sm" alignItems="start">
            <VStack flex={1} pr="$xs">
              <Box mb="$sm">
                <SkeletonPostCard opacity={skeletonOpacity} />
              </Box>
              <Box mb="$sm">
                <SkeletonPostCard opacity={skeletonOpacity} />
              </Box>
              <Box mb="$sm">
                <SkeletonPostCard opacity={skeletonOpacity} />
              </Box>
            </VStack>
            <VStack flex={1} pl="$xs">
              <Box mb="$sm">
                <SkeletonPostCard opacity={skeletonOpacity} />
              </Box>
              <Box mb="$sm">
                <SkeletonPostCard opacity={skeletonOpacity} />
              </Box>
              <Box mb="$sm">
                <SkeletonPostCard opacity={skeletonOpacity} />
              </Box>
            </VStack>
          </HStack>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <Reanimated.View style={[{ overflow: "hidden" }, headerAnimatedStyle]}>
        <DiscoverHeader
          avatar={user?.avatar}
          username={user?.username || user?.name}
          totalInteractionUnread={headerNotifUnread}
          onAvatarPress={handleAvatarPress}
          onInteractionPress={handleInteractionPress}
        />
      </Reanimated.View>
      <DiscoverTabBar
        activeTab={activeTopTab}
        onTabChange={handleTopTabChange}
        searchPlaceholder={i18nT(SEARCH_PLACEHOLDER_KEY[activeTopTab])}
        onSearchPress={handleSearchPress}
        pagerPosition={pagerPosition}
        onChromeLayout={handleChromeLayout}
      />

      <View style={{ flex: 1 }} collapsable={false}>
        {/* @ts-expect-error RNC codegen typings omit `children`; runtime supports pages. */}
        <PagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={DEFAULT_TOP_TAB_INDEX}
          keyboardDismissMode="on-drag"
          scrollEnabled
          offscreenPageLimit={TOP_TAB_PAGES.length}
          onPageScroll={onPageScroll}
          onPageSelected={onPageSelected}
        >
          {TOP_TAB_PAGES.map((top, index) => (
            <View key={top} style={{ flex: 1 }} collapsable={false}>
              {renderPageSlot(top, index)}
            </View>
          ))}
        </PagerView>
      </View>
    </SafeAreaView>
  );
};

export default DiscoverScreen;
