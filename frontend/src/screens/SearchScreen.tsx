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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack, VStack, UserAvatar, AnimatedChip, chipRowStyle } from "../components/ui";
import { playfairFonts, theme, useThemedStyles, type AppTheme, useAppTheme } from "../theme";
import PostCard, { Post } from "../components/PostCard";
import { searchPosts, likePost, unlikePost, Post as PostData } from "../services/postService";
import { searchUsers, UserInfo } from "../services/userInfoService";
import { searchBrands, Brand } from "../services/brandService";
import { getStoresPaginated, BuyerStore } from "../services/buyerStoreService";
import {
  searchProductsGlobal,
  StoreProduct,
  formatPrice,
  getMarketplaceSearchSuggestions,
  type MarketplaceSearchSuggestion,
} from "../services/storeProductService";
import { useAuthStore } from "../store/authStore";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { splitIntoMasonryColumns } from "../utils/masonryLayout";
import { resolveAvatarUrlOrEmpty } from "../utils/avatarUtils";

type SearchType = "posts" | "users" | "brands" | "stores" | "products";

interface SearchHistory {
  id: string;
  keyword: string;
  timestamp: number;
}

const SearchScreen = () => {
  const theme = useAppTheme();
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

  // 输入下拉建议（PRD: 搜索框支持品牌名/单品名/秀场关键词的模糊匹配，
  // 输入"Rick"时下拉提示 Rick Owens / Rick Owens DRKSHDW / Rick Owens FW07）
  const [suggestions, setSuggestions] = useState<MarketplaceSearchSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const suggestRequestIdRef = useRef(0);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const POST_PAGE_SIZE = 20;

  // 加载搜索历史
  useEffect(() => {
    setSearchHistory([]);
  }, []);

  // 输入即拉取建议（仅品牌/商品）；用户/帖子/店铺需点击搜索按钮后才查询。
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (suggestDebounceRef.current) {
      clearTimeout(suggestDebounceRef.current);
      suggestDebounceRef.current = null;
    }
    if (!trimmed || isSearching || searchType !== "brands" && searchType !== "products") {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    const requestId = ++suggestRequestIdRef.current;
    suggestDebounceRef.current = setTimeout(async () => {
      try {
        const items = await getMarketplaceSearchSuggestions(trimmed, 8);
        if (requestId !== suggestRequestIdRef.current) return;
        setSuggestions(items);
      } catch {
        if (requestId !== suggestRequestIdRef.current) return;
        setSuggestions([]);
      } finally {
        if (requestId === suggestRequestIdRef.current) {
          setLoadingSuggestions(false);
        }
      }
    }, 280);
    return () => {
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [searchQuery, isSearching, searchType]);

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

  // 用户在输入框编辑时，把搜索回退到输入态：
  // - 退出"已搜索"状态，让下拉建议重新显示
  // - 不清空已得到的结果集，避免下次"X"清除前出现空白闪烁
  const handleQueryChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (isSearching) {
      setIsSearching(false);
    }
  }, [isSearching]);

  // 清除搜索
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setSuggestions([]);
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

  // 点击下拉建议
  // - 品牌建议：尽量切到"品牌"tab 让用户拿到品牌主页入口；
  // - 秀场 / 系列 / 单品标题建议：切到"商品"tab，复用 marketplace 关键词搜索
  //   （后端会自动反查 shows 表把该秀场对应的单品也带回来）。
  const handleSuggestionClick = useCallback(
    (item: MarketplaceSearchSuggestion) => {
      const keyword = item.query || item.label;
      setSearchQuery(keyword);

      let nextType: SearchType = searchType;
      if (item.type === "brand" && allowedTypes.includes("brands")) {
        nextType = "brands";
      } else if (allowedTypes.includes("products")) {
        nextType = "products";
      }
      if (nextType !== searchType) {
        setSearchType(nextType);
      }

      Keyboard.dismiss();
      setIsSearching(true);
      setIsLoading(true);
      setSuggestions([]);

      (async () => {
        try {
          if (nextType === "posts") {
            postOffsetRef.current = 0;
            const result = await searchPosts(keyword, POST_PAGE_SIZE, 0);
            setPostResults(result.posts);
            setPostTotal(result.total);
            setHasMorePosts(result.posts.length < result.total);
            postOffsetRef.current = result.posts.length;
          } else if (nextType === "users") {
            const users = await searchUsers(keyword);
            setUserResults(users);
          } else if (nextType === "brands") {
            const brands = await searchBrands(keyword);
            setBrandResults(brands);
          } else if (nextType === "stores") {
            storePageRef.current = 1;
            const result = await getStoresPaginated({ page: 1, pageSize: STORE_PAGE_SIZE, searchQuery: keyword });
            setStoreResults(result.stores);
            setStoreTotal(result.total);
            setHasMoreStores(result.stores.length < result.total);
          } else if (nextType === "products") {
            productPageRef.current = 1;
            const result = await searchProductsGlobal(keyword, 1, PRODUCT_PAGE_SIZE);
            setProductResults(result.products);
            setProductTotal(result.total);
            setHasMoreProducts(result.products.length < result.total);
          }

          // 同步落历史
          const newHistoryItem: SearchHistory = {
            id: Date.now().toString(),
            keyword,
            timestamp: Date.now(),
          };
          setSearchHistory((prev) => {
            const filtered = prev.filter(
              (h) => h.keyword.toLowerCase() !== keyword.toLowerCase()
            );
            return [newHistoryItem, ...filtered].slice(0, 10);
          });
        } catch (error) {
          console.error("Suggestion search failed:", error);
        } finally {
          setIsLoading(false);
        }
      })();
    },
    [searchType, allowedTypes]
  );

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
        avatar: resolveAvatarUrlOrEmpty(post.avatarUrl),
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

  // 下拉建议项类型标签 & 图标
  const suggestionTypeLabel = (type: MarketplaceSearchSuggestion["type"]) => {
    switch (type) {
      case "brand":
        return t("search.suggestionTypeBrand");
      case "product":
        return t("search.suggestionTypeProduct");
      case "show":
        return t("search.suggestionTypeShow");
      default:
        return t("search.suggestionTypeKeyword");
    }
  };

  const suggestionIcon = (type: MarketplaceSearchSuggestion["type"]) => {
    switch (type) {
      case "brand":
        return "pricetag-outline";
      case "product":
        return "bag-outline";
      case "show":
        return "sparkles-outline";
      default:
        return "search-outline";
    }
  };

  // 输入态下拉建议列表（品牌 / 商品）
  const renderSuggestionList = () => {
    if (loadingSuggestions && suggestions.length === 0) {
      return (
        <VStack flex={1} justifyContent="center" alignItems="center" py="$xl">
          <ActivityIndicator size="small" color={theme.colors.gray400} />
        </VStack>
      );
    }
    if (suggestions.length === 0) {
      return (
        <VStack flex={1} justifyContent="center" alignItems="center" px="$xl" py="$xl">
          <Ionicons name="search-outline" size={48} color={theme.colors.gray300} />
          <Text fontSize="$md" style={{ color: theme.colors.gray600 }} mt="$md" textAlign="center">
            {t("search.noSuggestions")}
          </Text>
          <Text fontSize="$sm" style={{ color: theme.colors.gray400 }} mt="$xs" textAlign="center">
            {t("search.suggestionsHint")}
          </Text>
        </VStack>
      );
    }
    return (
      <FlatList
        data={suggestions}
        keyExtractor={(item, idx) => `${item.type}_${item.label}_${idx}`}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleSuggestionClick(item)}
            px="$md"
            py="$sm"
          >
            <HStack alignItems="center" space="md">
              {item.imageUrl ? (
                <OptimizedImage
                  uri={item.imageUrl}
                  size={ImageSize.THUMBNAIL}
                  style={styles.suggestionThumb}
                  contentFit="cover"
                  lazy
                />
              ) : (
                <Box style={styles.suggestionIconWrap}>
                  <Ionicons
                    name={suggestionIcon(item.type) as any}
                    size={18}
                    color={theme.colors.gray500}
                  />
                </Box>
              )}
              <VStack flex={1} space="xs">
                <Text
                  fontSize="$md"
                  style={{ color: theme.colors.text }}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <HStack alignItems="center" space="xs">
                  <Text fontSize="$xs" style={{ color: theme.colors.gray400 }}>
                    {suggestionTypeLabel(item.type)}
                  </Text>
                  {item.listingCount != null && item.listingCount > 0 ? (
                    <Text fontSize="$xs" style={{ color: theme.colors.gray400 }}>
                      · {t("search.suggestionListingCount", { count: item.listingCount })}
                    </Text>
                  ) : null}
                </HStack>
              </VStack>
              <Ionicons
                name="arrow-up-outline"
                size={16}
                color={theme.colors.gray300}
                style={{ transform: [{ rotate: "-45deg" }] }}
              />
            </HStack>
          </Pressable>
        )}
        ItemSeparatorComponent={() => (
          <Box height={StyleSheet.hairlineWidth} mx="$md" style={{ backgroundColor: theme.colors.gray100 }} />
        )}
      />
    );
  };

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
          <Text fontSize="$md" style={{ color: theme.colors.text }} flex={1} numberOfLines={1}>
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
        <UserAvatar
          uri={resolveAvatarUrlOrEmpty(item.avatarUrl) || undefined}
          name={item.username}
          size={56}
        />

        <VStack flex={1} space="xs">
          <HStack alignItems="center" space="sm">
            <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.black }}>
              {item.username}
            </Text>
            <Text fontSize="$sm" style={{ color: theme.colors.gray400 }}>
              ID: {item.userId}
            </Text>
          </HStack>
          {item.bio ? (
            <Text fontSize="$sm" style={{ color: theme.colors.gray600 }} numberOfLines={1}>
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
              <Text fontSize="$xs" style={{ color: theme.colors.gray400 }}>
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
          style={{ backgroundColor: theme.colors.gray100 }}
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
            <Text fontSize="$xl" fontWeight="$bold" style={{ color: theme.colors.gray400 }}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </Box>

        <VStack flex={1} space="xs">
          <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.black }}>
            {item.name}
          </Text>
          <HStack alignItems="center" space="sm">
            {item.category ? (
              <Text fontSize="$sm" style={{ color: theme.colors.gray600 }}>
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
                <Text fontSize="$xs" style={{ color: theme.colors.gray400 }}>
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
      <Box borderBottomWidth={1} style={{ borderBottomColor: theme.colors.gray100 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          <View style={chipRowStyle}>
            {visibleTabs.map((tab) => (
              <AnimatedChip
                key={tab.type}
                label={tab.label}
                isActive={searchType === tab.type}
                onPress={() => handleSearchTypeChange(tab.type)}
              />
            ))}
          </View>
        </ScrollView>
      </Box>
    );
  };

  // 渲染帖子搜索结果
  const renderPostResults = () => (
    <VStack flex={1}>
      <HStack px="$md" py="$md" alignItems="center">
        <Text fontSize="$md" style={{ color: theme.colors.gray600 }}>
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
            style={{ color: theme.colors.gray600 }}
            fontWeight="$medium"
            mt="$md"
            textAlign="center"
          >
            {t("search.noResults")}
          </Text>
          <Text
            fontSize="$sm"
            style={{ color: theme.colors.gray400 }}
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
        <Text fontSize="$md" style={{ color: theme.colors.gray600 }}>
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
            <Box height={1} style={{ backgroundColor: theme.colors.gray100 }} mx="$md" />
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
            style={{ color: theme.colors.gray600 }}
            fontWeight="$medium"
            mt="$md"
            textAlign="center"
          >
            {t("search.noResults")}
          </Text>
          <Text
            fontSize="$sm"
            style={{ color: theme.colors.gray400 }}
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
        <Text fontSize="$md" style={{ color: theme.colors.gray600 }}>
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
            <Box height={1} style={{ backgroundColor: theme.colors.gray100 }} mx="$md" />
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
            style={{ color: theme.colors.gray600 }}
            fontWeight="$medium"
            mt="$md"
            textAlign="center"
          >
            {t("search.noResults")}
          </Text>
          <Text
            fontSize="$sm"
            style={{ color: theme.colors.gray400 }}
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
              <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.black }} numberOfLines={1}>
                {store.name}
              </Text>
              <Text fontSize="$sm" style={{ color: theme.colors.gray400 }} mt="$xs" numberOfLines={1}>
                {store.city}, {store.country}
              </Text>
            </VStack>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.gray400} />
          </HStack>
          {store.address ? (
            <HStack alignItems="center" space="xs">
              <Ionicons name="location-outline" size={14} color={theme.colors.gray400} />
              <Text fontSize="$xs" style={{ color: theme.colors.gray400 }} flex={1} numberOfLines={1}>
                {store.address}
              </Text>
            </HStack>
          ) : null}
          {store.style.length > 0 && (
            <HStack space="xs" flexWrap="wrap">
              {store.style.slice(0, 3).map((s, idx) => (
                <Box key={idx} style={{ backgroundColor: theme.colors.gray100 }} px="$sm" py={2} rounded="$sm">
                  <Text fontSize="$xs" style={{ color: theme.colors.gray600 }}>{s}</Text>
                </Box>
              ))}
            </HStack>
          )}
          {store.brands.length > 0 && (
            <Text fontSize="$xs" style={{ color: theme.colors.gray400 }} numberOfLines={1} fontStyle="italic">
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
        <Text fontSize="$md" style={{ color: theme.colors.gray600 }}>
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
          ItemSeparatorComponent={() => <Box height={1} style={{ backgroundColor: theme.colors.gray100 }} mx="$md" />}
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
          <Text fontSize="$lg" style={{ color: theme.colors.gray600 }} fontWeight="$medium" mt="$md" textAlign="center">
            {t("search.noResults")}
          </Text>
          <Text fontSize="$sm" style={{ color: theme.colors.gray400 }} mt="$sm" textAlign="center" lineHeight="$lg">
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
          <Box width={72} height={72} rounded="$sm" overflow="hidden" style={{ backgroundColor: theme.colors.gray100 }}>
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
            <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.black }} numberOfLines={2}>
              {product.title}
            </Text>
            {product.brand ? (
              <Text fontSize="$sm" style={{ color: theme.colors.gray600 }} numberOfLines={1}>
                {product.brand}
              </Text>
            ) : null}
            <HStack alignItems="center" space="sm">
              {product.hasDiscount && product.discountPriceCents != null ? (
                <>
                  <Text fontSize="$md" fontWeight="$bold" style={{ color: theme.colors.black }}>
                    {formatPrice(product.discountPriceCents, product.currency)}
                  </Text>
                  <Text fontSize="$xs" style={[{ textDecorationLine: "line-through" }, { color: theme.colors.gray400 }]}>
                    {formatPrice(product.priceCents, product.currency)}
                  </Text>
                </>
              ) : (
                <Text fontSize="$md" fontWeight="$bold" style={{ color: theme.colors.black }}>
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
        <Text fontSize="$md" style={{ color: theme.colors.gray600 }}>
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
          ItemSeparatorComponent={() => <Box height={1} style={{ backgroundColor: theme.colors.gray100 }} mx="$md" />}
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
          <Text fontSize="$lg" style={{ color: theme.colors.gray600 }} fontWeight="$medium" mt="$md" textAlign="center">
            {t("search.noResults")}
          </Text>
          <Text fontSize="$sm" style={{ color: theme.colors.gray400 }} mt="$sm" textAlign="center" lineHeight="$lg">
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
        style={{ borderBottomColor: theme.colors.gray100 }}
      >
        {/* Back Button */}
        <Pressable onPress={() => navigation.goBack()} p="$xs">
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>

        {/* Search Input */}
        <Box
          flex={1}
          style={{ backgroundColor: theme.colors.gray100 }}
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
            onChangeText={handleQueryChange}
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
          style={{ backgroundColor: theme.colors.black }}
          rounded="$sm"
        >
          <Text style={{ color: theme.colors.white }} fontSize="$sm" fontWeight="$semibold">
            {t("common.search")}
          </Text>
        </Pressable>
      </HStack>

      {/* Search Type Tabs */}
      {renderSearchTypeTabs()}

      {/* Content Area */}
      {!isSearching && searchQuery.trim().length > 0 &&
      (searchType === "brands" || searchType === "products") ? (
        // 输入中：品牌 / 商品 展示下拉建议
        <VStack flex={1}>
          {renderSuggestionList()}
        </VStack>
      ) : !isSearching ? (
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
                <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.black }}>
                  {t("search.recent")}
                </Text>
                <Pressable onPress={handleClearAllHistory}>
                  <Text fontSize="$sm" style={{ color: theme.colors.gray600 }}>
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
                style={{ color: theme.colors.gray600 }}
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
                style={{ color: theme.colors.gray400 }}
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
          <Text fontSize="$md" style={{ color: theme.colors.gray600 }} mt="$md">
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
  suggestionThumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.colors.gray100,
  },
  suggestionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default SearchScreen;
