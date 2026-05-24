/**
 * PRD 单品发布 · Step 1 / 4：基本信息。
 *
 * 字段：
 *   - 卖家身份（个人 / 买手店）
 *   - 品牌（搜索选择，找不到可联系小客服）
 *   - 单品类型 / 款式（系列名）
 *   - 尺码、颜色（颜色支持自由填写）
 *   - 成色（5 档）
 *   - 年代（1950s ~ 2020s）
 *   - 配件说明（可选）
 *
 * 沿用主题化样式；全部 borderRadius=4；i18n key 在 trading.publishListing.* 下。
 */
import React, { useCallback, useMemo, useState } from "react";
import {
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
import BrandSearchSheet from "../../components/BrandSearchSheet";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import {
  usePublishListingStore,
  validateStep1,
  TOTAL_PUBLISH_STEPS,
} from "../../store/publishListingStore";
import type { Brand } from "../../services/brandService";
import {
  YEAR_DECADE_OPTIONS,
  type ProductCondition,
  type SellerKind,
  type YearDecade,
} from "../../services/storeProductService";
import {
  makePublishListingFormStyles,
  PublishListingFieldRow,
  PublishListingFeeNotice,
  PublishListingTextArea,
} from "./publishListingFormShared";

const PublishListingStep1Screen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(makeStyles);
  const theme = useAppTheme();
  const form = usePublishListingStore();
  const patch = usePublishListingStore((s) => s.patch);

  const [brandSheetVisible, setBrandSheetVisible] = useState(false);

  const conditionOptions = useMemo<
    Array<{ value: ProductCondition; labelKey: string; subKey: string }>
  >(
    () => [
      { value: "BNWT",   labelKey: "conditionBnwt",   subKey: "conditionBnwtSub" },
      { value: "NEW_99", labelKey: "conditionNew99",  subKey: "conditionNew99Sub" },
      { value: "NEW_95", labelKey: "conditionNew95",  subKey: "conditionNew95Sub" },
      { value: "USED_8", labelKey: "conditionUsed8",  subKey: "conditionUsed8Sub" },
      { value: "FLAW",   labelKey: "conditionFlaw",   subKey: "conditionFlawSub" },
    ],
    []
  );

  const canContinue = useMemo(() => validateStep1(form).length === 0, [form]);

  const handleNext = useCallback(() => {
    if (!canContinue) {
      Alert.show(t("trading.publishListing.fillRequired"));
      return;
    }
    navigation.navigate("PublishListingStep2");
  }, [canContinue, navigation, t]);

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
        current={1}
        labels={stepLabels}
      />
      {/* 1% 抽佣提醒 */}
      <PublishListingFeeNotice />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <VStack gap="$lg">
            <PublishListingFieldRow label={t("trading.publishListing.fields.sellerKind")}>
              <HStack space="sm">
                {(["individual", "merchant"] as SellerKind[]).map((k) => {
                  const active = form.sellerKind === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => patch({ sellerKind: k })}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {k === "individual"
                          ? t("trading.publishListing.fields.sellerIndividual")
                          : t("trading.publishListing.fields.sellerMerchant")}
                      </Text>
                    </Pressable>
                  );
                })}
              </HStack>
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.brand")}
              required
            >
              <Pressable
                onPress={() => setBrandSheetVisible(true)}
                style={styles.selectorRow}
              >
                <Text
                  style={[
                    styles.selectorText,
                    !form.brand && styles.placeholderText,
                  ]}
                >
                  {form.brand || t("trading.publishListing.fields.brandPlaceholder")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme.colors.gray400}
                />
              </Pressable>
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.styleName")}
              hint={t("trading.publishListing.fields.styleNameHint")}
            >
              <Input
                value={form.styleName}
                onChangeText={(v) => patch({ styleName: v })}
                placeholder={t("trading.publishListing.fields.styleNamePlaceholder")}
                placeholderTextColor={theme.colors.gray400}
                variant="underlined"
                size="sm"
              />
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.size")}
              required
            >
              <Input
                value={form.size}
                onChangeText={(v) => patch({ size: v })}
                placeholder={t("trading.publishListing.fields.sizePlaceholder")}
                placeholderTextColor={theme.colors.gray400}
                variant="underlined"
                size="sm"
              />
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.color")}
              required
              hint={t("trading.publishListing.fields.colorHint")}
            >
              <Input
                value={form.color}
                onChangeText={(v) => patch({ color: v })}
                placeholder={t("trading.publishListing.fields.colorPlaceholder")}
                placeholderTextColor={theme.colors.gray400}
                variant="underlined"
                size="sm"
              />
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.condition")}
              required
            >
              <VStack space="xs">
                {conditionOptions.map((opt) => {
                  const active = form.condition === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => patch({ condition: opt.value })}
                      style={[styles.optionRow, active && styles.optionRowActive]}
                    >
                      <VStack>
                        <Text style={styles.optionTitle}>
                          {t(`trading.publishListing.${opt.labelKey}`)}
                        </Text>
                        <Text style={styles.optionSubtitle}>
                          {t(`trading.publishListing.${opt.subKey}`)}
                        </Text>
                      </VStack>
                      {active ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={theme.colors.black}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </VStack>
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.yearDecade")}
              required
            >
              <HStack flexWrap="wrap" style={{ gap: 8 } as any}>
                {YEAR_DECADE_OPTIONS.map((d) => {
                  const active = form.yearDecade === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => patch({ yearDecade: d as YearDecade })}
                      style={[styles.smallChip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </HStack>
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.accessoriesNote")}
            >
              <PublishListingTextArea
                value={form.accessoriesNote}
                onChangeText={(v) => patch({ accessoriesNote: v })}
                placeholder={t("trading.publishListing.fields.accessoriesNotePlaceholder")}
                placeholderTextColor={theme.colors.placeholder}
              />
            </PublishListingFieldRow>
          </VStack>
        </ScrollView>

        <Box style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.nextButton,
              !canContinue && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            activeOpacity={0.8}
            disabled={!canContinue}
          >
            <Text style={styles.nextButtonText}>
              {t("trading.publishListing.nextToPhotos")}
            </Text>
          </TouchableOpacity>
        </Box>
      </KeyboardAvoidingView>

      <BrandSearchSheet
        visible={brandSheetVisible}
        onClose={() => setBrandSheetVisible(false)}
        onSelect={(b: Brand) => {
          patch({ brand: b.name, brandId: b.id });
          setBrandSheetVisible(false);
        }}
      />
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    ...makePublishListingFormStyles(t),
  });

export default PublishListingStep1Screen;
