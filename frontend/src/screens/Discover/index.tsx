import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  Animated,
  ScrollView as RNScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
  StatusBar,
} from "react-native";
import Reanimated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Box, ScrollView, VStack, HStack } from "../../components/ui";
import { Post } from "../../components/PostCard";
import { Banner } from "../../services/bannerService";
import { useAuthStore } from "../../store/authStore";
import { getUnreadCount } from "../../services/notificationService";
import { getUnreadCount as getChatUnreadCount } from "../../services/chatService";
import { userInfoService, UserInfo } from "../../services/userInfoService";
import { TabType } from "./types";
import { SCREEN_WIDTH, TAB_INDEX_MAP } from "./constants";
import { styles } from "./styles";
import { SkeletonPostCard, useSkeletonAnimation } from "./components/SkeletonPostCard";
import { DiscoverHeader } from "./components/DiscoverHeader";
import { DiscoverTabBar } from "./components/DiscoverTabBar";
import { TabContent } from "./components/TabContent";
import { useDiscoverData } from "./hooks/useDiscoverData";
import { useHeaderAnimation } from "./hooks/useHeaderAnimation";

const RECOMMEND_TAB_DOUBLE_TAP_MS = 700;

// 骨架屏 Header 占位（匹配 DiscoverHeader 布局）
const SkeletonHeader: React.FC<{
  opacity: Animated.AnimatedInterpolation<number>;
}> = ({ opacity }) => (
  <Box bg="$white" px="$md" pt="$sm" pb="$md">
    <VStack space="sm">
      {/* 第一行：Logo + 头像 + 通知 */}
      <HStack alignItems="center" justifyContent="space-between">
        {/* 左侧 Logo 骨架 */}
        <Animated.View
          style={{
            width: 140,
            height: 36,
            borderRadius: 4,
            backgroundColor: "#e5e5e5",
            opacity,
          }}
        />
        {/* 右侧：头像 + 通知图标骨架 */}
        <HStack alignItems="center" space="md">
          {/* 头像骨架 - 圆形 */}
          <Animated.View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "#e5e5e5",
              opacity,
            }}
          />
          {/* 通知图标骨架 */}
          <Animated.View
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              backgroundColor: "#e5e5e5",
              opacity,
            }}
          />
        </HStack>
      </HStack>
      {/* 第二行：搜索框骨架 */}
      <Animated.View
        style={{
          height: 40,
          borderRadius: 4,
          backgroundColor: "#e5e5e5",
          opacity,
        }}
      />
    </VStack>
  </Box>
);

// 骨架屏 Tab 栏占位
const SkeletonTabBar: React.FC<{
  opacity: Animated.AnimatedInterpolation<number>;
}> = ({ opacity }) => (
  <Box borderBottomWidth={1} borderBottomColor="$gray100" bg="$white">
    <HStack justifyContent="center" alignItems="center" py="$xs">
      <Animated.View
        style={{
          width: 40,
          height: 20,
          borderRadius: 4,
          backgroundColor: "#e5e5e5",
          opacity,
          marginHorizontal: 20,
        }}
      />
      <Animated.View
        style={{
          width: 40,
          height: 20,
          borderRadius: 4,
          backgroundColor: "#e5e5e5",
          opacity,
          marginHorizontal: 20,
        }}
      />
      <Animated.View
        style={{
          width: 40,
          height: 20,
          borderRadius: 4,
          backgroundColor: "#e5e5e5",
          opacity,
          marginHorizontal: 20,
        }}
      />
    </HStack>
  </Box>
);

/**
 * 发现页主组件
 */
const DiscoverScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>("recommend");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const totalInteractionUnread = unreadNotificationCount + unreadChatCount;
  const [currentUserInfo, setCurrentUserInfo] = useState<UserInfo | null>(null);
  const [recommendScrollToTopSignal, setRecommendScrollToTopSignal] = useState(0);

  // 滑动视图引用
  const scrollViewRef = useRef<RNScrollView>(null);
  const hasInitialScrolled = useRef(false);
  const lastRecommendTabPressAt = useRef(0);

  // 数据 Hook
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
    handleRefresh,
    handleLike,
    loadTabData,
    loadMoreRecommend,
    recommendLoadingMore,
  } = useDiscoverData();

  // Header 动画 Hook（reanimated 版本，在 UI 线程驱动 height + opacity，
  // 避免冷启动首次下滑时和滚动事件、图片解码在 JS 线程互相抢占）
  const { headerAnimatedStyle, handleVerticalScroll, notifyRefreshing } = useHeaderAnimation();

  // Sync refreshing state → header animation before paint so the very first
  // scroll event after a refresh-start already sees the suppression flag.
  useLayoutEffect(() => {
    notifyRefreshing(refreshing);
  }, [refreshing, notifyRefreshing]);

  // 骨架屏动画
  const { skeletonOpacity } = useSkeletonAnimation();

  // 获取当前用户详细信息。
  //
  // Cold-start note: `user.avatar` from the auth store is already good
  // enough to paint the header; this fetch only fills in title/bio that
  // we don't display on the Discover header anyway. Push it 2s out so
  // its response + `setState` doesn't land inside the first-paint window
  // of the masonry feed.
  //
  // Race protection: `cancelled` flag guards the setState so that if
  // `user.userId` switches (sign-out / account switch) while the async
  // `getUserInfo` is in flight, the stale response from the previous
  // user cannot overwrite the current user's state. `clearTimeout` alone
  // only catches the case where the user id changes within the first 2s.
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

  // 获取未读消息数量
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

  // 页面聚焦时刷新未读消息数。
  //
  // Cold-start budget: the very first `useFocusEffect` pass fires while
  // the recommend feed is still decoding its first screen of images. Two
  // HTTP requests + their `setState` landing in that window visibly drops
  // FPS. Delay the first focus by 2s so the first-paint budget belongs to
  // the feed alone; subsequent focuses (user switching back from another
  // tab) fire immediately — the badge is more interesting then, and the
  // Discover tree is already warm.
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

  // 初始化时滚动到推荐 tab —— 用 TAB_INDEX_MAP 而不是字面量 1，避免
  // 以后再调整 Tab 顺序（比如把买手店挪到最左侧）时这里忘记同步更新。
  useEffect(() => {
    if (isInitialized && !hasInitialScrolled.current) {
      hasInitialScrolled.current = true;
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: TAB_INDEX_MAP.recommend * SCREEN_WIDTH,
          animated: false,
        });
      }, 0);
    }
  }, [isInitialized]);

  // 处理搜索按钮点击
  const handleSearchPress = useCallback(() => {
    (navigation.navigate as any)("Search");
  }, [navigation]);

  // 处理头像点击 - 跳转到个人主页
  const handleAvatarPress = useCallback(() => {
    (navigation.navigate as any)("Profile");
  }, [navigation]);

  const handleInteractionPress = useCallback(() => {
    (navigation.navigate as any)("Main", { screen: "Interaction" });
  }, [navigation]);

  const refreshRecommendAndScrollToTop = useCallback(() => {
    setActiveTab("recommend");
    scrollViewRef.current?.scrollTo({
      x: TAB_INDEX_MAP.recommend * SCREEN_WIDTH,
      animated: true,
    });

    // Give immediate visual feedback, then scroll again after refresh inserts
    // newer items at the top.
    setRecommendScrollToTopSignal((value) => value + 1);
    void handleRefresh("recommend").finally(() => {
      setRecommendScrollToTopSignal((value) => value + 1);
    });
  }, [handleRefresh]);

  // 处理标签切换 - 点击 tab 时也触发懒加载。重按/双击推荐 Tab 时刷新并回到顶部。
  const handleTabChange = useCallback((tab: TabType) => {
    const now = Date.now();
    const isRecommendTab = tab === "recommend";
    const isRecommendDoubleTap =
      isRecommendTab &&
      now - lastRecommendTabPressAt.current <= RECOMMEND_TAB_DOUBLE_TAP_MS;
    const isActiveRecommendRetap = isRecommendTab && activeTab === "recommend";

    lastRecommendTabPressAt.current = isRecommendTab ? now : 0;

    if (isActiveRecommendRetap || isRecommendDoubleTap) {
      refreshRecommendAndScrollToTop();
      return;
    }

    setActiveTab(tab);
    scrollViewRef.current?.scrollTo({
      x: TAB_INDEX_MAP[tab] * SCREEN_WIDTH,
      animated: true,
    });
    // 触发懒加载
    loadTabData(tab);
  }, [activeTab, loadTabData, refreshRecommendAndScrollToTop]);

  // 处理滑动结束 - 切换 tab 时触发懒加载
  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const pageIndex = Math.round(offsetX / SCREEN_WIDTH);
      // 顺序与 TAB_INDEX_MAP 保持严格一致：0 forum / 1 recommend / 2 buyer / 3 following。
      const newTab: TabType =
        pageIndex === 0
          ? "forum"
          : pageIndex === 1
          ? "recommend"
          : pageIndex === 2
          ? "buyer"
          : "following";

      if (newTab !== activeTab) {
        setActiveTab(newTab);
        // 触发懒加载：如果该 tab 尚未加载，则加载数据
        loadTabData(newTab);
      }
    },
    [activeTab, loadTabData]
  );

  // 处理刷新 — read `activeTab` through a ref so the callback identity stays
  // stable across tab switches. Otherwise `onRefresh` changes every time
  // `activeTab` flips, invalidating the `refreshControl` memo in every
  // TabContent and defeating `TabContent.memo` on tab switches.
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const onRefresh = useCallback(() => {
    handleRefresh(activeTabRef.current);
  }, [handleRefresh]);

  // 处理帖子点击
  const handlePostPress = useCallback(
    (post: Post) => {
      console.log("查看帖子详情:", post.id);
      (navigation.navigate as any)("PostDetail", { postId: post.id });
    },
    [navigation]
  );

  // 处理作者点击 — use refs to avoid depending on entire post arrays
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

  // 买手店 Tab 专用导航：选中的店铺卡片 / 分类入口 / 单品全部走 navigation
  const handleBuyerStorePress = useCallback(
    (storeId: string) => {
      (navigation.navigate as any)("StoreDetail", { storeId });
    },
    [navigation]
  );

  // 顶部横向选择条末尾"查看全部"入口：跳到 AllBuyerStoresScreen。
  // 这个回调独立出来的目的是让 BuyerTab 内部不感知具体路由名，只认
  // "我要看全部"这个语义，后续如果换成 Modal/BottomSheet 也能原地替换。
  const handleOpenAllBuyerStores = useCallback(() => {
    (navigation.navigate as any)("AllBuyerStores");
  }, [navigation]);

  // Phase 4：入口卡片（分类 / 折扣 / 新品）分流到 StoreProductList。
  // 这里单纯做一次 `navigate(name, params)` 转发，业务语义（mode /
  // categoryId）已经在 BuyerTab 里解释完毕，不再二次翻译。
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
      // 买手店 Tab 现在只展示商家真实上架的单品（去 mock 后），必定有 realProductId。
      (navigation.navigate as any)("StoreProductDetail", {
        productId: product.realProductId,
      });
    },
    [navigation]
  );

  // 处理 Banner 点击
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

  // 加载中状态（骨架屏）
  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="dark-content" />
        <SkeletonHeader opacity={skeletonOpacity} />
        <SkeletonTabBar opacity={skeletonOpacity} />
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

  // 获取用户头像URL
  const userAvatarUrl = currentUserInfo?.avatarUrl || user?.avatar;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      {/* 顶部栏 - Logo视频 + 头像 + 通知 + 搜索框（滚动时可收起） */}
      <Reanimated.View style={[{ overflow: "hidden" }, headerAnimatedStyle]}>
        <DiscoverHeader
          avatar={userAvatarUrl}
          totalInteractionUnread={totalInteractionUnread}
          onAvatarPress={handleAvatarPress}
          onSearchPress={handleSearchPress}
          onInteractionPress={handleInteractionPress}
        />
      </Reanimated.View>

      {/* Tab 栏 - 居中样式 */}
      <DiscoverTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* 水平滑动容器 */}
      <RNScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        style={{ flex: 1 }}
      >
        <TabContent
          tab="forum"
          tabPosts={forumPosts}
          banners={banners}
          communities={communities}
          error={error}
          refreshing={refreshing}
          tabLoading={tabLoading.forum}
          tabLoaded={tabLoaded.forum}
          isActive={activeTab === "forum"}
          onRefresh={onRefresh}
          onScroll={handleVerticalScroll}
          onPostPress={handlePostPress}
          onAuthorPress={handleAuthorPress}
          onLike={handleLike}
          onBannerPress={handleBannerPress}
        />
        <TabContent
          tab="recommend"
          tabPosts={recommendPosts}
          banners={banners}
          communities={communities}
          error={error}
          refreshing={refreshing}
          tabLoading={tabLoading.recommend}
          tabLoaded={tabLoaded.recommend}
          isActive={activeTab === "recommend"}
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
        {/* 买手店 Tab —— 统一走 <TabContent tab="buyer" />，内部 dispatcher
            会 delegate 到 BuyerTabContent 子组件。`isActive` 是懒加载开关，
            避免冷启动瞬间和推荐 Feed 抢同一批 HTTP slot。 */}
        <TabContent
          tab="buyer"
          isActive={activeTab === "buyer"}
          onScroll={handleVerticalScroll}
          onSearchPress={handleSearchPress}
          onStorePress={handleBuyerStorePress}
          onProductPress={handleBuyerProductPress}
          onOpenAllStores={handleOpenAllBuyerStores}
          onOpenProductList={handleOpenProductList}
        />
        <TabContent
          tab="following"
          tabPosts={followingPosts}
          banners={banners}
          communities={communities}
          error={error}
          refreshing={refreshing}
          tabLoading={tabLoading.following}
          tabLoaded={tabLoaded.following}
          isActive={activeTab === "following"}
          onRefresh={onRefresh}
          onScroll={handleVerticalScroll}
          onPostPress={handlePostPress}
          onAuthorPress={handleAuthorPress}
          onLike={handleLike}
          onBannerPress={handleBannerPress}
        />
      </RNScrollView>
    </SafeAreaView>
  );
};

export default DiscoverScreen;
