import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Box, Text, ScrollView, Pressable, VStack, HStack } from "../components/ui";
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
      <HStack justifyContent="center" alignItems="center" py="$lg">
        <ActivityIndicator size="small" color={theme.colors.accent} />
        <Text color="$gray400" fontSize="$sm" ml="$sm">
          加载更多...
        </Text>
      </HStack>
    );
  }, [loading]);

  // Show loading state until initialized
  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScreenHeader
          title="AVANT REGARD"
          subtitle="时尚内容流"
          boldTitle={true}
          borderless
        />

        <VStack flex={1} justifyContent="center" alignItems="center" py="$2xl">
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text color="$gray400" fontSize="$sm" mt="$sm">
            加载中...
          </Text>
        </VStack>
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

      {/* Simple Tab View */}
      <HStack px="$md" borderBottomWidth={1} borderBottomColor="$gray100">
        <Pressable
          py="$md"
          px="$lg"
          mr="$md"
          borderBottomWidth={activeTab === "home" ? 2 : 0}
          borderBottomColor="$black"
          onPress={() => setActiveTab("home")}
        >
          <Text
            color={activeTab === "home" ? "$black" : "$gray400"}
            fontWeight={activeTab === "home" ? "$semibold" : "$normal"}
          >
            主页 ({Array.isArray(posts) ? posts.length : 0})
          </Text>
        </Pressable>
        <Pressable
          py="$md"
          px="$lg"
          mr="$md"
          borderBottomWidth={activeTab === "favorites" ? 2 : 0}
          borderBottomColor="$black"
          onPress={() => setActiveTab("favorites")}
        >
          <Text
            color={activeTab === "favorites" ? "$black" : "$gray400"}
            fontWeight={activeTab === "favorites" ? "$semibold" : "$normal"}
          >
            收藏相关 ({Array.isArray(favoritePosts) ? favoritePosts.length : 0})
          </Text>
        </Pressable>
      </HStack>

      {/* Content List */}
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
        {currentPosts.length === 0 ? (
          <VStack flex={1} justifyContent="center" alignItems="center" py="$2xl">
            <Text fontSize="$lg" color="$black" fontWeight="$medium" mb="$sm" textAlign="center">
              {activeTab === "home" ? "暂无主页内容" : "暂无收藏相关内容"}
            </Text>
            <Text color="$gray400" textAlign="center" lineHeight="$lg">
              {activeTab === "home"
                ? "当有新的时尚内容时，您会在这里看到它们"
                : "收藏一些单品后，相关的搭配和评测会在这里显示"}
            </Text>
          </VStack>
        ) : (
          <HStack px="$sm" pt="$sm">
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
});

export default DiscoverScreen;
