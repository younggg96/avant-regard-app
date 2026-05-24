/**
 * MarketplaceAllBrandsSheet —— 「热门品牌」更多按钮展开的底部弹窗。
 *
 * 设计稿（PRD 二期 p.4）：从 marketplace 顶部「热门品牌」横滑列表的「更多」
 * 按钮点开时弹出本组件，展示平台所有已录入的品牌。
 *
 * 数据源：``GET /api/marketplace/all-brands`` 返回每个品牌的
 *   ``brandId / name / imageUrl / category / country / listingCount``。
 *
 * 交互：
 *   - 顶部搜索框（关键词同时匹配品牌名 / 创始人 / 国家）
 *   - 网格卡片，点击后回调 `onSelectBrand(brand)` —— TradingTabContent
 *     用它来收敛筛选到该品牌的单品列表。
 *   - 列表底部分页加载（pageSize=50）。
 *
 * UI 约定：所有圆角统一 4pt，与 Discover 二期总体规范对齐；自动适配
 * DarkTheme / LightTheme（通过 useThemedStyles 读取 t.colors）。
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Box, HStack, Text, VStack } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import {
  getAllPlatformBrands,
  type PlatformBrand,
} from "../../services/storeProductService";

const PAGE_SIZE = 50;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectBrand: (brand: PlatformBrand) => void;
}

const MarketplaceAllBrandsSheet: React.FC<Props> = ({
  visible,
  onClose,
  onSelectBrand,
}) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  const [brands, setBrands] = useState<PlatformBrand[]>([]);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadingMoreRef = useRef(false);
  const lastQueryRef = useRef("");

  const load = useCallback(
    async (nextPage: number, q: string, reset: boolean) => {
      if (loadingMoreRef.current && !reset) return;
      loadingMoreRef.current = true;
      setLoading(true);
      try {
        const res = await getAllPlatformBrands({
          keyword: q.trim() || undefined,
          page: nextPage,
          pageSize: PAGE_SIZE,
        });
        const items = res.brands || [];
        if (reset || nextPage === 1) {
          setBrands(items);
        } else {
          setBrands((prev) => [...prev, ...items]);
        }
        setHasMore(items.length >= PAGE_SIZE);
        setPage(nextPage);
      } catch (e) {
        if (reset) setBrands([]);
      } finally {
        setLoading(false);
        loadingMoreRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    if (!visible) return;
    lastQueryRef.current = "";
    setKeyword("");
    setPage(1);
    setHasMore(true);
    load(1, "", true);
  }, [visible, load]);

  const handleSearch = () => {
    const q = keyword.trim();
    if (q === lastQueryRef.current) return;
    lastQueryRef.current = q;
    setHasMore(true);
    load(1, q, true);
  };

  const handleEndReached = () => {
    if (!loading && hasMore) {
      load(page + 1, lastQueryRef.current, false);
    }
  };

  const renderItem = ({ item }: { item: PlatformBrand }) => (
    <TouchableOpacity
      style={styles.brandCard}
      onPress={() => onSelectBrand(item)}
      activeOpacity={0.7}
    >
      <View style={styles.brandImageWrap}>
        {item.imageUrl ? (
          <OptimizedImage
            uri={item.imageUrl}
            style={styles.brandImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.brandImagePlaceholder}>
            <Text style={styles.brandImagePlaceholderText}>
              {item.name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.brandName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.brandMeta} numberOfLines={1}>
        {t("trading.marketplace.allBrandsListingCount", {
          count: item.listingCount,
        })}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
            <View style={styles.handleBar} />
            <HStack style={styles.header} alignItems="center">
              <Text style={styles.title}>
                {t("trading.marketplace.allBrandsTitle")}
              </Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </HStack>

            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <Ionicons
                  name="search"
                  size={16}
                  color={theme.colors.gray400}
                />
                <TextInput
                  style={styles.searchInput}
                  value={keyword}
                  onChangeText={setKeyword}
                  onSubmitEditing={handleSearch}
                  placeholder={t(
                    "trading.marketplace.allBrandsSearchPlaceholder"
                  )}
                  placeholderTextColor={theme.colors.gray400}
                  returnKeyType="search"
                />
                {keyword.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => {
                      setKeyword("");
                      lastQueryRef.current = "";
                      load(1, "", true);
                    }}
                    hitSlop={6}
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={theme.colors.gray300}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <FlatList
              data={brands}
              keyExtractor={(b, i) =>
                `brand_${b.brandId ?? "x"}_${b.name}_${i}`
              }
              numColumns={3}
              columnWrapperStyle={styles.columnWrapper}
              contentContainerStyle={styles.listContent}
              renderItem={renderItem}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.4}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                loading ? (
                  <View style={styles.center}>
                    <ActivityIndicator color={theme.colors.accent} />
                  </View>
                ) : (
                  <View style={styles.center}>
                    <Ionicons
                      name="pricetag-outline"
                      size={32}
                      color={theme.colors.gray300}
                    />
                    <Text style={styles.empty}>
                      {t("trading.marketplace.allBrandsEmpty")}
                    </Text>
                  </View>
                )
              }
              ListFooterComponent={
                loading && brands.length > 0 ? (
                  <View style={{ paddingVertical: 16 }}>
                    <ActivityIndicator
                      color={theme.colors.gray300}
                      size="small"
                    />
                  </View>
                ) : null
              }
            />
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      height: "85%",
      backgroundColor: t.colors.card,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      overflow: "hidden",
    },
    safeArea: {
      flex: 1,
      backgroundColor: t.colors.card,
    },
    handleBar: {
      width: 40,
      height: 4,
      backgroundColor: t.colors.gray300,
      borderRadius: 4,
      alignSelf: "center",
      marginTop: 10,
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: t.colors.text,
    },
    searchRow: {
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    searchInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 4,
      backgroundColor: t.colors.surface,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: t.colors.text,
      paddingVertical: 0,
    },
    listContent: {
      paddingHorizontal: 12,
      paddingBottom: 24,
    },
    columnWrapper: {
      gap: 8,
      justifyContent: "flex-start",
      marginBottom: 12,
    },
    brandCard: {
      flex: 1 / 3,
      maxWidth: "33%",
      paddingHorizontal: 4,
    },
    brandImageWrap: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 4,
      overflow: "hidden",
      backgroundColor: t.colors.skeleton,
    },
    brandImage: {
      width: "100%",
      height: "100%",
    },
    brandImagePlaceholder: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surface,
    },
    brandImagePlaceholderText: {
      fontFamily: "PlayfairDisplay-Bold",
      fontSize: 22,
      color: t.colors.text,
    },
    brandName: {
      marginTop: 6,
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.text,
    },
    brandMeta: {
      marginTop: 2,
      fontSize: 10,
      color: t.colors.textSecondary,
    },
    center: {
      paddingTop: 60,
      alignItems: "center",
      gap: 8,
    },
    empty: {
      fontSize: 13,
      color: t.colors.gray400,
    },
  });

export default MarketplaceAllBrandsSheet;
