import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  StyleSheet,
  TextInput,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Image, HStack, VStack, ScrollView } from "../../../components/ui";
import { theme } from "../../../theme";
import { brandService, Brand } from "../../../services/brandService";
import { useAuthStore } from "../../../store/authStore";
import SubmitBrandModal from "../../../components/SubmitBrandModal";
import CategoryFilterModal from "./CategoryFilterModal";
import { PAGE_SIZE } from "../types";

interface CategoryFilter {
  label: string;
  value: string;
}

interface BrandListTabProps {
  onScrollUp: () => void;
  onScrollDown: () => void;
}

const BrandListTab: React.FC<BrandListTabProps> = ({
  onScrollUp,
  onScrollDown,
}) => {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilter[]>([
    { label: "全部", value: "all" },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const isLoadingMoreRef = useRef(false);
  const lastScrollY = useRef(0);

  const loadBrands = useCallback(async (reset = true) => {
    try {
      if (reset) {
        setIsLoading(true);
        setPage(1);
        setHasMore(true);
      }
      setError(null);
      const response = await brandService.getBrands({
        page: 1,
        pageSize: PAGE_SIZE,
      });
      setBrands(response.brands);
      setTotal(response.total);
      setHasMore(
        response.brands.length >= PAGE_SIZE &&
          response.brands.length < response.total
      );
      setPage(1);
    } catch {
      setError("加载品牌数据失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMoreBrands = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMore || isLoading) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await brandService.getBrands({
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      if (response.brands.length > 0) {
        setBrands((prev) => [...prev, ...response.brands]);
        setPage(nextPage);
        setHasMore(
          response.brands.length >= PAGE_SIZE &&
            brands.length + response.brands.length < response.total
        );
      } else {
        setHasMore(false);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  }, [page, hasMore, isLoading, brands.length]);

  const loadCategories = useCallback(async () => {
    try {
      const categories = await brandService.getBrandCategories();
      setCategoryFilters([
        { label: "全部", value: "all" },
        ...categories.map((cat) => ({ label: cat, value: cat })),
      ]);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    loadBrands();
    loadCategories();
  }, [loadBrands, loadCategories]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;
      const currentScrollY = contentOffset.y;
      const isCloseToBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;

      if (isCloseToBottom && !isLoadingMoreRef.current) loadMoreBrands();

      if (currentScrollY > 50 && currentScrollY > lastScrollY.current) {
        onScrollDown();
      } else if (
        (currentScrollY < lastScrollY.current || currentScrollY <= 10) &&
        !isCloseToBottom
      ) {
        onScrollUp();
      }
      lastScrollY.current = currentScrollY;
    },
    [loadMoreBrands, onScrollDown, onScrollUp]
  );

  const handleOpenSubmitModal = useCallback(() => {
    if (!user?.userId) {
      Alert.alert("提示", "请先登录后再提交品牌");
      return;
    }
    setSubmitModalVisible(true);
  }, [user]);

  const filteredBrands = useMemo(() => {
    return brands.filter((brand) => {
      const matchesSearch =
        brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (brand.founder &&
          brand.founder.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (brand.country &&
          brand.country.toLowerCase().includes(searchQuery.toLowerCase()));
      let matchesCategory = selectedCategory === "all";
      if (!matchesCategory && brand.category) {
        matchesCategory = brand.category.includes(selectedCategory);
      }
      return matchesSearch && matchesCategory;
    });
  }, [brands, searchQuery, selectedCategory]);

  const groupedBrands = useMemo(() => {
    const groups = filteredBrands.reduce(
      (acc, brand) => {
        const firstLetter = brand.name.charAt(0).toUpperCase();
        if (!acc[firstLetter]) acc[firstLetter] = [];
        acc[firstLetter].push(brand);
        return acc;
      },
      {} as Record<string, Brand[]>
    );
    return Object.keys(groups)
      .sort((a, b) => {
        const aIsNum = /^\d/.test(a);
        const bIsNum = /^\d/.test(b);
        if (aIsNum && !bIsNum) return 1;
        if (!aIsNum && bIsNum) return -1;
        return a.localeCompare(b);
      })
      .map((letter) => ({
        letter,
        brands: groups[letter].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [filteredBrands]);

  const hasActiveFilter = selectedCategory !== "all";
  const activeFilterLabel = hasActiveFilter
    ? categoryFilters.find((f) => f.value === selectedCategory)?.label
    : null;

  if (isLoading) {
    return (
      <Box style={styles.loadingContainer}>
        <Image
          source={require("../../../../assets/gif/archive-loading.gif")}
          style={styles.loadingGif}
          resizeMode="contain"
        />
      </Box>
    );
  }

  if (error) {
    return (
      <VStack style={styles.loadingContainer} alignItems="center">
        <Ionicons
          name="alert-circle-outline"
          size={24}
          color={theme.colors.gray400}
        />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadBrands()}
        >
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </VStack>
    );
  }

  return (
    <Box flex={1}>
      {/* Search + Filter */}
      <Box px="$md" pt="$sm" pb="$xs">
        <HStack space="sm">
          <HStack
            flex={1}
            bg="$gray50"
            rounded="$md"
            px="$md"
            py={12}
            borderWidth={1}
            borderColor="$gray100"
            alignItems="center"
          >
            <Ionicons
              name="search"
              size={18}
              color={theme.colors.gray400}
              style={{ marginRight: 10 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索品牌、设计师、国家..."
              placeholderTextColor={theme.colors.gray300}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={theme.colors.gray300}
                />
              </TouchableOpacity>
            )}
          </HStack>

          <TouchableOpacity
            style={[
              styles.filterButton,
              hasActiveFilter && styles.filterButtonActive,
            ]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={hasActiveFilter ? "#FFF" : theme.colors.gray600}
            />
            {hasActiveFilter && <Box style={styles.filterDot} />}
          </TouchableOpacity>
        </HStack>

        {hasActiveFilter && (
          <TouchableOpacity
            style={styles.activeFilterTag}
            onPress={() => setFilterModalVisible(true)}
          >
            <Text style={styles.activeFilterTagText}>{activeFilterLabel}</Text>
            <TouchableOpacity
              onPress={() => setSelectedCategory("all")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={14} color={theme.colors.gray500} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      </Box>

      {/* Results count */}
      <HStack justifyContent="between" px="$md" py="$sm">
        <Text style={styles.resultsText}>
          {filteredBrands.length} / {total} 个品牌
        </Text>
        <TouchableOpacity onPress={handleOpenSubmitModal} activeOpacity={0.7}>
          <Text style={styles.submitLinkText}>上传品牌</Text>
        </TouchableOpacity>
      </HStack>

      {/* Brand list */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {groupedBrands.map((group) => (
          <Box key={group.letter}>
            <HStack px="$lg" py="$md" bg="$white" alignItems="center">
              <Box style={styles.letterBadge}>
                <Text style={styles.letterText}>{group.letter}</Text>
              </Box>
              <Box style={styles.letterLine} />
            </HStack>

            {group.brands.map((brand) => (
              <TouchableOpacity
                key={brand.id}
                style={styles.brandItem}
                onPress={() =>
                  (navigation.navigate as any)("BrandDetail", {
                    id: brand.id.toString(),
                    name: brand.name,
                  })
                }
                activeOpacity={0.7}
              >
                <VStack flex={1}>
                  <Text style={styles.brandName} numberOfLines={1}>
                    {brand.name}
                  </Text>
                  <HStack style={styles.brandMetaRow}>
                    {brand.category && (
                      <Text style={styles.brandCategory} numberOfLines={1}>
                        {brand.category.split("/")[0]}
                      </Text>
                    )}
                    {brand.country && (
                      <Text style={styles.brandMeta}>{brand.country}</Text>
                    )}
                    {brand.foundedYear && (
                      <Text style={styles.brandMeta}>
                        {brand.foundedYear}年
                      </Text>
                    )}
                  </HStack>
                </VStack>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.colors.gray200}
                />
              </TouchableOpacity>
            ))}
          </Box>
        ))}

        {filteredBrands.length === 0 && (
          <VStack style={styles.emptyState} alignItems="center">
            <Ionicons
              name="search-outline"
              size={48}
              color={theme.colors.gray200}
            />
            <Text style={styles.emptyTitle}>未找到品牌</Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? `没有匹配 "${searchQuery}" 的品牌`
                : "品牌列表正在更新中"}
            </Text>
          </VStack>
        )}

        {/* Footer */}
        {!hasMore && brands.length > 0 && (
          <HStack justifyContent="center" py="$lg">
            <Text style={styles.footerText}>
              已加载全部 {total} 个品牌
            </Text>
          </HStack>
        )}
        {isLoadingMore && (
          <HStack justifyContent="center" py="$lg">
            <Image
              source={require("../../../../assets/gif/archive-loading.gif")}
              style={styles.footerGif}
              resizeMode="contain"
            />
          </HStack>
        )}
      </ScrollView>

      <CategoryFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={categoryFilters}
        selectedValue={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <SubmitBrandModal
        visible={submitModalVisible}
        onClose={() => setSubmitModalVisible(false)}
        onSuccess={() => loadBrands(true)}
      />
    </Box>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingGif: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
  errorText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.gray500,
  },
  retryButton: {
    marginTop: theme.spacing.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.black,
    borderRadius: theme.borderRadius.lg,
  },
  retryButtonText: {
    color: theme.colors.white,
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.black,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  filterDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF4444",
  },
  activeFilterTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: theme.colors.gray50,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  activeFilterTagText: {
    fontSize: 12,
    color: theme.colors.gray600,
  },
  resultsText: {
    fontSize: 12,
    color: theme.colors.gray400,
    letterSpacing: 0.5,
  },
  submitLinkText: {
    fontSize: 12,
    color: theme.colors.gray500,
    letterSpacing: 0.5,
    textDecorationLine: "underline",
  },
  contentContainer: {
    paddingBottom: theme.spacing.lg,
  },
  letterBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  letterText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.white,
    fontFamily: "PlayfairDisplay-Bold",
  },
  letterLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.gray200,
    marginLeft: theme.spacing.md,
  },
  brandItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
    backgroundColor: theme.colors.white,
  },
  brandName: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.black,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  brandMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  brandCategory: {
    fontSize: 12,
    color: theme.colors.gray500,
    marginRight: 8,
  },
  brandMeta: {
    fontSize: 12,
    color: theme.colors.gray300,
    marginRight: 8,
  },
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.colors.black,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.gray400,
    textAlign: "center",
    lineHeight: 20,
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.gray400,
  },
  footerGif: {
    width: 60,
    height: 60,
  },
});

export default BrandListTab;
