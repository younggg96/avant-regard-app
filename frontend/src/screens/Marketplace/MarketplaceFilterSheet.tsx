/**
 * Marketplace 筛选器（全屏抽屉版，对应 PRD 模块二 · 设计稿 p.5）。
 *
 * 维度顺序按使用频率（PRD）：
 *   1. 品牌（搜索 + 多选 chip 列表，复用 brandService）
 *   2. 分类（PRD 6 大类，多选）
 *   3. 尺码（按分类动态展示对应尺码体系，多选）
 *   4. 价格区间（输入框 + 预设区段）
 *   5. 成色（4 档，多选）
 *   6. 颜色（色块多选）
 *   7. 发货地（国内 / 海外 + 直邮开关，UI 占位，后端字段就绪后接入）
 *
 * 计数策略：组件内部按用户输入实时（debounce 400ms）调用 `searchMarketplace`
 * 取 `total`，按钮上显示 `查看 N 件`；首次加载或网络抖动时显示 loader。
 *
 * 锁定品牌：`brandLocked=true` 时品牌区不可编辑，用于 BrandDetailScreen 进入
 * 此 sheet 时把当前品牌作为隐含上下文，符合 PRD「进入 archive 视为直接选中
 * 了品牌」的语义。
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box, HStack, ScrollView, Text, VStack } from "../../components/ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import {
  searchMarketplace,
  getPopularBrands,
  type MarketplaceFilter,
  type ProductCondition,
  type SellerKind,
} from "../../services/storeProductService";
import { brandService, type Brand } from "../../services/brandService";

// ---------------------------------------------------------------------------
// PRD 维度静态数据
// ---------------------------------------------------------------------------

/**
 * PRD 6 大类 —— 用 i18n key 渲染中英文，value 是后端 ``category`` 查询参数
 * （会做 ``store_product_categories.name ilike %value%`` 模糊匹配）。
 */
const CATEGORY_KINDS: Array<{ value: string; labelKey: string }> = [
  { value: "外套", labelKey: "trading.filter.categoryOuter" },
  { value: "上衣", labelKey: "trading.filter.categoryTop" },
  { value: "裤装", labelKey: "trading.filter.categoryPants" },
  { value: "鞋履", labelKey: "trading.filter.categoryShoes" },
  { value: "包袋", labelKey: "trading.filter.categoryBag" },
  { value: "配饰", labelKey: "trading.filter.categoryAccessory" },
];

/** 字母尺码（适用上衣 / 外套 / 配饰）。 */
const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL"];
/** 数字号（适用上衣 / 外套 / 裤装：欧码 36–54）。 */
const NUMERIC_SIZES = [
  "36",
  "38",
  "40",
  "42",
  "44",
  "46",
  "48",
  "50",
  "52",
  "54",
];
/** 鞋码 EU。 */
const SHOE_SIZES_EU = [
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
];
/** 鞋码 US（仅用于「鞋履」分类）。 */
const SHOE_SIZES_US = [
  "4.5",
  "5",
  "5.5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
];

/** 价格预设区段（cents）。 */
const PRICE_PRESETS: Array<{ minCents?: number; maxCents?: number; labelKey: string }> = [
  { minCents: 0, maxCents: 500_000, labelKey: "trading.filter.pricePreset0to5k" },
  { minCents: 500_000, maxCents: 2_000_000, labelKey: "trading.filter.pricePreset5kto20k" },
  {
    minCents: 2_000_000,
    maxCents: 5_000_000,
    labelKey: "trading.filter.pricePreset20kto50k",
  },
  { minCents: 5_000_000, labelKey: "trading.filter.pricePreset50kPlus" },
];

interface ColorOption {
  value: string;
  labelKey: string;
  hex: string;
  bordered?: boolean;
}

