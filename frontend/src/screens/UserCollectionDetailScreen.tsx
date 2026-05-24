/**
 * UserCollectionDetailScreen —— 查看某个收藏夹 / 默认收藏内的商品 (PRD 模块三 3.4)。
 *
 * 区分两种入口:
 *   - collectionId 是数字 → 走 GET /api/users/me/collections/{id}/items
 *   - collectionId 是 null → "默认收藏" (collection_id IS NULL)
 *     走 GET /api/store-merchants/user/favorited-products?onlyDefault=true
 *
 * 长按商品弹出 ActionSheet 提供 "移出该收藏夹" / "移到其他收藏夹"。
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { Box, HStack, Pressable, Text, VStack } from "../components/ui";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import ScreenHeader from "../components/ScreenHeader";
import { ActionSheet } from "../components/ui/ActionSheet";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";
import { Alert } from "../utils/Alert";
import { SaveToCollectionSheet } from "../components/SaveToCollectionSheet";
import {
  removeProductFromCollection,
  type UserCollection,
} from "../services/tradingExtrasService";
import { listCollectionItems } from "../services/tradingExtrasService";
import {
  formatPrice,
  listMyFavoritedStoreProducts,
  unfavoriteStoreProduct,
  type StoreProduct,
} from "../services/storeProductService";

type ParamList = {
  UserCollectionDetail: {
    collectionId: number | null;
    title?: string;
  };
};

const UserCollectionDetailScreen: React.FC = () => {
  const route = useRoute<RouteProp<ParamList, "UserCollectionDetail">>();
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const { collectionId, title: paramTitle } = route.params || {
    collectionId: null,
  };
  const isDefault = collectionId == null;

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [collection, setCollection] = useState<UserCollection | null>(null);
  const [loading, setLoading] = useState(false);

  const [actionTarget, setActionTarget] = useState<StoreProduct | null>(null);
  const [moveSheetVisible, setMoveSheetVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isDefault) {
        const res = await listMyFavoritedStoreProducts(1, 100, {
          onlyDefault: true,
        });
        setProducts(res.products || []);
      } else {
        const res = await listCollectionItems(collectionId as number, 1, 100);
        setProducts(res.products || []);
        setCollection(res.collection);
      }
    } catch (e) {
      console.error("[UserCollectionDetailScreen] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [collectionId, isDefault]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const headerTitle = useMemo(() => {
    if (isDefault) {
      return paramTitle || t("collections.defaultCollection");
    }
    return collection?.name || paramTitle || t("collections.title");
  }, [collection, isDefault, paramTitle, t]);

  const handleProductPress = (p: StoreProduct) => {
    (navigation as any).navigate("StoreProductDetail", { productId: p.id });
  };

  const handleRemoveFromCollection = useCallback(async () => {
    const target = actionTarget;
    if (!target) return;
    setActionTarget(null);
    try {
      if (isDefault) {
        // 默认收藏 = 取消收藏
        await unfavoriteStoreProduct(target.id);
        Alert.show(t("collections.removed"));
      } else {
        await removeProductFromCollection(collectionId as number, target.id);
        Alert.show(t("collections.removedFromFolder"));
      }
      await load();
    } catch (e) {
      Alert.show(
        e instanceof Error ? e.message : t("collections.saveFailed"),
      );
    }
  }, [actionTarget, collectionId, isDefault, load, t]);

  const handleMoveToOther = useCallback(() => {
    setMoveSheetVisible(true);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={headerTitle} showBack />

      <FlatList
        data={products}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
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
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              style={{ marginTop: 48 }}
              color={theme.colors.text}
            />
          ) : (
            <Box style={styles.emptyWrap}>
              <Ionicons
                name="bookmark-outline"
                size={48}
                color={theme.colors.gray200}
              />
              <Text style={styles.emptyText}>
                {t("collections.detailEmpty")}
              </Text>
            </Box>
          )
        }
      />

      {/* 长按操作 */}
      <ActionSheet
        visible={!!actionTarget && !moveSheetVisible}
        onClose={() => setActionTarget(null)}
        title={actionTarget?.title}
        actions={[
          {
            label: t("collections.moveToOther"),
            icon: (
              <Ionicons
                name="folder-open-outline"
                size={20}
                color={theme.colors.text}
              />
            ),
            onPress: handleMoveToOther,
          },
          {
            label: isDefault
              ? t("collections.removeFavorite")
              : t("collections.removeFromFolder"),
            destructive: true,
            icon: (
              <Ionicons
                name="trash-outline"
                size={20}
                color={theme.colors.error}
              />
            ),
            onPress: handleRemoveFromCollection,
          },
        ]}
      />

      {/* "移到其他收藏夹" — 复用 SaveToCollectionSheet */}
      {actionTarget && (
        <SaveToCollectionSheet
          visible={moveSheetVisible}
          productId={actionTarget.id}
          isFavorited={true}
          onClose={() => {
            setMoveSheetVisible(false);
            setActionTarget(null);
          }}
          onSaved={async () => {
            setMoveSheetVisible(false);
            setActionTarget(null);
            await load();
          }}
        />
      )}
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    listContent: { padding: 12, paddingBottom: 32 },
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
      alignItems: "center",
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

export default UserCollectionDetailScreen;
