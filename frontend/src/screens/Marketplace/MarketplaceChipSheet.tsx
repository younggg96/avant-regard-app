/**
 * MarketplaceChipSheet —— 顶部筛选 chip 的「单项快捷弹窗」。
 *
 * 与 `MarketplaceFilterSheet`（全屏聚合筛选器）的区别：
 *   - 这是一个底部弹起的紧凑 sheet；只渲染**一个**字段的选择 UI。
 *   - 适用于 chip 行的 4 个子项（分类 / 尺码 / 价格 / 成色），用户希望
 *     "点哪个 chip 就只编辑这一项"，避免每次都打开全屏聚合 sheet。
 *
 * 多选语义：分类/尺码/成色都是多选 chip（与全屏 Sheet 对齐）。价格仍是
 * 区间双输入。"应用" 提交增量字段，由调用方 merge 进主 filter。
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
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, HStack, Text } from "../../components/ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import type {
  MarketplaceFilter,
  ProductCondition,
} from "../../services/storeProductService";
import { brandService, type Brand } from "../../services/brandService";

export type ChipFilterKey =
  | "brand"
  | "category"
  | "size"
  | "price"
  | "condition";

const CATEGORY_KINDS: Array<{ value: string; labelKey: string }> = [
  { value: "外套", labelKey: "trading.filter.categoryOuter" },
  { value: "上衣", labelKey: "trading.filter.categoryTop" },
  { value: "裤装", labelKey: "trading.filter.categoryPants" },
  { value: "鞋履", labelKey: "trading.filter.categoryShoes" },
  { value: "包袋", labelKey: "trading.filter.categoryBag" },
  { value: "配饰", labelKey: "trading.filter.categoryAccessory" },
];

const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL"];

const CONDITION_OPTIONS: Array<{ value: ProductCondition; labelKey: string }> = [
  { value: "BNWT", labelKey: "trading.filter.conditionBnwt" },
  { value: "NEW_95", labelKey: "trading.filter.conditionNear" },
  { value: "USED_8", labelKey: "trading.filter.conditionLight" },
  { value: "FLAW", labelKey: "trading.filter.conditionUsed" },
];

const TITLE_KEY: Record<ChipFilterKey, string> = {
  brand: "trading.filter.brand",
  category: "trading.filter.category",
  size: "trading.filter.size",
  price: "trading.filter.price",
  condition: "trading.filter.condition",
};

const BRAND_PAGE_SIZE = 30;

interface Props {
  visible: boolean;
  chipKey: ChipFilterKey | null;
  initial: MarketplaceFilter;
  onClose: () => void;
  /** 传递增量字段：调用方决定如何合并到主 filter。 */
  onApply: (patch: Partial<MarketplaceFilter>) => void;
}

const toggle = <T extends string>(arr: T[], v: T): T[] =>
  arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