/** 8 主色 + 1 多彩 兜底；与 ProductInfoSection 的 PRD 颜色集合保持一致基础上扩展。 */
const COLORS: ColorOption[] = [
  { value: "black", labelKey: "trading.filter.colorBlack", hex: "#000000" },
  {
    value: "white",
    labelKey: "trading.filter.colorWhite",
    hex: "#FFFFFF",
    bordered: true,
  },
  { value: "gray", labelKey: "trading.filter.colorGray", hex: "#9CA3AF" },
  { value: "brown", labelKey: "trading.filter.colorBrown", hex: "#8B4513" },
  { value: "beige", labelKey: "trading.filter.colorBeige", hex: "#D9C9A8" },
  { value: "red", labelKey: "trading.filter.colorRed", hex: "#DC2626" },
  { value: "blue", labelKey: "trading.filter.colorBlue", hex: "#2563EB" },
  { value: "green", labelKey: "trading.filter.colorGreen", hex: "#16A34A" },
  { value: "yellow", labelKey: "trading.filter.colorYellow", hex: "#FACC15" },
  { value: "pink", labelKey: "trading.filter.colorPink", hex: "#EC4899" },
];

const CONDITION_OPTIONS: Array<{ value: ProductCondition; labelKey: string }> = [
  { value: "BNWT", labelKey: "trading.filter.conditionBnwt" },
  { value: "NEW_95", labelKey: "trading.filter.conditionNear" },
  { value: "USED_8", labelKey: "trading.filter.conditionLight" },
  { value: "FLAW", labelKey: "trading.filter.conditionUsed" },
];

const SELLER_OPTIONS: Array<{ value: SellerKind | ""; labelKey: string }> = [
  { value: "", labelKey: "trading.filter.all" },
  { value: "individual", labelKey: "trading.marketplace.sellerIndividual" },
  { value: "merchant", labelKey: "trading.marketplace.sellerMerchant" },
];

const SHIP_FROM_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: "domestic", labelKey: "trading.filter.shipFromDomestic" },
  { value: "overseas", labelKey: "trading.filter.shipFromOverseas" },
];

// ---------------------------------------------------------------------------
// 辅助
// ---------------------------------------------------------------------------

const toggleInArray = <T extends string>(arr: T[] | undefined, v: T): T[] => {
  const set = new Set(arr ?? []);
  if (set.has(v)) set.delete(v);
  else set.add(v);
  return Array.from(set);
};

/**
 * 根据已选的 PRD 大类决定要展示的尺码维度。
 *
 * 默认展示字母 + 数字号；选了「鞋履」加上鞋码 EU/US，且如果只选了鞋履则
 * 隐藏字母/数字号让用户更聚焦。配饰/包袋时通常无意义，不展示尺码区。
 */
function buildSizeSets(selectedKinds: string[]): Array<{
  titleKey: string;
  sizes: string[];
}> {
  if (!selectedKinds.length) {
    return [
      { titleKey: "trading.filter.sizeLetter", sizes: LETTER_SIZES },
      { titleKey: "trading.filter.sizeNumeric", sizes: NUMERIC_SIZES },
    ];
  }
  const wantsLetter = selectedKinds.some((k) => ["外套", "上衣"].includes(k));
  const wantsNumeric = selectedKinds.some((k) =>
    ["外套", "上衣", "裤装"].includes(k),
  );
  const wantsShoe = selectedKinds.includes("鞋履");
  const wantsAccessory =
    selectedKinds.includes("配饰") || selectedKinds.includes("包袋");
  const sets: Array<{ titleKey: string; sizes: string[] }> = [];
  if (wantsLetter) sets.push({ titleKey: "trading.filter.sizeLetter", sizes: LETTER_SIZES });
  if (wantsNumeric)
    sets.push({ titleKey: "trading.filter.sizeNumeric", sizes: NUMERIC_SIZES });
  if (wantsShoe) {
    sets.push({ titleKey: "trading.filter.sizeShoeEu", sizes: SHOE_SIZES_EU });
    sets.push({ titleKey: "trading.filter.sizeShoeUs", sizes: SHOE_SIZES_US });
  }
  // 只勾配饰/包袋时空集，但如果上面没匹配也提供基础字母码兜底
  if (sets.length === 0 && wantsAccessory) {
    sets.push({
      titleKey: "trading.filter.sizeLetter",
      sizes: ["S", "M", "L"],
    });
  }
  return sets;
}

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  initial: MarketplaceFilter;
  onClose: () => void;
  onApply: (next: MarketplaceFilter) => void;
  /** 锁定品牌（来自 BrandDetailScreen），不可编辑。 */
  brandLocked?: boolean;
}

type SectionKey =
  | "brand"
  | "category"
  | "size"
  | "price"
  | "condition"
  | "color"
  | "shipFrom"
  | "seller";

