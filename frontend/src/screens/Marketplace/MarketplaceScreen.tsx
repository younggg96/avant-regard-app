/**
 * MarketplaceScreen —— PRD 2.1 交易大厅。
 *
 * - 双列瀑布流（用 FlatList 2 列 + 4:5 主图）；
 * - 顶部搜索 + 筛选按钮，弹出 MarketplaceFilterSheet；
 * - 卡片显示品牌 / 标题 / 价格 / 卖家徽章。
 *
 * 当前为独立入口屏；后续可作为 Discover 的一个 Tab 接入。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { Box, HStack, Pressable, Text, VStack } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import ScreenHeader from "../../components/ScreenHeader";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import {
  searchMarketplace,
  type MarketplaceFilter,
  type StoreProduct,
} from "../../services/storeProductService";
import { useFormatPrice } from "../../utils/currency";
import MarketplaceFilterSheet from "./MarketplaceFilterSheet";

const SCREEN_W = Dimensions.get("window").width;
const CARD_W = (SCREEN_W - 24 * 3) / 2;
const CARD_H = (CARD_W * 5) / 4; // PRD 2.1: 4:5 主图

const MarketplaceScreen: React.FC = () => {
  const navigation = useNavigation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<MarketplaceFilter>({ sort: "newest" });
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  // 价格按用户在 Settings → 币种 中选择的偏好展示；切换后整页自动 rerender。
  const formatPrice = useFormatPrice();

  const [items, setItems] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(
    async (nextPage: number, currentFilter: MarketplaceFilter) => {
      setLoading(true);
      try {
        const res = await searchMarketplace({
          ...currentFilter,
          q: currentFilter.q || keyword || undefined,
          page: nextPage,
          pageSize: 20,
        });
        const newItems = res.products || [];
        if (nextPage === 1) {
          setItems(newItems);
        } else {
          setItems((prev) => [...prev, ...newItems]);
        }
        setHasMore(
          newItems.length === 20 && nextPage * 20 < (res.total ?? Infinity)
        );
        setPage(nextPage);
      } finally {
        setLoading(false);
      }
    },
    [keyword]
  );

  useEffect(() => {
    load(1, filter);
  }, [load, filter]);

  const handleSearch = () => {
    setFilter((prev) => ({ ...prev, q: keyword || undefined }));
    load(1, { ...filter, q: keyword || undefined });
  };

  const handleApplyFilter = (next: MarketplaceFilter) => {
    setFilterSheetVisible(false);
    setFilter(next);
    load(1, next);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(1, filter);
    setRefreshing(false);
  };

  const onEndReached = () => {
    if (!loading && hasMore) {
      load(page + 1, filter);
    }
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter.brands?.length) count += filter.brands.length;
    else if (filter.brand) count += 1;
    if (filter.categoryKinds?.length) count += filter.categoryKinds.length;
    if (filter.categoryIds?.length) count += filter.categoryIds.length;
    else if (filter.categoryId != null) count += 1;
    if (filter.sizes?.length) count += filter.sizes.length;
    else if (filter.size) count += 1;
    if (filter.colors?.length) count += filter.colors.length;
    else if (filter.color) count += 1;
    if (filter.conditions?.length) count += filter.conditions.length;
    else if (filter.condition) count += 1;
    if (filter.sellerKind) count += 1;
    if (filter.priceMinCents != null || filter.priceMaxCents != null) count += 1;
    return count;
  }, [filter]);

  const renderCard = ({ item }: { item: StoreProduct }) => (
    <Pressable
      style={styles.card}
      onPress={() => {
        // @ts-expect-error - navigation types
        navigation.navigate("StoreProductDetail", { productId: item.id });
      }}
    >
      <Box style={styles.imageWrap}>
        {item.images?.[0] ? (
          <OptimizedImage uri={item.images[0]} style={styles.image} />
        ) : (
          <Box style={[styles.image, styles.imageEmpty]} />
        )}
        <Box style={styles.sellerBadge}>
          <Text style={styles.sellerBadgeText}>
            {item.sellerKind === "merchant" ? "买手店" : "个人"}
          </Text>
        </Box>
      </Box>
      <VStack space="xs" style={styles.meta}>
        <Text style={styles.brand} numberOfLines={1}>
          {item.brand ?? "—"}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.price}>
          {formatPrice(item.priceCents, item.currency)}
        </Text>
      </VStack>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Marketplace" showBack />

      <HStack style={styles.searchBar} space="sm">
        <HStack style={styles.searchInput} space="sm">
          <Ionicons name="search" size={16} color={theme.colors.gray300} />
          <TextInput
            style={styles.searchText}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={handleSearch}
            placeholder="搜索品牌、品类、关键词"
            placeholderTextColor={theme.colors.placeholder}
            returnKeyType="search"
          />
        </HStack>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setFilterSheetVisible(true)}
        >
          <Ionicons
            name="options"
            size={20}
            color={theme.colors.textInverted}
          />
          {activeFilterCount > 0 && (
            <Box style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </Box>
          )}
        </TouchableOpacity>
      </HStack>

      <FlatList
        data={items}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        renderItem={renderCard}
        contentContainerStyle={{
          padding: 12,
          paddingBottom: 32,
        }}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: 12 }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          loading ? (
            <Box style={styles.center}>
              <ActivityIndicator />
            </Box>
          ) : (
            <Box style={styles.center}>
              <Text style={styles.empty}>未找到符合的单品</Text>
            </Box>
          )
        }
        ListFooterComponent={
          loading && items.length > 0 ? (
            <Box style={{ padding: 16 }}>
              <ActivityIndicator />
            </Box>
          ) : null
        }
      />

      <MarketplaceFilterSheet
        visible={filterSheetVisible}
        initial={filter}
        onClose={() => setFilterSheetVisible(false)}
        onApply={handleApplyFilter}
      />
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    searchBar: {
      padding: 12,
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    searchInput: {
      flex: 1,
      alignItems: "center",
      backgroundColor: t.colors.surface,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    searchText: { flex: 1, color: t.colors.text, fontSize: 14 },
    filterBtn: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: t.colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    filterBadge: {
      position: "absolute",
      top: 2,
      right: 2,
      minWidth: 14,
      height: 14,
      paddingHorizontal: 4,
      backgroundColor: t.colors.error,
      borderRadius: 7,
      justifyContent: "center",
      alignItems: "center",
    },
    filterBadgeText: {
      color: t.colors.textInverted,
      fontSize: 10,
      fontWeight: "600",
    },
    card: {
      width: CARD_W,
      backgroundColor: t.colors.surface,
      borderRadius: 8,
      overflow: "hidden",
    },
    imageWrap: { width: CARD_W, height: CARD_H, backgroundColor: t.colors.border },
    image: { width: "100%", height: "100%" },
    imageEmpty: { backgroundColor: t.colors.border },
    sellerBadge: {
      position: "absolute",
      left: 8,
      bottom: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: t.colors.scrim,
      borderRadius: 4,
    },
    sellerBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
    meta: { padding: 10 },
    brand: { fontSize: 12, color: t.colors.textSecondary, fontWeight: "600" },
    title: { fontSize: 13, color: t.colors.text },
    price: { fontSize: 14, color: t.colors.text, fontWeight: "700", marginTop: 2 },
    center: { padding: 48, alignItems: "center" },
    empty: { color: t.colors.textSecondary },
  });

export default MarketplaceScreen;
