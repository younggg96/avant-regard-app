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

const DiscoverScreen = () => {
  const navigation = useNavigation();
  const [posts, setPosts] = useState<Post[]>([] as Post[]);
  const [favoritePosts, setFavoritePosts] = useState<Post[]>([] as Post[]);
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
          (post) =>
            post &&
            typeof post.id === "string" &&
            post.author &&
            post.content &&
            post.engagement
        );
        setPosts(validPosts.length > 0 ? validPosts : []);
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
          (post) =>
            post &&
            typeof post.id === "string" &&
            post.author &&
            post.content &&
            post.engagement
        );
        setFavoritePosts(
          validFavoritePosts.length > 0 ? validFavoritePosts : []
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

  // Get current posts based on active tab with safety checks
  const getCurrentPosts = useCallback(() => {
    if (activeTab === "home") {
      return Array.isArray(posts) ? posts : [];
    } else {
      return Array.isArray(favoritePosts) ? favoritePosts : [];
    }
  }, [activeTab, posts, favoritePosts]);

  // Handle post interactions
  const handlePostPress = useCallback(
    (post: Post) => {
      console.log("Navigate to post detail:", post.id);
      // Navigate based on post type
      switch (post.type) {
        case "lookbook":
        case "outfit":
        case "review":
        case "article":
          // 简化：暂时只记录日志，不进行页面跳转
          console.log("查看帖子详情:", post.id, post.type);
          break;
      }
    },
    [navigation]
  );

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
    const updatePost = (post: Post) =>
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

  const handleSave = useCallback((postId: string) => {
    const updatePost = (post: Post) =>
      post.id === postId
        ? {
            ...post,
            engagement: {
              ...post.engagement,
              isSaved: !post.engagement.isSaved,
              saves: post.engagement.isSaved
                ? post.engagement.saves - 1
                : post.engagement.saves + 1,
            },
          }
        : post;

    setPosts((prevPosts) => prevPosts.map(updatePost));
    setFavoritePosts((prevPosts) => prevPosts.map(updatePost));
  }, []);

  const handleComment = useCallback((postId: string) => {
    console.log("Open comments for post:", postId);
    // Navigate to comments screen or open comments modal
  }, []);

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
    ({ item, index }: { item: Post; index?: number }) => {
      // Enhanced safety check for item
      if (
        !item ||
        typeof item !== "object" ||
        !item.id ||
        !item.author ||
        !item.content ||
        !item.engagement
      ) {
        console.warn("Invalid post item:", item);
        return null;
      }

      return (
        <PostCard
          post={item}
          onPress={handlePostPress}
          onAuthorPress={handleAuthorPress}
          onLike={handleLike}
          onSave={handleSave}
          onComment={handleComment}
          onItemPress={handleItemPress}
        />
      );
    },
    [
      handlePostPress,
      handleAuthorPress,
      handleLike,
      handleSave,
      handleComment,
      handleItemPress,
    ]
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

  // 移除keyExtractor，因为不再使用FlatList

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

  // Only proceed if we have initialized data
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

  // Ensure we have valid current posts data
  const currentPosts = getCurrentPosts();
  const safeCurrentPosts =
    Array.isArray(currentPosts) &&
    currentPosts.every(
      (post) =>
        post &&
        typeof post === "object" &&
        post.id &&
        post.author &&
        post.content &&
        post.engagement
    )
      ? currentPosts
      : [];

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
        {safeCurrentPosts.length === 0 ? (
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
          <>
            {safeCurrentPosts.map((post, index) => (
              <View key={post.id || index}>
                {renderPost({ item: post, index })}
              </View>
            ))}
            {loading && (
              <View style={styles.loadingFooter}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
                <Text style={styles.loadingText}>加载更多...</Text>
              </View>
            )}
          </>
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
