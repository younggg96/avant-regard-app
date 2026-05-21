/**
 * Marketplace 筛选器（全屏抽屉版，参考设计稿 p.5）。
 *
 * 结构：
 *   - 顶部：X / 筛选 / 重置
 *   - 中部：可滚动的分组列表。每个分组（分类、品牌、尺码、价格、成色、颜色、发货地、卖家）
 *           默认折叠，显示当前选中摘要 + chevron 箭头；点击展开后渲染对应的 chips/输入框。
 *   - 底部：「只看支持直邮」开关 + 「查看结果 (N)」 主按钮。
 *
 * 计数策略：组件内部按用户输入实时（debounce 400ms）调用 `searchMarketplace`
 * 取 `total`，无需上层维护。
 *
 * 数据/可用性：
 *   - 分类 / 发货地 暂以可输入文本（categoryId 走数字 / shipFrom 暂未接入后端）的形式呈现，
 *     可在后续迭代中替换为更丰富的选择器；
 *   - "只看支持直邮" 为视觉占位，后端字段就绪后再接入。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type MarketplaceFilter,
  type ProductCondition,
  type SellerKind,
} from "../../services/storeProductService";

const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL"];

interface ColorOption {
  value: string;
  labelKey: string;
  hex: string;
  bordered?: boolean;
}

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
  { value: "red", labelKey: "trading.filter.colorRed", hex: "#DC2626" },
];

interface Props {
  visible: boolean;
  initial: MarketplaceFilter;
  onClose: () => void;
  onApply: (next: MarketplaceFilter) => void;
}

type SectionKey =
  | "category"
  | "brand"
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
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [filter, setFilter] = useState<MarketplaceFilter>(initial);
  const [priceMin, setPriceMin] = useState(
    initial.priceMinCents ? String(Math.round(initial.priceMinCents / 100)) : ""
  );
  const [priceMax, setPriceMax] = useState(
    initial.priceMaxCents ? String(Math.round(initial.priceMaxCents / 100)) : ""
  );
  const [directShippingOnly, setDirectShippingOnly] = useState(false);
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    category: false,
    brand: false,
    size: true,
    price: true,
    condition: true,
    color: true,
    shipFrom: false,
    seller: false,
  });

  // 计数预览：与当前编辑中的 filter 同步（搜索 pageSize=1，仅取 total）。
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setFilter(initial);
      setPriceMin(
        initial.priceMinCents
          ? String(Math.round(initial.priceMinCents / 100))
          : ""
      );
      setPriceMax(
        initial.priceMaxCents
          ? String(Math.round(initial.priceMaxCents / 100))
          : ""
      );
    }
  }, [visible, initial]);

  const composedFilter = useMemo<MarketplaceFilter>(() => {
    const min = priceMin ? Math.round(Number(priceMin) * 100) : undefined;
    const max = priceMax ? Math.round(Number(priceMax) * 100) : undefined;
    return {
      ...filter,
      priceMinCents: Number.isFinite(min) ? min : undefined,
      priceMaxCents: Number.isFinite(max) ? max : undefined,
    };
  }, [filter, priceMin, priceMax]);

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

  const toggleSection = (key: SectionKey) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleApply = () => {
    onApply({ ...composedFilter, page: 1 });
  };

  const handleReset = () => {
    setFilter({ sort: filter.sort });
    setPriceMin("");
    setPriceMax("");
    setDirectShippingOnly(false);
  };

  // ----- 摘要文案 -----
  const allLabel = t("trading.filter.all");

  const summaryFor = (key: SectionKey): string => {
    switch (key) {
      case "category":
        return filter.categoryId != null ? `#${filter.categoryId}` : allLabel;
      case "brand":
        return filter.brand && filter.brand.trim() !== ""
          ? filter.brand
          : allLabel;
      case "size":
        return filter.size ?? allLabel;
      case "price":
        if (priceMin || priceMax)
          return `¥${priceMin || "0"} - ¥${priceMax || "∞"}`;
        return `¥${t("trading.filter.priceMin")} - ¥${t(
          "trading.filter.priceMax"
        )}`;
      case "condition":
        if (!filter.condition) return allLabel;
        return CONDITION_LABEL_KEYS[filter.condition]
          ? t(CONDITION_LABEL_KEYS[filter.condition]!)
          : allLabel;
      case "color":
        if (!filter.color) return allLabel;
        const opt = COLORS.find((c) => c.value === filter.color);
        return opt ? t(opt.labelKey) : filter.color;
      case "shipFrom":
        return allLabel;
      case "seller":
        if (!filter.sellerKind) return allLabel;
        return filter.sellerKind === "individual"
          ? t("trading.marketplace.sellerIndividual")
          : t("trading.marketplace.sellerMerchant");
      default:
        return allLabel;
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
      // presentationStyle="fullScreen"
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
            <Text style={styles.headerReset}>
              {t("trading.filter.reset")}
            </Text>
          </TouchableOpacity>
        </HStack>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 分类 */}
          <Section
            iconName="grid-outline"
            title={t("trading.filter.category")}
            summary={summaryFor("category")}
            expanded={expanded.category}
            onToggle={() => toggleSection("category")}
          >
            <TextInput
              style={styles.input}
              value={filter.categoryId != null ? String(filter.categoryId) : ""}
              onChangeText={(v) => {
                const n = Number(v);
                setFilter((prev) => ({
                  ...prev,
                  categoryId: v === "" ? undefined : Number.isFinite(n) ? n : undefined,
                }));
              }}
              keyboardType="numeric"
              placeholder={t("trading.filter.category")}
              placeholderTextColor={theme.colors.placeholder}
            />
          </Section>

          {/* 品牌 */}
          <Section
            iconName="pricetag-outline"
            title={t("trading.filter.brand")}
            summary={summaryFor("brand")}
            expanded={expanded.brand}
            onToggle={() => toggleSection("brand")}
          >
            <TextInput
              style={styles.input}
              value={filter.brand ?? ""}
              onChangeText={(v) =>
                setFilter((prev) => ({ ...prev, brand: v }))
              }
              placeholder={t("trading.filter.brandPlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
            />
          </Section>

          {/* 尺码 */}
          <Section
            iconName="resize-outline"
            title={t("trading.filter.size")}
            summary={summaryFor("size")}
            expanded={expanded.size}
            onToggle={() => toggleSection("size")}
          >
            <HStack style={styles.sizeGrid}>
              {SIZE_PRESETS.map((s) => {
                const active = filter.size === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() =>
                      setFilter((prev) => ({
                        ...prev,
                        size: prev.size === s ? undefined : s,
                      }))
                    }
                    style={[styles.sizeChip, active && styles.sizeChipActive]}
                  >
                    <Text
                      style={[
                        styles.sizeChipText,
                        active && styles.sizeChipTextActive,
                      ]}
                    >
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
            <TouchableOpacity style={styles.viewAllSizes}>
              <Text style={styles.viewAllSizesText}>
                {t("trading.filter.viewAllSizes")}
              </Text>
            </TouchableOpacity>
          </Section>

          {/* 价格 */}
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
          </Section>

          {/* 成色 */}
          <Section
            iconName="ribbon-outline"
            title={t("trading.filter.condition")}
            summary={summaryFor("condition")}
            expanded={expanded.condition}
            onToggle={() => toggleSection("condition")}
          >
            <HStack style={styles.conditionGrid}>
              {CONDITION_OPTIONS.map((c) => {
                const active = filter.condition === c.value;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() =>
                      setFilter((prev) => ({
                        ...prev,
                        condition:
                          prev.condition === c.value ? undefined : c.value,
                      }))
                    }
                    style={[
                      styles.conditionChip,
                      active && styles.sizeChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sizeChipText,
                        active && styles.sizeChipTextActive,
                      ]}
                    >
                      {t(c.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </Section>

          {/* 颜色 */}
          <Section
            iconName="color-palette-outline"
            title={t("trading.filter.color")}
            summary={summaryFor("color")}
            expanded={expanded.color}
            onToggle={() => toggleSection("color")}
          >
            <HStack style={styles.colorGrid}>
              {COLORS.map((c) => {
                const active = filter.color === c.value;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() =>
                      setFilter((prev) => ({
                        ...prev,
                        color: prev.color === c.value ? undefined : c.value,
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
                    />
                    <Text style={styles.colorLabel}>{t(c.labelKey)}</Text>
                  </Pressable>
                );
              })}
              <Pressable style={styles.colorItem}>
                <View style={[styles.colorSwatch, styles.colorMore]}>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={theme.colors.text}
                  />
                </View>
                <Text style={styles.colorLabel}>
                  {t("trading.filter.colorMore")}
                </Text>
              </Pressable>
            </HStack>
          </Section>

          {/* 发货地（占位） */}
          <Section
            iconName="location-outline"
            title={t("trading.filter.shipFrom")}
            summary={summaryFor("shipFrom")}
            expanded={expanded.shipFrom}
            onToggle={() => toggleSection("shipFrom")}
            placeholder
          />

          {/* 卖家 */}
          <Section
            iconName="person-outline"
            title={t("trading.filter.seller")}
            summary={summaryFor("seller")}
            expanded={expanded.seller}
            onToggle={() => toggleSection("seller")}
          >
            <HStack style={styles.conditionGrid}>
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
                      styles.conditionChip,
                      active && styles.sizeChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sizeChipText,
                        active && styles.sizeChipTextActive,
                      ]}
                    >
                      {t(s.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </Section>

          {/* 只看直邮（占位） */}
          <HStack style={styles.toggleRow} alignItems="center">
            <Text style={styles.sectionTitle}>
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
// 子组件 & 静态数据
// ---------------------------------------------------------------------------

const CONDITION_LABEL_KEYS: Partial<Record<ProductCondition, string>> = {
  BNWT: "trading.filter.conditionBnwt",
  NEW_99: "trading.filter.conditionNear",
  NEW_95: "trading.filter.conditionNear",
  USED_8: "trading.filter.conditionLight",
  FLAW: "trading.filter.conditionUsed",
};

const CONDITION_OPTIONS: Array<{ value: ProductCondition; labelKey: string }> =
  [
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

interface SectionProps {
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  /** 占位分组：不展示展开内容，仅渲染头部行（设计稿中的「发货地」）。 */
  placeholder?: boolean;
}

const Section: React.FC<SectionProps> = ({
  iconName,
  title,
  summary,
  expanded,
  onToggle,
  children,
  placeholder,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const showBody = !placeholder && expanded && children != null;
  return (
    <VStack style={styles.section}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.6}
        style={styles.sectionHeader}
      >
        <Ionicons
          name={iconName}
          size={18}
          color={theme.colors.text}
          style={{ marginRight: 12 }}
        />
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.sectionSummary}>{summary}</Text>
        <Ionicons
          name={showBody ? "chevron-up" : "chevron-forward"}
          size={16}
          color={theme.colors.gray300}
          style={{ marginLeft: 6 }}
        />
      </TouchableOpacity>
      {showBody ? <View style={styles.sectionBody}>{children}</View> : null}
    </VStack>
  );
};

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
    section: {
      paddingHorizontal: 16,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.divider,
    },
    sectionTitle: { fontSize: 15, color: t.colors.text, fontWeight: "500" },
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
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.inputBorder,
      backgroundColor: t.colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: t.colors.text,
    },
    sizeGrid: {
      flexWrap: "wrap",
      gap: 8,
    } as any,
    sizeChip: {
      flex: 1,
      minWidth: 48,
      maxWidth: "20%",
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    sizeChipActive: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
    },
    sizeChipText: { fontSize: 13, color: t.colors.text },
    sizeChipTextActive: { color: t.colors.textInverted, fontWeight: "600" },
    viewAllSizes: {
      marginTop: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: "center",
    },
    viewAllSizesText: { fontSize: 13, color: t.colors.text },
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
    conditionGrid: {
      flexWrap: "wrap",
      gap: 8,
    } as any,
    conditionChip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 72,
    },
    colorGrid: {
      flexWrap: "wrap",
      gap: 16,
    } as any,
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
    colorMore: {
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    colorLabel: {
      marginTop: 6,
      fontSize: 11,
      color: t.colors.textSecondary,
    },
    toggleRow: {
      paddingHorizontal: 16,
      paddingVertical: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.divider,
    },
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
