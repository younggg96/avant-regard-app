/**
 * PRD 单品发布 · Step 1 / 4：基本信息。
 *
 * 字段:
 *   - 品牌 (搜索选择, 找不到可联系小客服)
 *   - 款式 / 系列 (选填)
 *   - 尺码 (按"体系"分组的快捷 chip + 自定义输入)
 *   - 颜色 (预设色板 chip + 自定义输入)
 *   - 成色 (4 档, 描述精简化避免"几新"主观分歧)
 *   - 配件说明 (选填)
 *
 * 设计变更说明 (重要):
 *   1. 移除「出售身份」选择: sellerKind 不再让卖家手选, 默认走 individual.
 *      个人 / 买手在身份资料里就已区分, 这里再放一次只会让流程变重.
 *   2. 颜色 / 尺码改成"先选预设, 再可自定义". 旧版完全自由输入导致
 *      "雾霾蓝/做旧靛蓝" 这种诗意文案大量入库, 后台筛选 / 推荐无法对齐.
 *   3. 成色文案改成动作描述 (全新/试穿/日常/磨损), 不再用 "99新/95新/8成新"
 *      —— 不同人对几新的定义差异巨大, 改成行为描述能显著降低交易纠纷.
 *      enum 值仍复用 BNWT / NEW_99 / USED_8 / FLAW (后端不变),
 *      只是 UI 上不再暴露 NEW_95 这种容易争议的中间档.
 *   4. 移除「年代」字段: 多数卖家无法准确判断衣物年份, 强制 / 选填都会污染
 *      数据, 产品决定完全删除该字段 (前后端 schema 同步移除).
 */
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

  // 4 档成色（全新 / 几乎全新 / 轻微使用 / 明显使用）与分类选项均取自共享 taxonomy，
  // 与筛选（MarketplaceFilterSheet）完全一致，保证发布的单品筛选时匹配得上。
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

            {/* 分类: PRD 6 大类, 与筛选一致, 决定该单品在交易大厅按分类筛选时能否命中. */}
            <PublishListingFieldRow
              label={t("trading.filter.category")}
              required
              hint={t("trading.publishListing.fields.categoryHint")}
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

            {/* 尺码: 先选体系 -> 选具体码 -> 仍可自定义输入. */}
            <PublishListingFieldRow
              label={t("trading.publishListing.fields.size")}
              required
              hint={t("trading.publishListing.fields.sizeHint")}
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

            {/* 颜色: 预设色板 chip + 自定义输入兜底 */}
            <PublishListingFieldRow
              label={t("trading.publishListing.fields.color")}
              required
              hint={t("trading.publishListing.fields.colorHint")}
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
                      <VStack>
                        <Text style={styles.optionTitle}>
                          {t(opt.labelKey)}
                        </Text>
                        <Text style={styles.optionSubtitle}>
                          {t(opt.subKey)}
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
