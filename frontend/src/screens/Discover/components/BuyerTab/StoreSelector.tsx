/**
 * 顶部横向买手店选择条。
 *
 * 视觉对齐设计稿：圆形 logo + 店铺名，选中态用黑色圆环描边。
 * 点击单元 → 触发 `onSelect(storeId)`，所有后续状态更新由 `useBuyerTabData`
 * 接管，这里保持无状态，便于和 React.memo 配合。
 */
import React, { useCallback } from "react";
import { FlatList, ListRenderItem, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, HStack, Pressable, Text } from "../../../../components/ui";
import { OptimizedImage } from "../../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../../utils/imageUtils";
import { theme } from "../../../../theme";
import { BuyerStoreShortcut } from "./types";
import { PLAYFAIR } from "./playfair";

interface StoreSelectorProps {
  stores: BuyerStoreShortcut[];
  selectedStoreId: string | null;
  onSelect: (storeId: string) => void;
  /**
   * 尾部"查看全部 →"入口的点击回调。未传则不渲染该尾部 cell
   * （保持向后兼容，便于其他场景独立复用 StoreSelector）。
   */
  onOpenAll?: () => void;
  isLoading?: boolean;
}

const LOGO_SIZE = 56;

// 尾部 "查看全部" 的哨兵 id，和任何真实 store id 区分开。
const ALL_SHORTCUT_ID = "__ALL__";

/**
 * FlatList 渲染项：真实店铺 shortcut 或尾部"查看全部"入口。
 * 用一个 discriminated union 让 renderItem 可以统一处理两种 item，
 * 避免把尾部 cell 写成 ListFooterComponent（那样它就不会跟着其他店铺
 * 一起横向 snap，体感上像是被截在末尾的额外按钮）。
 */
type SelectorItem =
  | ({ kind: "store" } & BuyerStoreShortcut)
  | { kind: "all"; storeId: typeof ALL_SHORTCUT_ID };

const StoreSelectorImpl: React.FC<StoreSelectorProps> = ({
  stores,
  selectedStoreId,
  onSelect,
  onOpenAll,
  isLoading,
}) => {
  const { t } = useTranslation();
  const items: SelectorItem[] = React.useMemo(() => {
    const base: SelectorItem[] = stores.map((s) => ({ kind: "store" as const, ...s }));
    if (onOpenAll && stores.length > 0) {
      base.push({ kind: "all" as const, storeId: ALL_SHORTCUT_ID });
    }
    return base;
  }, [stores, onOpenAll]);

  const renderItem = useCallback<ListRenderItem<SelectorItem>>(
    ({ item }) => {
      if (item.kind === "all") {
        return (
          <Pressable
            onPress={onOpenAll}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            style={styles.item}
          >
            <Box style={[styles.logoRing, styles.logoRingIdle]}>
              <Box style={[styles.logoInner, styles.allLogoInner]}>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={theme.colors.white}
                />
              </Box>
            </Box>
            <Text numberOfLines={1} style={[styles.name, styles.nameIdle]}>
              {t("discover.buyerViewAll")}
            </Text>
          </Pressable>
        );
      }

      const isSelected = item.storeId === selectedStoreId;
      const firstLetter = (item.name?.charAt(0) || "S").toUpperCase();
      return (
        <Pressable
          onPress={() => onSelect(item.storeId)}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          style={styles.item}
        >
          <Box
            style={[
              styles.logoRing,
              isSelected ? styles.logoRingSelected : styles.logoRingIdle,
            ]}
          >
            <Box style={styles.logoInner}>
              {item.coverImage ? (
                <OptimizedImage
                  uri={item.coverImage}
                  size={ImageSize.THUMBNAIL}
                  style={styles.logoImage}
                  contentFit="cover"
                  lazy
                />
              ) : (
                <Box style={styles.logoPlaceholder}>
                  <Text style={styles.logoPlaceholderText}>{firstLetter}</Text>
                </Box>
              )}
            </Box>
          </Box>
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              isSelected ? styles.nameSelected : styles.nameIdle,
            ]}
          >
            {item.name}
          </Text>
        </Pressable>
      );
    },
    [onSelect, onOpenAll, selectedStoreId]
  );

  if (isLoading && stores.length === 0) {
    return (
      <Box py="$sm">
        <HStack style={styles.skeletonRow}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <Box key={idx} style={styles.skeletonCell}>
              <Box style={styles.skeletonLogo} />
              <Box style={styles.skeletonLabel} />
            </Box>
          ))}
        </HStack>
      </Box>
    );
  }

  if (stores.length === 0) {
    return (
      <Box py="$md" alignItems="center">
        <Ionicons name="storefront-outline" size={24} color={theme.colors.gray300} />
        <Text fontSize="$xs" color="$gray400" mt="$xs" style={styles.emptyHint}>
          {t("discover.buyerNoStoreData")}
        </Text>
      </Box>
    );
  }

  return (
    <FlatList
      data={items}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item.storeId}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
    />
  );
};

export const StoreSelector = React.memo(StoreSelectorImpl);

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  item: {
    alignItems: "center",
    width: 68,
  },
  logoRing: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    padding: 3,
  },
  logoRingIdle: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  logoRingSelected: {
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.black,
  },
  logoInner: {
    flex: 1,
    width: "100%",
    borderRadius: LOGO_SIZE / 2,
    overflow: "hidden",
    backgroundColor: theme.colors.gray100,
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  logoPlaceholder: {
    flex: 1,
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  allLogoInner: {
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  logoPlaceholderText: {
    fontFamily: PLAYFAIR.bold,
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
  name: {
    marginTop: 8,
    fontSize: 11,
    textAlign: "center",
    maxWidth: 68,
  },
  nameIdle: {
    fontFamily: PLAYFAIR.medium,
    color: theme.colors.gray300,
  },
  nameSelected: {
    fontFamily: PLAYFAIR.bold,
    color: theme.colors.black,
  },
  emptyHint: {
    fontFamily: PLAYFAIR.regular,
  },
  skeletonRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
  },
  skeletonCell: {
    alignItems: "center",
    width: 68,
  },
  skeletonLogo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: theme.colors.gray100,
  },
  skeletonLabel: {
    marginTop: 6,
    width: 40,
    height: 10,
    borderRadius: 2,
    backgroundColor: theme.colors.gray100,
  },
});

export default StoreSelector;
