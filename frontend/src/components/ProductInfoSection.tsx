import React, { useState, useCallback } from "react";
import { StyleSheet, LayoutAnimation, Platform, UIManager } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack, Input, ScrollView } from "./ui";
import { theme, useAppTheme } from "../theme";
import { Brand } from "../services/brandService";
import { useBrandSearch } from "../hooks/useBrandSearch";
import BrandSelectorModal from "./BrandSelectorModal";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CATEGORIES = [
  { value: "外套", labelKey: "productInfo.coat" },
  { value: "裤装", labelKey: "productInfo.pants" },
  { value: "鞋装", labelKey: "productInfo.shoes" },
  { value: "裙子", labelKey: "productInfo.skirt" },
  { value: "内搭", labelKey: "productInfo.innerwear" },
  { value: "配件", labelKey: "productInfo.accessory" },
] as const;
const LETTER_SIZES = ["XS", "S", "M", "L", "XL"] as const;
const NUMBER_SIZES = [
  "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50",
] as const;
const COLORS: { labelKey: string; value: string }[] = [
  { labelKey: "productInfo.black", value: "黑" },
  { labelKey: "productInfo.white", value: "白" },
  { labelKey: "productInfo.blue", value: "蓝" },
  { labelKey: "productInfo.red", value: "红" },
  { labelKey: "productInfo.brown", value: "棕" },
];

export type ItemCategory = (typeof CATEGORIES)[number]["value"];

export interface ProductInfo {
  itemBrand?: string;
  itemBrandId?: number;
  itemCategory?: string;
  itemSizes?: string[];
  itemColors?: string[];
}

interface ProductInfoSectionProps {
  value: ProductInfo;
  onChange: (info: ProductInfo) => void;
}

