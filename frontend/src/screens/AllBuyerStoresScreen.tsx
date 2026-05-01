/**
 * AllBuyerStoresScreen —— 买手店 Tab 的 "查看全部" 入口落地页。
 *
 * 与 `StoreListScreen` 的区别：
 *   - `StoreListScreen` 是 "买手地图 → 列表" 的传统单列 + 底部 sheet 详情，
 *     UX 针对地图场景；
 *   - 本屏专门给 Discover/BuyerTab 的"查看全部"入口，用和买手店 Tab
 *     视觉一致的 2 列网格 + "已入驻" 徽章，点击直接跳 `StoreDetail`。
 *
 * 数据源：`GET /api/buyer-stores/all` —— 已入驻商家永远排前，所以用户
 * 翻页时能清晰看到"合作商家先、其它门店后"的层级。
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  ListRenderItem,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Pressable, Text, VStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { BuyerStore, getAllBuyerStores } from "../services/buyerStoreService";
import { SCREEN_WIDTH } from "./Discover/constants";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 30;
const GRID_HORIZONTAL_PADDING = 16;
const GRID_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP) / 2;

type NavigationProp = {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
};

const AllBuyerStoresScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();

  const [stores, setStores] = useState<BuyerStore[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const searchInputRef = useRef<TextInput>(null);

  // 防止组件卸载后 setState
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // --- 数据加载 ---
  const load = useCallback(
    async (mode: "initial" | "refresh" | "more", overrideQuery?: string) => {
      const queryForCall = overrideQuery !== undefined ? overrideQuery : activeQuery;
      try {
        if (mode === "initial") setIsLoading(true);
        else if (mode === "refresh") setIsRefreshing(true);
        else setIsLoadingMore(true);
        setError(null);

        const targetPage = mode === "more" ? page + 1 : 1;
        const result = await getAllBuyerStores({
          page: targetPage,
          pageSize: PAGE_SIZE,
          searchQuery: queryForCall || undefined,
        });
        if (!mountedRef.current) return;

        setTotal(result.total);
        setPage(targetPage);

        const nextStores =
          mode === "more" ? [...stores, ...result.stores] : result.stores;
        setStores(nextStores);
        setHasMore(nextStores.length < result.total && result.stores.length > 0);
      } catch (e) {
        console.error("加载全部买手店失败:", e);
        if (!mountedRef.current) return;
        setError(e instanceof Error ? e.message : t("store.loadFailed"));
      } finally {
        if (!mountedRef.current) return;
        if (mode === "initial") setIsLoading(false);
        else if (mode === "refresh") setIsRefreshing(false);
        else setIsLoadingMore(false);
      }
    },
    [activeQuery, page, stores]
  );

  // 首次挂载拉取
  useEffect(() => {
    load("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 搜索 ---
  const handleSearchSubmit = useCallback(() => {
    const trimmed = searchInput.trim();
    Keyboard.dismiss();
    setActiveQuery(trimmed);
    // 触发一次新的 initial 加载（传入 overrideQuery，因为 state 还没刷）
    load("initial", trimmed);
  }, [searchInput, load]);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setActiveQuery("");
    searchInputRef.current?.blur();
    Keyboard.dismiss();
    load("initial", "");
  }, [load]);

  // --- 列表交互 ---
  const handleStorePress = useCallback(
    (storeId: string) => {
      navigation.navigate("StoreDetail", { storeId });
    },
    [navigation]
  );

  const renderItem = useCallback<ListRenderItem<BuyerStore>>(
    ({ item }) => (
      <StoreCard
        store={item}
        onPress={handleStorePress}
      />
    ),
    [handleStorePress]
  );

  const keyExtractor = useCallback((item: BuyerStore) => item.id, []);

  // ---- 渲染分支 ----
  if (isLoading && stores.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <ScreenHeader title={t("store.allStores")} showBack />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && stores.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <ScreenHeader title={t("store.allStores")} showBack />
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={theme.colors.gray300} />
          <Text fontSize="$md" fontWeight="$semibold" color="$black" mt="$sm">
            {t("store.loadFailed")}
          </Text>
          <Text fontSize="$xs" color="$gray300" mt="$xs" textAlign="center">
            {error}
          </Text>
          <Pressable
            onPress={() => load("initial")}
            px="$lg"
            py="$sm"
            mt="$md"
            bg="$black"
            rounded="$md"
          >
            <Text color="$white" fontWeight="$semibold" fontSize="$sm">
              {t("store.tapRetry")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScreenHeader
        title={t("store.allStores")}
        subtitle={total > 0 ? t('store.totalCount', { count: total }) : undefined}
        showBack
      />

      {/* 搜索框 */}
      <Box mx="$md" my="$sm">
        <HStack
          style={styles.searchBar}
          alignItems="center"
          gap={8}
        >
          <Ionicons name="search" size={16} color={theme.colors.gray300} />
          <TextInput
            ref={searchInputRef}
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder={t("store.searchPlaceholder")}
            placeholderTextColor={theme.colors.gray300}
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
            style={styles.searchInput}
          />
          {searchInput.length > 0 && (
            <Pressable onPress={handleClearSearch} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={theme.colors.gray300} />
            </Pressable>
          )}
        </HStack>
      </Box>

      <FlatList
        data={stores}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load("refresh")}
            colors={[theme.colors.accent]}
            tintColor={theme.colors.accent}
          />
        }
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (!isLoadingMore && hasMore && !isLoading) {
            load("more");
          }
        }}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={theme.colors.gray300} />
            </View>
          ) : !hasMore && stores.length > 0 ? (
            <View style={styles.footerEnd}>
              <Text fontSize="$xs" color="$gray300">
                {t("store.noMoreData")}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading && stores.length === 0 ? (
            <Box py="$xl" alignItems="center">
              <Ionicons name="storefront-outline" size={32} color={theme.colors.gray300} />
              <Text fontSize="$sm" color="$gray300" mt="$sm">
                {activeQuery ? t("store.noMatchStores") : t("store.noStores")}
              </Text>
            </Box>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

// ======================================================================
// 单元卡片
// ======================================================================

interface StoreCardProps {
  store: BuyerStore;
  onPress: (storeId: string) => void;
}

const StoreCardImpl: React.FC<StoreCardProps> = ({ store, onPress }) => {
  const { t } = useTranslation();
  const cover = store.images?.[0];
  const location = [store.city, store.country].filter(Boolean).join(" · ");

  return (
    <Pressable onPress={() => onPress(store.id)} style={styles.card}>
      <View style={styles.cardCover}>
        {cover ? (
          <OptimizedImage
            uri={cover}
            size={ImageSize.MEDIUM}
            style={styles.cardImage}
            contentFit="cover"
            lazy
          />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={styles.cardImagePlaceholderText}>
              {(store.name?.charAt(0) || "S").toUpperCase()}
            </Text>
          </View>
        )}
        {store.hasMerchant && (
          <View style={styles.merchantBadge}>
            <Ionicons name="checkmark-circle" size={11} color={theme.colors.white} />
            <Text style={styles.merchantBadgeText}>{t("store.verified")}</Text>
          </View>
        )}
      </View>
      <VStack px="$sm" py="$sm" gap={4}>
        <Text
          fontSize={13}
          fontWeight="$bold"
          color="$black"
          numberOfLines={1}
        >
          {store.name}
        </Text>
        {location && (
          <Text fontSize={11} color="$gray300" numberOfLines={1}>
            {location}
          </Text>
        )}
        {store.brands && store.brands.length > 0 && (
          <Text fontSize={10} color="$gray400" numberOfLines={1}>
            {store.brands.slice(0, 3).join(" / ")}
          </Text>
        )}
      </VStack>
    </Pressable>
  );
};

const StoreCard = React.memo(StoreCardImpl);

// ======================================================================
// Styles
// ======================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  searchBar: {
    backgroundColor: theme.colors.gray50,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.black,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: GRID_HORIZONTAL_PADDING,
    paddingBottom: 32,
    gap: GRID_GAP,
  },
  row: {
    gap: GRID_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.gray100,
    overflow: "hidden",
  },
  cardCover: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    backgroundColor: theme.colors.gray100,
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  cardImagePlaceholderText: {
    color: theme.colors.white,
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 1,
  },
  merchantBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  merchantBadgeText: {
    color: theme.colors.white,
    fontSize: 9,
    fontWeight: "700",
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  footerEnd: {
    paddingVertical: 20,
    alignItems: "center",
  },
});

export default AllBuyerStoresScreen;
