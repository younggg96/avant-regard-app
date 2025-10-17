import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack, VStack } from "../components/ui";
import { theme } from "../theme";
import PostCard, { Post } from "../components/PostCard";
import { mockPosts } from "../data/mockPosts";
import { mockFavoritePosts } from "../data/mockFavoritePosts";

interface SearchHistory {
  id: string;
  keyword: string;
  timestamp: number;
}

const SearchScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);

  // 加载搜索历史
  useEffect(() => {
    // 这里应该从 AsyncStorage 加载历史记录
    // 暂时使用模拟数据
    const mockHistory: SearchHistory[] = [
      { id: "1", keyword: "CHANEL", timestamp: Date.now() - 3600000 },
      { id: "2", keyword: "春夏系列", timestamp: Date.now() - 7200000 },
      { id: "3", keyword: "街头优雅", timestamp: Date.now() - 86400000 },
      { id: "4", keyword: "Saint Laurent", timestamp: Date.now() - 172800000 },
    ];
    setSearchHistory(mockHistory);
  }, []);

  // 合并所有帖子
  const allPosts = [...mockPosts, ...mockFavoritePosts];

  // 执行搜索
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    Keyboard.dismiss();
    setIsSearching(true);

    // 搜索逻辑：匹配标题、描述、标签、品牌名、作者名
    const query = searchQuery.toLowerCase().trim();
    const results = allPosts.filter((post) => {
      // 搜索标题
      if (post.content?.title?.toLowerCase().includes(query)) return true;

      // 搜索描述
      if (post.content?.description?.toLowerCase().includes(query)) return true;

      // 搜索标签
      if (post.content?.tags?.some((tag) => tag.toLowerCase().includes(query)))
        return true;

      // 搜索品牌名
      if (post.brandName?.toLowerCase().includes(query)) return true;

      // 搜索作者名
      if (post.author?.name?.toLowerCase().includes(query)) return true;

      // 搜索系列
      if (post.season?.toLowerCase().includes(query)) return true;

      return false;
    });

    setSearchResults(results);

    // 保存搜索历史
    const newHistoryItem: SearchHistory = {
      id: Date.now().toString(),
      keyword: searchQuery.trim(),
      timestamp: Date.now(),
    };

    setSearchHistory((prev) => {
      // 移除重复的关键词
      const filtered = prev.filter(
        (item) => item.keyword.toLowerCase() !== query
      );
      // 添加新搜索到顶部，最多保留10条
      return [newHistoryItem, ...filtered].slice(0, 10);
    });

    // 这里应该保存到 AsyncStorage
  }, [searchQuery, allPosts]);

  // 清除搜索
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  // 点击历史记录
  const handleHistoryClick = useCallback(
    (keyword: string) => {
      setSearchQuery(keyword);
      // 自动执行搜索
      setTimeout(() => {
        const query = keyword.toLowerCase().trim();
        const results = allPosts.filter((post) => {
          if (post.content?.title?.toLowerCase().includes(query)) return true;
          if (post.content?.description?.toLowerCase().includes(query))
            return true;
          if (
            post.content?.tags?.some((tag) => tag.toLowerCase().includes(query))
          )
            return true;
          if (post.brandName?.toLowerCase().includes(query)) return true;
          if (post.author?.name?.toLowerCase().includes(query)) return true;
          if (post.season?.toLowerCase().includes(query)) return true;
          return false;
        });
        setSearchResults(results);
        setIsSearching(true);
      }, 100);
    },
    [allPosts]
  );

  // 删除历史记录项
  const handleDeleteHistory = useCallback((id: string) => {
    setSearchHistory((prev) => prev.filter((item) => item.id !== id));
    // 这里应该更新 AsyncStorage
  }, []);

  // 清空所有历史
  const handleClearAllHistory = useCallback(() => {
    setSearchHistory([]);
    // 这里应该清空 AsyncStorage
  }, []);

  // 处理帖子点击
  const handlePostPress = useCallback(
    (post: any) => {
      console.log("查看帖子详情:", post.id);
      (navigation.navigate as any)("PostDetail", { post });
    },
    [navigation]
  );

  // 处理作者点击
  const handleAuthorPress = useCallback(
    (authorId: string) => {
      console.log("查看作者资料:", authorId);
      (navigation.navigate as any)("DesignerDetail", { id: authorId });
    },
    [navigation]
  );

  // 处理点赞
  const handleLike = useCallback((postId: string) => {
    console.log("点赞帖子:", postId);
    // 这里应该更新帖子状态
  }, []);

  // 转换帖子格式
  const convertToPost = (post: any): Post => {
    return {
      id: post.id,
      title: post.content?.title || "",
      image: post.content?.images?.[0] || "https://picsum.photos/id/1/600/800",
      author: {
        id: post.author?.id || "",
        name: post.author?.name || "",
        avatar: post.author?.avatar || "",
      },
      likes: post.engagement?.likes || 0,
      isLiked: post.engagement?.isLiked,
    };
  };

  // 分离左右列数据
  const getLeftColumnPosts = useCallback(() => {
    return searchResults.filter((_, index) => index % 2 === 0);
  }, [searchResults]);

  const getRightColumnPosts = useCallback(() => {
    return searchResults.filter((_, index) => index % 2 === 1);
  }, [searchResults]);

  // 渲染历史记录项
  const renderHistoryItem = ({ item }: { item: SearchHistory }) => (
    <Pressable
      onPress={() => handleHistoryClick(item.keyword)}
      px="$md"
      py="$sm"
    >
      <HStack alignItems="center" justifyContent="between">
        <HStack alignItems="center" flex={1} space="sm">
          <Ionicons
            name="time-outline"
            size={20}
            color={theme.colors.gray400}
          />
          <Text fontSize="$md" color="$gray800" flex={1} numberOfLines={1}>
            {item.keyword}
          </Text>
        </HStack>
        <Pressable
          onPress={() => handleDeleteHistory(item.id)}
          p="$xs"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={theme.colors.gray400} />
        </Pressable>
      </HStack>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <HStack
        px="$md"
        py="$sm"
        alignItems="center"
        space="sm"
        borderBottomWidth={1}
        borderBottomColor="$gray100"
      >
        {/* Back Button */}
        <Pressable onPress={() => navigation.goBack()} p="$xs">
          <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
        </Pressable>

        {/* Search Input */}
        <Box
          flex={1}
          bg="$gray100"
          rounded="$full"
          px="$md"
          py="$xs"
          flexDirection="row"
          alignItems="center"
        >
          <Ionicons
            name="search"
            size={20}
            color={theme.colors.gray400}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索帖子、作者、品牌..."
            placeholderTextColor={theme.colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={handleClearSearch}
              style={{ padding: 4 }}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.colors.gray400}
              />
            </TouchableOpacity>
          )}
        </Box>

        {/* Search Button */}
        <Pressable
          onPress={handleSearch}
          px="$lg"
          py="$sm"
          bg="$black"
          rounded="$md"
        >
          <Text color="$white" fontSize="$sm" fontWeight="$semibold">
            搜索
          </Text>
        </Pressable>
      </HStack>

      {/* Content Area */}
      {!isSearching ? (
        // 显示搜索历史
        <VStack flex={1}>
          {searchHistory.length > 0 && (
            <>
              <HStack
                px="$md"
                py="$md"
                justifyContent="between"
                alignItems="center"
              >
                <Text fontSize="$md" fontWeight="$semibold" color="$black">
                  搜索历史
                </Text>
                <Pressable onPress={handleClearAllHistory}>
                  <Text fontSize="$sm" color="$gray600">
                    清空
                  </Text>
                </Pressable>
              </HStack>

              <FlatList
                data={searchHistory}
                renderItem={renderHistoryItem}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
              />
            </>
          )}

          {searchHistory.length === 0 && (
            <VStack
              flex={1}
              justifyContent="center"
              alignItems="center"
              px="$xl"
            >
              <Ionicons
                name="search-outline"
                size={64}
                color={theme.colors.gray300}
              />
              <Text
                fontSize="$lg"
                color="$gray600"
                fontWeight="$medium"
                mt="$md"
                textAlign="center"
              >
                搜索帖子
              </Text>
              <Text
                fontSize="$sm"
                color="$gray400"
                mt="$sm"
                textAlign="center"
                lineHeight="$lg"
              >
                输入关键词搜索帖子、作者、品牌等内容
              </Text>
            </VStack>
          )}
        </VStack>
      ) : (
        // 显示搜索结果
        <VStack flex={1}>
          <HStack px="$md" py="$md" alignItems="center">
            <Text fontSize="$md" color="$gray600">
              找到{" "}
              <Text fontWeight="$semibold" color="$black">
                {searchResults.length}
              </Text>{" "}
              个结果
            </Text>
          </HStack>

          {searchResults.length > 0 ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <HStack px="$sm" pt="$sm">
                {/* Left Column */}
                <VStack flex={1} pr="$xs">
                  {getLeftColumnPosts().map((item) => {
                    const post = convertToPost(item);
                    return (
                      <Box key={item.id} mb="$sm">
                        <PostCard
                          post={post}
                          onPress={() => handlePostPress(item)}
                          onAuthorPress={handleAuthorPress}
                          onLike={handleLike}
                        />
                      </Box>
                    );
                  })}
                </VStack>

                {/* Right Column */}
                <VStack flex={1} pl="$xs">
                  {getRightColumnPosts().map((item) => {
                    const post = convertToPost(item);
                    return (
                      <Box key={item.id} mb="$sm">
                        <PostCard
                          post={post}
                          onPress={() => handlePostPress(item)}
                          onAuthorPress={handleAuthorPress}
                          onLike={handleLike}
                        />
                      </Box>
                    );
                  })}
                </VStack>
              </HStack>
            </ScrollView>
          ) : (
            <VStack
              flex={1}
              justifyContent="center"
              alignItems="center"
              px="$xl"
            >
              <Ionicons
                name="search-outline"
                size={64}
                color={theme.colors.gray300}
              />
              <Text
                fontSize="$lg"
                color="$gray600"
                fontWeight="$medium"
                mt="$md"
                textAlign="center"
              >
                未找到相关内容
              </Text>
              <Text
                fontSize="$sm"
                color="$gray400"
                mt="$sm"
                textAlign="center"
                lineHeight="$lg"
              >
                试试其他关键词吧
              </Text>
            </VStack>
          )}
        </VStack>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.black,
    paddingVertical: 8,
  },
  scrollContent: {
    paddingBottom: 20,
  },
});

export default SearchScreen;
