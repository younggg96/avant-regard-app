/**
 * PRD 单品发布 · Step 4 / 4：物流与其他。
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { Box, HStack, Text, VStack, Pressable, Input } from "../../components/ui";
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
import { ApiError } from "../../services/http";
import { showService } from "../../services/showService";
import {
  makePublishListingFormStyles,
  PublishListingFeeNotice,
  PublishListingFieldRow,
} from "./publishListingFormShared";

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
          // shows.id 是字符串 slug, 不能转 Number (会变 NaN → 提交触发外键违规)。
          show_id: s.id != null ? String(s.id) : undefined,
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
    title:
      form.title.trim() ||
      `${form.brand} ${form.styleName || ""}`.trim() ||
      form.brand,
    description: form.description,
    brand: form.brand,
    categoryId: form.categoryId,
    // PRD 1.3 7 视角图 + extras: 顺序固定, 让首图(列表卡片封面)始终是正面.
    // photoAngles 字段本身也透传一份, 让详情页能区分"哪张是领标背面"等。
    images: [
      form.photoAngles.front,
      form.photoAngles.back,
      form.photoAngles.wash_label,
      form.photoAngles.wash_label_back,
      form.photoAngles.brand_label,
      form.photoAngles.brand_label_back,
      form.photoAngles.flaw,
      ...(form.photoAngles.extras ?? []),
    ].filter(Boolean) as string[],
    priceCents: form.priceCents ?? 0,
    size: form.size,
    color: form.color,
    condition: form.condition ?? undefined,
    conditionNote: form.conditionNote,
    originalShowId: form.originalShowId ?? null,
    originalAcquiredAt: form.originalAcquiredAt,
    acceptOffer: form.acceptOffer,
    photoAngles: form.photoAngles,
    tags: form.tags,
    styleName: form.styleName || null,
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
      // 后端在个人卖家未实名时返回 403,引导用户先去完成实名认证再上架。
      if (e instanceof ApiError && e.status === 403) {
        Alert.alert(t("trading.publishListing.needKyc"), "", [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("trading.publishListing.goKyc"),
            onPress: () => navigation.navigate("KycVerification"),
          },
        ]);
        return;
      }
      Alert.show(
        e instanceof Error ? e.message : t("trading.publishListing.submitFailed")
      );
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
            <PublishListingFieldRow
              label={t("trading.publishListing.fields.originalAcquiredAt")}
            >
              <Input
                value={form.originalAcquiredAt ?? ""}
                onChangeText={(v) =>
                  patch({ originalAcquiredAt: v.trim() || null })
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.gray400}
                variant="underlined"
                size="sm"
                autoCorrect={false}
              />
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.originalShow")}
            >
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
                  color={theme.colors.gray400}
                />
              </Pressable>
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.shipFrom")}
              required
              hint={t("trading.publishListing.fields.shipFromHint")}
            >
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
                  color={theme.colors.gray400}
                />
              </Pressable>
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.shippingFeeMode")}
              required
            >
              <HStack space="sm">
                {(["cod", "free"] as const).map((mode) => {
                  const active = form.shippingFeeMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => patch({ shippingFeeMode: mode })}
                      style={[styles.modeChip, active && styles.modeChipActive]}
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
            </PublishListingFieldRow>
          </VStack>
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
              <ActivityIndicator color={theme.colors.white} />
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
            .filter(
              (part) =>
                part !== null && part !== undefined && part !== "" && part !== 0
            )
            .join(" ");
          patch({
            originalShowId:
              show.show_id != null ? String(show.show_id) : null,
            originalShowLabel: label || show.title || null,
          });
          setShowSheetVisible(false);
        }}
        onClose={() => setShowSheetVisible(false)}
      />
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) => {
  const shared = makePublishListingFormStyles(t);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    scroll: shared.scroll,
    selectorRow: shared.selectorRow,
    selectorText: shared.selectorText,
    placeholderText: shared.placeholderText,
    modeChip: shared.modeChip,
    modeChipActive: shared.modeChipActive,
    modeChipTitle: shared.modeChipTitle,
    modeChipTitleActive: shared.modeChipTitleActive,
    modeChipSub: shared.modeChipSub,
    modeChipSubActive: shared.modeChipSubActive,
    footer: shared.footer,
    draftButton: shared.draftButton,
    draftButtonText: shared.draftButtonText,
    submitButton: shared.submitButton,
    submitButtonText: shared.submitButtonText,
  });
};

export default PublishListingStep4Screen;
