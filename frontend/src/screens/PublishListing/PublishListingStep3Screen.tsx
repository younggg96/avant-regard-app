/**
 * PRD 单品发布 · Step 3 / 4：定价 + 描述。
 *
 * 变更说明:
 *   1. 「商品描述」与「成色补充说明」合并为单一「商品描述」, 减少重复填写.
 *   2. 暂时下线「平台参考区间」—— 早期成交数据不足时, 给出的区间反而会让卖家
 *      觉得"定低了"而焦虑; 待历史成交样本充足后再恢复。
 *   3. 价格栏改为「¥ 数字 + 右侧 元 单位」的紧凑布局, 下方仅保留预计到手。
 */
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  parsePriceInputToCents,
  PLATFORM_COMMISSION_BPS,
} from "../../services/storeProductService";
import { formatPriceDisplay } from "../../utils/currency";
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
  const form = usePublishListingStore();
  const patch = usePublishListingStore((s) => s.patch);

  const [priceInput, setPriceInput] = useState(
    form.priceCents ? centsToPriceInput(form.priceCents) : ""
  );
  const [tagsInput, setTagsInput] = useState(form.tags.join(", "));

  const priceCents = useMemo(
    () => parsePriceInputToCents(priceInput),
    [priceInput]
  );

  const expectedPayout = useMemo(
    () => calculateExpectedPayout(priceCents ?? 0, PLATFORM_COMMISSION_BPS),
    [priceCents]
  );

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
              <HStack alignItems="center" justifyContent="space-between">
                <HStack alignItems="baseline" space="xs" style={styles.priceInputRow}>
                  <Text style={styles.currencySymbol}>¥</Text>
                  <TextInput
                    style={styles.priceInput}
                    keyboardType="decimal-pad"
                    value={priceInput}
                    onChangeText={setPriceInput}
                    placeholder="0"
                    placeholderTextColor={theme.colors.placeholder}
                  />
                </HStack>
                <Text style={styles.priceUnit}>
                  {t("trading.publishListing.fields.priceUnit")}
                </Text>
              </HStack>

              {priceCents != null && priceCents > 0 && (
                <HStack
                  alignItems="center"
                  justifyContent="flex-end"
                  space="xs"
                  style={styles.payoutRow}
                >
                  <Text style={styles.payoutText}>
                    {t("trading.publishListing.pricing.expectedPayoutShort", {
                      price: formatPriceDisplay(expectedPayout, "CNY", "CNY"),
                    })}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      Alert.show(t("trading.publishListing.feeNotice"))
                    }
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={15}
                      color={theme.colors.gray400}
                    />
                  </Pressable>
                </HStack>
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
              hint={t("trading.publishListing.fields.descriptionHint")}
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
    priceInputRow: {
      flex: 1,
      paddingVertical: 8,
    },
    currencySymbol: {
      ...t.typography.bodySmall,
      color: t.colors.gray400,
    },
    priceInput: {
      flex: 1,
      ...t.typography.h4,
      color: t.colors.text,
      paddingVertical: 0,
      lineHeight: 22,
      ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
    },
    priceUnit: {
      ...t.typography.bodySmall,
      color: t.colors.gray400,
      marginLeft: 8,
    },
    payoutRow: { marginTop: 2 },
    payoutText: { fontSize: 13, color: t.colors.gray500 },
  });
};

export default PublishListingStep3Screen;
