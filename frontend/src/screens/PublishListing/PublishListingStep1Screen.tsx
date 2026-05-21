/**
 * PRD 模块一 · Step 1：单品属性录入。
 *
 * 字段：品牌 / 品类 / 尺码 / 颜色 / 5 档成色 / 关联秀场 / 原入手时间。
 * 这里只做轻量录入；上传图片与定价分别在 Step 2 / Step 3。
 */
import React, { useCallback, useMemo, useState } from "react";
import {
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

import { Box, HStack, Text, VStack, Pressable } from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import BrandSelectorModal from "../../components/BrandSelectorModal";
import ShowSelectorModal from "../../components/ShowSelectorModal";
import { useThemedStyles, type AppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import { searchBrands } from "../../services/brandService";
import { searchShows } from "../../services/showService";
import type { Brand } from "../../services/brandService";
import type { Show } from "../../services/showService";
import {
  usePublishListingStore,
  type ListingFormState,
} from "../../store/publishListingStore";
import type {
  ProductCondition,
  SellerKind,
} from "../../services/storeProductService";

const CONDITION_OPTIONS: Array<{ value: ProductCondition; label: string; subtitle: string }> = [
  { value: "BNWT",   label: "全新未拆", subtitle: "Brand New With Tag" },
  { value: "NEW_99", label: "99 新",   subtitle: "几乎全新，轻试" },
  { value: "NEW_95", label: "95 新",   subtitle: "少量穿着痕迹" },
  { value: "USED_8", label: "8 成新",  subtitle: "明显使用痕迹" },
  { value: "FLAW",   label: "有瑕疵",  subtitle: "请在说明中详述" },
];

const PublishListingStep1Screen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);
  const form = usePublishListingStore();
  const patch = usePublishListingStore((s) => s.patch);

  const [brandModalVisible, setBrandModalVisible] = useState(false);
  const [brandQuery, setBrandQuery] = useState("");
  const [brandResults, setBrandResults] = useState<Brand[]>([]);
  const [brandLoading, setBrandLoading] = useState(false);

  const [showModalVisible, setShowModalVisible] = useState(false);
  const [showQuery, setShowQuery] = useState("");
  const [showResults, setShowResults] = useState<Show[]>([]);
  const [showLoading, setShowLoading] = useState(false);

  const handleSearchBrand = useCallback(async () => {
    if (!brandQuery.trim()) {
      setBrandResults([]);
      return;
    }
    setBrandLoading(true);
    try {
      const list = await searchBrands(brandQuery.trim(), 30);
      setBrandResults(list || []);
    } catch (e) {
      setBrandResults([]);
    } finally {
      setBrandLoading(false);
    }
  }, [brandQuery]);

  const handleSearchShow = useCallback(async () => {
    if (!showQuery.trim()) {
      setShowResults([]);
      return;
    }
    setShowLoading(true);
    try {
      const list = await searchShows(showQuery.trim(), 50);
      setShowResults(list || []);
    } catch (e) {
      setShowResults([]);
    } finally {
      setShowLoading(false);
    }
  }, [showQuery]);

  const canContinue = useMemo(
    () =>
      !!form.brand.trim() &&
      !!form.condition &&
      !!form.size.trim() &&
      !!form.color.trim(),
    [form.brand, form.condition, form.size, form.color]
  );

  const handleNext = () => {
    if (!canContinue) {
      Alert.show("请先完成必填项");
      return;
    }
    // @ts-expect-error - navigation types
    navigation.navigate("PublishListingStep2");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="发布单品 · 属性" showBack />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <SectionTitle>1 / 3 · 属性</SectionTitle>

          {/* Seller kind */}
          <FieldRow label="发布身份">
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
                      {k === "individual" ? "个人卖家" : "买手店"}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </FieldRow>

          <FieldRow label="品牌 *">
            <Pressable
              onPress={() => setBrandModalVisible(true)}
              style={styles.selectorRow}
            >
              <Text
                style={[
                  styles.selectorText,
                  !form.brand && styles.placeholderText,
                ]}
              >
                {form.brand || "选择品牌"}
              </Text>
            </Pressable>
          </FieldRow>

          <FieldRow label="尺码 *">
            <TextInput
              style={styles.input}
              value={form.size}
              onChangeText={(v) => patch({ size: v })}
              placeholder="如 M / 42 / S-XL"
              placeholderTextColor="#9999"
            />
          </FieldRow>

          <FieldRow label="颜色 *">
            <TextInput
              style={styles.input}
              value={form.color}
              onChangeText={(v) => patch({ color: v })}
              placeholder="如 Black / Bone"
              placeholderTextColor="#9999"
            />
          </FieldRow>

          <FieldRow label="成色 *">
            <VStack space="xs">
              {CONDITION_OPTIONS.map((opt) => {
                const active = form.condition === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => patch({ condition: opt.value })}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                  >
                    <VStack>
                      <Text style={styles.optionTitle}>{opt.label}</Text>
                      <Text style={styles.optionSubtitle}>{opt.subtitle}</Text>
                    </VStack>
                  </Pressable>
                );
              })}
            </VStack>
          </FieldRow>

          <FieldRow label="关联秀场（可选）">
            <Pressable
              onPress={() => setShowModalVisible(true)}
              style={styles.selectorRow}
            >
              <Text
                style={[
                  styles.selectorText,
                  !form.originalShowLabel && styles.placeholderText,
                ]}
              >
                {form.originalShowLabel || "如 Rick Owens FW07"}
              </Text>
            </Pressable>
          </FieldRow>

          <FieldRow label="原入手时间（可选）">
            <TextInput
              style={styles.input}
              value={form.originalAcquiredAt ?? ""}
              onChangeText={(v) =>
                patch({ originalAcquiredAt: v.trim() || null })
              }
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9999"
              autoCorrect={false}
            />
          </FieldRow>

          <Box style={{ height: 24 }} />
        </ScrollView>

        <Box style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextButton, !canContinue && styles.nextButtonDisabled]}
            onPress={handleNext}
            activeOpacity={0.8}
            disabled={!canContinue}
          >
            <Text style={styles.nextButtonText}>下一步 · 5 视角图</Text>
          </TouchableOpacity>
        </Box>
      </KeyboardAvoidingView>

      <BrandSelectorModal
        visible={brandModalVisible}
        brands={brandResults}
        searchQuery={brandQuery}
        isLoading={brandLoading}
        onSearchChange={setBrandQuery}
        onSearch={handleSearchBrand}
        onSelectBrand={(b: Brand) => {
          patch({ brand: b.name, brandId: b.id });
          setBrandModalVisible(false);
        }}
        onClose={() => setBrandModalVisible(false)}
      />

      <ShowSelectorModal
        visible={showModalVisible}
        shows={showResults}
        searchQuery={showQuery}
        isLoading={showLoading}
        onSearchChange={setShowQuery}
        onSearch={handleSearchShow}
        onSelectShow={(show: Show) => {
          patch({
            originalShowId: typeof show.id === "string" ? Number(show.id) : show.id,
            originalShowLabel: `${show.designer ?? ""} ${show.season ?? ""} ${
              show.year ?? ""
            }`.trim(),
          });
          setShowModalVisible(false);
        }}
        onClose={() => setShowModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.sectionTitle}>{children}</Text>;
};

