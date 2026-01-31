import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Animated,
  ScrollView as RNScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Box, ScrollView, VStack, HStack } from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import { Post } from "../../components/PostCard";
import { Banner } from "../../services/bannerService";
import { TabType } from "./types";
import { SCREEN_WIDTH, TAB_INDEX_MAP } from "./constants";
import { styles } from "./styles";
import { SkeletonPostCard, useSkeletonAnimation } from "./components/SkeletonPostCard";
import { DiscoverTabBar } from "./components/DiscoverTabBar";
import { TabContent } from "./components/TabContent";
import { useDiscoverData } from "./hooks/useDiscoverData";
import { useHeaderAnimation } from "./hooks/useHeaderAnimation";

// 骨架屏 Tab 栏占位
const SkeletonTabBar: React.FC<{
  opacity: Animated.AnimatedInterpolation<number>;
}> = ({ opacity }) => (
  <Box borderBottomWidth={1} borderBottomColor="$gray100">
    <HStack justifyContent="space-between" alignItems="center" py="$sm" px="$md">
      <HStack justifyContent="center" alignItems="center" gap="$sm">
        <Animated.View
          style={{
            width: 40,
            height: 20,
            borderRadius: 4,
            backgroundColor: "#e5e5e5",
            opacity,
          }}
        />
        <Animated.View
          style={{
            width: 40,
            height: 20,
            borderRadius: 4,
            backgroundColor: "#e5e5e5",
            opacity,
          }}
        />
        <Animated.View
          style={{
            width: 40,
            height: 20,
            borderRadius: 4,
            backgroundColor: "#e5e5e5",
            opacity,
          }}
        />
      </HStack>
      <Animated.View
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          backgroundColor: "#e5e5e5",
          opacity,
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
  const [activeTab, setActiveTab] = useState<TabType>("recommend");

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
    handleRefresh,
    handleLike,
  } = useDiscoverData();

  // Header 动画 Hook
  const {
    headerOpacity,
    handleVerticalScroll,
    interpolatedHeaderHeight,
  } = useHeaderAnimation();

  // 骨架屏动画
  const { skeletonOpacity } = useSkeletonAnimation();

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

  // 处理标签切换
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    scrollViewRef.current?.scrollTo({
      x: TAB_INDEX_MAP[tab] * SCREEN_WIDTH,
      animated: true,
    });
  }, []);

  // 处理滑动结束
  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const pageIndex = Math.round(offsetX / SCREEN_WIDTH);
      const newTab: TabType =
        pageIndex === 0 ? "forum" : pageIndex === 1 ? "recommend" : "following";

      if (newTab !== activeTab) {
        setActiveTab(newTab);
      }
    },
    [activeTab]
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
      console.log("查看作者资料:", authorId);
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
            (navigation.navigate as any)("BrandDetail", { brandSlug: banner.linkValue });
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
        <ScreenHeader
          title="AVANT REGARD"
          subtitle="时尚内容流"
          boldTitle={true}
          borderless
        />
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

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* 动画 Header */}
      <Animated.View
        style={{
          height: interpolatedHeaderHeight,
          opacity: headerOpacity,
          overflow: "hidden",
        }}
      >
        <ScreenHeader
          title="AVANT REGARD"
          subtitle="时尚内容流"
          boldTitle={true}
          borderless
        />
      </Animated.View>

      {/* Tab 栏 - 吸顶 */}
      <DiscoverTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSearchPress={handleSearchPress}
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
