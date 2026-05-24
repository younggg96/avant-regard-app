/**
 * SellerListingsScreen —— 卖家管理后台（PRD 模块一 1.6）。
 *
 * 同时服务个人卖家（C2C）和买手店：
 *   - 默认合并展示该用户的所有 listing；
 *   - Tabs：全部 / 在售 / 草稿 / 审核中 / 已售 / 已下架 / 已拒；
 *   - 支持多选 + 批量下架（active）/ 批量删除（draft / rejected）；
 *   - 点击单品进入对应详情或继续编辑草稿。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { Box, HStack, Pressable, Text, VStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import ScreenHeader from "../components/ScreenHeader";
import { CenteredTabBar } from "../components/CenteredTabBar";
import { ActionSheet } from "../components/ui/ActionSheet";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";
import { Alert } from "../utils/Alert";
import {
  batchDeleteListings,
  batchOfflineListings,
  formatPrice,
  getMyListingsSummary,
  listMyListings,
  transitionListing,
  type ListingsStatusSummary,
  type StoreProduct,
  type ProductStatus,
} from "../services/storeProductService";
import { usePublishListingStore } from "../store/publishListingStore";

const CARD_RADIUS = 4;
const PAGE_SIZE = 20;

type TabValue =
  | "all"
  | "active"
  | "draft"
  | "reviewing"
  | "sold"
  | "offline"
  | "rejected";

const EMPTY_SUMMARY: ListingsStatusSummary = {
  active: 0,
  draft: 0,
  reviewing: 0,
  sold: 0,
  offline: 0,
  rejected: 0,
  frozen: 0,
};

function formatSubmittedDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(5, 10);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

const SellerListingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const tabs = useMemo<Array<{ id: TabValue; label: string }>>(
    () => [
      { id: "all", label: t("trading.myListings.tabAll") },
      { id: "active", label: t("trading.myListings.tabActive") },
      { id: "draft", label: t("trading.myListings.tabDraft") },
      { id: "reviewing", label: t("trading.myListings.tabReviewing") },
      { id: "sold", label: t("trading.myListings.tabSold") },
      { id: "offline", label: t("trading.myListings.tabOffline") },
      { id: "rejected", label: t("trading.myListings.tabRejected") },
    ],
    [t],
  );

  const statItems = useMemo(
    () =>
      [
        {
          key: "active" as const,
          label: t("trading.myListings.statActive"),
          icon: "cube-outline" as const,
        },
        {
          key: "reviewing" as const,
          label: t("trading.myListings.statReviewing"),
          icon: "document-text-outline" as const,
        },
        {
          key: "offline" as const,
          label: t("trading.myListings.statOffline"),
          icon: "pause-circle-outline" as const,
        },
        {
          key: "sold" as const,
          label: t("trading.myListings.statSold"),
          icon: "checkmark-done-outline" as const,
        },
      ] as const,
    [t],
  );

  const [tab, setTab] = useState<TabValue>("all");
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [summary, setSummary] = useState<ListingsStatusSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [menuProduct, setMenuProduct] = useState<StoreProduct | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const data = await getMyListingsSummary();
      setSummary({ ...EMPTY_SUMMARY, ...data });
    } catch {
      setSummary(EMPTY_SUMMARY);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listMyListings({
        status: tab === "all" ? undefined : (tab as ProductStatus),
        page: 1,
        pageSize: PAGE_SIZE,
      });
      setProducts(result.products || []);
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : t("common.operationFailed"));
    } finally {
      setLoading(false);
    }
  }, [tab, t]);

  const reloadAll = useCallback(async () => {
    await Promise.all([load(), loadSummary()]);
  }, [load, loadSummary]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      reloadAll();
    }, [reloadAll]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await reloadAll();
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

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBatchOffline = async () => {
    if (selectedIds.size === 0) return;
    try {
      const r = await batchOfflineListings(Array.from(selectedIds));
      Alert.show(t("trading.myListings.offlineSuccess", { count: r.updated }));
      exitSelectionMode();
      await reloadAll();
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : t("common.operationFailed"));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const r = await batchDeleteListings(Array.from(selectedIds));
      Alert.show(t("trading.myListings.deleteSuccess", { count: r.deleted }));
      exitSelectionMode();
      await reloadAll();
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : t("common.operationFailed"));
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
      usePublishListingStore.getState().hydrateFromListing(item);
      // @ts-expect-error - navigation types
      navigation.navigate("PublishListingStep1");
      return;
    }
    // @ts-expect-error - navigation types
    navigation.navigate("StoreProductDetail", { productId: item.id });
  };

  const handleSingleOffline = async (productId: number) => {
    try {
      await transitionListing(productId, "offline");
      Alert.show(t("trading.myListings.singleOfflineSuccess"));
      setMenuProduct(null);
      await reloadAll();
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : t("common.operationFailed"));
    }
  };

  const handleSingleDelete = async (productId: number) => {
    try {
      const r = await batchDeleteListings([productId]);
      if (r.deleted > 0) {
        Alert.show(t("trading.myListings.singleDeleteSuccess"));
      }
      setMenuProduct(null);
      await reloadAll();
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : t("common.operationFailed"));
    }
  };

  const canBatchOffline = tab === "active" || tab === "all";
  const canBatchDelete = tab === "draft" || tab === "rejected" || tab === "all";
  const showManageAction = canBatchOffline || canBatchDelete;

  const menuActions = useMemo(() => {
    if (!menuProduct) return [];
    const actions: Array<{ label: string; onPress: () => void; destructive?: boolean }> = [];
    if (menuProduct.status === "draft" || menuProduct.status === "rejected") {
      actions.push({
        label: t("trading.myListings.actionEdit"),
        onPress: () => {
          setMenuProduct(null);
          usePublishListingStore.getState().hydrateFromListing(menuProduct);
          // @ts-expect-error - navigation types
          navigation.navigate("PublishListingStep1");
        },
      });
      actions.push({
        label: t("trading.myListings.actionDelete"),
        destructive: true,
        onPress: () => handleSingleDelete(menuProduct.id),
      });
    } else if (menuProduct.status === "active") {
      actions.push({
        label: t("trading.myListings.actionDelist"),
        onPress: () => handleSingleOffline(menuProduct.id),
      });
      actions.push({
        label: t("trading.myListings.actionView"),
        onPress: () => {
          setMenuProduct(null);
          // @ts-expect-error - navigation types
          navigation.navigate("StoreProductDetail", { productId: menuProduct.id });
        },
      });
    } else {
      actions.push({
        label: t("trading.myListings.actionView"),
        onPress: () => {
          setMenuProduct(null);
          // @ts-expect-error - navigation types
          navigation.navigate("StoreProductDetail", { productId: menuProduct.id });
        },
      });
    }
    return actions;
  }, [menuProduct, navigation, t]);

  const renderHeaderRight = () => {
    if (!showManageAction) return undefined;
    return (
      <Pressable
        w={40}
        h={40}
        justifyContent="center"
        alignItems="end"
        onPress={() => {
          if (selectionMode) exitSelectionMode();
          else setSelectionMode(true);
        }}
        accessibilityLabel={
          selectionMode ? t("common.cancel") : t("trading.myListings.manageA11y")
        }
      >
        <Ionicons
          name={selectionMode ? "close" : "checkbox-outline"}
          size={22}
          color={theme.colors.text}
        />
      </Pressable>
    );
  };

  const renderListHeader = () => (
    <VStack style={styles.listHeader} space="md">
      <Text style={styles.sectionTitle}>{t("trading.myListings.sectionTitle")}</Text>

      <Box style={styles.statsCard}>
        <HStack style={styles.statsRow}>
          {statItems.map((item) => (
            <Pressable
              key={item.key}
              style={styles.statCell}
              onPress={() => {
                setTab(item.key);
                setSelectedIds(new Set());
              }}
            >
              <Ionicons name={item.icon} size={18} color={theme.colors.text} />
              <Text style={styles.statCount}>{summary[item.key] ?? 0}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </HStack>
      </Box>

      <Pressable style={styles.publishBtn} onPress={handleNewListing}>
        <Ionicons name="add" size={20} color={theme.colors.textInverted} />
        <Text style={styles.publishBtnText}>
          {t("trading.myListings.publishItem")}
        </Text>
      </Pressable>
      <Text style={styles.publishHint}>{t("trading.myListings.publishHint")}</Text>
    </VStack>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("trading.myListings.title")}
        showBack
        borderless
        rightComponent={renderHeaderRight()}
      />

      <CenteredTabBar
        tabs={tabs}
        activeTab={tab}
        onTabChange={(next) => {
          setTab(next);
          setSelectedIds(new Set());
        }}
      />

      {loading && products.length === 0 ? (
        <Box style={styles.center}>
          <ActivityIndicator color={theme.colors.text} />
        </Box>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => String(p.id)}
          ListHeaderComponent={renderListHeader}
          renderItem={({ item }) => (
            <ListingRow
              item={item}
              selected={selectedIds.has(item.id)}
              selectionMode={selectionMode}
              onPress={() => handleItemPress(item)}
              onLongPress={() => {
                setSelectionMode(true);
                toggleSelected(item.id);
              }}
              onMenuPress={() => setMenuProduct(item)}
            />
          )}
          ListEmptyComponent={
            <Box style={styles.center}>
              <Text style={styles.emptyText}>{t("trading.myListings.empty")}</Text>
            </Box>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={
            products.length === 0 ? styles.listEmptyContent : styles.listContent
          }
        />
      )}

      {selectionMode && (canBatchOffline || canBatchDelete) && (
        <Box style={styles.batchBar}>
          <Text style={styles.batchInfo}>
            {t("trading.myListings.selectedCount", { count: selectedIds.size })}
          </Text>
          <HStack space="sm">
            {canBatchOffline && (
              <TouchableOpacity
                style={styles.batchBtn}
                onPress={handleBatchOffline}
                disabled={selectedIds.size === 0}
              >
                <Text style={styles.batchBtnText}>
                  {t("trading.myListings.offline")}
                </Text>
              </TouchableOpacity>
            )}
            {canBatchDelete && (
              <TouchableOpacity
                style={[styles.batchBtn, styles.batchBtnDanger]}
                onPress={handleBatchDelete}
                disabled={selectedIds.size === 0}
              >
                <Text style={[styles.batchBtnText, styles.batchBtnDangerText]}>
                  {t("trading.myListings.delete")}
                </Text>
              </TouchableOpacity>
            )}
          </HStack>
        </Box>
      )}

      {!selectionMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleNewListing}
          activeOpacity={0.85}
          accessibilityLabel={t("trading.myListings.publishItem")}
        >
          <Ionicons name="add" size={28} color={theme.colors.textInverted} />
        </TouchableOpacity>
      )}

      <ActionSheet
        visible={!!menuProduct}
        onClose={() => setMenuProduct(null)}
        actions={menuActions}
      />
    </SafeAreaView>
  );
};

function getStatusLabel(
  status: ProductStatus,
  t: (key: string) => string,
): string {
  if (status === "active") return t("trading.myListings.statActive");
  if (status === "draft") return t("trading.myListings.tabDraft");
  if (status === "reviewing") return t("trading.myListings.tabReviewing");
  if (status === "sold") return t("trading.myListings.statSold");
  if (status === "offline") return t("trading.myListings.statOffline");
  if (status === "rejected") return t("trading.myListings.tabRejected");
  if (status === "frozen") return t("trading.myListings.statusFrozen");
  return String(status);
}

interface ListingRowProps {
  item: StoreProduct;
  selected: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onMenuPress: () => void;
}

const ListingRow: React.FC<ListingRowProps> = ({
  item,
  selected,
  selectionMode,
  onPress,
  onLongPress,
  onMenuPress,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const badgeStyle = useStatusBadgeStyle(item.status as ProductStatus);

  const footerText =
    item.status === "active" && (item.viewCount > 0 || item.favoriteCount > 0)
      ? `${t("trading.myListings.views")} ${item.viewCount} · ${t("trading.myListings.favorites")} ${item.favoriteCount}`
      : t("trading.myListings.submittedAt", {
          date: formatSubmittedDate(item.publishedAt || item.createdAt),
        });

  return (
    <Pressable
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {selectionMode && (
        <Box style={styles.checkbox}>
          <Ionicons
            name={selected ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={selected ? theme.colors.text : theme.colors.gray300}
          />
        </Box>
      )}

      <Box style={styles.thumbWrap}>
        {item.images?.[0] ? (
          <OptimizedImage uri={item.images[0]} style={styles.thumb} />
        ) : (
          <Box style={[styles.thumb, styles.thumbEmpty]} />
        )}
        <View style={[styles.thumbBadge, { backgroundColor: badgeStyle.bg }]}>
          <Text style={[styles.thumbBadgeText, { color: badgeStyle.text }]}>
            {getStatusLabel(item.status as ProductStatus, t)}
          </Text>
        </View>
      </Box>

      <VStack style={styles.meta} space="xs">
        <HStack style={styles.metaTop} alignItems="start">
          <VStack style={styles.metaBody} space="xs">
            <Text style={styles.brand} numberOfLines={1}>
              {item.brand || item.title}
            </Text>
            {(item.styleName || item.title) && item.brand ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {item.styleName || item.title}
              </Text>
            ) : null}
            <HStack space="md">
              {item.size ? (
                <Text style={styles.attrText}>
                  {t("trading.myListings.sizeLabel")} {item.size}
                </Text>
              ) : null}
              {item.color ? (
                <Text style={styles.attrText}>
                  {t("trading.myListings.colorLabel")} {item.color}
                </Text>
              ) : null}
            </HStack>
            <Text style={styles.price}>
              {formatPrice(item.priceCents, item.currency)}
            </Text>
          </VStack>
          {!selectionMode ? (
            <Pressable style={styles.menuBtn} onPress={onMenuPress} hitSlop={8}>
              <Ionicons
                name="ellipsis-horizontal"
                size={18}
                color={theme.colors.gray300}
              />
            </Pressable>
          ) : null}
        </HStack>
        <Text style={styles.footerMeta}>{footerText}</Text>
      </VStack>
    </Pressable>
  );
};

function useStatusBadgeStyle(status: ProductStatus) {
  const theme = useAppTheme();
  switch (status) {
    case "active":
      return { bg: theme.colors.success, text: theme.colors.textInverted };
    case "reviewing":
      return { bg: theme.colors.plusGold, text: theme.colors.textInverted };
    case "sold":
      return { bg: theme.colors.gray300, text: theme.colors.textInverted };
    case "offline":
      return { bg: theme.colors.gray200, text: theme.colors.text };
    case "rejected":
      return { bg: theme.colors.error, text: theme.colors.textInverted };
    case "frozen":
      return { bg: theme.colors.gray400, text: theme.colors.textInverted };
    default:
      return { bg: theme.colors.surface, text: theme.colors.textSecondary };
  }
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    listHeader: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: t.colors.text,
    },
    statsCard: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: CARD_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      paddingVertical: 14,
      paddingHorizontal: 8,
    },
    statsRow: {
      justifyContent: "space-between",
    },
    statCell: {
      flex: 1,
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 4,
    },
    statCount: {
      fontSize: 18,
      fontWeight: "700",
      color: t.colors.text,
    },
    statLabel: {
      fontSize: 11,
      color: t.colors.textSecondary,
      textAlign: "center",
    },
    publishBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: t.colors.text,
      borderRadius: CARD_RADIUS,
      paddingVertical: 14,
    },
    publishBtnText: {
      fontSize: 15,
      fontWeight: "600",
      color: t.colors.textInverted,
    },
    publishHint: {
      fontSize: 12,
      color: t.colors.textSecondary,
      textAlign: "center",
      marginTop: -4,
    },
    row: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      alignItems: "flex-start",
    },
    rowSelected: { backgroundColor: `${t.colors.text}11` },
    checkbox: { width: 28, alignItems: "center", marginTop: 28 },
    thumbWrap: {
      width: 88,
      height: 88,
      backgroundColor: t.colors.surface,
      borderRadius: CARD_RADIUS,
      overflow: "hidden",
      marginRight: 12,
      position: "relative",
    },
    thumb: { width: "100%", height: "100%" },
    thumbEmpty: { backgroundColor: t.colors.skeleton },
    thumbBadge: {
      position: "absolute",
      left: 0,
      bottom: 0,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderTopRightRadius: CARD_RADIUS,
    },
    thumbBadgeText: { fontSize: 10, fontWeight: "600" },
    meta: { flex: 1 },
    metaTop: { justifyContent: "space-between" },
    metaBody: { flex: 1, paddingRight: 8 },
    brand: { fontSize: 15, fontWeight: "700", color: t.colors.text },
    subtitle: { fontSize: 13, color: t.colors.textSecondary },
    attrText: { fontSize: 12, color: t.colors.textSecondary },
    price: { fontSize: 16, fontWeight: "700", color: t.colors.text },
    menuBtn: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    footerMeta: {
      fontSize: 11,
      color: t.colors.textSecondary,
      alignSelf: "flex-end",
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    emptyText: { color: t.colors.textSecondary, fontSize: 14 },
    listContent: { paddingBottom: 96 },
    listEmptyContent: { flexGrow: 1, paddingBottom: 96 },
    batchBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    batchInfo: { color: t.colors.text, fontSize: 14 },
    batchBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: CARD_RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.cardElevated,
    },
    batchBtnDanger: {
      backgroundColor: t.colors.error,
      borderColor: t.colors.error,
    },
    batchBtnText: { color: t.colors.text, fontSize: 14, fontWeight: "500" },
    batchBtnDangerText: { color: t.colors.textInverted },
    fab: {
      position: "absolute",
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: CARD_RADIUS,
      backgroundColor: t.colors.text,
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
