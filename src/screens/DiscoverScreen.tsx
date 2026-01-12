import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Animated,
  View,
  Dimensions,
  ScrollView as RNScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { getFollowingUsers, FollowingUser } from "../services/followService";

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
  // 关联的秀场
  showImages?: ShowImageDetail[];
}

type TabType = "recommend" | "following";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
    // 关联的秀场
    showImages: apiPost.showImages,
  };
};

const DiscoverScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<DisplayPost[]>([]);
  const [followingUserIds, setFollowingUserIds] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("recommend");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 缓存用户信息
  const userInfoCache = useRef<Map<number, UserInfo>>(new Map());

  // 滑动视图引用
  const scrollViewRef = useRef<RNScrollView>(null);

  // Header 动画值
  const headerHeight = useRef(new Animated.Value(1)).current; // 1 = 显示, 0 = 隐藏
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const isHeaderVisible = useRef(true); // 追踪 header 当前状态，避免重复动画

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
      await Promise.all([fetchPosts(), fetchFollowingUsers()]);
      setIsInitialized(true);
    };
    initData();
  }, [fetchPosts]);

  // 获取关注的用户列表
  const fetchFollowingUsers = useCallback(async () => {
    if (!user?.userId) return;

    try {
      const followingList = await getFollowingUsers(user.userId);
      // 提取关注的用户 ID 列表
      const userIds = followingList.map((item: FollowingUser) => item.userId);
      setFollowingUserIds(userIds);
      console.log("关注的用户数量:", userIds.length);
    } catch (err) {
      console.error("获取关注列表失败:", err);
      setFollowingUserIds([]);
    }
  }, [user?.userId]);

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

  // 获取各类型的帖子数量（暂时不需要，因为不显示数量）
  const getPostCountByType = useCallback(
    (type: TabType) => {
      return posts.length;
    },
    [posts]
  );

  // 处理搜索按钮点击
  const handleSearchPress = useCallback(() => {
    (navigation.navigate as any)("Search");
  }, [navigation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === "recommend") {
      await fetchPosts();
    } else {
      // 关注标签页也刷新帖子和关注列表
      await Promise.all([fetchPosts(), fetchFollowingUsers()]);
    }
    setRefreshing(false);
  }, [fetchPosts, fetchFollowingUsers, activeTab]);

  // 处理垂直滚动（控制 header 显示/隐藏）
  const lastScrollY = useRef(0);
  const handleVerticalScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;
      const contentHeight = event.nativeEvent.contentSize.height;
      const layoutHeight = event.nativeEvent.layoutMeasurement.height;
      const scrollThreshold = 50; // 滚动阈值
      const bottomThreshold = 100; // 距离底部的阈值

      // 检测是否接近底部
      const isNearBottom =
        currentScrollY + layoutHeight >= contentHeight - bottomThreshold;

      // 向下滚动且超过阈值 - 隐藏 header
      if (
        currentScrollY > scrollThreshold &&
        currentScrollY > lastScrollY.current &&
        isHeaderVisible.current
      ) {
        isHeaderVisible.current = false;
        Animated.parallel([
          Animated.timing(headerHeight, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(headerOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }),
        ]).start();
      }
      // 向上滚动或接近顶部 - 显示 header（但如果在底部附近则不显示）
      else if (
        (currentScrollY < lastScrollY.current || currentScrollY <= 10) &&
        !isHeaderVisible.current &&
        !isNearBottom // 在底部附近时不显示 header
      ) {
        isHeaderVisible.current = true;
        Animated.parallel([
          Animated.timing(headerHeight, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(headerOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
        ]).start();
      }

      lastScrollY.current = currentScrollY;
    },
    [headerHeight, headerOpacity]
  );

  // 处理标签切换
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    // 滑动到对应页面
    const pageIndex = tab === "recommend" ? 0 : 1;
    scrollViewRef.current?.scrollTo({
      x: pageIndex * SCREEN_WIDTH,
      animated: true,
    });
  }, []);

  // 处理滑动结束
  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const pageIndex = Math.round(offsetX / SCREEN_WIDTH);
      const newTab: TabType = pageIndex === 0 ? "recommend" : "following";

      if (newTab !== activeTab) {
        setActiveTab(newTab);
      }
    },
    [activeTab]
  );

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

  // 渲染标签页内容
  const renderTabContent = useCallback(
    (tab: TabType) => {
      // 根据标签获取对应的帖子
      let tabPosts: DisplayPost[] = [];
      if (tab === "recommend") {
        // 推荐显示所有帖子
        tabPosts = posts;
      } else if (tab === "following") {
        // 关注标签只显示关注用户的帖子
        tabPosts = posts.filter((post) => {
          const authorId = parseInt(post.author.id, 10);
          return followingUserIds.includes(authorId);
        });
      }

      const currentPosts = Array.isArray(tabPosts)
        ? tabPosts.map(convertToPost)
        : [];

      return (
        <View style={{ width: SCREEN_WIDTH }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
            onScroll={handleVerticalScroll}
            scrollEventThrottle={16}
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
                <Text
                  color="$gray400"
                  textAlign="center"
                  lineHeight="$lg"
                  mb="$md"
                >
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
                  {tab === "recommend" && "暂无推荐内容"}
                  {tab === "following" && "暂无关注内容"}
                </Text>
                <Text color="$gray400" textAlign="center" lineHeight="$lg">
                  {tab === "recommend" && "下拉刷新获取最新内容"}
                  {tab === "following" && "关注更多用户查看他们的动态"}
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
        </View>
      );
    },
    [
      posts,
      followingUserIds,
      convertToPost,
      error,
      refreshing,
      handleRefresh,
      handleVerticalScroll,
      renderPost,
      loading,
    ]
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

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* 动画 Header */}
      <Animated.View
        style={{
          height: headerHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 80], // 根据实际 header 高度调整
          }),
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

      {/* Tab View with Types - 吸顶 */}
      <Box borderBottomWidth={1} borderBottomColor="$gray100">
        <HStack justifyContent="center" alignItems="center" py="$sm" gap="$sm">
          <Pressable
            py="$sm"
            px="$md"
            position="relative"
            onPress={() => handleTabChange("recommend")}
          >
            <Text
              color={activeTab === "recommend" ? "$black" : "$gray400"}
              fontWeight={activeTab === "recommend" ? "$semibold" : "$normal"}
              fontSize="$md"
            >
              推荐
            </Text>
            {activeTab === "recommend" && (
              <Box
                position="absolute"
                bottom={-4}
                left={0}
                right={0}
                height={3}
                bg="#000"
                borderRadius="$full"
              />
            )}
          </Pressable>

          <Pressable
            py="$sm"
            px="$md"
            position="relative"
            onPress={() => handleTabChange("following")}
          >
            <Text
              color={activeTab === "following" ? "$black" : "$gray400"}
              fontWeight={activeTab === "following" ? "$semibold" : "$normal"}
              fontSize="$md"
            >
              关注
            </Text>
            {activeTab === "following" && (
              <Box
                position="absolute"
                bottom={-4}
                left={0}
                right={0}
                height={3}
                bg="#000"
                borderRadius="$full"
              />
            )}
          </Pressable>
        </HStack>
      </Box>

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
        {renderTabContent("recommend")}
        {renderTabContent("following")}
      </RNScrollView>
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
