/**
 * BrowsingHistoryScreen —— "浏览记录"。
 *
 * 个人主页头部「我的收藏」下方的入口，展示用户最近浏览过的商品（按浏览时间倒序）。
 * 进入商品详情页时由 recordStoreProductView 自动落库，每个商品只保留一条。
 *
 * 复用 UserCollectionDetailScreen 的两列商品网格视觉；右上角「清空」清除全部记录，
 * 长按单个商品可从记录中移除。颜色 / 圆角全部走 theme tokens，自动兼容 light / dark。
 */
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { Box, Pressable, Text, VStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import ScreenHeader from "../components/ScreenHeader";
import { ActionSheet } from "../components/ui/ActionSheet";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";
import { Alert } from "../utils/Alert";
import {
  clearMyBrowsingHistory,
  listMyBrowsingHistory,
  removeStoreProductFromHistory,
  type StoreProduct,
} from "../services/storeProductService";
import { useFormatPrice } from "../utils/currency";

const PAGE_SIZE = 20;

const BrowsingHistoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [actionTarget, setActionTarget] = useState<StoreProduct | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMyBrowsingHistory(1, PAGE_SIZE);
      setProducts(res.products || []);
      setTotal(res.total || 0);
      setPage(1);
    } catch (e) {
      console.error("[BrowsingHistoryScreen] load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    if (products.length >= total) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await listMyBrowsingHistory(next, PAGE_SIZE);
      setProducts((prev) => [...prev, ...(res.products || [])]);
      setTotal(res.total || 0);
      setPage(next);
    } catch (e) {
      console.warn("[BrowsingHistoryScreen] load more failed", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, page, products.length, total]);

  const handleProductPress = (p: StoreProduct) => {
    (navigation as any).navigate("StoreProductDetail", { productId: p.id });
  };

  const handleRemoveItem = useCallback(async () => {
    const target = actionTarget;
    if (!target) return;
    setActionTarget(null);
    try {
      await removeStoreProductFromHistory(target.id);
      setProducts((prev) => prev.filter((p) => p.id !== target.id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (e) {
      Alert.show(
        e instanceof Error ? e.message : t("browsingHistory.removeFailed"),
      );
    }
  }, [actionTarget, t]);

  const handleClearAll = useCallback(() => {
    if (products.length === 0) return;
    Alert.alert(
      t("browsingHistory.clearConfirmTitle"),
      t("browsingHistory.clearConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("browsingHistory.clearAll"),
          style: "destructive",
          onPress: async () => {
            try {
              await clearMyBrowsingHistory();
              setProducts([]);
              setTotal(0);
              Alert.show(t("browsingHistory.cleared"));
            } catch (e) {
              Alert.show(
                e instanceof Error
                  ? e.message
                  : t("browsingHistory.removeFailed"),
              );
            }
          },
        },
      ],
    );
  }, [products.length, t]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={t("browsingHistory.title")}
        showBack
        rightActions={
          products.length > 0
            ? [
                {
                  icon: "trash-outline",
                  style: "ghost",
                  onPress: handleClearAll,
                },
              ]
            : undefined
        }
      />

      <FlatList
        data={products}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={theme.colors.text}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.productCard}
            onPress={() => handleProductPress(item)}
            onLongPress={() => setActionTarget(item)}
          >
            {item.images?.[0] ? (
              <OptimizedImage uri={item.images[0]} style={styles.productImage} />
            ) : (
              <Box style={[styles.productImage, styles.imagePlaceholder]}>
                <Ionicons
                  name="image-outline"
                  size={32}
                  color={theme.colors.gray300}
                />
              </Box>
            )}
            <VStack style={styles.productInfo}>
              {!!item.brand && (
                <Text style={styles.productBrand} numberOfLines={1}>
                  {item.brand}
                </Text>
              )}
              <Text style={styles.productTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.productPrice}>
                {formatPrice(item.priceCents, item.currency)}
              </Text>
            </VStack>
          </Pressable>
        )}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              style={{ marginVertical: 16 }}
              color={theme.colors.text}
            />
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              style={{ marginTop: 48 }}
              color={theme.colors.text}
            />
          ) : (
            <Box style={styles.emptyWrap}>
              <Ionicons
                name="time-outline"
                size={48}
                color={theme.colors.gray200}
              />
              <Text style={styles.emptyText}>
                {t("browsingHistory.empty")}
              </Text>
            </Box>
          )
        }
      />

      {/* 长按操作 —— 从浏览记录移除 */}
      <ActionSheet
        visible={!!actionTarget}
        onClose={() => setActionTarget(null)}
        title={actionTarget?.title}
        actions={[
          {
            label: t("browsingHistory.removeItem"),
            destructive: true,
            icon: (
              <Ionicons
                name="trash-outline"
                size={20}
                color={theme.colors.error}
              />
            ),
            onPress: handleRemoveItem,
          },
        ]}
      />
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    listContent: { padding: 12, paddingBottom: 32, flexGrow: 1 },
    columnWrapper: { justifyContent: "space-between" },
    productCard: {
      width: "48%",
      backgroundColor: t.colors.cardElevated,
      borderRadius: t.borderRadius.sm,
      padding: 8,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    productImage: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.skeleton,
    },
    imagePlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    productInfo: { marginTop: 8 },
    productBrand: {
      fontSize: 11,
      color: t.colors.gray300,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    productTitle: {
      fontSize: 13,
      color: t.colors.text,
      marginTop: 2,
    },
    productPrice: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
      marginTop: 4,
    },
    emptyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 64,
    },
    emptyText: {
      marginTop: 12,
      fontSize: 13,
      color: t.colors.gray300,
      paddingHorizontal: 32,
      textAlign: "center",
    },
  });

export default BrowsingHistoryScreen;
