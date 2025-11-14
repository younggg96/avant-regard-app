import React, { useState, useCallback, useEffect } from "react";
import { StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
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
import { mockPosts } from "../data/mockPosts";

// 原始Post类型用于数据处理
interface OriginalPost {
  id: string;
  type: string;
  author: {
    id: string;
    name: string;
    avatar: string;
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

type TabType = "home" | "lookbook" | "outfit" | "review" | "article";

const DiscoverScreen = () => {
  const navigation = useNavigation();
  const [posts, setPosts] = useState<OriginalPost[]>([] as OriginalPost[]);
  const [activeTab, setActiveTab] = useState<TabType>("home");
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
    } catch (error) {
      console.error("Error initializing posts:", error);
      setPosts([]);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Convert OriginalPost to Post format
  const convertToPost = useCallback((post: OriginalPost): Post => {
    return {
      id: post.id,
      title: post.content.title,
      image: post.content.images[0] || "https://picsum.photos/id/1/600/800",
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
    let rawPosts: OriginalPost[] = [];

    if (activeTab === "home") {
      // 主页显示所有帖子
      rawPosts = posts;
    } else {
      // 根据类型筛选帖子
      rawPosts = posts.filter((post: any) => post.type === activeTab);
    }

    return Array.isArray(rawPosts) ? rawPosts.map(convertToPost) : [];
  }, [activeTab, posts, convertToPost]);

  // Handle post interactions
  const handlePostPress = useCallback(
    (post: Post) => {
      console.log("查看帖子详情:", post.id);
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
      // 导航到设计师详情页面
      (navigation.navigate as any)("DesignerDetail", { id: authorId });
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
  }, []);

  // 获取各类型的帖子数量
  const getPostCountByType = useCallback(
    (type: TabType) => {
      if (type === "home") {
        return posts.length;
      }
      return posts.filter((post: any) => post.type === type).length;
    },
    [posts]
  );

  // 处理搜索按钮点击
  const handleSearchPress = useCallback(() => {
    (navigation.navigate as any)("Search");
  }, [navigation]);

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
            borderBottomWidth={activeTab === "lookbook" ? 2 : 0}
            borderBottomColor="$black"
            onPress={() => setActiveTab("lookbook")}
          >
            <Text
              color={activeTab === "lookbook" ? "$black" : "$gray400"}
              fontWeight={activeTab === "lookbook" ? "$semibold" : "$normal"}
              fontSize="$sm"
            >
              Lookbook ({getPostCountByType("lookbook")})
            </Text>
          </Pressable>

          <Pressable
            py="$md"
            px="$md"
            mr="$md"
            borderBottomWidth={activeTab === "outfit" ? 2 : 0}
            borderBottomColor="$black"
            onPress={() => setActiveTab("outfit")}
          >
            <Text
              color={activeTab === "outfit" ? "$black" : "$gray400"}
              fontWeight={activeTab === "outfit" ? "$semibold" : "$normal"}
              fontSize="$sm"
            >
              搭配 ({getPostCountByType("outfit")})
            </Text>
          </Pressable>

          <Pressable
            py="$md"
            px="$md"
            mr="$md"
            borderBottomWidth={activeTab === "review" ? 2 : 0}
            borderBottomColor="$black"
            onPress={() => setActiveTab("review")}
          >
            <Text
              color={activeTab === "review" ? "$black" : "$gray400"}
              fontWeight={activeTab === "review" ? "$semibold" : "$normal"}
              fontSize="$sm"
            >
              评测 ({getPostCountByType("review")})
            </Text>
          </Pressable>

          <Pressable
            py="$md"
            px="$md"
            mr="$md"
            borderBottomWidth={activeTab === "article" ? 2 : 0}
            borderBottomColor="$black"
            onPress={() => setActiveTab("article")}
          >
            <Text
              color={activeTab === "article" ? "$black" : "$gray400"}
              fontWeight={activeTab === "article" ? "$semibold" : "$normal"}
              fontSize="$sm"
            >
              文章 ({getPostCountByType("article")})
            </Text>
          </Pressable>
        </ScrollView>

        {/* Search Button */}
        <Pressable
          onPress={handleSearchPress}
          px="$md"
          py="$sm"
          rounded="$md"
          ml="$sm"
        >
          <Ionicons name="search" size={18} color={theme.colors.gray700} />
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
          <VStack
            flex={1}
            justifyContent="center"
            alignItems="center"
            py="$2xl"
          >
            <Text
              fontSize="$lg"
              color="$black"
              fontWeight="$medium"
              mb="$sm"
              textAlign="center"
            >
              {activeTab === "home" && "暂无主页内容"}
              {activeTab === "lookbook" && "暂无 Lookbook 内容"}
              {activeTab === "outfit" && "暂无搭配内容"}
              {activeTab === "review" && "暂无评测内容"}
              {activeTab === "article" && "暂无文章内容"}
            </Text>
            <Text color="$gray400" textAlign="center" lineHeight="$lg">
              {activeTab === "home" && "当有新的时尚内容时，您会在这里看到它们"}
              {activeTab === "lookbook" && "精彩的秀场系列即将到来"}
              {activeTab === "outfit" && "优秀的搭配灵感即将到来"}
              {activeTab === "review" && "详细的产品评测即将到来"}
              {activeTab === "article" && "深度的时尚文章即将到来"}
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
