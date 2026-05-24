/**
 * PRD 单品发布 · Step 4 / 4：物流与其他。
 *
 * 字段：
 *   - 原入手时间（可选，YYYY-MM-DD）
 *   - 关联秀场（可选）
 *   - 发货地：国家 / 省 - 州 / 城市（三段式 RegionPicker）
 *   - 运费方式：到付 / 包邮
 *   - 保存草稿 / 提交审核（首次会校验所有 step）
 *
 * 提交时把 store 数据组装成 ListingCreate/Patch payload，逻辑沿用旧 Step3 的 ensureDraft。
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { Box, HStack, Text, VStack, Pressable } from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import WizardStepper from "../../components/WizardStepper";
import RegionPicker from "../../components/RegionPicker";
import ShowSelectorModal, {
  type Show as ShowSelectorItem,
} from "../../components/ShowSelectorModal";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import {
  usePublishListingStore,
  validateForSubmit,
  TOTAL_PUBLISH_STEPS,
} from "../../store/publishListingStore";
import {
  createListing,
  patchListing,
  submitListingForReview,
  type ListingCreateBody,
  type ListingPatchBody,
} from "../../services/storeProductService";
import { showService } from "../../services/showService";
import { FeeNotice } from "./PublishListingStep1Screen";

const PublishListingStep4Screen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(makeStyles);
  const theme = useAppTheme();
  const form = usePublishListingStore();
  const patch = usePublishListingStore((s) => s.patch);
  const setProductId = usePublishListingStore((s) => s.setProductId);

  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const [regionVisible, setRegionVisible] = useState(false);
  const [showSheetVisible, setShowSheetVisible] = useState(false);
  const [showQuery, setShowQuery] = useState("");
  const [showResults, setShowResults] = useState<ShowSelectorItem[]>([]);
  const [showLoading, setShowLoading] = useState(false);

  const searchShowsHandler = useCallback(async () => {
    if (!showQuery.trim()) {
      setShowResults([]);
      return;
    }
    setShowLoading(true);
    try {
      const list = await showService.searchShows(showQuery.trim(), 50);
      setShowResults(
        (list || []).map((s) => ({
          brand: s.brand || "",
          season: s.season,
          title: s.title || s.brand || "",
          cover_image: s.coverImage || "",
          show_url: s.showUrl || "",
          year: s.year || 0,
          category: s.category || "",
          show_id: typeof s.id === "string" ? Number(s.id) : s.id,
        }))
      );
    } catch {
      setShowResults([]);
    } finally {
      setShowLoading(false);
    }
  }, [showQuery]);

  const regionLabel = useMemo(() => {
    const parts = [form.shipFromCountry, form.shipFromState, form.shipFromCity]
      .filter(Boolean)
      .join(" · ");
    return parts || t("trading.publishListing.logistics.regionPlaceholder");
  }, [form.shipFromCountry, form.shipFromState, form.shipFromCity, t]);

  const stepLabels = useMemo(
    () => [
      t("trading.publishListing.steps.basics"),
      t("trading.publishListing.steps.photos"),
      t("trading.publishListing.steps.pricing"),
      t("trading.publishListing.steps.logistics"),
    ],
    [t]
  );

  const buildPayload = (): ListingPatchBody => ({
    title: form.title.trim() ||
      `${form.brand} ${form.styleName || ""}`.trim() ||
      form.brand,
    description: form.description,
    brand: form.brand,
    categoryId: form.categoryId,
    images: ([
      form.photoAngles.front,
      form.photoAngles.back,
      form.photoAngles.wash_label,
      form.photoAngles.brand_label,
      form.photoAngles.flaw,
      ...(form.photoAngles.extras ?? []),
    ].filter(Boolean) as string[]),
    priceCents: form.priceCents ?? 0,
    size: form.size,
    color: form.color,
    condition: form.condition ?? undefined,
    conditionNote: form.conditionNote,
    originalShowId: form.originalShowId != null ? String(form.originalShowId) : null,
    originalAcquiredAt: form.originalAcquiredAt,
    acceptOffer: form.acceptOffer,
    photoAngles: form.photoAngles,
    tags: form.tags,
    // PRD 单品 Phase 2
    styleName: form.styleName || null,
    yearDecade: form.yearDecade,
    accessoriesNote: form.accessoriesNote || null,
    shipFromCountry: form.shipFromCountry,
    shipFromState: form.shipFromState,
    shipFromCity: form.shipFromCity,
    shippingFeeMode: form.shippingFeeMode,
  });

  const ensureDraft = async (): Promise<number> => {
    if (form.productId) {
      await patchListing(form.productId, buildPayload());
      return form.productId;
    }
    const created = await createListing({
      ...(buildPayload() as ListingCreateBody),
      sellerKind: form.sellerKind,
      title: buildPayload().title || form.brand,
      priceCents: form.priceCents ?? 0,
    });
    setProductId(created.id);
    return created.id;
  };

  const handleSaveDraft = async () => {
    if (!form.priceCents || form.priceCents <= 0) {
      Alert.show(t("trading.publishListing.draftRequiresPrice"));
      return;
    }
    setSavingDraft(true);
    try {
      await ensureDraft();
      Alert.show(t("trading.publishListing.draftSaved"));
      navigation.navigate("SellerListings");
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : t("common.saveFailed"));
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    const missing = validateForSubmit(form);
    if (missing.length > 0) {
      Alert.show(
        `${t("trading.publishListing.missingFields")}\n${missing.join(", ")}`
      );
      return;
    }
    setSubmitting(true);
    try {
      const productId = await ensureDraft();
      const result = await submitListingForReview(productId);
      Alert.show(
        result.status === "active"
          ? t("trading.publishListing.submitAutoApproved")
          : t("trading.publishListing.submitPendingReview")
      );
      navigation.navigate("SellerListings");
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : t("trading.publishListing.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={t("trading.publishListing.title")} showBack />
      <WizardStepper
        total={TOTAL_PUBLISH_STEPS}
        current={4}
        labels={stepLabels}
        onJumpTo={(s) => {
          if (s === 1) navigation.navigate("PublishListingStep1");
          else if (s === 2) navigation.navigate("PublishListingStep2");
          else if (s === 3) navigation.navigate("PublishListingStep3");
        }}
      />
      <FeeNotice />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Acquired date */}
          <VStack style={styles.fieldRow} space="xs">
            <Text style={styles.fieldLabel}>
              {t("trading.publishListing.fields.originalAcquiredAt")}
            </Text>
            <TextInput
              style={styles.input}
              value={form.originalAcquiredAt ?? ""}
              onChangeText={(v) => patch({ originalAcquiredAt: v.trim() || null })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.placeholder}
              autoCorrect={false}
            />
          </VStack>

          {/* Original show */}
          <VStack style={styles.fieldRow} space="xs">
            <Text style={styles.fieldLabel}>
              {t("trading.publishListing.fields.originalShow")}
            </Text>
            <Pressable
              onPress={() => setShowSheetVisible(true)}
              style={styles.selectorRow}
            >
              <Text
                style={[
                  styles.selectorText,
                  !form.originalShowLabel && styles.placeholderText,
                ]}
              >
                {form.originalShowLabel ||
                  t("trading.publishListing.fields.originalShowPlaceholder")}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          </VStack>

          {/* Ship-from region */}
          <VStack style={styles.fieldRow} space="xs">
            <Text style={styles.fieldLabel}>
              {t("trading.publishListing.fields.shipFrom")} *
            </Text>
            <Pressable
              onPress={() => setRegionVisible(true)}
              style={styles.selectorRow}
            >
              <Text
                style={[
                  styles.selectorText,
                  (!form.shipFromCountry || !form.shipFromState) &&
                    styles.placeholderText,
                ]}
              >
                {regionLabel}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.textSecondary}
              />
            </Pressable>
            <Text style={styles.fieldHint}>
              {t("trading.publishListing.fields.shipFromHint")}
            </Text>
          </VStack>

          {/* Shipping fee mode */}
          <VStack style={styles.fieldRow} space="xs">
            <Text style={styles.fieldLabel}>
              {t("trading.publishListing.fields.shippingFeeMode")} *
            </Text>
            <HStack space="sm">
              {(["cod", "free"] as const).map((mode) => {
                const active = form.shippingFeeMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => patch({ shippingFeeMode: mode })}
                    style={[
                      styles.modeChip,
                      active && styles.modeChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeChipTitle,
                        active && styles.modeChipTitleActive,
                      ]}
                    >
                      {t(
                        mode === "cod"
                          ? "trading.publishListing.fields.shippingCod"
                          : "trading.publishListing.fields.shippingFree"
                      )}
                    </Text>
                    <Text
                      style={[
                        styles.modeChipSub,
                        active && styles.modeChipSubActive,
                      ]}
                    >
                      {t(
                        mode === "cod"
                          ? "trading.publishListing.fields.shippingCodSub"
                          : "trading.publishListing.fields.shippingFreeSub"
                      )}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </VStack>

          <Box style={{ height: 24 }} />
        </ScrollView>

        <HStack style={styles.footer} space="sm">
          <TouchableOpacity
            style={[styles.draftButton, savingDraft && { opacity: 0.6 }]}
            onPress={handleSaveDraft}
            activeOpacity={0.8}
            disabled={savingDraft || submitting}
          >
            {savingDraft ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.draftButtonText}>
                {t("trading.publishListing.saveDraft")}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={submitting || savingDraft}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {t("trading.publishListing.submitForReview")}
              </Text>
            )}
          </TouchableOpacity>
        </HStack>
      </KeyboardAvoidingView>

      <RegionPicker
        visible={regionVisible}
        value={{
          country: form.shipFromCountry,
          state: form.shipFromState,
          city: form.shipFromCity,
        }}
        onClose={() => setRegionVisible(false)}
        onChange={(r) =>
          patch({
            shipFromCountry: r.country,
            shipFromState: r.state,
            shipFromCity: r.city,
          })
        }
      />

      <ShowSelectorModal
        visible={showSheetVisible}
        shows={showResults}
        searchQuery={showQuery}
        isLoading={showLoading}
        onSearchChange={setShowQuery}
        onSearch={searchShowsHandler}
        onSelectShow={(show: ShowSelectorItem) => {
          const label = [show.brand, show.season, show.year]
            .filter((part) => part !== null && part !== undefined && part !== "" && part !== 0)
            .join(" ");
          patch({
            originalShowId: show.show_id ?? null,
            originalShowLabel: label || show.title || null,
          });
          setShowSheetVisible(false);
        }}
        onClose={() => setShowSheetVisible(false)}
      />
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    scroll: { padding: 16, paddingBottom: 32 },
    fieldRow: { marginBottom: 18 },
    fieldLabel: { fontSize: 13, color: t.colors.textSecondary, marginBottom: 6 },
    fieldHint: { fontSize: 11, color: t.colors.textSecondary, marginTop: 4 },
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
    selectorRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: t.borderRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: t.colors.inputBackground,
    },
    selectorText: { fontSize: 15, color: t.colors.text },
    placeholderText: { color: t.colors.placeholder },
    modeChip: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: t.borderRadius.sm,
      padding: 12,
    },
    modeChipActive: {
      borderColor: t.colors.accent,
      backgroundColor: `${t.colors.accent}0F`,
    },
    modeChipTitle: { fontSize: 14, color: t.colors.text, fontWeight: "600" },
    modeChipTitleActive: { color: t.colors.text },
    modeChipSub: {
      fontSize: 11,
      color: t.colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    modeChipSubActive: { color: t.colors.text },
    footer: {
      padding: 16,
      paddingBottom: Platform.OS === "ios" ? 28 : 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    draftButton: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      paddingVertical: 14,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
    },
    draftButtonText: { color: t.colors.text, fontSize: 15 },
    submitButton: {
      flex: 1,
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
    },
    submitButtonText: { color: t.colors.textInverted, fontSize: 15, fontWeight: "600" },
  });

export default PublishListingStep4Screen;
