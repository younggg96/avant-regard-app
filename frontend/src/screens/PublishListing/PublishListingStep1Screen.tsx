import React, { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import {
  AnimatedChip,
  Box,
  chipRowStyle,
  Text,
  VStack,
  Pressable,
  Input,
} from "../../components/ui";
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
  makePublishListingFormStyles,
  PublishListingFieldRow,
  PublishListingFeeNotice,
  PublishListingTextArea,
} from "./publishListingFormShared";
import {
  COLOR_PRESETS,
  SIZE_STANDARDS,
  getColorDisplayText,
  type SizeStandardKey,
} from "./publishListingPresets";
import {
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_CONDITIONS,
} from "../../constants/marketplaceTaxonomy";

const PublishListingStep1Screen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(makeStyles);
  const theme = useAppTheme();
  const form = usePublishListingStore();
  const patch = usePublishListingStore((s) => s.patch);

  const [brandSheetVisible, setBrandSheetVisible] = useState(false);
  const [sizeStandard, setSizeStandard] = useState<SizeStandardKey>("womensCn");

  const conditionOptions = MARKETPLACE_CONDITIONS;

  const activeStandard = useMemo(
    () => SIZE_STANDARDS.find((s) => s.key === sizeStandard) ?? SIZE_STANDARDS[0],
    [sizeStandard]
  );

  const colorInputValue = useMemo(
    () => getColorDisplayText(form.color, t),
    [form.color, t]
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
              label={t("trading.filter.category")}
              required
            >
              <View style={chipRowStyle}>
                {MARKETPLACE_CATEGORIES.map((c) => (
                  <AnimatedChip
                    key={c.value}
                    label={t(c.labelKey)}
                    isActive={form.categoryName === c.value}
                    onPress={() => patch({ categoryName: c.value })}
                  />
                ))}
              </View>
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.styleName")}
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
              <VStack space="sm">
                <Text style={styles.subLabel}>
                  {t("trading.publishListing.fields.sizeStandard")}
                </Text>
                <View style={chipRowStyle}>
                  {SIZE_STANDARDS.map((std) => (
                    <AnimatedChip
                      key={std.key}
                      label={t(
                        `trading.publishListing.sizeStandards.${std.labelKey}`
                      )}
                      isActive={sizeStandard === std.key}
                      onPress={() => setSizeStandard(std.key)}
                    />
                  ))}
                </View>
                <View style={chipRowStyle}>
                  {activeStandard.options.map((opt) => (
                    <AnimatedChip
                      key={`${activeStandard.key}-${opt.value}-${opt.label}`}
                      label={opt.label}
                      isActive={form.size === opt.value}
                      onPress={() => patch({ size: opt.value })}
                    />
                  ))}
                </View>
                <Input
                  value={form.size}
                  onChangeText={(v) => patch({ size: v })}
                  placeholder={t("trading.publishListing.fields.sizePlaceholder")}
                  placeholderTextColor={theme.colors.gray400}
                  variant="underlined"
                  size="sm"
                />
              </VStack>
            </PublishListingFieldRow>

            <PublishListingFieldRow
              label={t("trading.publishListing.fields.color")}
              required
            >
              <VStack space="sm">
                <View style={chipRowStyle}>
                  {COLOR_PRESETS.map((c) => (
                    <AnimatedChip
                      key={c.value}
                      label={t(c.labelKey)}
                      isActive={form.color === c.value}
                      onPress={() => patch({ color: c.value })}
                    />
                  ))}
                </View>
                <Input
                  value={colorInputValue}
                  onChangeText={(v) => patch({ color: v })}
                  placeholder={t("trading.publishListing.fields.colorPlaceholder")}
                  placeholderTextColor={theme.colors.gray400}
                  variant="underlined"
                  size="sm"
                />
              </VStack>
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
                      <Text style={styles.optionTitle}>{t(opt.labelKey)}</Text>
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
    subLabel: {
      fontSize: 12,
      color: t.colors.gray500,
      marginBottom: 2,
    },
    ...makePublishListingFormStyles(t),
  });

export default PublishListingStep1Screen;
