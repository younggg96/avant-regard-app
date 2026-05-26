/**
 * PRD 单品发布 · Step 3 / 4：智能定价 + 描述。
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

import { Box, HStack, Text, VStack, Pressable, Input } from "../../components/ui";
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
  getBrandPriceRange,
  parsePriceInputToCents,
  PLATFORM_COMMISSION_BPS,
  suggestPriceRange,
  type BrandPriceRange,
} from "../../services/storeProductService";
import { useFormatPrice } from "../../utils/currency";
import {
  makePublishListingFormStyles,
  PublishListingFeeNotice,
  PublishListingFieldRow,
  PublishListingTextArea,
} from "./publishListingFormShared";

const PublishListingStep3Screen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(makeStyles);
  const theme = useAppTheme();
  const formatPrice = useFormatPrice();
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
      <PublishListingFeeNotice />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <VStack gap="$lg">
            <VStack style={styles.priceBlock} space="xs">
              <Text style={styles.fieldLabel}>
                {t("trading.publishListing.fields.price")}
                <Text style={{ color: theme.colors.error }}> *</Text>
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
                      <Pressable onPress={handleApplyMedian} style={styles.applyBtn}>
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

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.titleField")}
              required
            >
              <Input
                value={form.title}
                onChangeText={(v) => patch({ title: v })}
                placeholder={
                  `${form.brand || ""} ${form.styleName || ""}`.trim() ||
                  t("trading.publishListing.fields.titlePlaceholder")
                }
                placeholderTextColor={theme.colors.gray400}
                variant="underlined"
                size="sm"
                maxLength={80}
              />
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.description")}
              required
            >
              <PublishListingTextArea
                value={form.description}
                onChangeText={(v) => patch({ description: v })}
                placeholder={t("trading.publishListing.fields.descriptionPlaceholder")}
                placeholderTextColor={theme.colors.placeholder}
                maxLength={1000}
              />
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.conditionNote")}
              required
              hint={t("trading.publishListing.fields.conditionNoteHint")}
            >
              <PublishListingTextArea
                value={form.conditionNote}
                onChangeText={(v) => patch({ conditionNote: v })}
                placeholder={t("trading.publishListing.fields.conditionNotePlaceholder")}
                placeholderTextColor={theme.colors.placeholder}
              />
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.tags")}
              hint={t("trading.publishListing.fields.tagsHint")}
            >
              <Input
                value={tagsInput}
                onChangeText={setTagsInput}
                placeholder={t("trading.publishListing.fields.tagsPlaceholder")}
                placeholderTextColor={theme.colors.gray400}
                variant="underlined"
                size="sm"
              />
            </PublishListingFieldRow>

            <PublishListingFieldRow label={t("trading.publishListing.fields.acceptOffer")}>
              <HStack alignItems="center" justifyContent="space-between">
                <Text style={styles.fieldHint}>
                  {t("trading.publishListing.fields.acceptOfferHint")}
                </Text>
                <Switch
                  value={form.acceptOffer}
                  onValueChange={(v) => patch({ acceptOffer: v })}
                />
              </HStack>
            </PublishListingFieldRow>
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

const makeStyles = (t: AppTheme) => {
  const shared = makePublishListingFormStyles(t);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    scroll: shared.scroll,
    fieldLabel: shared.fieldLabel,
    fieldHint: shared.fieldHint,
    footer: shared.footer,
    nextButton: shared.nextButton,
    nextButtonText: shared.nextButtonText,
    priceBlock: {
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.inputBorder,
    },
    currencyBig: {
      fontSize: 22,
      color: t.colors.gray400,
      fontWeight: "500",
    },
    priceInput: {
      fontSize: 36,
      fontWeight: "700",
      color: t.colors.text,
      minWidth: 160,
      paddingVertical: 4,
    },
    rangeBlock: { marginTop: 6 },
    rangeText: { fontSize: 14, color: t.colors.gray400 },
    rangeMedian: { fontSize: 14, color: t.colors.gray400 },
    rangeLoading: { fontSize: 14, color: t.colors.gray400, marginTop: 6 },
    applyBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: t.borderRadius.sm,
      borderWidth: 1,
      borderColor: t.colors.gray200,
    },
    applyBtnText: {
      fontSize: 12,
      color: t.colors.text,
      fontWeight: "500",
    },
    payoutText: { fontSize: 14, color: t.colors.gray500, marginTop: 4 },
  });
};

export default PublishListingStep3Screen;
