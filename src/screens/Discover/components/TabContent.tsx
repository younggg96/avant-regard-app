import React, { useCallback } from "react";
import {
  RefreshControl,
  ActivityIndicator,
  View,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
} from "react-native";
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

interface TabContentProps {
  tab: TabType;
  posts: DisplayPost[];
  forumPosts: DisplayPost[];
  followingUserIds: number[];
  banners: Banner[];
  communities: CommunityListResponse | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  tabLoading: boolean; // 当前 tab 是否正在加载
  tabLoaded: boolean;  // 当前 tab 是否已加载过
  onRefresh: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onPostPress: (post: Post) => void;
  onAuthorPress: (authorId: string) => void;
  onLike: (postId: string) => void;
  onBannerPress: (banner: Banner) => void;
}

/**
 * GIF 加载组件 - 所有 tab 通用
 */
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
 * 将 DisplayPost 转换为 PostCard 需要的 Post 格式
 */
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
  // 论坛帖子所属社区
  communityId: post.communityId,
  communityName: post.communityName,
});

/**
 * Tab 内容组件
 * 渲染单个 Tab 页面的内容（帖子列表）
 * 支持懒加载：未加载时显示加载状态
 */
export const TabContent: React.FC<TabContentProps> = ({
  tab,
  posts,
  forumPosts,
  followingUserIds,
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
}) => {
  // 渲染单个帖子卡片
  const renderPost = useCallback(
    (post: Post) => {
      if (!post || !post.id || !post.author) {
        console.warn("Invalid post:", post);
        return null;
      }

      return (
        <PostCard
          post={post}
          onPress={onPostPress}
          onAuthorPress={onAuthorPress}
          onLike={onLike}
        />
      );
    },
    [onPostPress, onAuthorPress, onLike]
  );

  // 根据标签获取对应的帖子
  const getTabPosts = (): DisplayPost[] => {
    if (tab === "forum") {
      // 论坛显示论坛帖子（按点赞数排序-热门）
      return [...forumPosts].sort(
        (a, b) => b.engagement.likes - a.engagement.likes
      );
    } else if (tab === "recommend") {
      // 发现显示非论坛帖子（排除有 communityId 的帖子）
      return posts.filter((post) => !post.communityId);
    } else if (tab === "following") {
      // 关注标签只显示关注用户的非论坛帖子
      return posts.filter((post) => {
        const authorId = parseInt(post.author.id, 10);
        return followingUserIds.includes(authorId) && !post.communityId;
      });
    }
    return [];
  };

  const tabPosts = getTabPosts();
  const currentPosts = Array.isArray(tabPosts) ? tabPosts.map(convertToPost) : [];

  // 获取空状态提示文案
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

  const emptyState = getEmptyStateText();

  // 懒加载：如果当前 tab 正在加载或尚未加载，显示加载状态
  // 论坛和关注 tab 使用视频 loading，推荐 tab 使用默认 loading
  if (tabLoading || !tabLoaded) {
    return (
      <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
        <GifLoading />
      </View>
    );
  }

  return (
    <View style={{ width: SCREEN_WIDTH }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.accent]}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* Banner 轮播图 - 只在论坛 tab 显示 */}
        {tab === "forum" && banners.length > 0 && (
          <BannerCarousel banners={banners} onBannerPress={onBannerPress} />
        )}

        {/* 热门社区 - 只在论坛 tab 显示 */}
        {tab === "forum" && <PopularCommunities communities={communities} />}

        {error ? (
          // 错误状态
          <VStack flex={1} justifyContent="center" alignItems="center" py="$2xl">
            <Ionicons
              name="cloud-offline-outline"
              size={48}
              color={theme.colors.gray400}
            />
            <Text
              fontSize="$lg"
              color="$black"
              fontWeight="$medium"
              mb="$sm"
              mt="$md"
              textAlign="center"
            >
              加载失败
            </Text>
            <Text color="$gray400" textAlign="center" lineHeight="$lg" mb="$md">
              {error}
            </Text>
            <Pressable
              onPress={onRefresh}
              px="$lg"
              py="$sm"
              bg="$black"
              rounded="$md"
            >
              <Text color="$white" fontWeight="$medium">
                点击重试
              </Text>
            </Pressable>
          </VStack>
        ) : currentPosts.length === 0 ? (
          // 空状态
          <VStack flex={1} justifyContent="center" alignItems="center" py="$2xl">
            <Ionicons
              name={tab === "forum" ? "chatbubbles-outline" : "newspaper-outline"}
              size={48}
              color={theme.colors.gray400}
            />
            <Text
              fontSize="$lg"
              color="$black"
              fontWeight="$medium"
              mb="$sm"
              mt="$md"
              textAlign="center"
            >
              {emptyState.title}
            </Text>
            <Text color="$gray400" textAlign="center" lineHeight="$lg">
              {emptyState.subtitle}
            </Text>
          </VStack>
        ) : tab === "forum" ? (
          // 论坛帖子列表（横向排版）
          <VStack>
            {currentPosts.map((post, index) => (
              <ForumPostCard
                key={post.id || `forum-${index}`}
                post={post}
                onPress={onPostPress}
                onAuthorPress={onAuthorPress}
                onLike={onLike}
              />
            ))}
          </VStack>
        ) : (
          // 发现/关注帖子列表（两列瀑布流布局）
          <HStack px="$sm" pt="$sm" alignItems="start">
            <VStack flex={1} pr="$xs">
              {currentPosts
                .filter((_, index) => index % 2 === 0)
                .map((post, index) => (
                  <Box key={post.id || `left-${index}`} mb="$sm">
                    {renderPost(post)}
                  </Box>
                ))}
            </VStack>
            <VStack flex={1} pl="$xs">
              {currentPosts
                .filter((_, index) => index % 2 === 1)
                .map((post, index) => (
                  <Box key={post.id || `right-${index}`} mb="$sm">
                    {renderPost(post)}
                  </Box>
                ))}
            </VStack>
          </HStack>
        )}

        {/* 加载更多指示器 */}
        {loading && (
          <HStack justifyContent="center" alignItems="center" py="$lg">
            <ActivityIndicator color={theme.colors.accent} />
            <Text color="$gray400" fontSize="$sm" ml="$sm">
              加载更多...
            </Text>
          </HStack>
        )}
      </ScrollView>
    </View>
  );
};

export default TabContent;
