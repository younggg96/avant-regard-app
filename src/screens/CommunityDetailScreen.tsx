/**
 * 社区详情页
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  View,
  Dimensions,
  Image,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  Box,
  Text,
  ScrollView,
  Pressable,
  VStack,
  HStack,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import PostCard, { Post } from "../components/PostCard";
import {
  getPostsByCommunityId,
  Post as ApiPost,
  likePost,
  unlikePost,
} from "../services/postService";
import {
  getCommunityById,
  Community,
  followCommunity,
  unfollowCommunity,
} from "../services/communityService";
import { userInfoService, UserInfo } from "../services/userInfoService";
import { useAuthStore } from "../store/authStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type RouteParams = {
  CommunityDetail: {
    communityId: number;
  };
};

// 计算相对时间
const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) return "刚刚";
  if (diffInMinutes < 60) return `${diffInMinutes}分钟前`;
  if (diffInHours < 24) return `${diffInHours}小时前`;
  if (diffInDays < 7) return `${diffInDays}天前`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}周前`;
  return `${Math.floor(diffInDays / 30)}个月前`;
};

// 用于展示的Post类型
interface DisplayPost {
  id: string;
  type: string;
  auditStatus?: string;
  author: {
    id: string;
    name: string;
    avatar: string;
    isVerified?: boolean;
  };
  content: {
    title: string;
    description?: string;
    images: string[];
    tags?: string[];
  };
  engagement: {
    likes: number;
    saves: number;
    comments: number;
    isLiked?: boolean;
    isSaved?: boolean;
  };
  timestamp: string;
}

// API Post类型到前端Post类型的映射
const mapApiPostToDisplayPost = (
  apiPost: ApiPost,
  userInfoMap: Map<number, UserInfo>
): DisplayPost => {
  const userInfo = userInfoMap.get(apiPost.userId);
  const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/png?seed=${apiPost.userId}`;

  return {
    id: String(apiPost.id),
    type: apiPost.postType,
    auditStatus: apiPost.auditStatus,
    author: {
      id: String(apiPost.userId),
      name: userInfo?.username || apiPost.username || "匿名用户",
      avatar: userInfo?.avatarUrl || defaultAvatar,
      isVerified: false,
    },
    content: {
      title: apiPost.title || "无标题",
      description: apiPost.contentText || "",
      images:
        apiPost.imageUrls && apiPost.imageUrls.length > 0
          ? apiPost.imageUrls
          : ["https://picsum.photos/id/1/600/800"],
      tags: [],
    },
    engagement: {
      likes: apiPost.likeCount || 0,
      saves: apiPost.favoriteCount || 0,
      comments: apiPost.commentCount || 0,
      isLiked: apiPost.likedByMe || false,
      isSaved: apiPost.favoritedByMe || false,
    },
    timestamp: getRelativeTime(apiPost.createdAt),
  };
};

const CommunityDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "CommunityDetail">>();
  const { communityId } = route.params;
  const { user } = useAuthStore();

  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<DisplayPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userInfoCache = useRef<Map<number, UserInfo>>(new Map());

  // 获取社区详情
  const fetchCommunity = useCallback(async () => {
    try {
      const communityData = await getCommunityById(communityId);
      setCommunity(communityData);
    } catch (err) {
      console.error("获取社区详情失败:", err);
      setError(err instanceof Error ? err.message : "获取社区详情失败");
    }
  }, [communityId]);

  // 获取社区帖子
  const fetchPosts = useCallback(async () => {
    try {
      setError(null);
      const apiPosts = await getPostsByCommunityId(communityId);

      const userIds = [...new Set(apiPosts.map((post) => post.userId))];
      const userInfoMap = new Map<number, UserInfo>(userInfoCache.current);
      const uncachedUserIds = userIds.filter((id) => !userInfoMap.has(id));

      if (uncachedUserIds.length > 0) {
        const userInfoPromises = uncachedUserIds.map(async (userId) => {
          try {
            const info = await userInfoService.getUserInfo(userId);
            return { userId, info };
          } catch (err) {
            console.warn(`获取用户 ${userId} 信息失败:`, err);
            return null;
          }
        });

        const results = await Promise.all(userInfoPromises);
        results.forEach((result) => {
          if (result && result.info) {
            userInfoMap.set(result.userId, result.info);
            userInfoCache.current.set(result.userId, result.info);
          }
        });
      }

      const displayPosts = apiPosts.map((post) =>
        mapApiPostToDisplayPost(post, userInfoMap)
      );
      setPosts(displayPosts);
    } catch (err) {
      console.error("获取社区帖子失败:", err);
      setError(err instanceof Error ? err.message : "获取帖子失败");
      setPosts([]);
    }
  }, [communityId]);

  // 初始化加载数据
  useEffect(() => {
    const initData = async () => {
      await Promise.all([fetchCommunity(), fetchPosts()]);
      setIsInitialized(true);
    };
    initData();
  }, [fetchCommunity, fetchPosts]);

  // 处理关注/取消关注
  const handleFollowPress = useCallback(async () => {
    if (!community) return;

    // 检查用户是否已登录
    if (!user) {
      (navigation.navigate as any)("Auth");
      return;
    }

    try {
      if (community.isFollowing) {
        await unfollowCommunity(community.id);
        setCommunity((prev) =>
          prev
            ? {
              ...prev,
              isFollowing: false,
              memberCount: Math.max(0, prev.memberCount - 1),
            }
            : null
        );
      } else {
        await followCommunity(community.id);
        setCommunity((prev) =>
          prev
            ? {
              ...prev,
              isFollowing: true,
              memberCount: prev.memberCount + 1,
            }
            : null
        );
      }
    } catch (err) {
      console.error("关注操作失败:", err);
      // 显示用户友好的错误提示
      alert("关注操作失败，请稍后重试");
    }
  }, [community, user, navigation]);

  // Convert DisplayPost to PostCard Post format
  const convertToPost = useCallback((post: DisplayPost): Post => {
    return {
      id: post.id,
      title: post.content.title,
      image: post.content.images[0] || "https://picsum.photos/id/1/600/800",
      auditStatus: post.auditStatus,
      author: {
        id: post.author.id,
        name: post.author.name,
        avatar: post.author.avatar,
      },
      likes: post.engagement.likes,
      isLiked: post.engagement.isLiked,
    };
  }, []);

  // Handle post interactions
  const handlePostPress = useCallback(
    (post: Post) => {
      (navigation.navigate as any)("PostDetail", { postId: post.id });
    },
    [navigation]
  );

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
    [navigation, posts]
  );

  const handleLike = useCallback(
    async (postId: string) => {
      const targetPost = posts.find((p) => p.id === postId);
      if (!targetPost) return;

      const isCurrentlyLiked = targetPost.engagement.isLiked;

      // 乐观更新
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? {
              ...post,
              engagement: {
                ...post.engagement,
                isLiked: !isCurrentlyLiked,
                likes: isCurrentlyLiked
                  ? post.engagement.likes - 1
                  : post.engagement.likes + 1,
              },
            }
            : post
        )
      );

      try {
        const numericPostId = parseInt(postId, 10);
        const userId = user?.id ? parseInt(user.id, 10) : 0;

        if (isCurrentlyLiked) {
          await unlikePost(numericPostId, userId);
        } else {
          await likePost(numericPostId, userId);
        }
      } catch (err) {
        console.error("点赞操作失败:", err);
        // 回滚
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.id === postId
              ? {
                ...post,
                engagement: {
                  ...post.engagement,
                  isLiked: isCurrentlyLiked,
                  likes: isCurrentlyLiked
                    ? post.engagement.likes + 1
                    : post.engagement.likes - 1,
                },
              }
              : post
          )
        );
      }
    },
    [posts, user]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchCommunity(), fetchPosts()]);
    setRefreshing(false);
  }, [fetchCommunity, fetchPosts]);

  // 处理发帖按钮
  const handlePublishPress = useCallback(() => {
    (navigation.navigate as any)("PublishForumPost", { communityId });
  }, [navigation, communityId]);

  // 渲染帖子
  const renderPost = useCallback(
    (post: Post, index: number) => {
      if (!post || !post.id || !post.author) {
        return null;
      }

      return (
        <PostCard
          post={post}
          onPress={handlePostPress}
          onAuthorPress={handleAuthorPress}
          onLike={handleLike}
        />
      );
    },
    [handlePostPress, handleAuthorPress, handleLike]
  );

  // 加载状态
  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScreenHeader
          title="社区"
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <VStack flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator size="small" color={theme.colors.gray400} />
          <Text color="$gray500" fontSize="$sm" mt="$md">
            加载中...
          </Text>
        </VStack>
      </SafeAreaView>
    );
  }

  const currentPosts = posts.map(convertToPost);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={community?.name || "社区"}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.accent]}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* 社区信息头部 */}
        {community && (
          <Box bg="$white" p="$lg" borderBottomWidth={1} borderBottomColor="$gray100">
            <HStack alignItems="center" gap="$md">
              <View style={styles.communityIcon}>
                {community.iconUrl ? (
                  <Image
                    source={{ uri: community.iconUrl }}
                    style={styles.communityImage}
                  />
                ) : (
                  <View style={styles.communityPlaceholder}>
                    <Text fontSize="$2xl" fontWeight="$bold" color="$white">
                      {community.name.charAt(0)}
                    </Text>
                  </View>
                )}
              </View>
              <VStack flex={1}>
                <Text fontSize="$lg" fontWeight="$bold" color="$black">
                  {community.name}
                </Text>
                <Text fontSize="$sm" color="$gray500" numberOfLines={2}>
                  {community.description || "暂无简介"}
                </Text>
                <HStack gap="$md" mt="$xs">
                  <Text fontSize="$xs" color="$gray400">
                    {community.memberCount} 成员
                  </Text>
                  <Text fontSize="$xs" color="$gray400">
                    {community.postCount} 帖子
                  </Text>
                </HStack>
              </VStack>
              <Pressable
                onPress={handleFollowPress}
                px="$md"
                py="$sm"
                rounded="$sm"
                bg={community.isFollowing ? "$gray100" : "$black"}
              >
                <Text
                  fontSize="$sm"
                  color={community.isFollowing ? "$black" : "$white"}
                  fontWeight="$medium"
                >
                  {community.isFollowing ? "已关注" : "关注"}
                </Text>
              </Pressable>
            </HStack>
          </Box>
        )}

        {/* 帖子列表 */}
        {error ? (
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
              onPress={handleRefresh}
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
          <VStack flex={1} justifyContent="center" alignItems="center" py="$2xl">
            <Ionicons
              name="chatbubbles-outline"
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
              暂无帖子
            </Text>
            <Text color="$gray400" textAlign="center" lineHeight="$lg">
              快来发布第一篇帖子吧
            </Text>
          </VStack>
        ) : (
          <HStack px="$sm" pt="$sm" alignItems="start">
            <VStack flex={1} pr="$xs">
              {currentPosts
                .filter((_, index) => index % 2 === 0)
                .map((post, index) => (
                  <Box key={post.id || `left-${index}`} mb="$sm">
                    {renderPost(post, index * 2)}
                  </Box>
                ))}
            </VStack>
            <VStack flex={1} pl="$xs">
              {currentPosts
                .filter((_, index) => index % 2 === 1)
                .map((post, index) => (
                  <Box key={post.id || `right-${index}`} mb="$sm">
                    {renderPost(post, index * 2 + 1)}
                  </Box>
                ))}
            </VStack>
          </HStack>
        )}

        {loading && (
          <HStack justifyContent="center" alignItems="center" py="$lg">
            <ActivityIndicator color={theme.colors.accent} />
            <Text color="$gray400" fontSize="$sm" ml="$sm">
              加载更多...
            </Text>
          </HStack>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  communityIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
  },
  communityImage: {
    width: "100%",
    height: "100%",
  },
  communityPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  publishButton: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default CommunityDetailScreen;
