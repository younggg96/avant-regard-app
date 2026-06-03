import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
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
import Reanimated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";
import { Box, ScrollView, VStack, HStack } from "../../components/ui";
import { Post } from "../../components/PostCard";
import { Banner } from "../../services/bannerService";
import { useAuthStore } from "../../store/authStore";
import { useDiscoverTabStore } from "../../store/discoverTabStore";
import { useMainBottomTabStore } from "../../store/mainBottomTabStore";
import { getUnreadCount } from "../../services/notificationService";
import { getUnreadCount as getChatUnreadCount } from "../../services/chatService";
import { userInfoService, UserInfo } from "../../services/userInfoService";
import { TabType } from "./types";
import { TAB_INDEX_MAP } from "./constants";
import { useDiscoverStyles } from "./styles";
import { useAppTheme } from "../../theme";
import { SkeletonPostCard, useSkeletonAnimation } from "./components/SkeletonPostCard";
import { DiscoverHeader } from "./components/DiscoverHeader";
import { DiscoverTabBar } from "./components/DiscoverTabBar";
import { TabContent } from "./components/TabContent";
import { useDiscoverData } from "./hooks/useDiscoverData";
import { useHeaderAnimation } from "./hooks/useHeaderAnimation";

/** 横向页顺序必须与 `TAB_INDEX_MAP` 一致（论坛 / 推荐 / 交易 / 买手店 / 关注）。 */
const TAB_PAGES = [
  "forum",
  "recommend",
  "trading",
  "buyer",
  "following",
] as const satisfies readonly TabType[];

const RECOMMEND_TAB_DOUBLE_TAP_MS = 700;

/** 稳定在「当前 ±1」页的 React 挂载量，卸载远处 Tab 的重列表。 */
const neighborMountSet = (center: number): Set<number> => {
  const n = new Set<number>();
  for (let i = center - 1; i <= center + 1; i++) {
    if (i >= 0 && i < TAB_PAGES.length) n.add(i);
  }
  return n;
};

const SkeletonTabBar: React.FC<{
  opacity: Animated.AnimatedInterpolation<number>;
  surfaceColor: string;
  borderColor: string;
  blockColor: string;
}> = ({ opacity, surfaceColor, borderColor, blockColor }) => (
  <Box style={{ backgroundColor: surfaceColor, borderBottomWidth: 1, borderBottomColor: borderColor }}>
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
  <Box style={{ backgroundColor: surfaceColor }} px="$md" pt="$sm" pb="$md">
    <VStack space="sm">
      <HStack alignItems="center" justifyContent="space-between">
        <Animated.View
          style={{
            width: 140,
            height: 36,
            borderRadius: 4,
            backgroundColor: blockColor,
            opacity,
          }}
        />
        <HStack alignItems="center" space="md">
          <Animated.View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: blockColor,
              opacity,
            }}
          />
          <Animated.View
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              backgroundColor: blockColor,
              opacity,
            }}
          />
        </HStack>
      </HStack>
      <Animated.View
        style={{
          height: 40,
          borderRadius: 4,
          backgroundColor: blockColor,
          opacity,
        }}
      />
    </VStack>
  </Box>
);

/**
 * 首页：DiscoverHeader（Logo + 搜索）+ 四 Tab；横向分页用 `react-native-pager-view`。
 *
 * 性能：`mountedPages` 仅挂载当前 Tab ±1。更换/安装本依赖后需重新 `expo run:ios` /
 * `expo run:android` 以链接原生 RNCViewPager。
 */
const DiscoverScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { user } = useAuthStore();
  const t = useAppTheme();
  const styles = useDiscoverStyles();
  const isDark = t.mode === "dark";
  const skeletonColor = isDark ? "#1F1F1F" : "#e5e5e5";
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const totalInteractionUnread = unreadNotificationCount + unreadChatCount;
  const [currentUserInfo, setCurrentUserInfo] = useState<UserInfo | null>(null);

  const [pageIndex, setPageIndex] = useState<number>(TAB_INDEX_MAP.recommend);
  const [mountedPages, setMountedPages] = useState(() => neighborMountSet(TAB_INDEX_MAP.recommend));
  const [recommendScrollToTopSignal, setRecommendScrollToTopSignal] = useState(0);

  const lastRecommendTabPressAt = useRef(0);
  const pagerRef = useRef<PagerView>(null);

  const activeTab = TAB_PAGES[pageIndex];

  // V2 发帖入口：底部「+」按钮通过 discoverTabStore 读取当前子 Tab，
  // 来决定跳「图片优先」流程还是「论坛模式选择」流程。
  useEffect(() => {
    useDiscoverTabStore.getState().setActiveTab(activeTab);
  }, [activeTab]);

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

  useEffect(() => {
    if (!user?.userId) return;
    const currentUserId = user.userId;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const info = await userInfoService.getUserInfo(currentUserId);
        if (cancelled) return;
        setCurrentUserInfo(info);
      } catch (err) {
        if (cancelled) return;
        console.warn("获取当前用户信息失败:", err);
      }
    }, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user?.userId]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      setUnreadNotificationCount(count);
    } catch (err) {
      console.warn("获取未读消息数量失败:", err);
    }
    try {
      const chatCount = await getChatUnreadCount();
      setUnreadChatCount(chatCount);
    } catch (err) {
      console.warn("获取未读聊天数量失败:", err);
    }
  }, []);

  const hasUnreadBootstrappedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (hasUnreadBootstrappedRef.current) {
        fetchUnreadCount();
        return;
      }
      const kickoff = setTimeout(() => {
        hasUnreadBootstrappedRef.current = true;
        fetchUnreadCount();
      }, 2000);
      return () => clearTimeout(kickoff);
    }, [fetchUnreadCount])
  );

  const augmentMountFromScrollFraction = useCallback((position: number, offset: number) => {
    const p = position + offset;
    const lo = Math.max(0, Math.min(TAB_PAGES.length - 1, Math.floor(p)));
    const hi = Math.max(0, Math.min(TAB_PAGES.length - 1, Math.ceil(p)));
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
      augmentMountFromScrollFraction(e.nativeEvent.position, e.nativeEvent.offset);
    },
    [augmentMountFromScrollFraction]
  );

  const onPageSelected = useCallback(
    (e: PagerViewOnPageSelectedEvent) => {
      const idx = Math.round(Number(e.nativeEvent.position));
      if (idx < 0 || idx >= TAB_PAGES.length) return;
      const tab = TAB_PAGES[idx];
      useDiscoverTabStore.getState().setActiveTab(tab);
      setPageIndex(idx);
      setMountedPages(neighborMountSet(idx));
      loadTabData(TAB_PAGES[idx]);
    },
    [loadTabData]
  );

  const refreshRecommendAndScrollToTop = useCallback(() => {
    pagerRef.current?.setPage(TAB_INDEX_MAP.recommend);
    setPageIndex(TAB_INDEX_MAP.recommend);
    setMountedPages(neighborMountSet(TAB_INDEX_MAP.recommend));
    setRecommendScrollToTopSignal((v) => v + 1);
    void handleRefresh("recommend").finally(() => {
      setRecommendScrollToTopSignal((v) => v + 1);
    });
  }, [handleRefresh]);

  const handleTabChange = useCallback(
    (tab: TabType) => {
      const now = Date.now();
      const isRecommendTab = tab === "recommend";
      const isRecommendDoubleTap =
        isRecommendTab && now - lastRecommendTabPressAt.current <= RECOMMEND_TAB_DOUBLE_TAP_MS;
      const isActiveRecommendRetap = isRecommendTab && activeTab === "recommend";

      lastRecommendTabPressAt.current = isRecommendTab ? now : 0;

      if (isActiveRecommendRetap || isRecommendDoubleTap) {
        refreshRecommendAndScrollToTop();
        return;
      }

      const idx = TAB_INDEX_MAP[tab];
      useDiscoverTabStore.getState().setActiveTab(tab);
      setMountedPages((prev) => {
        const n = new Set(prev);
        neighborMountSet(idx).forEach((i) => n.add(i));
        return n;
      });
      pagerRef.current?.setPage(idx);
      setPageIndex(idx);
      loadTabData(tab);
    },
    [activeTab, loadTabData, refreshRecommendAndScrollToTop]
  );

  useEffect(() => {
    const targetTab = route.params?.targetDiscoverTab as TabType | undefined;
    if (!targetTab || !(targetTab in TAB_INDEX_MAP)) return;
    handleTabChange(targetTab);
    (navigation as any).setParams?.({ targetDiscoverTab: undefined });
  }, [route.params?.targetDiscoverTab, handleTabChange, navigation]);

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const onRefresh = useCallback(() => {
    handleRefresh(activeTabRef.current);
  }, [handleRefresh]);

  const handlePostPress = useCallback(
    (post: Post) => {
      console.log("查看帖子详情:", post.id);
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
      console.log("Banner 点击:", banner.linkType, banner.linkValue);

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
    (navigation.navigate as any)("Search");
  }, [navigation]);

  const handleAvatarPress = useCallback(() => {
    (navigation.navigate as any)("Profile");
  }, [navigation]);

  const handleInteractionPress = useCallback(() => {
    (navigation.navigate as any)("Main", {
      screen: "Interaction",
      params: { subTab: "trading" },
    });
  }, [navigation]);

  const renderPageSlot = (tab: TabType, index: number) => {
    if (!mountedPages.has(index)) {
      return <View style={{ flex: 1 }} />;
    }

    const isFocused = pageIndex === index;

    switch (tab) {
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
      case "recommend":
        return (
          <TabContent
            tab="recommend"
            tabPosts={recommendPosts}
            banners={banners}
            communities={communities}
            error={error}
            refreshing={refreshing}
            tabLoading={tabLoading.recommend}
            tabLoaded={tabLoaded.recommend}
            isActive={isFocused}
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
      case "trading":
        return (
          <TabContent
            tab="trading"
            isActive={isFocused}
            onScroll={handleVerticalScroll}
          />
        );
      case "buyer":
        return (
          <TabContent
            tab="buyer"
            isActive={isFocused}
            onScroll={handleVerticalScroll}
            onSearchPress={handleSearchPress}
            onStorePress={handleBuyerStorePress}
            onProductPress={handleBuyerProductPress}
            onPostPress={handleBuyerPostPress}
            onOpenAllStores={handleOpenAllBuyerStores}
            onOpenProductList={handleOpenProductList}
          />
        );
      case "following":
        return (
          <TabContent
            tab="following"
            tabPosts={followingPosts}
            banners={banners}
            communities={communities}
            error={error}
            refreshing={refreshing}
            tabLoading={tabLoading.following}
            tabLoaded={tabLoaded.following}
            isActive={isFocused}
            onRefresh={onRefresh}
            onScroll={handleVerticalScroll}
            onPostPress={handlePostPress}
            onAuthorPress={handleAuthorPress}
            onLike={handleLike}
            onBannerPress={handleBannerPress}
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

  const userAvatarUrl = currentUserInfo?.avatarUrl || user?.avatar;
  const username = currentUserInfo?.username || user?.username;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <Reanimated.View style={[{ overflow: "hidden" }, headerAnimatedStyle]}>
        <DiscoverHeader
          avatar={userAvatarUrl}
          username={username}
          totalInteractionUnread={totalInteractionUnread}
          onAvatarPress={handleAvatarPress}
          onSearchPress={handleSearchPress}
          onInteractionPress={handleInteractionPress}
        />
      </Reanimated.View>
      <DiscoverTabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* @ts-expect-error RNC codegen typings omit `children`; runtime supports pages. */}
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={TAB_INDEX_MAP.recommend}
        keyboardDismissMode="on-drag"
        scrollEnabled
        offscreenPageLimit={1}
        onPageScroll={onPageScroll}
        onPageSelected={onPageSelected}
      >
        {TAB_PAGES.map((tab, index) => (
          <View key={tab} style={{ flex: 1 }} collapsable={false}>
            {renderPageSlot(tab, index)}
          </View>
        ))}
      </PagerView>
    </SafeAreaView>
  );
};

export default DiscoverScreen;
