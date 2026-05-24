/**
 * PRD 单品发布 · Step 3 / 4：智能定价 + 描述。
 *
 * 关键点：
 *   - 价格输入框走大号字体（保持原 PRD 1.4 视觉）。
 *   - 参考区间从后端 GET /api/marketplace/brand-price-range 拉取（按品牌 + 成色）。
 *     拉不到样本时降级到 client 端 suggestPriceRange()。
 *   - 抽佣固定 1%，与 store_products.commission_rate_bps 默认值一致。
 *   - 描述、标签、是否议价、瑕疵说明全部在这一步收集。
 *   - 下一步进入 Step 4（物流）；Step 4 才提交审核。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { Box, HStack, Text, VStack, Pressable } from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import WizardStepper from "../../components/WizardStepper";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import {
  usePublishListingStore,
  validateStep3,
  TOTAL_PUBLISH_STEPS,
} from "../../store/publishListingStore";
import {
  calculateExpectedPayout,
  centsToPriceInput,
  formatPrice,
  getBrandPriceRange,
  parsePriceInputToCents,
  PLATFORM_COMMISSION_BPS,
  suggestPriceRange,
  type BrandPriceRange,
} from "../../services/storeProductService";
import { FeeNotice } from "./PublishListingStep1Screen";

const PublishListingStep3Screen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(makeStyles);
  const theme = useAppTheme();
  const form = usePublishListingStore();
  const patch = usePublishListingStore((s) => s.patch);

  const [priceInput, setPriceInput] = useState(
    form.priceCents ? centsToPriceInput(form.priceCents) : ""
  );
  const [tagsInput, setTagsInput] = useState(form.tags.join(", "));
  const [brandRange, setBrandRange] = useState<BrandPriceRange | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);

  const priceCents = useMemo(
    () => parsePriceInputToCents(priceInput),
    [priceInput]
  );

  // 服务端历史价格区间 —— 防抖：依赖 brand + condition 变化
  useEffect(() => {
    if (!form.brand.trim()) {
      setBrandRange(null);
      return;
    }
    setRangeLoading(true);
    let cancelled = false;
    getBrandPriceRange(form.brand, form.condition || undefined)
      .then((r) => {
        if (!cancelled) setBrandRange(r);
      })
      .catch(() => {
        if (!cancelled) setBrandRange(null);
      })
      .finally(() => {
        if (!cancelled) setRangeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.brand, form.condition]);

  // 选择参考区间的展示：优先服务端 history；否则按输入价 + condition 客户端兜底
  const fallbackRange = useMemo(
    () => suggestPriceRange(form.brand, form.condition, priceCents ?? 0),
    [form.brand, form.condition, priceCents]
  );

  const displayRange = useMemo(() => {
    if (brandRange && brandRange.source === "history" && brandRange.sampleSize >= 3) {
      return {
        low: brandRange.lowCents,
        high: brandRange.highCents,
        median: brandRange.medianCents,
        source: "history" as const,
        sample: brandRange.sampleSize,
      };
    }
    return {
      low: fallbackRange.low,
      high: fallbackRange.high,
      median: 0,
      source: "fallback" as const,
      sample: 0,
    };
  }, [brandRange, fallbackRange]);

  const expectedPayout = useMemo(
    () => calculateExpectedPayout(priceCents ?? 0, PLATFORM_COMMISSION_BPS),
    [priceCents]
  );

  const handleApplyMedian = useCallback(() => {
    if (!brandRange || brandRange.medianCents <= 0) return;
    setPriceInput(centsToPriceInput(brandRange.medianCents));
  }, [brandRange]);

  const handleNext = () => {
    if (priceCents != null) patch({ priceCents });
    if (tagsInput) {
      patch({
        tags: tagsInput
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 8),
      });
    }
    const missing = validateStep3({ ...form, priceCents });
    if (missing.length > 0) {
      Alert.show(t("trading.publishListing.fillRequired"));
      return;
    }
    navigation.navigate("PublishListingStep4");
  };

  const stepLabels = useMemo(
    () => [
      t("trading.publishListing.steps.basics"),
      t("trading.publishListing.steps.photos"),
      t("trading.publishListing.steps.pricing"),
      t("trading.publishListing.steps.logistics"),
    ],
    [t]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={t("trading.publishListing.title")} showBack />
      <WizardStepper
        total={TOTAL_PUBLISH_STEPS}
        current={3}
        labels={stepLabels}
        onJumpTo={(s) => {
          if (s === 1) navigation.navigate("PublishListingStep1");
          else if (s === 2) navigation.navigate("PublishListingStep2");
        }}
      />
      <FeeNotice />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <VStack style={styles.priceBlock} space="xs">
            <Text style={styles.fieldLabel}>
              {t("trading.publishListing.fields.price")} *
            </Text>
            <HStack alignItems="baseline" space="sm">
              <Text style={styles.currencyBig}>¥</Text>
              <TextInput
                style={styles.priceInput}
                keyboardType="decimal-pad"
                value={priceInput}
                onChangeText={setPriceInput}
                placeholder="0"
                placeholderTextColor={theme.colors.placeholder}
              />
            </HStack>

            {displayRange.low > 0 && (
              <VStack space="xs" style={styles.rangeBlock}>
                <Text style={styles.rangeText}>
                  {displayRange.source === "history"
                    ? t("trading.publishListing.pricing.referenceHistory", {
                        low: formatPrice(displayRange.low),
                        high: formatPrice(displayRange.high),
                        sample: displayRange.sample,
                      })
                    : t("trading.publishListing.pricing.referenceFallback", {
                        low: formatPrice(displayRange.low),
                        high: formatPrice(displayRange.high),
                      })}
                </Text>
                {displayRange.source === "history" && displayRange.median > 0 && (
                  <HStack alignItems="center" space="sm">
                    <Text style={styles.rangeMedian}>
                      {t("trading.publishListing.pricing.median", {
                        price: formatPrice(displayRange.median),
                      })}
                    </Text>
                    <Pressable
                      onPress={handleApplyMedian}
                      style={styles.applyBtn}
                    >
                      <Text style={styles.applyBtnText}>
                        {t("trading.publishListing.pricing.applyMedian")}
                      </Text>
                    </Pressable>
                  </HStack>
                )}
              </VStack>
            )}

            {rangeLoading && !displayRange.low && (
              <Text style={styles.rangeLoading}>
                {t("trading.publishListing.pricing.referenceLoading")}
              </Text>
            )}

            {priceCents != null && priceCents > 0 && (
              <Text style={styles.payoutText}>
                {t("trading.publishListing.pricing.expectedPayout", {
                  price: formatPrice(expectedPayout),
                  fee: "1%",
                })}
              </Text>
            )}
          </VStack>

          {/* Title */}
          <VStack style={styles.fieldRow} space="xs">
            <Text style={styles.fieldLabel}>
              {t("trading.publishListing.fields.titleField")} *
            </Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(v) => patch({ title: v })}
              placeholder={`${form.brand || ""} ${form.styleName || ""}`.trim() ||
                t("trading.publishListing.fields.titlePlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              maxLength={80}
            />
          </VStack>

          {/* Description */}
          <VStack style={styles.fieldRow} space="xs">
            <Text style={styles.fieldLabel}>
              {t("trading.publishListing.fields.description")} *
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.description}
              onChangeText={(v) => patch({ description: v })}
              placeholder={t(
                "trading.publishListing.fields.descriptionPlaceholder"
              )}
              placeholderTextColor={theme.colors.placeholder}
              multiline
              maxLength={1000}
            />
          </VStack>

          {/* Condition note */}
          <VStack style={styles.fieldRow} space="xs">
            <Text style={styles.fieldLabel}>
              {t("trading.publishListing.fields.conditionNote")} *
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.conditionNote}
              onChangeText={(v) => patch({ conditionNote: v })}
              placeholder={t(
                "trading.publishListing.fields.conditionNotePlaceholder"
              )}
              placeholderTextColor={theme.colors.placeholder}
              multiline
            />
            <Text style={styles.fieldHint}>
              {t("trading.publishListing.fields.conditionNoteHint")}
            </Text>
          </VStack>

          {/* Tags */}
          <VStack style={styles.fieldRow} space="xs">
            <Text style={styles.fieldLabel}>
              {t("trading.publishListing.fields.tags")}
            </Text>
            <TextInput
              style={styles.input}
              value={tagsInput}
              onChangeText={setTagsInput}
              placeholder={t("trading.publishListing.fields.tagsPlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
            />
            <Text style={styles.fieldHint}>
              {t("trading.publishListing.fields.tagsHint")}
            </Text>
          </VStack>

          {/* Accept offer */}
          <VStack style={styles.fieldRow} space="xs">
            <Text style={styles.fieldLabel}>
              {t("trading.publishListing.fields.acceptOffer")}
            </Text>
            <HStack alignItems="center" justifyContent="space-between">
              <Text style={styles.hintInline}>
                {t("trading.publishListing.fields.acceptOfferHint")}
              </Text>
              <Switch
                value={form.acceptOffer}
                onValueChange={(v) => patch({ acceptOffer: v })}
              />
            </HStack>
          </VStack>
        </ScrollView>

        <Box style={styles.footer}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>
              {t("trading.publishListing.nextToLogistics")}
            </Text>
          </TouchableOpacity>
        </Box>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    scroll: { padding: 16, paddingBottom: 32 },
    priceBlock: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.surface,
      marginBottom: 18,
    },
    currencyBig: { fontSize: 26, color: t.colors.textSecondary, fontWeight: "500" },
    priceInput: {
      fontSize: 38,
      fontWeight: "700",
      color: t.colors.text,
      minWidth: 160,
      paddingVertical: 4,
    },
    rangeBlock: {
      marginTop: 6,
    },
    rangeText: { fontSize: 13, color: t.colors.textSecondary },
    rangeMedian: { fontSize: 12, color: t.colors.textSecondary },
    rangeLoading: { fontSize: 12, color: t.colors.textSecondary, marginTop: 6 },
    applyBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: t.borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    applyBtnText: {
      fontSize: 11,
      color: t.colors.text,
      fontWeight: "600",
    },
    payoutText: { fontSize: 13, color: t.colors.accent, marginTop: 4 },
    fieldRow: { marginBottom: 18 },
    fieldLabel: { fontSize: 13, color: t.colors.textSecondary },
    fieldHint: { fontSize: 11, color: t.colors.textSecondary, marginTop: 4 },
    hintInline: { fontSize: 12, color: t.colors.textSecondary },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: t.borderRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
    },
    textArea: { minHeight: 88, textAlignVertical: "top" },
    footer: {
      padding: 16,
      paddingBottom: Platform.OS === "ios" ? 28 : 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    nextButton: {
      flex: 1,
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
    },
    nextButtonText: { color: t.colors.textInverted, fontSize: 15, fontWeight: "600" },
  });

export default PublishListingStep3Screen;