const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <VStack style={styles.fieldRow} space="xs">
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </VStack>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    scroll: { padding: 16, paddingBottom: 32 },
    sectionTitle: {
      fontSize: 14,
      color: t.colors.textSecondary,
      marginBottom: 12,
      letterSpacing: 1,
    },
    fieldRow: { marginBottom: 18 },
    fieldLabel: {
      fontSize: 13,
      color: t.colors.textSecondary,
      marginBottom: 6,
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: t.colors.text,
    },
    selectorRow: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    selectorText: { fontSize: 16, color: t.colors.text },
    placeholderText: { color: t.colors.textSecondary },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    chipActive: {
      borderColor: t.colors.accent,
      backgroundColor: t.colors.accent,
    },
    chipText: { color: t.colors.text, fontSize: 13 },
    chipTextActive: { color: t.colors.textInverted },
    optionRow: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    optionRowActive: {
      borderColor: t.colors.accent,
      backgroundColor: `${t.colors.accent}11`,
    },
    optionTitle: { fontSize: 15, color: t.colors.text, fontWeight: "600" },
    optionSubtitle: { fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },
    footer: {
      padding: 16,
      paddingBottom: Platform.OS === "ios" ? 32 : 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    nextButton: {
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: "center",
    },
    nextButtonDisabled: { opacity: 0.4 },
    nextButtonText: {
      color: t.colors.textInverted,
      fontSize: 16,
      fontWeight: "600",
    },
  });

export default PublishListingStep1Screen;
