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
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack, VStack } from "../components/ui";
import { playfairFonts, theme, useThemedStyles, type AppTheme } from "../theme";
import PostCard, { Post } from "../components/PostCard";
import { searchPosts, likePost, unlikePost, Post as PostData } from "../services/postService";
import { searchUsers, UserInfo } from "../services/userInfoService";
import { searchBrands, Brand } from "../services/brandService";
import { getStoresPaginated, BuyerStore } from "../services/buyerStoreService";
import { searchProductsGlobal, StoreProduct, formatPrice } from "../services/storeProductService";
import { useAuthStore } from "../store/authStore";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { splitIntoMasonryColumns } from "../utils/masonryLayout";

type SearchType = "posts" | "users" | "brands" | "stores" | "products";

interface SearchHistory {
  id: string;
  keyword: string;
  timestamp: number;
}

const SearchScreen = () => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { user } = useAuthStore();

  const allowedTypes = (route.params?.allowedTypes as SearchType[] | undefined) ?? [
    "posts",
    "users",
    "brands",
    "stores",
    "products",
  ];
  const isRestricted = allowedTypes.length < 5;

  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>(allowedTypes[0]);
  const [postResults, setPostResults] = useState<PostData[]>([]);
  const [userResults, setUserResults] = useState<UserInfo[]>([]);
  const [brandResults, setBrandResults] = useState<Brand[]>([]);
  const [storeResults, setStoreResults] = useState<BuyerStore[]>([]);
  const [storeTotal, setStoreTotal] = useState(0);
  const [productResults, setProductResults] = useState<StoreProduct[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [postTotal, setPostTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [hasMoreStores, setHasMoreStores] = useState(false);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const postOffsetRef = useRef(0);
  const storePageRef = useRef(1);
  const productPageRef = useRef(1);

  const POST_PAGE_SIZE = 20;

  // 加载搜索历史
  useEffect(() => {
    setSearchHistory([]);
  }, []);

  const STORE_PAGE_SIZE = 20;
  const PRODUCT_PAGE_SIZE = 20;

  // 执行搜索
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setPostResults([]);
      setUserResults([]);
      setBrandResults([]);
      setStoreResults([]);
      setStoreTotal(0);
      setProductResults([]);
      setProductTotal(0);
      setIsSearching(false);
      setPostTotal(0);
      return;
    }

    Keyboard.dismiss();
    setIsSearching(true);
    setIsLoading(true);

    try {
      const query = searchQuery.trim();

      if (searchType === "posts") {
        postOffsetRef.current = 0;
        const result = await searchPosts(query, POST_PAGE_SIZE, 0);
        setPostResults(result.posts);
        setPostTotal(result.total);
        setHasMorePosts(result.posts.length < result.total);
        postOffsetRef.current = result.posts.length;
      } else if (searchType === "users") {
        const users = await searchUsers(query);
        setUserResults(users);
      } else if (searchType === "brands") {
        const brands = await searchBrands(query);
        setBrandResults(brands);
      } else if (searchType === "stores") {
        storePageRef.current = 1;
        const result = await getStoresPaginated({ page: 1, pageSize: STORE_PAGE_SIZE, searchQuery: query });
        setStoreResults(result.stores);
        setStoreTotal(result.total);
        setHasMoreStores(result.stores.length < result.total);
      } else if (searchType === "products") {
        productPageRef.current = 1;
        const result = await searchProductsGlobal(query, 1, PRODUCT_PAGE_SIZE);
        setProductResults(result.products);
        setProductTotal(result.total);
        setHasMoreProducts(result.products.length < result.total);
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
      const errorMessage = error instanceof Error ? error.message : t("common.unknownError");
      if (errorMessage.includes("JSON could not be generated") ||
        errorMessage.includes("Worker threw exception")) {
        Alert.alert(t("search.unavailable"), t("search.serverBusy"));
      } else {
        Alert.alert(t("search.failed"), t("search.networkError"));
      }
      if (searchType === "posts") {
        setPostResults([]);
        setPostTotal(0);
        setHasMorePosts(false);
      } else if (searchType === "users") {
        setUserResults([]);
      } else if (searchType === "brands") {
        setBrandResults([]);
      } else if (searchType === "stores") {
        setStoreResults([]);
        setStoreTotal(0);
        setHasMoreStores(false);
      } else if (searchType === "products") {
        setProductResults([]);
        setProductTotal(0);
        setHasMoreProducts(false);
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
          postOffsetRef.current = 0;
          const result = await searchPosts(query, POST_PAGE_SIZE, 0);
          setPostResults(result.posts);
          setPostTotal(result.total);
          setHasMorePosts(result.posts.length < result.total);
          postOffsetRef.current = result.posts.length;
        } else if (type === "users") {
          const users = await searchUsers(query);
          setUserResults(users);
        } else if (type === "brands") {
          const brands = await searchBrands(query);
          setBrandResults(brands);
        } else if (type === "stores") {
          storePageRef.current = 1;
          const result = await getStoresPaginated({ page: 1, pageSize: STORE_PAGE_SIZE, searchQuery: query });
          setStoreResults(result.stores);
          setStoreTotal(result.total);
          setHasMoreStores(result.stores.length < result.total);
        } else if (type === "products") {
          productPageRef.current = 1;
          const result = await searchProductsGlobal(query, 1, PRODUCT_PAGE_SIZE);
          setProductResults(result.products);
          setProductTotal(result.total);
          setHasMoreProducts(result.products.length < result.total);
        }
      } catch (error) {
        console.error("Search failed:", error);
        const errorMessage = error instanceof Error ? error.message : t("common.unknownError");
        if (errorMessage.includes("JSON could not be generated") ||
          errorMessage.includes("Worker threw exception")) {
          Alert.alert(t("search.unavailable"), t("search.serverBusy"));
        }
        if (type === "posts") {
          setPostResults([]);
          setPostTotal(0);
          setHasMorePosts(false);
        } else if (type === "users") {
          setUserResults([]);
        } else if (type === "brands") {
          setBrandResults([]);
        } else if (type === "stores") {
          setStoreResults([]);
          setStoreTotal(0);
          setHasMoreStores(false);
        } else if (type === "products") {
          setProductResults([]);
          setProductTotal(0);
          setHasMoreProducts(false);
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
    setStoreResults([]);
    setStoreTotal(0);
    setProductResults([]);
    setProductTotal(0);
    setIsSearching(false);
    setPostTotal(0);
    setHasMorePosts(false);
    setHasMoreStores(false);
    setHasMoreProducts(false);
    postOffsetRef.current = 0;
    storePageRef.current = 1;
    productPageRef.current = 1;
  }, []);

  // 点击历史记录
  const handleHistoryClick = useCallback(
    async (keyword: string) => {
      setSearchQuery(keyword);
      setIsSearching(true);
      setIsLoading(true);

      try {
        if (searchType === "posts") {
          postOffsetRef.current = 0;
          const result = await searchPosts(keyword, POST_PAGE_SIZE, 0);
          setPostResults(result.posts);
          setPostTotal(result.total);
          setHasMorePosts(result.posts.length < result.total);
          postOffsetRef.current = result.posts.length;
        } else if (searchType === "users") {
          const users = await searchUsers(keyword);
          setUserResults(users);
        } else if (searchType === "brands") {
          const brands = await searchBrands(keyword);
          setBrandResults(brands);
        } else if (searchType === "stores") {
          storePageRef.current = 1;
          const result = await getStoresPaginated({ page: 1, pageSize: STORE_PAGE_SIZE, searchQuery: keyword });
          setStoreResults(result.stores);
          setStoreTotal(result.total);
          setHasMoreStores(result.stores.length < result.total);
        } else if (searchType === "products") {
          productPageRef.current = 1;
          const result = await searchProductsGlobal(keyword, 1, PRODUCT_PAGE_SIZE);
          setProductResults(result.products);
          setProductTotal(result.total);
          setHasMoreProducts(result.products.length < result.total);
        }
      } catch (error) {
        console.error("Search failed:", error);
        const errorMessage = error instanceof Error ? error.message : t("common.unknownError");
        if (errorMessage.includes("JSON could not be generated") ||
          errorMessage.includes("Worker threw exception")) {
          Alert.alert(t("search.unavailable"), t("search.serverBusy"));
        }
        if (searchType === "posts") {
          setPostResults([]);
          setPostTotal(0);
          setHasMorePosts(false);
        } else if (searchType === "users") {
          setUserResults([]);
        } else if (searchType === "brands") {
          setBrandResults([]);
        } else if (searchType === "stores") {
          setStoreResults([]);
          setStoreTotal(0);
          setHasMoreStores(false);
        } else if (searchType === "products") {
          setProductResults([]);
          setProductTotal(0);
          setHasMoreProducts(false);
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

  const handleStorePress = useCallback(
    (store: BuyerStore) => {
      (navigation.navigate as any)("StoreDetail", { storeId: store.id });
    },
    [navigation]
  );

  const handleProductPress = useCallback(
    (product: StoreProduct) => {
      (navigation.navigate as any)("StoreProductDetail", { productId: product.id });
    },
    [navigation]
  );

  // 处理点赞
  const handleLike = useCallback(
    async (postId: string) => {
      const userId = user?.userId;
      if (!userId) {
        Alert.alert(t("search.loginRequired"));
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
    const images = post.imageUrls || [];
    return {
      id: post.id?.toString() || "",
      title: post.title || "",
      image: images[0] || "",
      author: {
        id: userId,
        name: post.username || t("profile.user"),
        avatar: post.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${userId}`,
      },
      content: {
        title: post.title || "",
        description: post.contentText || "",
        images,
        coverAspectRatio:
          post.coverWidth && post.coverHeight && post.coverHeight > 0
            ? post.coverWidth / post.coverHeight
            : undefined,
      },
      likes: post.likeCount || 0,
      isLiked: post.likedByMe || false,
    };
  };

  const loadMorePosts = useCallback(async () => {
    if (isLoadingMore || !hasMorePosts || !searchQuery.trim()) return;
    setIsLoadingMore(true);
    try {
      const result = await searchPosts(searchQuery.trim(), POST_PAGE_SIZE, postOffsetRef.current);
      setPostResults((prev) => [...prev, ...result.posts]);
      setPostTotal(result.total);
      postOffsetRef.current += result.posts.length;
      setHasMorePosts(postOffsetRef.current < result.total);
    } catch (error) {
      console.error("Load more posts failed:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMorePosts, searchQuery]);

  const loadMoreStores = useCallback(async () => {
    if (isLoadingMore || !hasMoreStores || !searchQuery.trim()) return;
    setIsLoadingMore(true);
    try {
      const nextPage = storePageRef.current + 1;
      const result = await getStoresPaginated({ page: nextPage, pageSize: STORE_PAGE_SIZE, searchQuery: searchQuery.trim() });
      setStoreResults((prev) => [...prev, ...result.stores]);
      setStoreTotal(result.total);
      storePageRef.current = nextPage;
      setHasMoreStores(storeResults.length + result.stores.length < result.total);
    } catch (error) {
      console.error("Load more stores failed:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreStores, searchQuery, storeResults.length]);

  const loadMoreProducts = useCallback(async () => {
    if (isLoadingMore || !hasMoreProducts || !searchQuery.trim()) return;
    setIsLoadingMore(true);
    try {
      const nextPage = productPageRef.current + 1;
      const result = await searchProductsGlobal(searchQuery.trim(), nextPage, PRODUCT_PAGE_SIZE);
      setProductResults((prev) => [...prev, ...result.products]);
      setProductTotal(result.total);
      productPageRef.current = nextPage;
      setHasMoreProducts(productResults.length + result.products.length < result.total);
    } catch (error) {
      console.error("Load more products failed:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreProducts, searchQuery, productResults.length]);

  const handlePostScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;
      if (isCloseToBottom) loadMorePosts();
    },
    [loadMorePosts]
  );

  const postColumns = splitIntoMasonryColumns(
    postResults,
    (item) => item.imageUrls?.[0],
  );

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
  const TAB_CONFIG: { type: SearchType; label: string }[] = [
    { type: "posts", label: t("search.posts") },
    { type: "users", label: t("search.users") },
    { type: "brands", label: t("search.brands") },
    { type: "stores", label: t("search.stores") },
    { type: "products", label: t("search.products") },
  ];

  const renderSearchTypeTabs = () => {
    const visibleTabs = TAB_CONFIG.filter((t) => allowedTypes.includes(t.type));
    if (visibleTabs.length <= 1) return null;

    return (
      <Box borderBottomWidth={1} borderBottomColor="$gray100">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {visibleTabs.map((tab) => (
            <Pressable
              key={tab.type}
              onPress={() => handleSearchTypeChange(tab.type)}
              style={[
                styles.tabPill,
                searchType === tab.type ? styles.tabPillActive : styles.tabPillInactive,
              ]}
            >
              <Text
                fontSize="$sm"
                fontWeight="$medium"
                color={searchType === tab.type ? "$white" : "$gray600"}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Box>
    );
  };

  // 渲染帖子搜索结果
  const renderPostResults = () => (
    <VStack flex={1}>
      <HStack px="$md" py="$md" alignItems="center">
        <Text fontSize="$md" color="$gray600">
          {t("search.foundResults", { count: postTotal, type: t("search.posts") })}
        </Text>
      </HStack>

      {postResults.length > 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={handlePostScroll}
          scrollEventThrottle={200}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <HStack px="$sm" pt="$sm" alignItems="flex-start">
            {postColumns.map((column, colIndex) => (
              <VStack key={colIndex} flex={1} px="$xs">
                {column.map((item) => {
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
            ))}
          </HStack>
          {isLoadingMore && (
            <VStack py="$md" alignItems="center">
              <ActivityIndicator size="small" color={theme.colors.gray400} />
            </VStack>
          )}
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
            {t("search.noResults")}
          </Text>
          <Text
            fontSize="$sm"
            color="$gray400"
            mt="$sm"
            textAlign="center"
            lineHeight="$lg"
          >
            {t("search.tryOtherKeywords")}
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
          {t("search.foundResults", { count: userResults.length, type: t("search.users") })}
        </Text>
      </HStack>

      {userResults.length > 0 ? (
        <FlatList
          data={userResults}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.userId.toString()}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
            {t("search.noResults")}
          </Text>
          <Text
            fontSize="$sm"
            color="$gray400"
            mt="$sm"
            textAlign="center"
            lineHeight="$lg"
          >
            {t("search.searchUsersHint")}
          </Text>
        </VStack>
      )}
    </VStack>
  );

  const renderBrandResults = () => (
    <VStack flex={1}>
      <HStack px="$md" py="$md" alignItems="center">
        <Text fontSize="$md" color="$gray600">
          {t("search.foundResults", { count: brandResults.length, type: t("search.brands") })}
        </Text>
      </HStack>

      {brandResults.length > 0 ? (
        <FlatList
          data={brandResults}
          renderItem={renderBrandItem}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
            {t("search.noResults")}
          </Text>
          <Text
            fontSize="$sm"
            color="$gray400"
            mt="$sm"
            textAlign="center"
            lineHeight="$lg"
          >
            {t("search.tryOtherKeywords")}
          </Text>
        </VStack>
      )}
    </VStack>
  );

  // 渲染店铺项
  const renderStoreItem = useCallback(
    ({ item: store }: { item: BuyerStore }) => (
      <Pressable onPress={() => handleStorePress(store)} px="$md" py="$md">
        <VStack space="sm">
          <HStack alignItems="center" justifyContent="between">
            <VStack flex={1} mr="$sm">
              <Text fontSize="$md" fontWeight="$semibold" color="$black" numberOfLines={1}>
                {store.name}
              </Text>
              <Text fontSize="$sm" color="$gray400" mt="$xs" numberOfLines={1}>
                {store.city}, {store.country}
              </Text>
            </VStack>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.gray400} />
          </HStack>
          {store.address ? (
            <HStack alignItems="center" space="xs">
              <Ionicons name="location-outline" size={14} color={theme.colors.gray400} />
              <Text fontSize="$xs" color="$gray400" flex={1} numberOfLines={1}>
                {store.address}
              </Text>
            </HStack>
          ) : null}
          {store.style.length > 0 && (
            <HStack space="xs" flexWrap="wrap">
              {store.style.slice(0, 3).map((s, idx) => (
                <Box key={idx} bg="$gray100" px="$sm" py={2} rounded="$sm">
                  <Text fontSize="$xs" color="$gray600">{s}</Text>
                </Box>
              ))}
            </HStack>
          )}
          {store.brands.length > 0 && (
            <Text fontSize="$xs" color="$gray400" numberOfLines={1} fontStyle="italic">
              {store.brands.slice(0, 5).join(" / ")}
            </Text>
          )}
        </VStack>
      </Pressable>
    ),
    [handleStorePress]
  );

  // 渲染店铺搜索结果
  const renderStoreResults = () => (
    <VStack flex={1}>
      <HStack px="$md" py="$md" alignItems="center">
        <Text fontSize="$md" color="$gray600">
          {t("search.foundResults", { count: storeTotal, type: t("search.stores") })}
        </Text>
      </HStack>
      {storeResults.length > 0 ? (
        <FlatList
          data={storeResults}
          renderItem={renderStoreItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onEndReached={loadMoreStores}
          onEndReachedThreshold={0.3}
          ItemSeparatorComponent={() => <Box height={1} bg="$gray100" mx="$md" />}
          ListFooterComponent={
            isLoadingMore ? (
              <VStack py="$md" alignItems="center">
                <ActivityIndicator size="small" color={theme.colors.gray400} />
              </VStack>
            ) : null
          }
        />
      ) : (
        <VStack flex={1} justifyContent="center" alignItems="center" px="$xl">
          <Ionicons name="storefront-outline" size={64} color={theme.colors.gray300} />
          <Text fontSize="$lg" color="$gray600" fontWeight="$medium" mt="$md" textAlign="center">
            {t("search.noResults")}
          </Text>
          <Text fontSize="$sm" color="$gray400" mt="$sm" textAlign="center" lineHeight="$lg">
            {t("search.tryOtherKeywords")}
          </Text>
        </VStack>
      )}
    </VStack>
  );

  // 渲染商品项
  const renderProductItem = useCallback(
    ({ item: product }: { item: StoreProduct }) => (
      <Pressable onPress={() => handleProductPress(product)} px="$md" py="$md">
        <HStack alignItems="center" space="md">
          <Box width={72} height={72} rounded="$sm" overflow="hidden" bg="$gray100">
            {product.images?.[0] ? (
              <OptimizedImage
                uri={product.images[0]}
                size={ImageSize.THUMBNAIL}
                style={{ width: 72, height: 72 }}
                contentFit="cover"
                lazy={true}
              />
            ) : (
              <Box flex={1} alignItems="center" justifyContent="center">
                <Ionicons name="bag-outline" size={28} color={theme.colors.gray300} />
              </Box>
            )}
          </Box>
          <VStack flex={1} space="xs">
            <Text fontSize="$md" fontWeight="$semibold" color="$black" numberOfLines={2}>
              {product.title}
            </Text>
            {product.brand ? (
              <Text fontSize="$sm" color="$gray600" numberOfLines={1}>
                {product.brand}
              </Text>
            ) : null}
            <HStack alignItems="center" space="sm">
              {product.hasDiscount && product.discountPriceCents != null ? (
                <>
                  <Text fontSize="$md" fontWeight="$bold" color="$black">
                    {formatPrice(product.discountPriceCents, product.currency)}
                  </Text>
                  <Text fontSize="$xs" color="$gray400" style={{ textDecorationLine: "line-through" }}>
                    {formatPrice(product.priceCents, product.currency)}
                  </Text>
                </>
              ) : (
                <Text fontSize="$md" fontWeight="$bold" color="$black">
                  {formatPrice(product.priceCents, product.currency)}
                </Text>
              )}
            </HStack>
          </VStack>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.gray400} />
        </HStack>
      </Pressable>
    ),
    [handleProductPress]
  );

  // 渲染商品搜索结果
  const renderProductResults = () => (
    <VStack flex={1}>
      <HStack px="$md" py="$md" alignItems="center">
        <Text fontSize="$md" color="$gray600">
          {t("search.foundResults", { count: productTotal, type: t("search.products") })}
        </Text>
      </HStack>
      {productResults.length > 0 ? (
        <FlatList
          data={productResults}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onEndReached={loadMoreProducts}
          onEndReachedThreshold={0.3}
          ItemSeparatorComponent={() => <Box height={1} bg="$gray100" mx="$md" />}
          ListFooterComponent={
            isLoadingMore ? (
              <VStack py="$md" alignItems="center">
                <ActivityIndicator size="small" color={theme.colors.gray400} />
              </VStack>
            ) : null
          }
        />
      ) : (
        <VStack flex={1} justifyContent="center" alignItems="center" px="$xl">
          <Ionicons name="bag-outline" size={64} color={theme.colors.gray300} />
          <Text fontSize="$lg" color="$gray600" fontWeight="$medium" mt="$md" textAlign="center">
            {t("search.noResults")}
          </Text>
          <Text fontSize="$sm" color="$gray400" mt="$sm" textAlign="center" lineHeight="$lg">
            {t("search.tryOtherKeywords")}
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
                ? t("search.searchPostsPlaceholder")
                : searchType === "users"
                  ? t("search.searchUsersPlaceholder")
                  : searchType === "brands"
                    ? t("search.searchBrandsPlaceholder")
                    : searchType === "stores"
                      ? t("search.searchStoresPlaceholder")
                      : t("search.searchProductsPlaceholder")
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
            {t("common.search")}
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
                  {t("search.recent")}
                </Text>
                <Pressable onPress={handleClearAllHistory}>
                  <Text fontSize="$sm" color="$gray600">
                    {t("search.clear")}
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
                name={
                  searchType === "posts"
                    ? "document-text-outline"
                    : searchType === "users"
                      ? "person-outline"
                      : searchType === "brands"
                        ? "pricetag-outline"
                        : searchType === "stores"
                          ? "storefront-outline"
                          : "bag-outline"
                }
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
                {searchType === "posts"
                  ? t("search.posts")
                  : searchType === "users"
                    ? t("search.users")
                    : searchType === "brands"
                      ? t("search.brands")
                      : searchType === "stores"
                        ? t("search.stores")
                        : t("search.products")}
              </Text>
              <Text
                fontSize="$sm"
                color="$gray400"
                mt="$sm"
                textAlign="center"
                lineHeight="$lg"
              >
                {searchType === "posts"
                  ? t("search.searchPostsHint")
                  : searchType === "users"
                    ? t("search.searchUsersHint")
                    : searchType === "brands"
                      ? t("search.searchBrandsHint")
                      : searchType === "stores"
                        ? t("search.searchStoresHint")
                        : t("search.searchProductsHint")}
              </Text>
            </VStack>
          )}
        </VStack>
      ) : isLoading ? (
        // 显示加载状态
        <VStack flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator size="small" color={theme.colors.black} />
          <Text fontSize="$md" color="$gray600" mt="$md">
            {t("common.loading")}
          </Text>
        </VStack>
      ) : (
        // 显示搜索结果
        searchType === "posts"
          ? renderPostResults()
          : searchType === "users"
            ? renderUserResults()
            : searchType === "brands"
              ? renderBrandResults()
              : searchType === "stores"
                ? renderStoreResults()
                : renderProductResults()
      )}
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: playfairFonts.regular,
    color: t.colors.text,
    paddingVertical: 8,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: t.borderRadius.sm,
    marginRight: 8,
  },
  tabPillActive: {
    backgroundColor: t.colors.text,
  },
  tabPillInactive: {
    backgroundColor: t.colors.gray100,
  },
});

export default SearchScreen;
