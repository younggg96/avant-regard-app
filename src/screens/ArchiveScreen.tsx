import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { brandService, Brand, BrandSubmission } from "../services/brandService";
import SubmitBrandModal from "../components/SubmitBrandModal";
import { useAuthStore } from "../store/authStore";
import { Alert } from "react-native";
import { ArchiveLeaderboard } from "./Discover/components/ArchiveLeaderboard";
import { showService, Show } from "../services/showService";
import {
  buyerStoreService,
  UserSubmittedStore,
} from "../services/buyerStoreService";

interface CategoryFilter {
  label: string;
  value: string;
}

type ArchiveTab = "all" | "myContribution" | "leaderboard";
type ContributionSubTab = "show" | "brand" | "store";

const PAGE_SIZE = 30;
const { width: screenWidth } = Dimensions.get("window");

const CARD_GAP = 12;
const CARD_PADDING = 16;
const CARD_WIDTH = (screenWidth - CARD_PADDING * 2 - CARD_GAP) / 2;

const MAIN_TABS: { id: ArchiveTab; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "myContribution", label: "我的贡献" },
  { id: "leaderboard", label: "贡献榜" },
];

const CONTRIBUTION_SUB_TABS: { id: ContributionSubTab; label: string }[] = [
  { id: "show", label: "秀场" },
  { id: "brand", label: "品牌" },
  { id: "store", label: "买手店" },
];

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  APPROVED: { bg: "#E8F5E9", color: "#2E7D32", label: "已通过" },
  REJECTED: { bg: "#FFEBEE", color: "#C62828", label: "已拒绝" },
  PENDING: { bg: "#FFF3E0", color: "#E65100", label: "审核中" },
};

const ArchiveScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
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

  const [activeMainTab, setActiveMainTab] = useState<ArchiveTab>("all");
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Contribution states
  const [contributionSubTab, setContributionSubTab] = useState<ContributionSubTab>("show");
  const [myShows, setMyShows] = useState<Show[]>([]);
  const [myBrands, setMyBrands] = useState<BrandSubmission[]>([]);
  const [myStores, setMyStores] = useState<UserSubmittedStore[]>([]);
  const [contributionLoading, setContributionLoading] = useState(false);
  const [contributionLoaded, setContributionLoaded] = useState(false);
  const [contributionRefreshing, setContributionRefreshing] = useState(false);

  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const headerHeight = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const isHeaderVisible = useRef(true);
  const lastScrollY = useRef(0);

  const tabWidth = (screenWidth - 32) / MAIN_TABS.length;

  const handleTabChange = useCallback(
    (tab: ArchiveTab) => {
      setActiveMainTab(tab);
      const tabIndex = MAIN_TABS.findIndex((t) => t.id === tab);
      Animated.spring(tabIndicatorAnim, {
        toValue: tabIndex,
        useNativeDriver: true,
        tension: 300,
        friction: 30,
      }).start();
      if (tab !== "all" && !isHeaderVisible.current) {
        isHeaderVisible.current = true;
        Animated.parallel([
          Animated.timing(headerHeight, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(headerOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
        ]).start();
      }
    },
    [tabIndicatorAnim, headerHeight, headerOpacity]
  );

  // --- Brand list logic ---
  const loadBrands = useCallback(async (reset: boolean = true) => {
    try {
      if (reset) {
        setIsLoading(true);
        setPage(1);
        setHasMore(true);
      }
      setError(null);
      const response = await brandService.getBrands({ page: 1, pageSize: PAGE_SIZE });
      setBrands(response.brands);
      setTotal(response.total);
      setHasMore(response.brands.length >= PAGE_SIZE && response.brands.length < response.total);
      setPage(1);
    } catch (err) {
      console.error("Failed to load brands:", err);
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
      const response = await brandService.getBrands({ page: nextPage, pageSize: PAGE_SIZE });
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
    } catch (err) {
      console.error("Failed to load more brands:", err);
    } finally {
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  }, [page, hasMore, isLoading, brands.length]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const currentScrollY = contentOffset.y;
      const isCloseToBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;

      if (isCloseToBottom && !isLoadingMoreRef.current) loadMoreBrands();

      if (currentScrollY > 50 && currentScrollY > lastScrollY.current && isHeaderVisible.current) {
        isHeaderVisible.current = false;
        Animated.parallel([
          Animated.timing(headerHeight, { toValue: 0, duration: 150, useNativeDriver: false }),
          Animated.timing(headerOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
        ]).start();
      } else if (
        (currentScrollY < lastScrollY.current || currentScrollY <= 10) &&
        !isHeaderVisible.current &&
        !isCloseToBottom
      ) {
        isHeaderVisible.current = true;
        Animated.parallel([
          Animated.timing(headerHeight, { toValue: 1, duration: 150, useNativeDriver: false }),
          Animated.timing(headerOpacity, { toValue: 1, duration: 150, useNativeDriver: false }),
        ]).start();
      }
      lastScrollY.current = currentScrollY;
    },
    [loadMoreBrands, headerHeight, headerOpacity]
  );

  const loadCategories = useCallback(async () => {
    try {
      const categories = await brandService.getBrandCategories();
      setCategoryFilters([
        { label: "全部", value: "all" },
        ...categories.map((cat) => ({ label: cat, value: cat })),
      ]);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, []);

  const handleOpenSubmitModal = useCallback(() => {
    if (!user?.userId) {
      Alert.alert("提示", "请先登录后再提交品牌");
      return;
    }
    setSubmitModalVisible(true);
  }, [user]);

  // --- Contribution logic ---
  const loadContributions = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const [showsResult, brandsResult, storesResult] = await Promise.all([
        showService.getMyShows(),
        brandService.getMySubmissions(),
        buyerStoreService.getMySubmissions(1, 100),
      ]);
      setMyShows(showsResult);
      setMyBrands(brandsResult);
      setMyStores(storesResult.stores);
    } catch (error) {
      console.error("Error loading contributions:", error);
    }
  }, [user]);

  useEffect(() => {
    loadBrands();
    loadCategories();
  }, [loadBrands, loadCategories]);

  useEffect(() => {
    if (activeMainTab === "myContribution" && !contributionLoaded && user?.userId) {
      setContributionLoading(true);
      loadContributions().finally(() => {
        setContributionLoading(false);
        setContributionLoaded(true);
      });
    }
  }, [activeMainTab, contributionLoaded, user, loadContributions]);

  const onContributionRefresh = useCallback(async () => {
    setContributionRefreshing(true);
    await loadContributions();
    setContributionRefreshing(false);
  }, [loadContributions]);

  // --- Computed ---
  const filteredBrands = useMemo(() => {
    return brands.filter((brand) => {
      const matchesSearch =
        brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (brand.founder && brand.founder.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (brand.country && brand.country.toLowerCase().includes(searchQuery.toLowerCase()));
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

  // --- Helpers ---
  const getStatusStyle = (status: string) => STATUS_STYLES[status] || STATUS_STYLES.PENDING;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const handleShowPress = (show: Show) => {
    (navigation as any).navigate("CollectionDetail", {
      collection: {
        id: String(show.id),
        title: `${show.brand} ${show.season}`,
        season: show.season,
        year: String(show.year || ""),
        coverImage: show.coverImage || "",
        imageCount: 0,
        designer: show.designer,
        description: show.description,
        category: show.category,
        showUrl: show.showUrl,
        contributorName: show.contributorName,
      },
      brandName: show.brand,
    });
  };

  const handleBrandSubmissionPress = (submission: BrandSubmission) => {
    if (submission.status === "APPROVED") {
      (navigation as any).navigate("BrandDetail", { name: submission.name });
    }
  };

  const handleStorePress = (store: UserSubmittedStore) => {
    if (store.status === "APPROVED" && store.approvedStoreId) {
      (navigation as any).navigate("StoreDetail", { storeId: store.approvedStoreId });
    }
  };

  // --- Render: Brand List Footer ---
  const renderFooter = () => {
    if (!hasMore && brands.length > 0) {
      return (
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>已加载全部 {total} 个品牌</Text>
        </View>
      );
    }
    if (isLoadingMore) {
      return (
        <View style={styles.footerContainer}>
          <Image
            source={require("../../assets/gif/archive-loading.gif")}
            style={styles.footerLoadingGif}
            resizeMode="contain"
          />
        </View>
      );
    }
    return null;
  };

  // --- Render: "全部" tab ---
  const renderBrandListContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <Image
            source={require("../../assets/gif/archive-loading.gif")}
            style={styles.loadingGif}
            resizeMode="contain"
          />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={24} color={theme.colors.gray400} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadBrands()}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <>
        <View style={styles.searchContainer}>
          <View style={styles.searchRow}>
            <View style={[styles.searchBar, { flex: 1 }]}>
              <Ionicons name="search" size={18} color={theme.colors.gray400} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="搜索品牌、设计师、国家..."
                placeholderTextColor={theme.colors.gray300}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.gray300} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.filterButton, hasActiveFilter && styles.filterButtonActive]}
              onPress={() => setFilterModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="options-outline"
                size={18}
                color={hasActiveFilter ? "#FFF" : theme.colors.gray600}
              />
              {hasActiveFilter && <View style={styles.filterDot} />}
            </TouchableOpacity>
          </View>
          {hasActiveFilter && (
            <TouchableOpacity style={styles.activeFilterTag} onPress={() => setFilterModalVisible(true)}>
              <Text style={styles.activeFilterTagText}>{activeFilterLabel}</Text>
              <TouchableOpacity
                onPress={() => setSelectedCategory("all")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={14} color={theme.colors.gray500} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.resultsContainer}>
          <Text style={styles.resultsText}>
            {filteredBrands.length} / {total} 个品牌
          </Text>
          <TouchableOpacity onPress={handleOpenSubmitModal} activeOpacity={0.7}>
            <Text style={styles.submitLinkText}>上传品牌</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {groupedBrands.map((group) => (
            <View key={group.letter}>
              <View style={styles.letterHeader}>
                <View style={styles.letterBadge}>
                  <Text style={styles.letterText}>{group.letter}</Text>
                </View>
                <View style={styles.letterLine} />
              </View>
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
                  <View style={styles.brandInfo}>
                    <Text style={styles.brandName} numberOfLines={1}>{brand.name}</Text>
                    <View style={styles.brandMetaRow}>
                      {brand.category && (
                        <Text style={styles.brandCategory} numberOfLines={1}>
                          {brand.category.split("/")[0]}
                        </Text>
                      )}
                      {brand.country && <Text style={styles.brandMeta}>{brand.country}</Text>}
                      {brand.foundedYear && <Text style={styles.brandMeta}>{brand.foundedYear}年</Text>}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.gray200} />
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {filteredBrands.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={theme.colors.gray200} />
              <Text style={styles.emptyTitle}>未找到品牌</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? `没有匹配 "${searchQuery}" 的品牌` : "品牌列表正在更新中"}
              </Text>
            </View>
          )}
          {renderFooter()}
        </ScrollView>
      </>
    );
  };

  // --- Render: Contribution cards ---
  const renderShowCard = (show: Show) => {
    const status = show.status || "APPROVED";
    const ss = getStatusStyle(status);
    return (
      <TouchableOpacity
        key={`show-${show.id}`}
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => handleShowPress(show)}
      >
        <View style={styles.cardImageContainer}>
          {show.coverImage ? (
            <Image source={{ uri: show.coverImage }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <Ionicons name="film-outline" size={32} color={theme.colors.gray300} />
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {show.brand} {show.season}
          </Text>
          {(show.category || show.year) && (
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {show.category || show.year?.toString() || ""}
            </Text>
          )}
          <View style={styles.cardBottom}>
            <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
              <Text style={[styles.statusText, { color: ss.color }]}>{ss.label}</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(show.createdAt)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderBrandCard = (brand: BrandSubmission) => {
    const ss = getStatusStyle(brand.status);
    return (
      <TouchableOpacity
        key={`brand-${brand.id}`}
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => handleBrandSubmissionPress(brand)}
      >
        <View style={styles.cardImageContainer}>
          {brand.coverImage ? (
            <Image source={{ uri: brand.coverImage }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <Ionicons name="pricetag-outline" size={32} color={theme.colors.gray300} />
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{brand.name}</Text>
          {brand.category && (
            <Text style={styles.cardSubtitle} numberOfLines={1}>{brand.category}</Text>
          )}
          <View style={styles.cardBottom}>
            <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
              <Text style={[styles.statusText, { color: ss.color }]}>{ss.label}</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(brand.createdAt)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStoreCard = (store: UserSubmittedStore) => {
    const ss = getStatusStyle(store.status);
    return (
      <TouchableOpacity
        key={`store-${store.id}`}
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => handleStorePress(store)}
      >
        <View style={styles.cardImageContainer}>
          {store.images && store.images.length > 0 ? (
            <Image source={{ uri: store.images[0] }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <Ionicons name="storefront-outline" size={32} color={theme.colors.gray300} />
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{store.name}</Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {store.city}, {store.country}
          </Text>
          <View style={styles.cardBottom}>
            <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
              <Text style={[styles.statusText, { color: ss.color }]}>{ss.label}</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(store.createdAt)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // --- Render: "我的贡献" tab ---
  const renderMyContributionContent = () => {
    if (!user?.userId) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={48} color={theme.colors.gray200} />
          <Text style={styles.emptyTitle}>请先登录</Text>
          <Text style={styles.emptyText}>登录后查看你的贡献记录</Text>
        </View>
      );
    }

    const getSubTabData = () => {
      switch (contributionSubTab) {
        case "show":
          return myShows;
        case "brand":
          return myBrands;
        case "store":
          return myStores;
      }
    };

    const data = getSubTabData();
    const emptyConfig: Record<ContributionSubTab, { icon: string; text: string }> = {
      show: { icon: "film-outline", text: "暂无秀场贡献" },
      brand: { icon: "pricetag-outline", text: "暂无品牌贡献" },
      store: { icon: "storefront-outline", text: "暂无买手店贡献" },
    };

    return (
      <View style={{ height: "100%" }}>

        {CONTRIBUTION_SUB_TABS.map((tab) => {
          const count =
            tab.id === "show" ? myShows.length : tab.id === "brand" ? myBrands.length : myStores.length;
          const isActive = contributionSubTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.subFilterChip, isActive && styles.subFilterChipActive]}
              onPress={() => setContributionSubTab(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.subFilterChipText, isActive && styles.subFilterChipTextActive]}>
                {tab.label}
              </Text>
              <Text style={[styles.subFilterChipCount, isActive && styles.subFilterChipCountActive]}>
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Content */}
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contributionScrollContainer}
          refreshControl={
            <RefreshControl refreshing={contributionRefreshing} onRefresh={onContributionRefresh} />
          }
        >
          {contributionLoading ? (
            <View style={styles.contributionLoadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.gray400} />
            </View>
          ) : data.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name={emptyConfig[contributionSubTab].icon as any} size={48} color={theme.colors.gray200} />
              <Text style={styles.emptyTitle}>{emptyConfig[contributionSubTab].text}</Text>
              <Text style={styles.emptyText}>你提交的内容通过审核后会显示在这里</Text>
            </View>
          ) : (
            <View style={styles.cardGrid}>
              {contributionSubTab === "show" && (data as Show[]).map(renderShowCard)}
              {contributionSubTab === "brand" && (data as BrandSubmission[]).map(renderBrandCard)}
              {contributionSubTab === "store" && (data as UserSubmittedStore[]).map(renderStoreCard)}
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // --- Render: "贡献榜" tab ---
  const renderLeaderboardContent = () => (
    <ScrollView
      style={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.leaderboardContainer}
    >
      <ArchiveLeaderboard />
    </ScrollView>
  );

  // --- Render: Filter Modal ---
  const renderFilterModal = () => (
    <Modal
      visible={filterModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setFilterModalVisible(false)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setFilterModalVisible(false)}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>筛选类别</Text>
          <View style={styles.categoryGrid}>
            {categoryFilters.map((filter) => (
              <TouchableOpacity
                key={filter.value}
                style={[styles.categoryChip, selectedCategory === filter.value && styles.categoryChipActive]}
                onPress={() => {
                  setSelectedCategory(filter.value);
                  setFilterModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === filter.value && styles.categoryChipTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {hasActiveFilter && (
            <TouchableOpacity
              style={styles.resetFilterButton}
              onPress={() => {
                setSelectedCategory("all");
                setFilterModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.resetFilterText}>重置筛选</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );

  // --- Tab content switch ---
  const renderTabContent = () => {
    switch (activeMainTab) {
      case "all":
        return renderBrandListContent();
      case "myContribution":
        return renderMyContributionContent();
      case "leaderboard":
        return renderLeaderboardContent();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Animated Header */}
      <Animated.View
        style={{
          height: headerHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 80],
          }),
          opacity: headerOpacity,
          overflow: "hidden",
        }}
      >
        <ScreenHeader title="Archive" subtitle="探索全球时尚品牌" boldTitle={true} borderless />
      </Animated.View>

      {/* Main Tab Bar */}
      <View style={styles.mainTabBar}>
        {MAIN_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={styles.mainTabItem}
            onPress={() => handleTabChange(tab.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.mainTabText, activeMainTab === tab.id && styles.mainTabTextActive]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
        <Animated.View
          style={[
            styles.mainTabIndicator,
            {
              width: 30,
              left: 0,
              transform: [
                {
                  translateX: tabIndicatorAnim.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [
                      16 + tabWidth * 0.5 - 15,
                      16 + tabWidth * 1.5 - 15,
                      16 + tabWidth * 2.5 - 15,
                    ],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Filter Bottom Sheet */}
      {renderFilterModal()}

      <SubmitBrandModal
        visible={submitModalVisible}
        onClose={() => setSubmitModalVisible(false)}
        onSuccess={() => loadBrands(true)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
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

  // Main Tab Bar
  mainTabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
    position: "relative",
  },
  mainTabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  mainTabText: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.gray400,
    textAlign: "center",
  },
  mainTabTextActive: {
    color: theme.colors.black,
    fontWeight: "600",
  },
  mainTabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    backgroundColor: theme.colors.black,
    borderRadius: 1,
  },

  // Sub Filter Buttons (for 我的贡献)
  subFilterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  subFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  subFilterChipActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  subFilterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.gray600,
  },
  subFilterChipTextActive: {
    color: theme.colors.white,
  },
  subFilterChipCount: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.gray400,
  },
  subFilterChipCountActive: {
    color: "rgba(255,255,255,0.7)",
  },

  // Search
  searchContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
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
  // Results
  resultsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
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

  // Scrollable content
  scrollContent: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: theme.spacing.lg,
  },
  letterHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.white,
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
  brandInfo: {
    flex: 1,
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
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: theme.spacing.lg,
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.gray400,
  },
  footerLoadingGif: {
    width: 60,
    height: 60,
  },

  // Contribution cards
  contributionScrollContainer: {
    paddingBottom: 32,
  },
  contributionLoadingContainer: {
    paddingVertical: 80,
    alignItems: "center",
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: CARD_PADDING,
    paddingTop: 4,
    justifyContent: "space-between",
  },
  card: {
    width: CARD_WIDTH,
    marginBottom: CARD_GAP,
    borderRadius: 12,
    backgroundColor: "#FFF",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  cardImageContainer: {
    width: "100%",
    aspectRatio: 3 / 4,
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A1A",
    lineHeight: 18,
  },
  cardSubtitle: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 10,
    color: theme.colors.gray300,
  },

  // Leaderboard tab
  leaderboardContainer: {
    paddingBottom: 32,
  },

  // Filter Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: "70%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.gray200,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.colors.black,
    marginBottom: 16,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.colors.gray50,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  categoryChipText: {
    fontSize: 14,
    color: theme.colors.gray600,
  },
  categoryChipTextActive: {
    color: theme.colors.white,
    fontWeight: "600",
  },
  resetFilterButton: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: "center",
  },
  resetFilterText: {
    fontSize: 14,
    color: theme.colors.gray500,
    fontWeight: "500",
  },
});

export default ArchiveScreen;
