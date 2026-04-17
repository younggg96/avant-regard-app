import React, { useCallback, useMemo } from "react";
import {
  RefreshControl,
  ActivityIndicator,
  View,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  FlatList,
  ListRenderItemInfo,
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
import { SCREEN_WIDTH } from "../constants";
import { PopularCommunities } from "./PopularCommunities";
import { BrandSection } from "./BrandSection";


interface TabContentProps {
  tab: TabType;
  tabPosts: DisplayPost[];
  banners: Banner[];
  communities: CommunityListResponse | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  tabLoading: boolean;
  tabLoaded: boolean;
  onRefresh: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onPostPress: (post: Post) => void;
  onAuthorPress: (authorId: string) => void;
  onLike: (postId: string) => void;
  onBannerPress: (banner: Banner) => void;
  /**
   * 无限滚动：触底加载下一页（仅推荐 Tab 使用；不传则关闭）。
   */
  onEndReached?: () => void;
  /**
   * 是否还有更多帖子。`false` 时在列表底部显示「没有更多帖子」提示。
   */
  hasMore?: boolean;
  /**
   * 触发 loadMore 后、下一页返回前为 true（仅用于推荐 Tab 的 footer 指示）。
   */
  loadingMore?: boolean;
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

const convertToPost = (post: DisplayPost): Post => ({
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
});

const ESTIMATED_ITEM_SIZE = 280;

/**
 * Tab 内容组件 — 使用 MasonryFlashList 实现高性能瀑布流
 */
export const TabContent: React.FC<TabContentProps> = ({
  tab,
  tabPosts,
  banners,
  communities,
  error,
  loading,
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
  hasMore,
  loadingMore,
}) => {
  const currentPosts = useMemo(
    () => (Array.isArray(tabPosts) ? tabPosts.map(convertToPost) : []),
    [tabPosts]
  );

  const keyExtractor = useCallback((item: Post) => item.id, []);

  const renderMasonryItem = useCallback(
    ({ item }: MasonryListRenderItemInfo<Post>) => {
      if (!item || !item.id || !item.author) return null;
      return (
        <Box px={4} mb="$sm">
          <PostCard
            post={item}
            onPress={onPostPress}
            onAuthorPress={onAuthorPress}
            onLike={onLike}
          />
        </Box>
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
          data={currentPosts}
          keyExtractor={keyExtractor}
          renderItem={renderForumItem}
          ListHeaderComponent={forumHeader}
          onScroll={onScroll}
          scrollEventThrottle={16}
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

  // Footer：
  //   • 正在加载下一页 → Spinner + 文案
  //   • 已经没有更多帖子 → 提示用户稍后刷新查看
  //   • 其它情况（兼容旧行为） → 仅 loading 时显示
  const footer = (() => {
    if (loadingMore || (onEndReached == null && loading)) {
      return (
        <HStack justifyContent="center" alignItems="center" py="$lg">
          <ActivityIndicator color={theme.colors.accent} />
          <Text color="$gray400" fontSize="$sm" ml="$sm">加载更多...</Text>
        </HStack>
      );
    }
    if (onEndReached != null && hasMore === false && currentPosts.length > 0) {
      return (
        <View style={endFooterStyles.container}>
          <View style={endFooterStyles.divider} />
          <Text color="$gray400" fontSize="$sm" textAlign="center">
            已经没有更多的帖子了，请稍后刷新查看
          </Text>
          <View style={endFooterStyles.divider} />
        </View>
      );
    }
    return null;
  })();

  return (
    <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
      <MasonryFlashList
        data={currentPosts}
        numColumns={2}
        keyExtractor={keyExtractor}
        renderItem={renderMasonryItem}
        estimatedItemSize={ESTIMATED_ITEM_SIZE}
        ListHeaderComponent={masonryHeader}
        ListFooterComponent={footer}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
      />
    </View>
  );
};

const endFooterStyles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#ECECEC",
  },
});

export default TabContent;
