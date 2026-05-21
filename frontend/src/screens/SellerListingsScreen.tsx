/**
 * SellerListingsScreen —— 卖家管理后台（PRD 模块一 1.6）。
 *
 * 同时服务个人卖家（C2C）和买手店：
 *   - 默认合并展示该用户的所有 listing；
 *   - Tabs：在售 / 草稿 / 审核中 / 已售 / 已下架 / 已拒；
 *   - 支持多选 + 批量下架（active 才生效）/ 批量删除（draft / rejected）；
 *   - 点击单品进入对应详情或继续编辑草稿。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { Box, HStack, Pressable, Text, VStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import ScreenHeader from "../components/ScreenHeader";
import { useThemedStyles, type AppTheme } from "../theme";
import { Alert } from "../utils/Alert";
import {
  batchDeleteListings,
  batchOfflineListings,
  formatPrice,
  listMyListings,
  type StoreProduct,
  type ProductStatus,
} from "../services/storeProductService";
import { usePublishListingStore } from "../store/publishListingStore";

type TabValue = "active" | "draft" | "reviewing" | "sold" | "offline" | "rejected";

const TABS: Array<{ value: TabValue; label: string }> = [
  { value: "active", label: "在售" },
  { value: "draft", label: "草稿" },
  { value: "reviewing", label: "审核中" },
  { value: "sold", label: "已售" },
  { value: "offline", label: "已下架" },
  { value: "rejected", label: "已拒" },
];

const PAGE_SIZE = 20;

const SellerListingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);

  const [tab, setTab] = useState<TabValue>("active");
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listMyListings({
        status: tab as ProductStatus,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      setProducts(result.products || []);
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchOffline = async () => {
    if (selectedIds.size === 0) return;
    try {
      const r = await batchOfflineListings(Array.from(selectedIds));
      Alert.show(`已下架 ${r.updated} 件`);
      setSelectedIds(new Set());
      setSelectionMode(false);
      await load();
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : "操作失败");
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const r = await batchDeleteListings(Array.from(selectedIds));
      Alert.show(`已删除 ${r.deleted} 件`);
      setSelectedIds(new Set());
      setSelectionMode(false);
      await load();
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : "操作失败");
    }
  };

  const handleNewListing = () => {
    usePublishListingStore.getState().reset({ sellerKind: "individual" });
    // @ts-expect-error - navigation types
    navigation.navigate("PublishListingStep1");
  };

  const handleItemPress = (item: StoreProduct) => {
    if (selectionMode) {
      toggleSelected(item.id);
      return;
    }
    if (item.status === "draft" || item.status === "rejected") {
      // 继续编辑：把数据 hydrate 进 store 后跳 Step 1
      usePublishListingStore.getState().hydrateFromListing(item);
      // @ts-expect-error - navigation types
      navigation.navigate("PublishListingStep1");
      return;
    }
    // 已上架/已售/已下架：走标准商品详情
    // @ts-expect-error - navigation types
    navigation.navigate("StoreProductDetail", { productId: item.id });
  };

  const canBatchOffline = tab === "active";
  const canBatchDelete = tab === "draft" || tab === "rejected";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="我的在售"
        showBack
        rightActions={
          selectionMode
            ? [
                {
                  text: "取消",
                  onPress: () => {
                    setSelectionMode(false);
                    setSelectedIds(new Set());
                  },
                },
              ]
            : [
                ...(canBatchOffline || canBatchDelete
                  ? [
                      {
                        text: "管理",
                        onPress: () => setSelectionMode(true),
                      },
                    ]
                  : []),
              ]
        }
      />

      {/* Tabs */}
      <Box style={styles.tabsRow}>
        <FlatList
          data={TABS}
          keyExtractor={(t) => t.value}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setTab(item.value);
                setSelectedIds(new Set());
              }}
              style={[
                styles.tab,
                tab === item.value && styles.tabActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === item.value && styles.tabTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
          contentContainerStyle={styles.tabsContent}
        />
      </Box>

      {loading ? (
        <Box style={styles.center}>
          <ActivityIndicator />
        </Box>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => {
            const selected = selectedIds.has(item.id);
            return (
              <Pressable
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => handleItemPress(item)}
                onLongPress={() => {
                  setSelectionMode(true);
                  toggleSelected(item.id);
                }}
              >
                {selectionMode && (
                  <Box style={styles.checkbox}>
                    <Ionicons
                      name={
                        selected
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={22}
                      color={selected ? "#fff" : "#888"}
                    />
                  </Box>
                )}
                <Box style={styles.thumbWrap}>
                  {item.images?.[0] ? (
                    <OptimizedImage uri={item.images[0]} style={styles.thumb} />
                  ) : (
                    <Box style={[styles.thumb, styles.thumbEmpty]} />
                  )}
                </Box>
                <VStack style={styles.meta} space="xs">
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.brandLine} numberOfLines={1}>
                    {[item.brand, item.size, item.color]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  <Text style={styles.price}>
                    {formatPrice(item.priceCents, item.currency)}
                  </Text>
                  <StatusBadge status={item.status as ProductStatus} />
                </VStack>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Box style={styles.center}>
              <Text style={styles.emptyText}>暂无相关单品</Text>
            </Box>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={products.length === 0 ? { flex: 1 } : { paddingBottom: 90 }}
        />
      )}

      {/* 批量操作栏 */}
      {selectionMode && (canBatchOffline || canBatchDelete) && (
        <Box style={styles.batchBar}>
          <Text style={styles.batchInfo}>已选 {selectedIds.size}</Text>
          <HStack space="sm">
            {canBatchOffline && (
              <TouchableOpacity
                style={styles.batchBtn}
                onPress={handleBatchOffline}
              >
                <Text style={styles.batchBtnText}>下架</Text>
              </TouchableOpacity>
            )}
            {canBatchDelete && (
              <TouchableOpacity
                style={[styles.batchBtn, styles.batchBtnDanger]}
                onPress={handleBatchDelete}
              >
                <Text style={[styles.batchBtnText, { color: "#fff" }]}>
                  删除
                </Text>
              </TouchableOpacity>
            )}
          </HStack>
        </Box>
      )}

      {/* FAB 发布新单品 */}
      {!selectionMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleNewListing}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const StatusBadge: React.FC<{ status: ProductStatus }> = ({ status }) => {
  const styles = useThemedStyles(makeStyles);
  const label =
    status === "active"
      ? "在售"
      : status === "draft"
      ? "草稿"
      : status === "reviewing"
      ? "审核中"
      : status === "sold"
      ? "已售"
      : status === "offline"
      ? "已下架"
      : status === "rejected"
      ? "已拒"
      : status === "frozen"
      ? "预订中"
      : String(status);
  return (
    <Box style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </Box>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    tabsRow: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    tabsContent: { paddingHorizontal: 12, paddingVertical: 8 },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginRight: 8,
      borderRadius: 16,
      backgroundColor: t.colors.surface,
    },
    tabActive: { backgroundColor: t.colors.accent },
    tabText: { fontSize: 13, color: t.colors.text },
    tabTextActive: { color: t.colors.textInverted, fontWeight: "600" },
    row: {
      flexDirection: "row",
      padding: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      alignItems: "center",
    },
    rowSelected: { backgroundColor: `${t.colors.accent}11` },
    checkbox: { width: 28, alignItems: "center" },
    thumbWrap: {
      width: 64,
      height: 80,
      backgroundColor: t.colors.surface,
      borderRadius: 6,
      overflow: "hidden",
      marginRight: 12,
    },
    thumb: { width: "100%", height: "100%" },
    thumbEmpty: { backgroundColor: t.colors.border },
    meta: { flex: 1 },
    title: { fontSize: 14, color: t.colors.text, fontWeight: "600" },
    brandLine: { fontSize: 12, color: t.colors.textSecondary },
    price: { fontSize: 14, color: t.colors.text, fontWeight: "600" },
    badge: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: t.colors.surface,
    },
    badgeText: { fontSize: 11, color: t.colors.textSecondary },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    emptyText: { color: t.colors.textSecondary },
    batchBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    batchInfo: { color: t.colors.text, fontSize: 14 },
    batchBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    batchBtnDanger: {
      backgroundColor: "#e44",
      borderColor: "#e44",
    },
    batchBtnText: { color: t.colors.text, fontSize: 14 },
    fab: {
      position: "absolute",
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.colors.accent,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 6,
    },
  });

export default SellerListingsScreen;
