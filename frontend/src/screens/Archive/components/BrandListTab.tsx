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
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Image, HStack, VStack, ScrollView } from "../../../components/ui";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../../../theme";
import { brandService, Brand } from "../../../services/brandService";
import { useAuthStore } from "../../../store/authStore";
import { useArchiveBrandListRefreshStore } from "../../../store/archiveBrandListRefreshStore";
import SubmitBrandModal from "../../../components/SubmitBrandModal";
import CategoryFilterModal from "./CategoryFilterModal";
import BrandListSkeleton from "./BrandListSkeleton";
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
  const theme = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const styles = useThemedStyles(makeStyles);
  const brandListRefreshNonce = useArchiveBrandListRefreshStore((s) => s.refreshNonce);

  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilter[]>([
    { label: t("archive.all"), value: "all" },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const isLoadingMoreRef = useRef(false);
  const lastScrollY = useRef(0);

  const searchQueryRef = useRef("");

  const buildParams = useCallback(
    (pageNum: number) => {
      const params: { page: number; pageSize: number; keyword?: string; category?: string } = {
        page: pageNum,
        pageSize: PAGE_SIZE,
      };
      const kw = searchQueryRef.current.trim();
      if (kw) params.keyword = kw;
      if (selectedCategory !== "all") params.category = selectedCategory;
      return params;
    },
    [selectedCategory]
  );

  const loadBrands = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await brandService.getBrands(buildParams(1));
      setBrands(response.brands);
      setTotal(response.total);
      setHasMore(
        response.brands.length >= PAGE_SIZE &&
          response.brands.length < response.total
      );
      setPage(1);
    } catch {
      setError(t("archive.brandLoadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [buildParams]);

  const loadMoreBrands = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMore || isLoading) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await brandService.getBrands(buildParams(nextPage));
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
  }, [page, hasMore, isLoading, brands.length, buildParams]);

  const handleSearch = useCallback(() => {
    searchQueryRef.current = searchQuery;
    loadBrands();
  }, [searchQuery, loadBrands]);

  const loadCategories = useCallback(async () => {
    try {
      const categories = await brandService.getBrandCategories();
      setCategoryFilters([
        { label: t("archive.all"), value: "all" },
        ...categories.map((cat) => ({ label: cat, value: cat })),
      ]);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  useEffect(() => {
    if (brandListRefreshNonce === 0) return;
    loadBrands();
  }, [brandListRefreshNonce, loadBrands]);

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
      Alert.alert(t("common.hint"), t("archive.loginToSubmitBrand"));
      return;
    }
    setSubmitModalVisible(true);
  }, [user, t]);

  const groupedBrands = useMemo(() => {
    const groups = brands.reduce(
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
  }, [brands]);

  const hasActiveFilter = selectedCategory !== "all";
  const activeFilterLabel = hasActiveFilter
    ? categoryFilters.find((f) => f.value === selectedCategory)?.label
    : null;

  if (isLoading) {
    // archive-loading.gif 是浅色品牌动图，dark mode 下整屏白底刺眼且没有
    // 深色版 GIF；用通用 skeleton 占位，light mode 继续保持原 GIF 体验。
    if (theme.mode === "dark") {
      return <BrandListSkeleton />;
    }
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
          <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
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
            style={[{ backgroundColor: theme.colors.gray50 }, { borderColor: theme.colors.gray100 }]}
            rounded="$md"
            px="$md"
            py={12}
            borderWidth={1}

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
              placeholder={t("archive.searchBrandPlaceholder")}
              placeholderTextColor={theme.colors.gray300}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(""); searchQueryRef.current = ""; loadBrands(); }}>
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
          {t("archive.brandCount", { current: brands.length, total })}
        </Text>
        <TouchableOpacity onPress={handleOpenSubmitModal} activeOpacity={0.7}>
          <Text style={styles.submitLinkText}>{t("archive.submitBrand")}</Text>
        </TouchableOpacity>
      </HStack>

      {/* Brand list */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {groupedBrands.map((group) => (
          <Box key={group.letter}>
            <HStack px="$lg" py="$md" style={{ backgroundColor: theme.colors.white }} alignItems="center">
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
                        {t("archive.foundedYearLabel", { year: brand.foundedYear })}
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

        {brands.length === 0 && !isLoading && (
          <VStack style={styles.emptyState} alignItems="center">
            <Ionicons
              name="search-outline"
              size={48}
              color={theme.colors.gray200}
            />
            <Text style={styles.emptyTitle}>{t("archive.noBrandsFound")}</Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? t("archive.noMatchingBrands", { query: searchQuery })
                : t("archive.brandsUpdating")}
            </Text>
          </VStack>
        )}

        {/* Footer */}
        {!hasMore && brands.length > 0 && (
          <HStack justifyContent="center" py="$lg">
            <Text style={styles.footerText}>
              {t("archive.allBrandsLoaded", { total })}
            </Text>
          </HStack>
        )}
        {isLoadingMore && (
          <HStack justifyContent="center" py="$lg">
            {theme.mode === "dark" ? (
              <ActivityIndicator color={theme.colors.gray400} />
            ) : (
              <Image
                source={require("../../../../assets/gif/archive-loading.gif")}
                style={styles.footerGif}
                resizeMode="contain"
              />
            )}
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
        onSuccess={loadBrands}
      />
    </Box>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
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
      marginTop: t.spacing.md,
      fontSize: 14,
      color: t.colors.gray500,
    },
    retryButton: {
      marginTop: t.spacing.md,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: t.colors.text,
      borderRadius: t.borderRadius.lg,
    },
    retryButtonText: {
      color: t.colors.textInverted,
      fontSize: 14,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: t.colors.text,
    },
    filterButton: {
      width: 44,
      height: 44,
      borderRadius: t.borderRadius.md,
      backgroundColor: t.colors.gray50,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: t.colors.gray100,
    },
    filterButtonActive: {
      backgroundColor: t.colors.text,
      borderColor: t.colors.text,
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
      backgroundColor: t.colors.gray50,
      borderWidth: 1,
      borderColor: t.colors.gray200,
    },
    activeFilterTagText: {
      fontSize: 12,
      color: t.colors.gray600,
    },
    resultsText: {
      fontSize: 12,
      color: t.colors.gray400,
      letterSpacing: 0.5,
    },
    submitLinkText: {
      fontSize: 12,
      color: t.colors.gray500,
      letterSpacing: 0.5,
      textDecorationLine: "underline",
    },
    contentContainer: {
      paddingBottom: t.spacing.lg,
    },
    letterBadge: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: t.colors.text,
      alignItems: "center",
      justifyContent: "center",
    },
    letterText: {
      fontSize: 13,
      fontWeight: "700",
      color: t.colors.textInverted,
      fontFamily: "PlayfairDisplay-Bold",
    },
    letterLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.gray200,
      marginLeft: t.spacing.md,
    },
    brandItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: t.spacing.lg,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    brandName: {
      fontSize: 16,
      fontWeight: "500",
      color: t.colors.text,
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
      color: t.colors.gray500,
      marginRight: 8,
    },
    brandMeta: {
      fontSize: 12,
      color: t.colors.gray300,
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
      color: t.colors.text,
      marginTop: t.spacing.md,
      marginBottom: t.spacing.sm,
    },
    emptyText: {
      fontSize: 14,
      color: t.colors.gray400,
      textAlign: "center",
      lineHeight: 20,
    },
    footerText: {
      fontSize: 13,
      color: t.colors.gray400,
    },
    footerGif: {
      width: 60,
      height: 60,
    },
  });

export default BrandListTab;
