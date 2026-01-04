import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Animated,
  View,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
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
  getPosts,
  Post as ApiPost,
  ShowImageDetail,
  likePost,
  unlikePost,
} from "../services/postService";
import { userInfoService, UserInfo } from "../services/userInfoService";
import { useAuthStore } from "../store/authStore";

// 用于展示的Post类型（与PostCard组件兼容）
interface DisplayPost {
  id: string;
  type: string;
  auditStatus?: string; // 审核状态
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
  // 关联的秀场造型
  showImages?: ShowImageDetail[];
}

type TabType = "home" | "OUTFIT" | "DAILY_SHARE" | "ITEM_REVIEW" | "ARTICLES";

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

// API Post类型到前端Post类型的映射
const mapApiPostToDisplayPost = (
  apiPost: ApiPost,
  userInfoMap: Map<number, UserInfo>
): DisplayPost => {
  // 获取用户信息
  const userInfo = userInfoMap.get(apiPost.userId);

  // 生成默认头像（如果没有用户信息或没有头像）
  const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/png?seed=${apiPost.userId}`;

  return {
    id: String(apiPost.id),
    type: apiPost.postType, // Uses the exact Enum value
    auditStatus: apiPost.auditStatus, // 审核状态
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
      isLiked: false, // 后端暂不支持，默认false
      isSaved: false,
    },
    timestamp: getRelativeTime(apiPost.createdAt),
    // 关联的秀场造型
    showImages: apiPost.showImages,
  };
};

const DiscoverScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<DisplayPost[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 缓存用户信息
  const userInfoCache = useRef<Map<number, UserInfo>>(new Map());

  // 从后端获取帖子数据
  const fetchPosts = useCallback(async () => {
    try {
      setError(null);
      console.log("开始获取帖子数据...");
      const apiPosts = await getPosts();
      console.log("获取到帖子数量:", apiPosts.length);

      // 只显示已发布的帖子
      const publishedPosts = apiPosts.filter(
        (post) => post.status === "PUBLISHED"
      );

      // 收集所有不同的 userId
      const userIds = [...new Set(publishedPosts.map((post) => post.userId))];

      // 获取所有用户信息（只获取缓存中没有的）
      const userInfoMap = new Map<number, UserInfo>(userInfoCache.current);
      const uncachedUserIds = userIds.filter((id) => !userInfoMap.has(id));

      if (uncachedUserIds.length > 0) {
        // 并行获取用户信息
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

      // 转换为前端展示格式（带用户信息）
      const displayPosts = publishedPosts.map((post) =>
        mapApiPostToDisplayPost(post, userInfoMap)
      );
      setPosts(displayPosts);
    } catch (err) {
      console.error("获取帖子失败:", err);
      setError(err instanceof Error ? err.message : "获取帖子失败");
      setPosts([]);
    }
  }, []);

  // 初始化加载数据
  useEffect(() => {
    const initData = async () => {
      await fetchPosts();
      setIsInitialized(true);
    };
    initData();
  }, [fetchPosts]);

  // Convert DisplayPost to PostCard Post format
  const convertToPost = useCallback((post: DisplayPost): Post => {
    return {
      id: post.id,
      title: post.content.title,
      image: post.content.images[0] || "https://picsum.photos/id/1/600/800",
      auditStatus: post.auditStatus, // 传递审核状态
      author: {
        id: post.author.id,
        name: post.author.name,
        avatar: post.author.avatar,
      },
      likes: post.engagement.likes,
      isLiked: post.engagement.isLiked,
    };
  }, []);

  // Get current posts based on active tab with safety checks
  const getCurrentPosts = useCallback(() => {
    let rawPosts: DisplayPost[] = [];

    if (activeTab === "home") {
      // 主页显示所有帖子
      rawPosts = posts;
    } else {
      // 根据类型筛选帖子
      rawPosts = posts.filter((post) => post.type === activeTab);
    }

    return Array.isArray(rawPosts) ? rawPosts.map(convertToPost) : [];
  }, [activeTab, posts, convertToPost]);

  // Handle post interactions
  const handlePostPress = useCallback(
    (post: Post) => {
      console.log("查看帖子详情:", post);
      // 查找完整的原始帖子数据
      const fullPost = posts.find((p) => p.id === post.id);

      // 传递完整的帖子数据到详情页
      if (fullPost) {
        (navigation.navigate as any)("PostDetail", { post: fullPost });
      }
    },
    [navigation, posts]
  );

  const handleAuthorPress = useCallback(
    (authorId: string) => {
      console.log("查看作者资料:", authorId);
      // 查找作者信息
      const post = posts.find((p) => p.author.id === authorId);
      const userId = parseInt(authorId, 10);

      // 从缓存获取用户信息
      const cachedUserInfo = userInfoCache.current.get(userId);

      // 导航到用户主页
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

      // 先乐观更新UI
      const updatePost = (post: DisplayPost) =>
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
          : post;

      setPosts((prevPosts) => prevPosts.map(updatePost));

      // 然后调用API
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
        // 如果API调用失败，回滚UI状态
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

  // 获取各类型的帖子数量
  const getPostCountByType = useCallback(
    (type: TabType) => {
      if (type === "home") {
        return posts.length;
      }
      return posts.filter((post) => post.type === type).length;
    },
    [posts]
  );

  // 处理搜索按钮点击
  const handleSearchPress = useCallback(() => {
    (navigation.navigate as any)("Search");
  }, [navigation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }, [fetchPosts]);

  const handleLoadMore = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    // Simulate API call for more posts
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // In real app, fetch more posts from API
    setLoading(false);
  }, [loading]);

  const renderPost = useCallback(
    (post: Post, index: number) => {
      // Safety check for post
      if (!post || !post.id || !post.author) {
        console.warn("Invalid post:", post);
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

  // 骨架屏动画
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isInitialized) {
      const shimmerAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      shimmerAnimation.start();
      return () => shimmerAnimation.stop();
    }
  }, [isInitialized, shimmerAnim]);

  const skeletonOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  // 骨架屏组件
  const SkeletonBox = ({
    width,
    height,
    style,
  }: {
    width: number | string;
    height: number;
    style?: any;
  }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: theme.colors.gray200,
          borderRadius: 4,
          opacity: skeletonOpacity,
        },
        style,
      ]}
    />
  );

  // 骨架屏帖子卡片
  const SkeletonPostCard = () => {
    const screenWidth = Dimensions.get("window").width;
    return (
      <View style={styles.skeletonCard}>
        {/* 头部：头像 + 用户名 */}
        <View style={styles.skeletonCardHeader}>
          <Animated.View
            style={[styles.skeletonAvatar, { opacity: skeletonOpacity }]}
          />
          <View style={styles.skeletonUserInfo}>
            <SkeletonBox width={100} height={14} style={{ marginBottom: 4 }} />
            <SkeletonBox width={60} height={10} />
          </View>
        </View>
        {/* 图片区域 */}
        <Animated.View
          style={[
            styles.skeletonImage,
            { width: screenWidth - 32, opacity: skeletonOpacity },
          ]}
        />
        {/* 标题和描述 */}
        <View style={styles.skeletonContent}>
          <SkeletonBox width="90%" height={18} style={{ marginBottom: 8 }} />
          <SkeletonBox width="70%" height={14} style={{ marginBottom: 12 }} />
          {/* 互动栏 */}
          <View style={styles.skeletonActions}>
            <SkeletonBox width={50} height={20} />
            <SkeletonBox width={50} height={20} />
            <SkeletonBox width={50} height={20} />
          </View>
        </View>
      </View>
    );
  };

  // Show loading state until initialized (Skeleton)
  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScreenHeader
          title="AVANT REGARD"
          subtitle="时尚内容流"
          boldTitle={true}
          borderless
        />

        {/* Tab 栏骨架 */}
        <HStack
          borderBottomWidth={1}
          borderBottomColor="$gray100"
          px="$md"
          py="$md"
          gap="$md"
        >
          <SkeletonBox width={60} height={20} style={{ borderRadius: 4 }} />
          <SkeletonBox width={80} height={20} style={{ borderRadius: 4 }} />
          <SkeletonBox width={60} height={20} style={{ borderRadius: 4 }} />
          <SkeletonBox width={60} height={20} style={{ borderRadius: 4 }} />
          <SkeletonBox width={60} height={20} style={{ borderRadius: 4 }} />
        </HStack>

        {/* 帖子列表骨架 */}
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 16 }}
        >
          <SkeletonPostCard />
          <SkeletonPostCard />
          <SkeletonPostCard />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Get current posts
  const currentPosts = getCurrentPosts();

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title="AVANT REGARD"
        subtitle="时尚内容流"
        boldTitle={true}
        borderless
      />

      {/* Tab View with Types */}
      <HStack
        borderBottomWidth={1}
        borderBottomColor="$gray100"
        justifyContent="between"
        alignItems="center"
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          <Pressable
            py="$md"
            px="$md"
            mr="$md"
            borderBottomWidth={activeTab === "home" ? 2 : 0}
            borderBottomColor="$black"
            onPress={() => setActiveTab("home")}
          >
            <Text
              color={activeTab === "home" ? "$black" : "$gray400"}
              fontWeight={activeTab === "home" ? "$semibold" : "$normal"}
              fontSize="$sm"
            >
              主页 ({getPostCountByType("home")})
            </Text>
          </Pressable>

          <Pressable
            py="$md"
            px="$md"
            mr="$md"
            borderBottomWidth={activeTab === "OUTFIT" ? 2 : 0}
            borderBottomColor="$black"
            onPress={() => setActiveTab("OUTFIT")}
          >
            <Text
              color={activeTab === "OUTFIT" ? "$black" : "$gray400"}
              fontWeight={activeTab === "OUTFIT" ? "$semibold" : "$normal"}
              fontSize="$sm"
            >
              Lookbook ({getPostCountByType("OUTFIT")})
            </Text>
          </Pressable>

          <Pressable
            py="$md"
            px="$md"
            mr="$md"
            borderBottomWidth={activeTab === "DAILY_SHARE" ? 2 : 0}
            borderBottomColor="$black"
            onPress={() => setActiveTab("DAILY_SHARE")}
          >
            <Text
              color={activeTab === "DAILY_SHARE" ? "$black" : "$gray400"}
              fontWeight={activeTab === "DAILY_SHARE" ? "$semibold" : "$normal"}
              fontSize="$sm"
            >
              搭配 ({getPostCountByType("DAILY_SHARE")})
            </Text>
          </Pressable>

          <Pressable
            py="$md"
            px="$md"
            mr="$md"
            borderBottomWidth={activeTab === "ITEM_REVIEW" ? 2 : 0}
            borderBottomColor="$black"
            onPress={() => setActiveTab("ITEM_REVIEW")}
          >
            <Text
              color={activeTab === "ITEM_REVIEW" ? "$black" : "$gray400"}
              fontWeight={activeTab === "ITEM_REVIEW" ? "$semibold" : "$normal"}
              fontSize="$sm"
            >
              评测 ({getPostCountByType("ITEM_REVIEW")})
            </Text>
          </Pressable>

          <Pressable
            py="$md"
            px="$md"
            mr="$md"
            borderBottomWidth={activeTab === "ARTICLES" ? 2 : 0}
            borderBottomColor="$black"
            onPress={() => setActiveTab("ARTICLES")}
          >
            <Text
              color={activeTab === "ARTICLES" ? "$black" : "$gray400"}
              fontWeight={activeTab === "ARTICLES" ? "$semibold" : "$normal"}
              fontSize="$sm"
            >
              文章 ({getPostCountByType("ARTICLES")})
            </Text>
          </Pressable>
        </ScrollView>

        {/* Search Button - 暂时隐藏 */}
        {/* <Pressable
          onPress={handleSearchPress}
          px="$md"
          py="$sm"
          rounded="$md"
          ml="$sm"
        >
          <Ionicons name="search" size={18} color={theme.colors.gray700} />
        </Pressable> */}
      </HStack>

      {/* Content List */}
      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.accent]}
            tintColor={theme.colors.accent}
          />
        }
      >
        {error ? (
          <VStack
            flex={1}
            justifyContent="center"
            alignItems="center"
            py="$2xl"
          >
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
          <VStack
            flex={1}
            justifyContent="center"
            alignItems="center"
            py="$2xl"
          >
            <Ionicons
              name="newspaper-outline"
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
              {activeTab === "home" && "暂无主页内容"}
              {activeTab === "OUTFIT" && "暂无 Lookbook 内容"}
              {activeTab === "DAILY_SHARE" && "暂无搭配内容"}
              {activeTab === "ITEM_REVIEW" && "暂无评测内容"}
              {activeTab === "ARTICLES" && "暂无文章内容"}
            </Text>
            <Text color="$gray400" textAlign="center" lineHeight="$lg">
              {activeTab === "home" && "下拉刷新获取最新内容"}
              {activeTab === "OUTFIT" && "精彩的秀场系列即将到来"}
              {activeTab === "DAILY_SHARE" && "优秀的搭配灵感即将到来"}
              {activeTab === "ITEM_REVIEW" && "详细的产品评测即将到来"}
              {activeTab === "ARTICLES" && "深度的时尚文章即将到来"}
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
            <ActivityIndicator size="small" color={theme.colors.accent} />
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
  // 骨架屏样式
  skeletonCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    overflow: "hidden",
  },
  skeletonCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.gray200,
    marginRight: 12,
  },
  skeletonUserInfo: {
    flex: 1,
  },
  skeletonImage: {
    height: 300,
    backgroundColor: theme.colors.gray200,
    borderRadius: 8,
    marginHorizontal: 12,
  },
  skeletonContent: {
    padding: 12,
  },
  skeletonActions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
});

export default DiscoverScreen;
