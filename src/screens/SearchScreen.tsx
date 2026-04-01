import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack, VStack } from "../components/ui";
import { theme } from "../theme";
import PostCard, { Post } from "../components/PostCard";
import { searchPosts, likePost, unlikePost, Post as PostData } from "../services/postService";
import { searchUsers, UserInfo } from "../services/userInfoService";
import { searchBrands, Brand } from "../services/brandService";
import { useAuthStore } from "../store/authStore";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";

type SearchType = "posts" | "users" | "brands";

interface SearchHistory {
  id: string;
  keyword: string;
  timestamp: number;
}

const SearchScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("posts");
  const [postResults, setPostResults] = useState<PostData[]>([]);
  const [userResults, setUserResults] = useState<UserInfo[]>([]);
  const [brandResults, setBrandResults] = useState<Brand[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 加载搜索历史
  useEffect(() => {
    setSearchHistory([]);
  }, []);

  // 输入防抖：自动搜索
  useEffect(() => {
    if (!searchQuery.trim()) {
      setPostResults([]);
      setUserResults([]);
      setBrandResults([]);
      setIsSearching(false);
      return;
    }

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      handleSearch();
    }, 400);

    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  // 执行搜索
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setPostResults([]);
      setUserResults([]);
      setBrandResults([]);
      setIsSearching(false);
      return;
    }

    Keyboard.dismiss();
    setIsSearching(true);
    setIsLoading(true);

    try {
      const query = searchQuery.trim();

      if (searchType === "posts") {
        const posts = await searchPosts(query);
        setPostResults(posts);
      } else if (searchType === "users") {
        const users = await searchUsers(query);
        setUserResults(users);
      } else {
        const brands = await searchBrands(query);
        setBrandResults(brands);
      }

      // 保存搜索历史
      const newHistoryItem: SearchHistory = {
        id: Date.now().toString(),
        keyword: query,
        timestamp: Date.now(),
      };

      setSearchHistory((prev) => {
        const filtered = prev.filter(
          (item) => item.keyword.toLowerCase() !== query.toLowerCase()
        );
        return [newHistoryItem, ...filtered].slice(0, 10);
      });
    } catch (error) {
      console.error("Search failed:", error);
      // 显示用户友好的错误提示
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      if (errorMessage.includes("JSON could not be generated") ||
        errorMessage.includes("Worker threw exception")) {
        Alert.alert("搜索暂时不可用", "服务器繁忙，请稍后重试");
      } else {
        Alert.alert("搜索失败", "网络连接异常，请检查网络后重试");
      }
      if (searchType === "posts") {
        setPostResults([]);
      } else if (searchType === "users") {
        setUserResults([]);
      } else {
        setBrandResults([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, searchType]);

  // 切换搜索类型时重新搜索
  const handleSearchTypeChange = useCallback(
    async (type: SearchType) => {
      setSearchType(type);

      if (!searchQuery.trim() || !isSearching) return;

      setIsLoading(true);
      try {
        const query = searchQuery.trim();
        if (type === "posts") {
          const posts = await searchPosts(query);
          setPostResults(posts);
        } else if (type === "users") {
          const users = await searchUsers(query);
          setUserResults(users);
        } else {
          const brands = await searchBrands(query);
          setBrandResults(brands);
        }
      } catch (error) {
        console.error("Search failed:", error);
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        if (errorMessage.includes("JSON could not be generated") ||
          errorMessage.includes("Worker threw exception")) {
          Alert.alert("搜索暂时不可用", "服务器繁忙，请稍后重试");
        }
        if (type === "posts") {
          setPostResults([]);
        } else if (type === "users") {
          setUserResults([]);
        } else {
          setBrandResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [searchQuery, isSearching]
  );

  // 清除搜索
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setPostResults([]);
    setUserResults([]);
    setBrandResults([]);
    setIsSearching(false);
  }, []);

  // 点击历史记录
  const handleHistoryClick = useCallback(
    async (keyword: string) => {
      setSearchQuery(keyword);
      setIsSearching(true);
      setIsLoading(true);

      try {
        if (searchType === "posts") {
          const posts = await searchPosts(keyword);
          setPostResults(posts);
        } else if (searchType === "users") {
          const users = await searchUsers(keyword);
          setUserResults(users);
        } else {
          const brands = await searchBrands(keyword);
          setBrandResults(brands);
        }
      } catch (error) {
        console.error("Search failed:", error);
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        if (errorMessage.includes("JSON could not be generated") ||
          errorMessage.includes("Worker threw exception")) {
          Alert.alert("搜索暂时不可用", "服务器繁忙，请稍后重试");
        }
        if (searchType === "posts") {
          setPostResults([]);
        } else if (searchType === "users") {
          setUserResults([]);
        } else {
          setBrandResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [searchType]
  );

  // 删除历史记录项
  const handleDeleteHistory = useCallback((id: string) => {
    setSearchHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // 清空所有历史
  const handleClearAllHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  // 处理帖子点击
  const handlePostPress = useCallback(
    (post: PostData) => {
      (navigation.navigate as any)("PostDetail", { postId: post.id });
    },
    [navigation]
  );

  // 处理作者点击
  const handleAuthorPress = useCallback(
    (authorId: string) => {
      (navigation.navigate as any)("UserProfile", { userId: Number(authorId) });
    },
    [navigation]
  );

  // 处理用户点击
  const handleUserPress = useCallback(
    (user: UserInfo) => {
      (navigation.navigate as any)("UserProfile", { userId: user.userId });
    },
    [navigation]
  );

  const handleBrandPress = useCallback(
    (brand: Brand) => {
      (navigation.navigate as any)("BrandDetail", { name: brand.name });
    },
    [navigation]
  );

  // 处理点赞
  const handleLike = useCallback(
    async (postId: string) => {
      const userId = user?.userId;
      if (!userId) {
        Alert.alert("提示", "请先登录");
        return;
      }

      const target = postResults.find((p) => String(p.id) === postId);
      if (!target) return;

      const isCurrentlyLiked = target.likedByMe;

      setPostResults((prev) =>
        prev.map((p) =>
          String(p.id) === postId
            ? {
                ...p,
                likedByMe: !isCurrentlyLiked,
                likeCount: isCurrentlyLiked
                  ? (p.likeCount || 1) - 1
                  : (p.likeCount || 0) + 1,
              }
            : p
        )
      );

      try {
        const numericPostId = parseInt(postId, 10);
        if (isCurrentlyLiked) {
          await unlikePost(numericPostId, userId);
        } else {
          await likePost(numericPostId, userId);
        }
      } catch (error) {
        console.error("Like toggle failed:", error);
        setPostResults((prev) =>
          prev.map((p) =>
            String(p.id) === postId
              ? {
                  ...p,
                  likedByMe: isCurrentlyLiked,
                  likeCount: isCurrentlyLiked
                    ? (p.likeCount || 0) + 1
                    : (p.likeCount || 1) - 1,
                }
              : p
          )
        );
      }
    },
    [user, postResults]
  );

  // 转换帖子格式
  const convertToPost = (post: PostData): Post => {
    const userId = post.userId?.toString() || "0";
    return {
      id: post.id?.toString() || "",
      title: post.title || "",
      image: post.imageUrls?.[0] || "https://picsum.photos/id/1/600/800",
      author: {
        id: userId,
        name: post.username || "用户",
        avatar: post.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${userId}`,
      },
      likes: post.likeCount || 0,
      isLiked: post.likedByMe || false,
    };
  };

  // 分离左右列数据
  const getLeftColumnPosts = useCallback(() => {
    return postResults.filter((_, index) => index % 2 === 0);
  }, [postResults]);

  const getRightColumnPosts = useCallback(() => {
    return postResults.filter((_, index) => index % 2 === 1);
  }, [postResults]);

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

  // 渲染用户项
  const renderUserItem = ({ item }: { item: UserInfo }) => (
    <Pressable onPress={() => handleUserPress(item)} px="$md" py="$md">
      <HStack alignItems="center" space="md">
        <Box
          width={56}
          height={56}
          rounded="$sm"
          overflow="hidden"
          bg="$gray100"
        >
          <OptimizedImage
            uri={
              item.avatarUrl ||
              `https://api.dicebear.com/7.x/avataaars/png?seed=${item.userId}`
            }
            size={ImageSize.THUMBNAIL}
            style={{ width: 56, height: 56 }}
            contentFit="cover"
            lazy={true}
          />
        </Box>

        <VStack flex={1} space="xs">
          <HStack alignItems="center" space="sm">
            <Text fontSize="$md" fontWeight="$semibold" color="$black">
              {item.username}
            </Text>
            <Text fontSize="$sm" color="$gray400">
              ID: {item.userId}
            </Text>
          </HStack>
          {item.bio ? (
            <Text fontSize="$sm" color="$gray600" numberOfLines={1}>
              {item.bio}
            </Text>
          ) : null}
          {item.location ? (
            <HStack alignItems="center" space="xs">
              <Ionicons
                name="location-outline"
                size={14}
                color={theme.colors.gray400}
              />
              <Text fontSize="$xs" color="$gray400">
                {item.location}
              </Text>
            </HStack>
          ) : null}
        </VStack>

        <Ionicons
          name="chevron-forward"
          size={20}
          color={theme.colors.gray400}
        />
      </HStack>
    </Pressable>
  );

  const renderBrandItem = ({ item }: { item: Brand }) => (
    <Pressable onPress={() => handleBrandPress(item)} px="$md" py="$md">
      <HStack alignItems="center" space="md">
        <Box
          width={56}
          height={56}
          rounded="$sm"
          overflow="hidden"
          bg="$gray100"
          alignItems="center"
          justifyContent="center"
        >
          {item.coverImage ? (
            <OptimizedImage
              uri={item.coverImage}
              size={ImageSize.THUMBNAIL}
              style={{ width: 56, height: 56 }}
              contentFit="cover"
              lazy={true}
            />
          ) : (
            <Text fontSize="$xl" fontWeight="$bold" color="$gray400">
              {item.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </Box>

        <VStack flex={1} space="xs">
          <Text fontSize="$md" fontWeight="$semibold" color="$black">
            {item.name}
          </Text>
          <HStack alignItems="center" space="sm">
            {item.category ? (
              <Text fontSize="$sm" color="$gray600">
                {item.category}
              </Text>
            ) : null}
            {item.country ? (
              <HStack alignItems="center" space="xs">
                <Ionicons
                  name="globe-outline"
                  size={14}
                  color={theme.colors.gray400}
                />
                <Text fontSize="$xs" color="$gray400">
                  {item.country}
                </Text>
              </HStack>
            ) : null}
          </HStack>
        </VStack>

        <Ionicons
          name="chevron-forward"
          size={20}
          color={theme.colors.gray400}
        />
      </HStack>
    </Pressable>
  );

  // 渲染搜索类型选择 Tab
  const renderSearchTypeTabs = () => (
    <HStack
      px="$md"
      py="$sm"
      space="md"
      borderBottomWidth={1}
      borderBottomColor="$gray100"
    >
      <Pressable
        onPress={() => handleSearchTypeChange("posts")}
        px="$md"
        py="$xs"
        rounded="$sm"
        bg={searchType === "posts" ? "$black" : "$gray100"}
      >
        <Text
          fontSize="$sm"
          fontWeight="$medium"
          color={searchType === "posts" ? "$white" : "$gray600"}
        >
          帖子
        </Text>
      </Pressable>
      <Pressable
        onPress={() => handleSearchTypeChange("users")}
        px="$md"
        py="$xs"
        rounded="$sm"
        bg={searchType === "users" ? "$black" : "$gray100"}
      >
        <Text
          fontSize="$sm"
          fontWeight="$medium"
          color={searchType === "users" ? "$white" : "$gray600"}
        >
          用户
        </Text>
      </Pressable>
      <Pressable
        onPress={() => handleSearchTypeChange("brands")}
        px="$md"
        py="$xs"
        rounded="$sm"
        bg={searchType === "brands" ? "$black" : "$gray100"}
      >
        <Text
          fontSize="$sm"
          fontWeight="$medium"
          color={searchType === "brands" ? "$white" : "$gray600"}
        >
          品牌
        </Text>
      </Pressable>
    </HStack>
  );

  // 渲染帖子搜索结果
  const renderPostResults = () => (
    <VStack flex={1}>
      <HStack px="$md" py="$md" alignItems="center">
        <Text fontSize="$md" color="$gray600">
          找到{" "}
          <Text fontWeight="$semibold" color="$black">
            {postResults.length}
          </Text>{" "}
          个帖子
        </Text>
      </HStack>

      {postResults.length > 0 ? (
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
        <VStack flex={1} justifyContent="center" alignItems="center" px="$xl">
          <Ionicons
            name="document-text-outline"
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
            未找到相关帖子
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
  );

  // 渲染用户搜索结果
  const renderUserResults = () => (
    <VStack flex={1}>
      <HStack px="$md" py="$md" alignItems="center">
        <Text fontSize="$md" color="$gray600">
          找到{" "}
          <Text fontWeight="$semibold" color="$black">
            {userResults.length}
          </Text>{" "}
          个用户
        </Text>
      </HStack>

      {userResults.length > 0 ? (
        <FlatList
          data={userResults}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.userId.toString()}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <Box height={1} bg="$gray100" mx="$md" />
          )}
        />
      ) : (
        <VStack flex={1} justifyContent="center" alignItems="center" px="$xl">
          <Ionicons
            name="person-outline"
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
            未找到相关用户
          </Text>
          <Text
            fontSize="$sm"
            color="$gray400"
            mt="$sm"
            textAlign="center"
            lineHeight="$lg"
          >
            支持用户名模糊搜索和用户ID精确搜索
          </Text>
        </VStack>
      )}
    </VStack>
  );

  const renderBrandResults = () => (
    <VStack flex={1}>
      <HStack px="$md" py="$md" alignItems="center">
        <Text fontSize="$md" color="$gray600">
          找到{" "}
          <Text fontWeight="$semibold" color="$black">
            {brandResults.length}
          </Text>{" "}
          个品牌
        </Text>
      </HStack>

      {brandResults.length > 0 ? (
        <FlatList
          data={brandResults}
          renderItem={renderBrandItem}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <Box height={1} bg="$gray100" mx="$md" />
          )}
        />
      ) : (
        <VStack flex={1} justifyContent="center" alignItems="center" px="$xl">
          <Ionicons
            name="pricetag-outline"
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
            未找到相关品牌
          </Text>
          <Text
            fontSize="$sm"
            color="$gray400"
            mt="$sm"
            textAlign="center"
            lineHeight="$lg"
          >
            试试其他品牌名称吧
          </Text>
        </VStack>
      )}
    </VStack>
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
          rounded="$sm"
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
            placeholder={
              searchType === "posts"
                ? "搜索帖子标题、内容、作者..."
                : searchType === "users"
                  ? "搜索用户名或用户ID..."
                  : "搜索品牌名称..."
            }
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
          rounded="$sm"
        >
          <Text color="$white" fontSize="$sm" fontWeight="$semibold">
            搜索
          </Text>
        </Pressable>
      </HStack>

      {/* Search Type Tabs */}
      {renderSearchTypeTabs()}

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
                {searchType === "posts" ? "搜索帖子" : searchType === "users" ? "搜索用户" : "搜索品牌"}
              </Text>
              <Text
                fontSize="$sm"
                color="$gray400"
                mt="$sm"
                textAlign="center"
                lineHeight="$lg"
              >
                {searchType === "posts"
                  ? "输入关键词搜索帖子标题、内容或作者"
                  : searchType === "users"
                    ? "输入用户名模糊搜索或用户ID精确搜索"
                    : "输入品牌名称进行搜索"}
              </Text>
            </VStack>
          )}
        </VStack>
      ) : isLoading ? (
        // 显示加载状态
        <VStack flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator size="small" color={theme.colors.black} />
          <Text fontSize="$md" color="$gray600" mt="$md">
            搜索中...
          </Text>
        </VStack>
      ) : (
        // 显示搜索结果
        searchType === "posts" ? renderPostResults() : searchType === "users" ? renderUserResults() : renderBrandResults()
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
