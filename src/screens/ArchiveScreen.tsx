import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { brandService, Brand } from "../services/brandService";

// Category filter options
const CATEGORY_FILTERS = [
  { label: "全部", value: "all" },
  { label: "时装品牌", value: "时装品牌" },
  { label: "奢侈", value: "奢侈" },
  { label: "先锋", value: "先锋" },
  { label: "工匠品牌", value: "工匠品牌" },
];

const ArchiveScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载品牌数据
  const loadBrands = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await brandService.getBrands({
        pageSize: 500, // 获取所有品牌
      });
      setBrands(response.brands);
    } catch (err) {
      console.error("Failed to load brands:", err);
      setError("加载品牌数据失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  // Filter brands by search query and category
  const filteredBrands = useMemo(() => {
    return brands.filter((brand) => {
      // Search filter
      const matchesSearch =
        brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (brand.founder &&
          brand.founder.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (brand.country &&
          brand.country.toLowerCase().includes(searchQuery.toLowerCase()));

      // Category filter
      let matchesCategory = selectedCategory === "all";
      if (!matchesCategory && brand.category) {
        matchesCategory = brand.category.includes(selectedCategory);
      }

      return matchesSearch && matchesCategory;
    });
  }, [brands, searchQuery, selectedCategory]);

  // Group brands by first letter
  const groupedBrands = useMemo(() => {
    const groups = filteredBrands.reduce((acc, brand) => {
      const firstLetter = brand.name.charAt(0).toUpperCase();
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      acc[firstLetter].push(brand);
      return acc;
    }, {} as Record<string, Brand[]>);

    // Sort groups alphabetically, with numbers at the end
    return Object.keys(groups)
      .sort((a, b) => {
        const aIsNumber = /^\d/.test(a);
        const bIsNumber = /^\d/.test(b);
        if (aIsNumber && !bIsNumber) return 1; // 数字放后面
        if (!aIsNumber && bIsNumber) return -1; // 字母放前面
        return a.localeCompare(b);
      })
      .map((letter) => ({
        letter,
        brands: groups[letter].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [filteredBrands]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScreenHeader
          title="Archive"
          subtitle="探索全球时尚品牌"
          boldTitle={true}
          borderless
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.black} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScreenHeader
          title="Archive"
          subtitle="探索全球时尚品牌"
          boldTitle={true}
          borderless
        />
        <View style={styles.loadingContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={theme.colors.gray400}
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadBrands}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title="Archive"
        subtitle="探索全球时尚品牌"
        boldTitle={true}
        borderless
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
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
        </View>
      </View>

      {/* Category Filter */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {CATEGORY_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterChip,
                selectedCategory === filter.value && styles.filterChipActive,
              ]}
              onPress={() => setSelectedCategory(filter.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === filter.value &&
                  styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results Count */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsText}>{filteredBrands.length} 个品牌</Text>
      </View>

      {/* Brands List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {groupedBrands.map((group) => (
          <View key={group.letter}>
            {/* Letter Header */}
            <View style={styles.letterHeader}>
              <View style={styles.letterBadge}>
                <Text style={styles.letterText}>{group.letter}</Text>
              </View>
              <View style={styles.letterLine} />
            </View>

            {/* Brands in this group */}
            {group.brands.map((brand) => (
              <TouchableOpacity
                key={brand.id}
                style={styles.brandItem}
                onPress={() => {
                  (navigation.navigate as any)("BrandDetail", {
                    id: brand.id.toString(),
                    name: brand.name,
                  });
                }}
                activeOpacity={0.7}
              >
                {/* Brand Info */}
                <View style={styles.brandInfo}>
                  <Text style={styles.brandName} numberOfLines={1}>
                    {brand.name}
                  </Text>
                  <View style={styles.brandMetaRow}>
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
                  </View>
                </View>

                {/* Arrow */}
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.colors.gray200}
                />
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {filteredBrands.length === 0 && (
          <View style={styles.emptyState}>
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
          </View>
        )}

        {/* Bottom Padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.gray400,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  errorText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.gray500,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
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
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.black,
  },
  filterContainer: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
  },
  filterScrollContent: {
    paddingHorizontal: theme.spacing.md,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.white,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  filterChipActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray500,
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  resultsBar: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  resultsText: {
    fontSize: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray400,
    letterSpacing: 0.5,
  },
  content: {
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
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
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
  brandAvatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: theme.colors.gray50,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  brandAvatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.gray500,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
  },
  brandInfo: {
    flex: 1,
  },
  brandName: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.black,
    marginBottom: 4,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
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
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    marginRight: 8,
  },
  brandMeta: {
    fontSize: 12,
    color: theme.colors.gray300,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    marginRight: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: theme.spacing.xxl * 2,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.colors.black,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.gray400,
    textAlign: "center",
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    lineHeight: 20,
  },
});

export default ArchiveScreen;
