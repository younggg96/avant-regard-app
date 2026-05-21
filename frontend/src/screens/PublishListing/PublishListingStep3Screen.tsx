/**
 * PRD 模块一 · Step 3：智能定价与描述。
 *
 * - 价格输入框大号字体（PRD 1.4 明确要求）。
 * - 实时计算参考价区间 + 抽佣后预计到手价。
 * - 「保存草稿」/「提交审核」两个 CTA。
 */
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  CommonActions,
  useFocusEffect,
} from "@react-navigation/native";

import { Box, HStack, Text, VStack } from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import { useThemedStyles, type AppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import {
  usePublishListingStore,
  validateForSubmit,
} from "../../store/publishListingStore";
import {
  calculateExpectedPayout,
  centsToPriceInput,
  createListing,
  formatPrice,
  parsePriceInputToCents,
  patchListing,
  submitListingForReview,
  suggestPriceRange,
  type ListingCreateBody,
  type ListingPatchBody,
} from "../../services/storeProductService";

const PublishListingStep3Screen: React.FC = () => {
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);
  const form = usePublishListingStore();
  const patch = usePublishListingStore((s) => s.patch);
  const setProductId = usePublishListingStore((s) => s.setProductId);

  const [priceInput, setPriceInput] = useState(
    form.priceCents ? centsToPriceInput(form.priceCents) : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const priceCents = useMemo(
    () => parsePriceInputToCents(priceInput),
    [priceInput]
  );

  const reference = useMemo(
    () => suggestPriceRange(form.brand, form.condition, priceCents ?? 0),
    [form.brand, form.condition, priceCents]
  );

  // 抽佣率：Phase 1 尚未接入 Plus 订阅，默认 8%。等 P6 接入后再读真实状态。
  const expectedPayout = useMemo(
    () => calculateExpectedPayout(priceCents ?? 0, false),
    [priceCents]
  );

  /** 把 form + Step 3 输入打包成 listing payload（不含 status，由调用方决定）。 */
  const buildPayload = () => {
    const payload: ListingPatchBody = {
      title: form.title.trim() || `${form.brand} ${form.condition ?? ""}`.trim(),
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
      priceCents: priceCents ?? 0,
      size: form.size,
      color: form.color,
      condition: form.condition ?? undefined,
      conditionNote: form.conditionNote,
      originalShowId: form.originalShowId,
      originalAcquiredAt: form.originalAcquiredAt,
      acceptOffer: form.acceptOffer,
      photoAngles: form.photoAngles,
    };
    return payload;
  };

  const ensureDraft = async (): Promise<number> => {
    if (form.productId) {
      await patchListing(form.productId, buildPayload());
      return form.productId;
    }
    const created = await createListing({
      ...(buildPayload() as ListingCreateBody),
      sellerKind: form.sellerKind,
      title: form.title.trim() || `${form.brand} ${form.condition ?? ""}`.trim(),
      priceCents: priceCents ?? 0,
    });
    setProductId(created.id);
    return created.id;
  };

  const handleSaveDraft = async () => {
    if (!priceCents) {
      Alert.show("请填写价格再保存");
      return;
    }
    setSavingDraft(true);
    try {
      await ensureDraft();
      Alert.show("草稿已保存");
      // 直接退回卖家库存
      navigation.dispatch(CommonActions.goBack());
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    // 同步当前 priceCents / 描述 / conditionNote 到 store
    patch({
      priceCents: priceCents,
    });
    const missing = validateForSubmit({
      ...form,
      priceCents: priceCents,
    });
    if (missing.length > 0) {
      Alert.show(`请完成：${missing.join(", ")}`);
      return;
    }
    setSubmitting(true);
    try {
      const productId = await ensureDraft();
      const result = await submitListingForReview(productId);
      Alert.show(
        result.status === "active"
          ? "已自动通过审核并上架"
          : "已提交审核，请等待管理员通过"
      );
      // @ts-expect-error - navigation types
      navigation.navigate("SellerListings");
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="发布单品 · 定价" showBack />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>3 / 3 · 定价与描述</Text>

          {/* 大号字体价格输入 — PRD 1.4 明确要求 */}
          <VStack space="xs" style={styles.priceBlock}>
            <Text style={styles.fieldLabel}>售价</Text>
            <HStack alignItems="baseline" space="sm">
              <Text style={styles.currencyBig}>¥</Text>
              <TextInput
                style={styles.priceInput}
                keyboardType="decimal-pad"
                value={priceInput}
                onChangeText={setPriceInput}
                placeholder="0"
                placeholderTextColor="#9999"
              />
            </HStack>

            {reference.high > 0 && (
              <Text style={styles.referenceText}>
                参考区间 {formatPrice(reference.low)} ~ {formatPrice(reference.high)}
              </Text>
            )}
            {priceCents != null && priceCents > 0 && (
              <Text style={styles.payoutText}>
                预计到手 {formatPrice(expectedPayout)} · 抽佣 8%
              </Text>
            )}
          </VStack>

          <VStack style={styles.fieldRow} space="xs">
            <Text style={styles.fieldLabel}>是否接受议价</Text>
            <HStack alignItems="center" justifyContent="space-between">
              <Text style={styles.hintInline}>
                关闭后将不接收买家 Offer
              </Text>
              <Switch
                value={form.acceptOffer}
                onValueChange={(v) => patch({ acceptOffer: v })}
              />
            </HStack>
          </VStack>

          <VStack style={styles.fieldRow} space="xs">
            <Text style={styles.fieldLabel}>标题</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(v) => patch({ title: v })}
              placeholder={`${form.brand || "品牌"} ${form.size} ${form.color}`}
              placeholderTextColor="#9999"
            />
          </VStack>

          <VStack style={styles.fieldRow} space="xs">
            <Text style={styles.fieldLabel}>详情描述</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.description}
              onChangeText={(v) => patch({ description: v })}
              placeholder="尺寸、版型、瑕疵描述、配件等"
              placeholderTextColor="#9999"
              multiline
            />
          </VStack>

          <VStack style={styles.fieldRow} space="xs">
            <Text style={styles.fieldLabel}>
              成色说明 * <Text style={styles.hintInline}>PRD 1.3：即使无瑕疵也需填写</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.conditionNote}
              onChangeText={(v) => patch({ conditionNote: v })}
              placeholder="如：袖口轻微起球；其它部位均无明显使用痕迹"
              placeholderTextColor="#9999"
              multiline
            />
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
              <Text style={styles.draftButtonText}>保存草稿</Text>
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
              <Text style={styles.submitButtonText}>提交审核</Text>
            )}
          </TouchableOpacity>
        </HStack>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    scroll: { padding: 16, paddingBottom: 32 },
    sectionTitle: {
      fontSize: 13,
      color: t.colors.textSecondary,
      letterSpacing: 1,
      marginBottom: 16,
    },
    priceBlock: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: t.colors.surface,
      marginBottom: 18,
    },
    currencyBig: { fontSize: 28, color: t.colors.textSecondary, fontWeight: "500" },
    priceInput: {
      fontSize: 42,
      fontWeight: "700",
      color: t.colors.text,
      minWidth: 160,
      paddingVertical: 4,
    },
    referenceText: { fontSize: 13, color: t.colors.textSecondary, marginTop: 6 },
    payoutText: { fontSize: 13, color: t.colors.accent, marginTop: 2 },
    fieldRow: { marginBottom: 18 },
    fieldLabel: { fontSize: 13, color: t.colors.textSecondary },
    hintInline: { fontSize: 12, color: t.colors.textSecondary },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: t.colors.text,
    },
    textArea: { minHeight: 88, textAlignVertical: "top" },
    footer: {
      padding: 16,
      paddingBottom: Platform.OS === "ios" ? 32 : 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    draftButton: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: "center",
    },
    draftButtonText: { color: t.colors.text, fontSize: 15 },
    submitButton: {
      flex: 1,
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: "center",
    },
    submitButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  });

export default PublishListingStep3Screen;
