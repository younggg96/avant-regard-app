import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Animated,
  ScrollView as RNScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Box, ScrollView, VStack, HStack } from "../../components/ui";
import { Post } from "../../components/PostCard";
import { Banner } from "../../services/bannerService";
import { useAuthStore } from "../../store/authStore";
import { getUnreadCount } from "../../services/notificationService";
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
  const [currentUserInfo, setCurrentUserInfo] = useState<UserInfo | null>(null);

  // 滑动视图引用
  const scrollViewRef = useRef<RNScrollView>(null);
  const hasInitialScrolled = useRef(false);

  // 数据 Hook
  const {
    posts,
    forumPosts,
    banners,
    followingUserIds,
    communities,
    isInitialized,
    refreshing,
    loading,
    error,
    userInfoCache,
    tabLoading,
    tabLoaded,
    handleRefresh,
    handleLike,
    loadTabData,
  } = useDiscoverData();

  // Header 动画 Hook
  const {
    headerOpacity,
    handleVerticalScroll,
    interpolatedHeaderHeight,
  } = useHeaderAnimation();

  // 骨架屏动画
  const { skeletonOpacity } = useSkeletonAnimation();

  // 获取当前用户详细信息
  useEffect(() => {
    const fetchCurrentUserInfo = async () => {
      if (user?.userId) {
        try {
          const info = await userInfoService.getUserInfo(user.userId);
          setCurrentUserInfo(info);
        } catch (err) {
          console.warn("获取当前用户信息失败:", err);
        }
      }
    };
    fetchCurrentUserInfo();
  }, [user?.userId]);

  // 获取未读消息数量
  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      setUnreadNotificationCount(count);
    } catch (err) {
      console.warn("获取未读消息数量失败:", err);
    }
  }, []);

  // 页面聚焦时刷新未读消息数
  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  // 初始化时滚动到推荐 tab（index 1）
  useEffect(() => {
    if (isInitialized && !hasInitialScrolled.current) {
      hasInitialScrolled.current = true;
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: SCREEN_WIDTH, // recommend tab 在 index 1
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

  // 处理消息图标点击
  const handleNotificationPress = useCallback(() => {
    (navigation.navigate as any)("Notifications");
  }, [navigation]);

  // 处理标签切换 - 点击 tab 时也触发懒加载
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    scrollViewRef.current?.scrollTo({
      x: TAB_INDEX_MAP[tab] * SCREEN_WIDTH,
      animated: true,
    });
    // 触发懒加载
    loadTabData(tab);
  }, [loadTabData]);

  // 处理滑动结束 - 切换 tab 时触发懒加载
  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const pageIndex = Math.round(offsetX / SCREEN_WIDTH);
      const newTab: TabType =
        pageIndex === 0 ? "forum" : pageIndex === 1 ? "recommend" : "following";

      if (newTab !== activeTab) {
        setActiveTab(newTab);
        // 触发懒加载：如果该 tab 尚未加载，则加载数据
        loadTabData(newTab);
      }
    },
    [activeTab, loadTabData]
  );

  // 处理刷新
  const onRefresh = useCallback(() => {
    handleRefresh(activeTab);
  }, [handleRefresh, activeTab]);

  // 处理帖子点击
  const handlePostPress = useCallback(
    (post: Post) => {
      console.log("查看帖子详情:", post.id);
      (navigation.navigate as any)("PostDetail", { postId: post.id });
    },
    [navigation]
  );

  // 处理作者点击
  const handleAuthorPress = useCallback(
    (authorId: string) => {
      const post = posts.find((p) => p.author.id === authorId);
      const userId = parseInt(authorId, 10);
      const cachedUserInfo = userInfoCache.current.get(userId);

      (navigation.navigate as any)("UserProfile", {
        userId,
        username: cachedUserInfo?.username || post?.author.name,
        avatar: cachedUserInfo?.avatarUrl || post?.author.avatar,
      });
    },
    [navigation, posts, userInfoCache]
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
      {/* 顶部栏 - Logo视频 + 头像 + 通知 + 搜索框（滚动时可收起） */}
      <Animated.View
        style={{
          height: interpolatedHeaderHeight,
          opacity: headerOpacity,
          overflow: "hidden",
        }}
      >
        <DiscoverHeader
          avatar={userAvatarUrl}
          unreadCount={unreadNotificationCount}
          onAvatarPress={handleAvatarPress}
          onSearchPress={handleSearchPress}
          onNotificationPress={handleNotificationPress}
        />
      </Animated.View>

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
          posts={posts}
          forumPosts={forumPosts}
          followingUserIds={followingUserIds}
          banners={banners}
          communities={communities}
          error={error}
          loading={loading}
          refreshing={refreshing}
          tabLoading={tabLoading.forum}
          tabLoaded={tabLoaded.forum}
          onRefresh={onRefresh}
          onScroll={handleVerticalScroll}
          onPostPress={handlePostPress}
          onAuthorPress={handleAuthorPress}
          onLike={handleLike}
          onBannerPress={handleBannerPress}
        />
        <TabContent
          tab="recommend"
          posts={posts}
          forumPosts={forumPosts}
          followingUserIds={followingUserIds}
          banners={banners}
          communities={communities}
          error={error}
          loading={loading}
          refreshing={refreshing}
          tabLoading={tabLoading.recommend}
          tabLoaded={tabLoaded.recommend}
          onRefresh={onRefresh}
          onScroll={handleVerticalScroll}
          onPostPress={handlePostPress}
          onAuthorPress={handleAuthorPress}
          onLike={handleLike}
          onBannerPress={handleBannerPress}
        />
        <TabContent
          tab="following"
          posts={posts}
          forumPosts={forumPosts}
          followingUserIds={followingUserIds}
          banners={banners}
          communities={communities}
          error={error}
          loading={loading}
          refreshing={refreshing}
          tabLoading={tabLoading.following}
          tabLoaded={tabLoaded.following}
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
