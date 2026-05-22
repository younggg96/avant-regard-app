/**
 * MarketplaceChipSheet —— 顶部筛选 chip 的「单项快捷弹窗」。
 *
 * 与 `MarketplaceFilterSheet`（全屏聚合筛选器）的区别：
 *   - 这是一个底部弹起的紧凑 sheet；只渲染**一个**字段的选择 UI。
 *   - 适用于 chip 行的 4 个子项（分类 / 尺码 / 价格 / 成色），用户希望
 *     "点哪个 chip 就只编辑这一项"，避免每次都打开全屏聚合 sheet。
 *   - "全部" 直接清空、"筛选" 走全屏 sheet——都不会触达此组件。
 *
 * 设计要点：
 *   - 顶部 handle + 标题 + 右上「重置」。
 *   - 中间根据 `chipKey` 渲染 TextInput / 尺码 chips / 价格双输入 / 成色 chips。
 *   - 底部主按钮「应用」。
 *
 * 用法：
 *   <MarketplaceChipSheet
 *     visible={chipKey !== null}
 *     chipKey={chipKey}
 *     initial={filter}
 *     onClose={() => setChipKey(null)}
 *     onApply={(patch) => reload({ ...filter, ...patch })}
 *   />
 */
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { Box, HStack, Text } from "../../components/ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import type {
  MarketplaceFilter,
  ProductCondition,
} from "../../services/storeProductService";

export type ChipFilterKey = "category" | "size" | "price" | "condition";

const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL"];

const CONDITION_OPTIONS: Array<{ value: ProductCondition; labelKey: string }> =
  [
    { value: "BNWT", labelKey: "trading.filter.conditionBnwt" },
    { value: "NEW_95", labelKey: "trading.filter.conditionNear" },
    { value: "USED_8", labelKey: "trading.filter.conditionLight" },
    { value: "FLAW", labelKey: "trading.filter.conditionUsed" },
  ];

const TITLE_KEY: Record<ChipFilterKey, string> = {
  category: "trading.filter.category",
  size: "trading.filter.size",
  price: "trading.filter.price",
  condition: "trading.filter.condition",
};

interface Props {
  visible: boolean;
  chipKey: ChipFilterKey | null;
  initial: MarketplaceFilter;
  onClose: () => void;
  /** 传递增量字段：调用方决定如何合并到主 filter。 */
  onApply: (patch: Partial<MarketplaceFilter>) => void;
}

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

  const [categoryText, setCategoryText] = useState(
    initial.categoryId != null ? String(initial.categoryId) : "",
  );
  const [size, setSize] = useState<string | undefined>(initial.size);
  const [condition, setCondition] = useState<ProductCondition | undefined>(
    initial.condition,
  );
  const [priceMin, setPriceMin] = useState(
    initial.priceMinCents != null
      ? String(Math.round(initial.priceMinCents / 100))
      : "",
  );
  const [priceMax, setPriceMax] = useState(
    initial.priceMaxCents != null
      ? String(Math.round(initial.priceMaxCents / 100))
      : "",
  );

  // 每次打开 / 切换 chipKey 时把本地草稿与外部状态对齐
  useEffect(() => {
    if (!visible) return;
    setCategoryText(
      initial.categoryId != null ? String(initial.categoryId) : "",
    );
    setSize(initial.size);
    setCondition(initial.condition);
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
  }, [visible, chipKey, initial]);

  if (!chipKey) return null;

  const handleApply = () => {
    switch (chipKey) {
      case "category": {
        const n = Number(categoryText);
        onApply({
          categoryId:
            categoryText === ""
              ? undefined
              : Number.isFinite(n)
                ? n
                : undefined,
        });
        break;
      }
      case "size":
        onApply({ size: size || undefined });
        break;
      case "condition":
        onApply({ condition: condition || undefined });
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
      case "category":
        setCategoryText("");
        onApply({ categoryId: undefined });
        break;
      case "size":
        setSize(undefined);
        onApply({ size: undefined });
        break;
      case "condition":
        setCondition(undefined);
        onApply({ condition: undefined });
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
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Box style={styles.handle} />
          <HStack style={styles.header} alignItems="center">
            <Text style={styles.title}>{t(TITLE_KEY[chipKey])}</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={handleReset} hitSlop={8}>
              <Text style={styles.reset}>{t("trading.filter.reset")}</Text>
            </TouchableOpacity>
          </HStack>

          <Box style={styles.body}>
            {chipKey === "category" ? (
              <TextInput
                style={styles.input}
                value={categoryText}
                onChangeText={setCategoryText}
                placeholder={t("trading.filter.category")}
                placeholderTextColor={theme.colors.placeholder}
                keyboardType="numeric"
              />
            ) : null}

            {chipKey === "size" ? (
              <HStack style={styles.chipGrid}>
                {SIZE_PRESETS.map((s) => {
                  const active = size === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setSize(active ? undefined : s)}
                      style={[styles.chip, active && styles.chipActive]}
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
            ) : null}

            {chipKey === "condition" ? (
              <HStack style={styles.chipGrid}>
                {CONDITION_OPTIONS.map((c) => {
                  const active = condition === c.value;
                  return (
                    <Pressable
                      key={c.value}
                      onPress={() =>
                        setCondition(active ? undefined : c.value)
                      }
                      style={[
                        styles.chip,
                        styles.conditionChip,
                        active && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
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
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.inputBorder,
      backgroundColor: t.colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      color: t.colors.text,
    },
    chipGrid: { flexWrap: "wrap", gap: 10 } as any,
    chip: {
      flex: 1,
      minWidth: 56,
      maxWidth: "20%",
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    conditionChip: {
      // 4 档成色文字更长，给更宽的内边距
      paddingHorizontal: 16,
      maxWidth: "23%",
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
      borderRadius: 28,
      alignItems: "center",
    },
    applyText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
  });

export default MarketplaceChipSheet;
