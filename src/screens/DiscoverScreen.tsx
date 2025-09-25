import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import PostCard, { Post } from "../components/PostCard";
import { mockPosts } from "../data/mockPosts";
import { mockFavoritePosts } from "../data/mockFavoritePosts";

// 原始Post类型用于数据处理
interface OriginalPost {
  id: string;
  type: string;
  author: {
    id: string;
    name: string;
    avatar: string;
    isVerified?: boolean;
  };
  content: {
    title: string;
    images: string[];
  };
  engagement: {
    likes: number;
    isLiked?: boolean;
  };
}

const DiscoverScreen = () => {
  const navigation = useNavigation();
  const [posts, setPosts] = useState<OriginalPost[]>([] as OriginalPost[]);
  const [favoritePosts, setFavoritePosts] = useState<OriginalPost[]>(
    [] as OriginalPost[]
  );
  const [activeTab, setActiveTab] = useState<"home" | "favorites">("home");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize posts data safely
  useEffect(() => {
    try {
      // Initialize home posts
      if (mockPosts && Array.isArray(mockPosts) && mockPosts.length > 0) {
        const validPosts = mockPosts.filter(
          (post: any) =>
            post &&
            typeof post.id === "string" &&
            post.author &&
            post.content &&
            post.engagement
        );
        setPosts(validPosts.length > 0 ? (validPosts as any) : []);
      } else {
        console.warn("mockPosts is not a valid array or is empty:", mockPosts);
        setPosts([]);
      }

      // Initialize favorite posts
      if (
        mockFavoritePosts &&
        Array.isArray(mockFavoritePosts) &&
        mockFavoritePosts.length > 0
      ) {
        const validFavoritePosts = mockFavoritePosts.filter(
          (post: any) =>
            post &&
            typeof post.id === "string" &&
            post.author &&
            post.content &&
            post.engagement
        );
        setFavoritePosts(
          validFavoritePosts.length > 0 ? (validFavoritePosts as any) : []
        );
      } else {
        console.warn(
          "mockFavoritePosts is not a valid array or is empty:",
          mockFavoritePosts
        );
        setFavoritePosts([]);
      }
    } catch (error) {
      console.error("Error initializing posts:", error);
      setPosts([]);
      setFavoritePosts([]);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Convert OriginalPost to Post format
  const convertToPost = useCallback((post: OriginalPost): Post => {
    return {
      id: post.id,
      title: post.content.title,
      image: post.content.images[0] || "https://via.placeholder.com/300x400",
      author: {
        id: post.author.id,
        name: post.author.name,
        avatar: post.author.avatar,
        isVerified: post.author.isVerified,
      },
      likes: post.engagement.likes,
      isLiked: post.engagement.isLiked,
    };
  }, []);

  // Get current posts based on active tab with safety checks
  const getCurrentPosts = useCallback(() => {
    const rawPosts = activeTab === "home" ? posts : favoritePosts;
    return Array.isArray(rawPosts) ? rawPosts.map(convertToPost) : [];
  }, [activeTab, posts, favoritePosts, convertToPost]);

  // Handle post interactions
  const handlePostPress = useCallback((post: Post) => {
    console.log("查看帖子详情:", post.id);
  }, []);

  const handleAuthorPress = useCallback(
    (authorId: string) => {
      console.log("查看作者资料:", authorId);
      // 导航到设计师详情页面
      (navigation.navigate as any)("DesignerDetail", { id: authorId });
    },
    [navigation]
  );

  const handleItemPress = useCallback(
    (itemId: string) => {
      console.log("查看商品详情:", itemId);
      // 简化：暂时只记录日志
    },
    [navigation]
  );

  const handleLike = useCallback((postId: string) => {
    const updatePost = (post: OriginalPost) =>
      post.id === postId
        ? {
            ...post,
            engagement: {
              ...post.engagement,
              isLiked: !post.engagement.isLiked,
              likes: post.engagement.isLiked
                ? post.engagement.likes - 1
                : post.engagement.likes + 1,
            },
          }
        : post;

    setPosts((prevPosts) => prevPosts.map(updatePost));
    setFavoritePosts((prevPosts) => prevPosts.map(updatePost));
  }, []);

  // 移除不需要的handleSave和handleComment函数

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // In real app, fetch latest posts from API
    setRefreshing(false);
  }, []);

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

  const renderFooter = useCallback(() => {
    if (!loading) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
        <Text style={styles.loadingText}>加载更多...</Text>
      </View>
    );
  }, [loading]);

  // Show loading state until initialized
  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScreenHeader title="AVANT REGARD" subtitle="时尚内容流" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Get current posts
  const currentPosts = getCurrentPosts();

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader title="AVANT REGARD" subtitle="时尚内容流" />

      {/* Simple Tab View */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "home" && styles.activeTab]}
          onPress={() => setActiveTab("home")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "home" && styles.activeTabText,
            ]}
          >
            主页 ({Array.isArray(posts) ? posts.length : 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "favorites" && styles.activeTab]}
          onPress={() => setActiveTab("favorites")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "favorites" && styles.activeTabText,
            ]}
          >
            收藏相关 ({Array.isArray(favoritePosts) ? favoritePosts.length : 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content List */}
      <ScrollView
        style={styles.scrollView}
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
        {currentPosts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {activeTab === "home" ? "暂无主页内容" : "暂无收藏相关内容"}
            </Text>
            <Text style={styles.emptyDescription}>
              {activeTab === "home"
                ? "当有新的时尚内容时，您会在这里看到它们"
                : "收藏一些单品后，相关的搭配和评测会在这里显示"}
            </Text>
          </View>
        ) : (
          <View style={styles.waterfallContainer}>
            <View style={styles.leftColumn}>
              {currentPosts
                .filter((_, index) => index % 2 === 0)
                .map((post, index) => (
                  <View
                    key={post.id || `left-${index}`}
                    style={styles.postWrapper}
                  >
                    {renderPost(post, index * 2)}
                  </View>
                ))}
            </View>
            <View style={styles.rightColumn}>
              {currentPosts
                .filter((_, index) => index % 2 === 1)
                .map((post, index) => (
                  <View
                    key={post.id || `right-${index}`}
                    style={styles.postWrapper}
                  >
                    {renderPost(post, index * 2 + 1)}
                  </View>
                ))}
            </View>
          </View>
        )}
        {loading && (
          <View style={styles.loadingFooter}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
            <Text style={styles.loadingText}>加载更多...</Text>
          </View>
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
  scrollView: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  waterfallContainer: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  leftColumn: {
    flex: 1,
    paddingRight: theme.spacing.xs,
  },
  rightColumn: {
    flex: 1,
    paddingLeft: theme.spacing.xs,
  },
  postWrapper: {
    marginBottom: theme.spacing.sm,
  },
  tab: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    marginRight: theme.spacing.md,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.black,
  },
  tabText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
  },
  activeTabText: {
    color: theme.colors.black,
    fontWeight: "600",
  },
  contentContainer: {
    paddingTop: theme.spacing.sm,
  },
  emptyContentContainer: {
    flexGrow: 1,
    paddingTop: theme.spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: theme.spacing.xxl,
  },
  loadingFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: theme.spacing.lg,
  },
  loadingText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginLeft: theme.spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginBottom: theme.spacing.sm,
    textAlign: "center",
  },
  emptyDescription: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    textAlign: "center",
    lineHeight: 20,
  },
});

export default DiscoverScreen;