const MarketplaceFilterSheet: React.FC<Props> = ({
  visible,
  initial,
  onClose,
  onApply,
  brandLocked,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // ---- 表单状态（多值）----
  const [filter, setFilter] = useState<MarketplaceFilter>(initial);
  const [priceMin, setPriceMin] = useState(
    initial.priceMinCents ? String(Math.round(initial.priceMinCents / 100)) : "",
  );
  const [priceMax, setPriceMax] = useState(
    initial.priceMaxCents ? String(Math.round(initial.priceMaxCents / 100)) : "",
  );
  const [shipFromValues, setShipFromValues] = useState<string[]>([]);
  const [directShippingOnly, setDirectShippingOnly] = useState(false);

  // ---- 品牌搜索 ----
  const [brandQuery, setBrandQuery] = useState("");
  const [brandList, setBrandList] = useState<Brand[]>([]);
  const [brandLoading, setBrandLoading] = useState(false);
  const brandSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- 折叠 ----
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    brand: !brandLocked,
    category: true,
    size: false,
    price: true,
    condition: true,
    color: false,
    shipFrom: false,
    seller: false,
  });

  // ---- 计数预览 ----
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // visible 变化时重置表单
  useEffect(() => {
    if (visible) {
      setFilter(initial);
      setPriceMin(
        initial.priceMinCents
          ? String(Math.round(initial.priceMinCents / 100))
          : "",
      );
      setPriceMax(
        initial.priceMaxCents
          ? String(Math.round(initial.priceMaxCents / 100))
          : "",
      );
      // 默认拉一波热门品牌当 chip 候选
      loadBrandSuggestions("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initial]);

  // 把当前表单合成最终 filter（含价格输入）
  const composedFilter = useMemo<MarketplaceFilter>(() => {
    const min = priceMin ? Math.round(Number(priceMin) * 100) : undefined;
    const max = priceMax ? Math.round(Number(priceMax) * 100) : undefined;
    return {
      ...filter,
      priceMinCents: Number.isFinite(min) ? min : undefined,
      priceMaxCents: Number.isFinite(max) ? max : undefined,
    };
  }, [filter, priceMin, priceMax]);

  // 实时计数预览
  useEffect(() => {
    if (!visible) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCounting(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchMarketplace({
          ...composedFilter,
          page: 1,
          pageSize: 1,
        });
        setPreviewCount(res.total ?? 0);
      } catch {
        setPreviewCount(null);
      } finally {
        setCounting(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [visible, composedFilter]);

  // ---- 品牌搜索：默认拉热门，输入时走 brandService 搜索 ----
  const loadBrandSuggestions = useCallback(async (kw: string) => {
    setBrandLoading(true);
    try {
      if (!kw.trim()) {
        // 空查询拉「热门 30」当默认 chip 候选
        const hot = await getPopularBrands(30).catch(() => []);
        setBrandList(
          hot.map((h, idx) => ({
            id: h.brandId ?? -idx,
            name: h.name,
            coverImage: h.imageUrl ?? undefined,
          }) as Brand),
        );
      } else {
        const res = await brandService.getBrands({
          keyword: kw,
          page: 1,
          pageSize: 30,
        });
        setBrandList(res.brands ?? []);
      }
    } finally {
      setBrandLoading(false);
    }
  }, []);

  const onBrandQueryChange = (text: string) => {
    setBrandQuery(text);
    if (brandSearchTimer.current) clearTimeout(brandSearchTimer.current);
    brandSearchTimer.current = setTimeout(() => {
      loadBrandSuggestions(text);
    }, 300);
  };

  // ---- 切换区块 ----
  const toggleSection = (key: SectionKey) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // ---- 应用 / 重置 ----
  const handleApply = () => {
    onApply({ ...composedFilter, page: 1 });
  };

  const handleReset = () => {
    setFilter({
      sort: filter.sort,
      // 锁定品牌时保留品牌
      ...(brandLocked
        ? { brand: filter.brand, brands: filter.brands }
        : {}),
    });
    setPriceMin("");
    setPriceMax("");
    setShipFromValues([]);
    setDirectShippingOnly(false);
  };

  // ---- 选中态助手 ----
  const selectedBrands = useMemo(() => {
    const arr = filter.brands ? [...filter.brands] : [];
    if (filter.brand && !arr.includes(filter.brand)) arr.push(filter.brand);
    return arr;
  }, [filter.brands, filter.brand]);

  const selectedKinds = filter.categoryKinds ?? [];
  const selectedSizes = filter.sizes ?? (filter.size ? [filter.size] : []);
  const selectedColors = filter.colors ?? (filter.color ? [filter.color] : []);
  const selectedConditions =
    filter.conditions ?? (filter.condition ? [filter.condition] : []);

  // ---- 摘要文案 ----
  const allLabel = t("trading.filter.all");
  const summaryFor = (key: SectionKey): string => {
    switch (key) {
      case "brand":
        return selectedBrands.length === 0
          ? allLabel
          : selectedBrands.length === 1
            ? selectedBrands[0]
            : t("trading.filter.summarySelectedCount", {
                count: selectedBrands.length,
              });
      case "category":
        if (selectedKinds.length === 0) return allLabel;
        return selectedKinds
          .map((k) => {
            const found = CATEGORY_KINDS.find((c) => c.value === k);
            return found ? t(found.labelKey) : k;
          })
          .join(" · ");
      case "size":
        return selectedSizes.length === 0
          ? allLabel
          : selectedSizes.length === 1
            ? selectedSizes[0]
            : t("trading.filter.summarySelectedCount", {
                count: selectedSizes.length,
              });
      case "price":
        if (priceMin || priceMax) return `¥${priceMin || "0"} – ¥${priceMax || "∞"}`;
        return allLabel;
      case "condition":
        if (selectedConditions.length === 0) return allLabel;
        return selectedConditions
          .map((c) => {
            const opt = CONDITION_OPTIONS.find((o) => o.value === c);
            return opt ? t(opt.labelKey) : c;
          })
          .join(" · ");
      case "color":
        if (selectedColors.length === 0) return allLabel;
        return selectedColors
          .map((c) => {
            const opt = COLORS.find((o) => o.value === c);
            return opt ? t(opt.labelKey) : c;
          })
          .join(" · ");
      case "shipFrom":
        if (shipFromValues.length === 0 && !directShippingOnly) return allLabel;
        return shipFromValues
          .map((v) => {
            const o = SHIP_FROM_OPTIONS.find((s) => s.value === v);
            return o ? t(o.labelKey) : v;
          })
          .concat(directShippingOnly ? [t("trading.filter.directShippingOnly")] : [])
          .join(" · ");
      case "seller":
        if (!filter.sellerKind) return allLabel;
        return filter.sellerKind === "individual"
          ? t("trading.marketplace.sellerIndividual")
          : t("trading.marketplace.sellerMerchant");
      default:
        return allLabel;
    }
  };

  const sizeSets = useMemo(() => buildSizeSets(selectedKinds), [selectedKinds]);

  // ---- 渲染 ----
  return (
    <Modal
      animationType="fade"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <HStack style={styles.header} alignItems="center">
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerSideBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("trading.filter.title")}</Text>
          <TouchableOpacity
            onPress={handleReset}
            style={styles.headerSideBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.headerReset}>{t("trading.filter.reset")}</Text>
          </TouchableOpacity>
        </HStack>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. 品牌（多选 + 搜索） */}
          <Section
            iconName="pricetag-outline"
            title={t("trading.filter.brand")}
            summary={summaryFor("brand")}
            expanded={expanded.brand && !brandLocked}
            onToggle={() => !brandLocked && toggleSection("brand")}
            disabled={brandLocked}
          >
            {/* 已选 chips 行 */}
            {selectedBrands.length > 0 ? (
              <HStack style={styles.selectedRow}>
                {selectedBrands.map((b) => (
                  <Pressable
                    key={`sel_${b}`}
                    style={styles.selectedChip}
                    onPress={() =>
                      setFilter((prev) => ({
                        ...prev,
                        brand: prev.brand === b ? undefined : prev.brand,
                        brands: (prev.brands ?? []).filter((x) => x !== b),
                      }))
                    }
                  >
                    <Text style={styles.selectedChipText}>{b}</Text>
                    <Ionicons name="close" size={12} color={theme.colors.textInverted} />
                  </Pressable>
                ))}
              </HStack>
            ) : null}

            {/* 搜索框 */}
            <View style={styles.searchInputWrap}>
              <Ionicons name="search" size={16} color={theme.colors.gray300} />
              <TextInput
                style={styles.searchInput}
                value={brandQuery}
                onChangeText={onBrandQueryChange}
                placeholder={t("trading.filter.brandPlaceholder")}
                placeholderTextColor={theme.colors.placeholder}
              />
              {brandLoading ? (
                <ActivityIndicator size="small" color={theme.colors.gray300} />
              ) : null}
            </View>

            {/* 候选 chip 列表 */}
            <HStack style={styles.brandGrid}>
              {brandList
                .filter((b) => !selectedBrands.includes(b.name))
                .slice(0, 30)
                .map((b) => (
                  <Pressable
                    key={`opt_${b.id}_${b.name}`}
                    style={styles.brandChip}
                    onPress={() =>
                      setFilter((prev) => {
                        const cur = prev.brands ?? (prev.brand ? [prev.brand] : []);
                        if (cur.includes(b.name)) return prev;
                        return {
                          ...prev,
                          brand: undefined,
                          brands: [...cur, b.name],
                        };
                      })
                    }
                  >
                    <Text style={styles.brandChipText} numberOfLines={1}>
                      {b.name}
                    </Text>
                  </Pressable>
                ))}
              {brandList.length === 0 && !brandLoading ? (
                <Text style={styles.emptyHint}>{t("trading.filter.brandEmpty")}</Text>
              ) : null}
            </HStack>
          </Section>

          {/* 2. 分类（PRD 6 大类，多选） */}
          <Section
            iconName="grid-outline"
            title={t("trading.filter.category")}
            summary={summaryFor("category")}
            expanded={expanded.category}
            onToggle={() => toggleSection("category")}
          >
            <HStack style={styles.chipGrid}>
              {CATEGORY_KINDS.map((c) => {
                const active = selectedKinds.includes(c.value);
                return (
                  <Pressable
                    key={c.value}
                    onPress={() =>
                      setFilter((prev) => ({
                        ...prev,
                        categoryKinds: toggleInArray(
                          prev.categoryKinds ?? [],
                          c.value,
                        ),
                      }))
                    }
                    style={[
                      styles.chip,
                      styles.categoryChip,
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
          </Section>

          {/* 3. 尺码（按分类动态展示） */}
          <Section
            iconName="resize-outline"
            title={t("trading.filter.size")}
            summary={summaryFor("size")}
            expanded={expanded.size}
            onToggle={() => toggleSection("size")}
          >
            {sizeSets.length === 0 ? (
              <Text style={styles.emptyHint}>{t("trading.filter.sizeEmpty")}</Text>
            ) : null}
            {sizeSets.map((set) => (
              <VStack key={set.titleKey} style={styles.sizeSet}>
                <Text style={styles.sizeSetTitle}>{t(set.titleKey)}</Text>
                <HStack style={styles.chipGrid}>
                  {set.sizes.map((s) => {
                    const active = selectedSizes.includes(s);
                    return (
                      <Pressable
                        key={`${set.titleKey}_${s}`}
                        onPress={() =>
                          setFilter((prev) => ({
                            ...prev,
                            size: undefined,
                            sizes: toggleInArray(
                              prev.sizes ?? (prev.size ? [prev.size] : []),
                              s,
                            ),
                          }))
                        }
                        style={[
                          styles.chip,
                          styles.sizeChip,
                          active && styles.chipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active && styles.chipTextActive,
                          ]}
                        >
                          {s}
                        </Text>
                      </Pressable>
                    );
                  })}
                </HStack>
              </VStack>
            ))}
          </Section>

          {/* 4. 价格（输入 + 预设） */}
          <Section
            iconName="cash-outline"
            title={t("trading.filter.price")}
            summary={summaryFor("price")}
            expanded={expanded.price}
            onToggle={() => toggleSection("price")}
          >
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
            <HStack style={[styles.chipGrid, { marginTop: 12 }]}>
              {PRICE_PRESETS.map((p) => {
                const minStr = p.minCents != null ? String(p.minCents / 100) : "";
                const maxStr = p.maxCents != null ? String(p.maxCents / 100) : "";
                const active = priceMin === minStr && priceMax === maxStr;
                return (
                  <Pressable
                    key={p.labelKey}
                    onPress={() => {
                      setPriceMin(active ? "" : minStr);
                      setPriceMax(active ? "" : maxStr);
                    }}
                    style={[
                      styles.chip,
                      styles.pricePresetChip,
                      active && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {t(p.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </Section>

          {/* 5. 成色（多选） */}
          <Section
            iconName="ribbon-outline"
            title={t("trading.filter.condition")}
            summary={summaryFor("condition")}
            expanded={expanded.condition}
            onToggle={() => toggleSection("condition")}
          >
            <HStack style={styles.chipGrid}>
              {CONDITION_OPTIONS.map((c) => {
                const active = selectedConditions.includes(c.value);
                return (
                  <Pressable
                    key={c.value}
                    onPress={() =>
                      setFilter((prev) => ({
                        ...prev,
                        condition: undefined,
                        conditions: toggleInArray<ProductCondition>(
                          (prev.conditions ??
                            (prev.condition ? [prev.condition] : [])) as ProductCondition[],
                          c.value,
                        ),
                      }))
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
          </Section>

          {/* 6. 颜色（色块多选） */}
          <Section
            iconName="color-palette-outline"
            title={t("trading.filter.color")}
            summary={summaryFor("color")}
            expanded={expanded.color}
            onToggle={() => toggleSection("color")}
          >
            <HStack style={styles.colorGrid}>
              {COLORS.map((c) => {
                const active = selectedColors.includes(c.value);
                return (
                  <Pressable
                    key={c.value}
                    onPress={() =>
                      setFilter((prev) => ({
                        ...prev,
                        color: undefined,
                        colors: toggleInArray(
                          prev.colors ?? (prev.color ? [prev.color] : []),
                          c.value,
                        ),
                      }))
                    }
                    style={styles.colorItem}
                  >
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: c.hex },
                        c.bordered && styles.colorSwatchBordered,
                        active && styles.colorSwatchActive,
                      ]}
                    >
                      {active ? (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={c.value === "white" || c.value === "yellow" || c.value === "beige" ? "#000" : "#FFF"}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.colorLabel} numberOfLines={1}>
                      {t(c.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </Section>

          {/* 7. 发货地（UI 占位，后端字段就绪后接入） */}
          <Section
            iconName="location-outline"
            title={t("trading.filter.shipFrom")}
            summary={summaryFor("shipFrom")}
            expanded={expanded.shipFrom}
            onToggle={() => toggleSection("shipFrom")}
          >
            <HStack style={styles.chipGrid}>
              {SHIP_FROM_OPTIONS.map((opt) => {
                const active = shipFromValues.includes(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() =>
                      setShipFromValues((prev) =>
                        prev.includes(opt.value)
                          ? prev.filter((v) => v !== opt.value)
                          : [...prev, opt.value],
                      )
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
                      {t(opt.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
            <HStack style={styles.toggleRow} alignItems="center">
              <Text style={styles.toggleLabel}>
                {t("trading.filter.directShippingOnly")}
              </Text>
              <View style={{ flex: 1 }} />
              <Switch
                value={directShippingOnly}
                onValueChange={setDirectShippingOnly}
                trackColor={{
                  false: theme.colors.gray200,
                  true: theme.colors.accent,
                }}
                thumbColor={theme.colors.cardElevated}
              />
            </HStack>
            <Text style={styles.placeholderHint}>
              {t("trading.filter.shipFromHint")}
            </Text>
          </Section>

          {/* 8. 卖家身份（次要维度，靠后） */}
          <Section
            iconName="person-outline"
            title={t("trading.filter.seller")}
            summary={summaryFor("seller")}
            expanded={expanded.seller}
            onToggle={() => toggleSection("seller")}
          >
            <HStack style={styles.chipGrid}>
              {SELLER_OPTIONS.map((s) => {
                const active =
                  (s.value === "" && !filter.sellerKind) ||
                  filter.sellerKind === s.value;
                return (
                  <Pressable
                    key={s.value || "all"}
                    onPress={() =>
                      setFilter((prev) => ({
                        ...prev,
                        sellerKind:
                          s.value === "" ? undefined : (s.value as SellerKind),
                      }))
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
                      {t(s.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </Section>
        </ScrollView>

        {/* 底部按钮 */}
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
            {counting ? (
              <ActivityIndicator color={theme.colors.textInverted} size="small" />
            ) : (
              <Text style={styles.applyText}>
                {t("trading.filter.viewResults", {
                  count: previewCount ?? 0,
                })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// 折叠分组
// ---------------------------------------------------------------------------

interface SectionProps {
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  /** 锁定状态：标题保留显示但不展开。 */
  disabled?: boolean;
}

const Section: React.FC<SectionProps> = ({
  iconName,
  title,
  summary,
  expanded,
  onToggle,
  children,
  disabled,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const showBody = !disabled && expanded && children != null;
  return (
    <VStack style={styles.section}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={disabled ? 1 : 0.6}
        style={styles.sectionHeader}
        disabled={disabled}
      >
        <Ionicons
          name={iconName}
          size={18}
          color={theme.colors.text}
          style={{ marginRight: 12 }}
        />
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.sectionSummary} numberOfLines={1}>
          {summary}
        </Text>
        {!disabled ? (
          <Ionicons
            name={showBody ? "chevron-up" : "chevron-forward"}
            size={16}
            color={theme.colors.gray300}
            style={{ marginLeft: 6 }}
          />
        ) : (
          <Ionicons
            name="lock-closed-outline"
            size={14}
            color={theme.colors.gray300}
            style={{ marginLeft: 6 }}
          />
        )}
      </TouchableOpacity>
      {showBody ? <View style={styles.sectionBody}>{children}</View> : null}
    </VStack>
  );
};

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    header: {
      paddingHorizontal: 8,
      paddingTop: 12,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    headerSideBtn: {
      width: 60,
      paddingVertical: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 17,
      fontWeight: "600",
      color: t.colors.text,
    },
    headerReset: {
      fontSize: 14,
      color: t.colors.text,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 24 },
    section: { paddingHorizontal: 16 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.divider,
    },
    sectionTitle: {
      fontSize: 15,
      color: t.colors.text,
      fontWeight: "500",
    },
    sectionSummary: {
      fontSize: 13,
      color: t.colors.textSecondary,
      maxWidth: 200,
    },
    sectionBody: {
      paddingTop: 12,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.divider,
    },
    // ---- 通用 chip ----
    chipGrid: { flexWrap: "wrap", gap: 8 } as any,
    chip: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    chipText: { fontSize: 13, color: t.colors.text },
    chipTextActive: { color: t.colors.textInverted, fontWeight: "600" },
    chipActive: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
    },
    categoryChip: {
      minWidth: 76,
    },
    sizeChip: {
      minWidth: 52,
      paddingVertical: 12,
    },
    conditionChip: {
      minWidth: 72,
    },
    pricePresetChip: {
      paddingHorizontal: 12,
    },
    sizeSet: { marginBottom: 12 },
    sizeSetTitle: {
      fontSize: 12,
      color: t.colors.textSecondary,
      marginBottom: 8,
    },
    // ---- 已选品牌行 ----
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
    // ---- 品牌搜索 ----
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
    },
    searchInput: {
      flex: 1,
      paddingVertical: 8,
      fontSize: 14,
      color: t.colors.text,
    },
    brandGrid: {
      flexWrap: "wrap",
      gap: 6,
      marginTop: 12,
    } as any,
    brandChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    brandChipText: {
      fontSize: 12,
      color: t.colors.text,
      maxWidth: 160,
    },
    emptyHint: {
      fontSize: 12,
      color: t.colors.textSecondary,
      paddingVertical: 8,
    },
    placeholderHint: {
      fontSize: 11,
      color: t.colors.textSecondary,
      marginTop: 8,
      lineHeight: 16,
    },
    // ---- 价格输入 ----
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
      paddingVertical: 10,
      fontSize: 14,
      color: t.colors.text,
    },
    priceDash: { color: t.colors.textSecondary, fontSize: 18 },
    // ---- 颜色色块 ----
    colorGrid: { flexWrap: "wrap", gap: 16 } as any,
    colorItem: { alignItems: "center", width: 56 },
    colorSwatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    colorSwatchBordered: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    colorSwatchActive: {
      borderWidth: 2,
      borderColor: t.colors.accent,
    },
    colorLabel: {
      marginTop: 6,
      fontSize: 11,
      color: t.colors.textSecondary,
    },
    // ---- 直邮 toggle ----
    toggleRow: {
      paddingVertical: 14,
    },
    toggleLabel: {
      fontSize: 14,
      color: t.colors.text,
    },
    // ---- 底部按钮 ----
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
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

export default MarketplaceFilterSheet;