const MarketplaceChipSheet: React.FC<Props> = ({
  visible,
  chipKey,
  initial,
  onClose,
  onApply,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  // 多选草稿
  const [brands, setBrands] = useState<string[]>([]);
  const [categoryKinds, setCategoryKinds] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [conditions, setConditions] = useState<ProductCondition[]>([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  // 品牌搜索 / 分页加载
  const [brandQuery, setBrandQuery] = useState("");
  const [brandList, setBrandList] = useState<Brand[]>([]);
  const [brandPage, setBrandPage] = useState(1);
  const [brandHasMore, setBrandHasMore] = useState(true);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandLoadingMore, setBrandLoadingMore] = useState(false);
  const brandSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandQueryRef = useRef("");

  // 拉取品牌（首页或下一页）。``reset=true`` 时回到第一页（搜索/打开时）
  const loadBrands = useCallback(
    async (reset: boolean) => {
      const nextPage = reset ? 1 : brandPage + 1;
      if (!reset && (!brandHasMore || brandLoadingMore)) return;
      if (reset) setBrandLoading(true);
      else setBrandLoadingMore(true);
      try {
        const res = await brandService.getBrands({
          keyword: brandQueryRef.current.trim() || undefined,
          page: nextPage,
          pageSize: BRAND_PAGE_SIZE,
        });
        const items = res.brands ?? [];
        setBrandList((prev) => (reset ? items : [...prev, ...items]));
        setBrandPage(nextPage);
        setBrandHasMore(
          items.length >= BRAND_PAGE_SIZE &&
            (reset ? items.length : brandList.length + items.length) <
              (res.total ?? Number.POSITIVE_INFINITY),
        );
      } catch {
        if (reset) setBrandList([]);
      } finally {
        setBrandLoading(false);
        setBrandLoadingMore(false);
      }
    },
    [brandPage, brandHasMore, brandLoadingMore, brandList.length],
  );

  useEffect(() => {
    if (!visible) return;
    setBrands(initial.brands ?? (initial.brand ? [initial.brand] : []));
    setCategoryKinds(initial.categoryKinds ?? []);
    setSizes(initial.sizes ?? (initial.size ? [initial.size] : []));
    setConditions(
      (initial.conditions ?? (initial.condition ? [initial.condition] : [])) as ProductCondition[],
    );
    setPriceMin(
      initial.priceMinCents != null
        ? String(Math.round(initial.priceMinCents / 100))
        : "",
    );
    setPriceMax(
      initial.priceMaxCents != null
        ? String(Math.round(initial.priceMaxCents / 100))
        : "",
    );
    // 进入 brand 模式时拉首页
    if (chipKey === "brand") {
      brandQueryRef.current = "";
      setBrandQuery("");
      setBrandHasMore(true);
      loadBrands(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, chipKey, initial]);

  const onBrandQueryChange = (text: string) => {
    setBrandQuery(text);
    brandQueryRef.current = text;
    if (brandSearchTimer.current) clearTimeout(brandSearchTimer.current);
    brandSearchTimer.current = setTimeout(() => {
      setBrandHasMore(true);
      loadBrands(true);
    }, 300);
  };

  if (!chipKey) return null;

  const handleApply = () => {
    switch (chipKey) {
      case "brand":
        onApply({
          brand: undefined,
          brands: brands.length ? brands : undefined,
        });
        break;
      case "category":
        onApply({ categoryKinds: categoryKinds.length ? categoryKinds : undefined });
        break;
      case "size":
        onApply({
          size: undefined,
          sizes: sizes.length ? sizes : undefined,
        });
        break;
      case "condition":
        onApply({
          condition: undefined,
          conditions: conditions.length ? conditions : undefined,
        });
        break;
      case "price": {
        const min = priceMin ? Math.round(Number(priceMin) * 100) : undefined;
        const max = priceMax ? Math.round(Number(priceMax) * 100) : undefined;
        onApply({
          priceMinCents: Number.isFinite(min) ? min : undefined,
          priceMaxCents: Number.isFinite(max) ? max : undefined,
        });
        break;
      }
    }
    onClose();
  };

  const handleReset = () => {
    switch (chipKey) {
      case "brand":
        setBrands([]);
        onApply({ brand: undefined, brands: undefined });
        break;
      case "category":
        setCategoryKinds([]);
        onApply({ categoryKinds: undefined });
        break;
      case "size":
        setSizes([]);
        onApply({ size: undefined, sizes: undefined });
        break;
      case "condition":
        setConditions([]);
        onApply({ condition: undefined, conditions: undefined });
        break;
      case "price":
        setPriceMin("");
        setPriceMax("");
        onApply({ priceMinCents: undefined, priceMaxCents: undefined });
        break;
    }
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            chipKey === "brand" && styles.sheetTall,
          ]}
          onPress={() => {}}
        >
          <Box style={styles.handle} />
          <HStack style={styles.header} alignItems="center">
            <Text style={styles.title}>{t(TITLE_KEY[chipKey])}</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={handleReset} hitSlop={8}>
              <Text style={styles.reset}>{t("trading.filter.reset")}</Text>
            </TouchableOpacity>
          </HStack>

          <Box
            style={[
              styles.body,
              chipKey === "brand" && styles.bodyBrand,
            ]}
          >
            {chipKey === "brand" ? (
              <View style={{ flex: 1 }}>
                {/* 已选品牌 chips */}
                {brands.length > 0 ? (
                  <HStack style={styles.selectedRow}>
                    {brands.map((b) => (
                      <Pressable
                        key={`sel_${b}`}
                        style={styles.selectedChip}
                        onPress={() =>
                          setBrands((prev) => prev.filter((x) => x !== b))
                        }
                      >
                        <Text style={styles.selectedChipText}>{b}</Text>
                        <Ionicons
                          name="close"
                          size={12}
                          color={theme.colors.textInverted}
                        />
                      </Pressable>
                    ))}
                  </HStack>
                ) : null}

                {/* 搜索框 */}
                <View style={styles.searchInputWrap}>
                  <Ionicons
                    name="search"
                    size={16}
                    color={theme.colors.gray300}
                  />
                  <TextInput
                    style={styles.searchInput}
                    value={brandQuery}
                    onChangeText={onBrandQueryChange}
                    placeholder={t("trading.filter.brandPlaceholder")}
                    placeholderTextColor={theme.colors.placeholder}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {brandQuery ? (
                    <TouchableOpacity
                      onPress={() => onBrandQueryChange("")}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={theme.colors.gray300}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* 品牌列表 —— 滚动到底加载更多 */}
                <FlatList
                  style={styles.brandFlat}
                  data={brandList}
                  keyExtractor={(b) => `b_${b.id}_${b.name}`}
                  keyboardShouldPersistTaps="handled"
                  onEndReachedThreshold={0.4}
                  onEndReached={() => {
                    if (brandHasMore && !brandLoading && !brandLoadingMore) {
                      loadBrands(false);
                    }
                  }}
                  renderItem={({ item }) => {
                    const active = brands.includes(item.name);
                    return (
                      <Pressable
                        style={[
                          styles.brandRow,
                          active && styles.brandRowActive,
                        ]}
                        onPress={() =>
                          setBrands((prev) =>
                            prev.includes(item.name)
                              ? prev.filter((x) => x !== item.name)
                              : [...prev, item.name],
                          )
                        }
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.brandRowName,
                              active && styles.brandRowNameActive,
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          {item.country || item.foundedYear ? (
                            <Text
                              style={styles.brandRowMeta}
                              numberOfLines={1}
                            >
                              {[item.country, item.foundedYear]
                                .filter(Boolean)
                                .join(" · ")}
                            </Text>
                          ) : null}
                        </View>
                        {active ? (
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color={theme.colors.accent}
                          />
                        ) : null}
                      </Pressable>
                    );
                  }}
                  ListEmptyComponent={
                    brandLoading ? (
                      <View style={styles.brandStatus}>
                        <ActivityIndicator
                          size="small"
                          color={theme.colors.gray300}
                        />
                      </View>
                    ) : (
                      <View style={styles.brandStatus}>
                        <Text style={styles.brandEmpty}>
                          {t("trading.filter.brandEmpty")}
                        </Text>
                      </View>
                    )
                  }
                  ListFooterComponent={
                    brandLoadingMore ? (
                      <View style={styles.brandStatus}>
                        <ActivityIndicator
                          size="small"
                          color={theme.colors.gray300}
                        />
                      </View>
                    ) : !brandHasMore && brandList.length > 0 ? (
                      <View style={styles.brandStatus}>
                        <Text style={styles.brandEmpty}>
                          {t("trading.filter.brandAllLoaded")}
                        </Text>
                      </View>
                    ) : null
                  }
                />
              </View>
            ) : null}

            {chipKey === "category" ? (
              <HStack style={styles.chipGrid}>
                {CATEGORY_KINDS.map((c) => {
                  const active = categoryKinds.includes(c.value);
                  return (
                    <Pressable
                      key={c.value}
                      onPress={() => setCategoryKinds(toggle(categoryKinds, c.value))}
                      style={[styles.chip, styles.categoryChip, active && styles.chipActive]}
                    >
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}
                      >
                        {t(c.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </HStack>
            ) : null}

            {chipKey === "size" ? (
              <HStack style={styles.chipGrid}>
                {SIZE_PRESETS.map((s) => {
                  const active = sizes.includes(s);
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setSizes(toggle(sizes, s))}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}
                      >
                        {s}
                      </Text>
                    </Pressable>
                  );
                })}
              </HStack>
            ) : null}

            {chipKey === "condition" ? (
              <HStack style={styles.chipGrid}>
                {CONDITION_OPTIONS.map((c) => {
                  const active = conditions.includes(c.value);
                  return (
                    <Pressable
                      key={c.value}
                      onPress={() =>
                        setConditions(toggle(conditions, c.value))
                      }
                      style={[
                        styles.chip,
                        styles.conditionChip,
                        active && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}
                      >
                        {t(c.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </HStack>
            ) : null}

            {chipKey === "price" ? (
              <HStack style={styles.priceRow} alignItems="center">
                <View style={styles.priceField}>
                  <Text style={styles.priceCurrency}>¥</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={priceMin}
                    onChangeText={setPriceMin}
                    keyboardType="numeric"
                    placeholder={t("trading.filter.priceMin")}
                    placeholderTextColor={theme.colors.placeholder}
                  />
                </View>
                <Text style={styles.priceDash}>—</Text>
                <View style={styles.priceField}>
                  <Text style={styles.priceCurrency}>¥</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={priceMax}
                    onChangeText={setPriceMax}
                    keyboardType="numeric"
                    placeholder={t("trading.filter.priceMax")}
                    placeholderTextColor={theme.colors.placeholder}
                  />
                </View>
              </HStack>
            ) : null}
          </Box>

          <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
            <Text style={styles.applyText}>{t("trading.filter.apply")}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: t.colors.scrim,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: t.colors.background,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 28,
    },
    sheetTall: {
      // 品牌模式：拉高到屏幕的 70%，保证列表可滚动
      height: "75%",
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border,
      marginBottom: 12,
    },
    header: {
      paddingVertical: 4,
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: t.colors.text,
    },
    reset: {
      fontSize: 13,
      color: t.colors.textSecondary,
    },
    body: {
      minHeight: 60,
      paddingVertical: 4,
      marginBottom: 16,
    },
    bodyBrand: {
      flex: 1,
      marginBottom: 12,
    },
    // ---- 品牌：已选 chip 行 ----
    selectedRow: {
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 10,
    } as any,
    selectedChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 14,
      backgroundColor: t.colors.accent,
    },
    selectedChipText: {
      color: t.colors.textInverted,
      fontSize: 12,
      fontWeight: "600",
    },
    // ---- 品牌：搜索框 ----
    searchInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.inputBorder,
      backgroundColor: t.colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 4,
      marginBottom: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 8,
      fontSize: 14,
      color: t.colors.text,
    },
    // ---- 品牌：列表 ----
    brandFlat: {
      flex: 1,
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.divider,
    },
    brandRowActive: {
      backgroundColor: t.colors.surface,
    },
    brandRowName: {
      fontSize: 14,
      color: t.colors.text,
    },
    brandRowNameActive: {
      fontWeight: "600",
      color: t.colors.accent,
    },
    brandRowMeta: {
      fontSize: 11,
      color: t.colors.textSecondary,
      marginTop: 2,
    },
    brandStatus: {
      paddingVertical: 18,
      alignItems: "center",
    },
    brandEmpty: {
      fontSize: 12,
      color: t.colors.textSecondary,
    },
    chipGrid: { flexWrap: "wrap", gap: 10 } as any,
    chip: {
      minWidth: 56,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryChip: {
      minWidth: 76,
      paddingHorizontal: 14,
    },
    conditionChip: {
      paddingHorizontal: 16,
    },
    chipActive: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
    },
    chipText: { fontSize: 13, color: t.colors.text },
    chipTextActive: { color: t.colors.textInverted, fontWeight: "600" },
    priceRow: { gap: 12 } as any,
    priceField: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.inputBorder,
      backgroundColor: t.colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 12,
    },
    priceCurrency: {
      fontSize: 14,
      color: t.colors.text,
      marginRight: 6,
    },
    priceInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 14,
      color: t.colors.text,
    },
    priceDash: { color: t.colors.textSecondary, fontSize: 18 },
    applyBtn: {
      backgroundColor: t.colors.accent,
      paddingVertical: 16,
      borderRadius: 4,
      alignItems: "center",
    },
    applyText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
  });

export default MarketplaceChipSheet;