const ProductInfoSection: React.FC<ProductInfoSectionProps> = ({
  value,
  onChange,
}) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [showBrandPicker, setShowBrandPicker] = useState(false);

  const {
    brands,
    searchQuery: brandQuery,
    isLoading: brandLoading,
    hasMore: brandHasMore,
    setSearchQuery: setBrandQuery,
    search: searchBrands,
    loadMore: loadMoreBrands,
  } = useBrandSearch();

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

  const hasAnyValue =
    !!value.itemBrand ||
    !!value.itemCategory ||
    (value.itemSizes && value.itemSizes.length > 0) ||
    (value.itemColors && value.itemColors.length > 0);

  const handleCategorySelect = (cat: string) => {
    onChange({
      ...value,
      itemCategory: value.itemCategory === cat ? undefined : cat,
    });
  };

  const handleSizeToggle = (size: string) => {
    const current = value.itemSizes || [];
    const next = current.includes(size)
      ? current.filter((s) => s !== size)
      : [...current, size];
    onChange({ ...value, itemSizes: next.length > 0 ? next : undefined });
  };

  const handleColorToggle = (color: string) => {
    const current = value.itemColors || [];
    const next = current.includes(color)
      ? current.filter((c) => c !== color)
      : [...current, color];
    onChange({ ...value, itemColors: next.length > 0 ? next : undefined });
  };

  const handleSelectBrand = (brand: Brand) => {
    onChange({ ...value, itemBrand: brand.name, itemBrandId: brand.id });
    setShowBrandPicker(false);
  };

  const handleClearBrand = () => {
    onChange({ ...value, itemBrand: undefined, itemBrandId: undefined });
  };

  return (
    <Box mx="$md" mb="$md">
      <Pressable onPress={toggleExpanded} py="$sm">
        <HStack alignItems="center" justifyContent="between">
          <HStack alignItems="center" gap="$sm">
            <Ionicons
              name="shirt-outline"
              size={18}
              color={theme.colors.gray400}
            />
            <Text style={{ color: theme.colors.gray500 }} fontSize="$sm" fontWeight="$medium">
              {t("productInfo.title")}
            </Text>
            {!expanded && hasAnyValue && (
              <Box
                w={6}
                h={6}
                rounded="$full"
                style={{ backgroundColor: theme.colors.accent }}
              />
            )}
          </HStack>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={theme.colors.gray400}
          />
        </HStack>
      </Pressable>

      {expanded && (
        <Box mt="$xs">
          {/* 品牌搜索 */}
          <Box mb="$md">
            <Text style={{ color: theme.colors.gray400 }} fontSize="$xs" mb="$xs">
              {t("productInfo.brand")}
            </Text>
            {value.itemBrand ? (
              <HStack
                alignItems="center"
                style={{ backgroundColor: theme.colors.gray100 }}
                rounded="$md"
                px="$md"
                py="$sm"
                justifyContent="between"
              >
                <Text style={{ color: theme.colors.black }} fontSize="$sm">
                  {value.itemBrand}
                </Text>
                <Pressable onPress={handleClearBrand} p="$xs">
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={theme.colors.gray300}
                  />
                </Pressable>
              </HStack>
            ) : (
              <Pressable
                onPress={() => setShowBrandPicker(true)}
                style={{ backgroundColor: theme.colors.gray100 }}
                rounded="$md"
                px="$md"
                py="$sm"
              >
                <HStack alignItems="center" gap="$sm">
                  <Ionicons
                    name="search"
                    size={16}
                    color={theme.colors.gray300}
                  />
                  <Text style={{ color: theme.colors.gray200 }} fontSize="$sm">
                    {t("productInfo.searchBrand")}
                  </Text>
                </HStack>
              </Pressable>
            )}
          </Box>

          {/* 品类 - 单选 */}
          <Box mb="$md">
            <Text style={{ color: theme.colors.gray400 }} fontSize="$xs" mb="$xs">
              {t("productInfo.category")}
            </Text>
            <HStack flexWrap="wrap" gap="$sm">
              {CATEGORIES.map((cat) => {
                const selected = value.itemCategory === cat.value;
                return (
                  <Pressable
                    key={cat.value}
                    onPress={() => handleCategorySelect(cat.value)}
                    style={{ backgroundColor: selected ? theme.colors.accent : theme.colors.gray100 }}
                    rounded="$full"
                    px="$md"
                    py="$xs"
                  >
                    <Text
                      style={{ color: selected ? theme.colors.white : theme.colors.gray500 }}
                      fontSize="$sm"
                    >
                      {t(cat.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </Box>

          {/* 尺码 - 多选 */}
          <Box mb="$md">
            <Text style={{ color: theme.colors.gray400 }} fontSize="$xs" mb="$xs">
              {t("productInfo.size")}
            </Text>
            <HStack flexWrap="wrap" gap="$sm" mb="$xs">
              {LETTER_SIZES.map((size) => {
                const selected = value.itemSizes?.includes(size);
                return (
                  <Pressable
                    key={size}
                    onPress={() => handleSizeToggle(size)}
                    style={{ backgroundColor: selected ? theme.colors.accent : theme.colors.gray100 }}
                    rounded="$full"
                    px="$md"
                    py="$xs"
                    minWidth={42}
                    alignItems="center"
                  >
                    <Text
                      style={{ color: selected ? theme.colors.white : theme.colors.gray500 }}
                      fontSize="$sm"
                    >
                      {size}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              <HStack gap="$sm">
                {NUMBER_SIZES.map((size) => {
                  const selected = value.itemSizes?.includes(size);
                  return (
                    <Pressable
                      key={size}
                      onPress={() => handleSizeToggle(size)}
                      style={{ backgroundColor: selected ? theme.colors.accent : theme.colors.gray100 }}
                      rounded="$full"
                      px="$md"
                      py="$xs"
                      minWidth={42}
                      alignItems="center"
                    >
                      <Text
                        style={{ color: selected ? theme.colors.white : theme.colors.gray500 }}
                        fontSize="$sm"
                      >
                        {size}
                      </Text>
                    </Pressable>
                  );
                })}
              </HStack>
            </ScrollView>
          </Box>

          {/* 颜色 - 多选 */}
          <Box mb="$sm">
            <Text style={{ color: theme.colors.gray400 }} fontSize="$xs" mb="$xs">
              {t("productInfo.color")}
            </Text>
            <HStack flexWrap="wrap" gap="$sm">
              {COLORS.map(({ labelKey, value: colorVal }) => {
                const selected = value.itemColors?.includes(colorVal);
                return (
                  <Pressable
                    key={colorVal}
                    onPress={() => handleColorToggle(colorVal)}
                    style={{ backgroundColor: selected ? theme.colors.accent : theme.colors.gray100 }}
                    rounded="$full"
                    px="$md"
                    py="$xs"
                  >
                    <Text
                      style={{ color: selected ? theme.colors.white : theme.colors.gray500 }}
                      fontSize="$sm"
                    >
                      {t(labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </Box>
        </Box>
      )}

      <BrandSelectorModal
        visible={showBrandPicker}
        brands={brands}
        searchQuery={brandQuery}
        isLoading={brandLoading}
        hasMore={brandHasMore}
        onSearchChange={setBrandQuery}
        onSearch={searchBrands}
        onSelectBrand={handleSelectBrand}
        onClose={() => setShowBrandPicker(false)}
        onLoadMore={loadMoreBrands}
      />
    </Box>
  );
};

export default ProductInfoSection;
