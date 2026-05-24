/**
 * PRD 单品发布 · Step 2 / 4：规范化 5 视角图 + 最多 7 张额外图。
 *
 * 5 个必填卡槽：正面 / 背面 / 细节 / 领标 / 洗标
 * - 点击空槽时弹 PhotoSlotGuide，先讲清楚构图要求再让卖家拍。
 * - 已上传的图可重新点击替换；长按移除。
 * - extras 上限 7 张，让总数最多 12 张（PRD 建议）。
 *
 * 注意：旧 schema 把"瑕疵细节"作为第 5 个槽 (flaw)，本版本改为更通用的
 * "细节" (detail)；为了向后兼容，仍把图 URL 存在 photoAngles.flaw 字段。
 */
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";

import { Box, HStack, Pressable, Text } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import ScreenHeader from "../../components/ScreenHeader";
import WizardStepper from "../../components/WizardStepper";
import PhotoSlotGuide, {
  type PhotoAngleKey as GuideAngle,
} from "../../components/PhotoSlotGuide";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import { uploadImageFromUri } from "../admin/adminUtils";
import {
  usePublishListingStore,
  TOTAL_PUBLISH_STEPS,
} from "../../store/publishListingStore";
import type { PhotoAngles } from "../../services/storeProductService";
import { FeeNotice } from "./PublishListingStep1Screen";

// 数据层 key 与 UI 层 key 的桥接：UI 里"细节"对应 DB 里的 flaw 字段（兼容旧数据）。
type StoreAngleKey = keyof Pick<
  PhotoAngles,
  "front" | "back" | "wash_label" | "brand_label" | "flaw"
>;

const SLOT_ORDER: Array<{
  storeKey: StoreAngleKey;
  guideKey: GuideAngle;
  titleKey: string;
  tipKey: string;
}> = [
  { storeKey: "front",        guideKey: "front",        titleKey: "front",       tipKey: "frontTip" },
  { storeKey: "back",         guideKey: "back",         titleKey: "back",        tipKey: "backTip" },
  { storeKey: "flaw",         guideKey: "detail",       titleKey: "detail",      tipKey: "detailTip" },
  { storeKey: "brand_label",  guideKey: "brand_label",  titleKey: "brandLabel",  tipKey: "brandLabelTip" },
  { storeKey: "wash_label",   guideKey: "wash_label",   titleKey: "washLabel",   tipKey: "washLabelTip" },
];

const MAX_EXTRAS = 7;

const { width: SCREEN_W } = Dimensions.get("window");
const PAGE_PADDING = 16;
const GAP = 12;
const TILE_W = (SCREEN_W - PAGE_PADDING * 2 - GAP * 2) / 3;

const PublishListingStep2Screen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(makeStyles);
  const theme = useAppTheme();

  const photoAngles = usePublishListingStore((s) => s.photoAngles);
  const patch = usePublishListingStore((s) => s.patch);

  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [guideKey, setGuideKey] = useState<GuideAngle | null>(null);
  const [pendingStoreKey, setPendingStoreKey] = useState<StoreAngleKey | null>(
    null
  );

  const stepLabels = useMemo(
    () => [
      t("trading.publishListing.steps.basics"),
      t("trading.publishListing.steps.photos"),
      t("trading.publishListing.steps.pricing"),
      t("trading.publishListing.steps.logistics"),
    ],
    [t]
  );

  const allComplete = useMemo(
    () => SLOT_ORDER.every(({ storeKey }) => !!photoAngles[storeKey]),
    [photoAngles]
  );

  const launchPicker = async (storeKey: StoreAngleKey) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.show(t("common.photoPermissionRequired"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingKey(storeKey);
    try {
      const url = await uploadImageFromUri(result.assets[0].uri);
      patch({ photoAngles: { ...photoAngles, [storeKey]: url } });
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : t("common.uploadFailed"));
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSlotPress = (storeKey: StoreAngleKey, guideAngle: GuideAngle) => {
    // 首次点开（槽是空的）→ 先讲构图要求；已有图 → 直接换图
    if (!photoAngles[storeKey]) {
      setPendingStoreKey(storeKey);
      setGuideKey(guideAngle);
      return;
    }
    launchPicker(storeKey);
  };

  const handleRemoveSlot = (storeKey: StoreAngleKey) => {
    patch({ photoAngles: { ...photoAngles, [storeKey]: null } });
  };

  const handlePickExtra = async () => {
    const extras = photoAngles.extras ?? [];
    if (extras.length >= MAX_EXTRAS) {
      Alert.show(t("trading.publishListing.photos.extraLimit", { max: MAX_EXTRAS }));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingKey("extras");
    try {
      const url = await uploadImageFromUri(result.assets[0].uri);
      patch({
        photoAngles: { ...photoAngles, extras: [...extras, url] },
      });
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : t("common.uploadFailed"));
    } finally {
      setUploadingKey(null);
    }
  };

  const handleRemoveExtra = (index: number) => {
    const extras = photoAngles.extras ?? [];
    patch({
      photoAngles: {
        ...photoAngles,
        extras: extras.filter((_, i) => i !== index),
      },
    });
  };

  const handleNext = () => {
    if (!allComplete) {
      Alert.show(t("trading.publishListing.photos.allRequired"));
      return;
    }
    navigation.navigate("PublishListingStep3");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={t("trading.publishListing.title")} showBack />
      <WizardStepper
        total={TOTAL_PUBLISH_STEPS}
        current={2}
        labels={stepLabels}
        onJumpTo={(s) => {
          if (s === 1) navigation.navigate("PublishListingStep1");
        }}
      />
      <FeeNotice />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>
          {t("trading.publishListing.photos.requiredHeader")}
        </Text>
        <Text style={styles.sectionHint}>
          {t("trading.publishListing.photos.requiredHint")}
        </Text>

        <View style={styles.angleGrid}>
          {SLOT_ORDER.map(({ storeKey, guideKey: gk, titleKey }) => {
            const url = photoAngles[storeKey];
            const isUploading = uploadingKey === storeKey;
            return (
              <Pressable
                key={storeKey}
                style={styles.angleTile}
                onPress={() => handleSlotPress(storeKey, gk)}
                onLongPress={() => url && handleRemoveSlot(storeKey)}
                disabled={isUploading}
              >
                <Box style={styles.angleThumb}>
                  {url ? (
                    <>
                      <OptimizedImage uri={url} style={styles.angleImage} />
                      <View style={styles.angleEditOverlay}>
                        <Ionicons name="camera-outline" size={14} color="#fff" />
                      </View>
                    </>
                  ) : (
                    <Box style={styles.angleEmpty}>
                      {isUploading ? (
                        <ActivityIndicator />
                      ) : (
                        <>
                          <Ionicons
                            name="add"
                            size={26}
                            color={theme.colors.textSecondary}
                          />
                          <Text style={styles.angleEmptyHint}>
                            {t(`trading.publishListing.photoGuide.${titleKey}`)}
                          </Text>
                        </>
                      )}
                    </Box>
                  )}
                </Box>
                <Text style={styles.angleTitle} numberOfLines={1}>
                  {t(`trading.publishListing.photoGuide.${titleKey}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, { marginTop: 24 }]}>
          {t("trading.publishListing.photos.extraHeader", { max: MAX_EXTRAS })}
        </Text>
        <Text style={styles.sectionHint}>
          {t("trading.publishListing.photos.extraHint")}
        </Text>
        <HStack flexWrap="wrap" style={{ gap: 8 } as any}>
          {(photoAngles.extras ?? []).map((url, i) => (
            <Pressable
              key={url + i}
              style={styles.extraTile}
              onLongPress={() => handleRemoveExtra(i)}
            >
              <OptimizedImage uri={url} style={styles.extraImage} />
              <View style={styles.angleEditOverlay}>
                <Ionicons name="trash-outline" size={12} color="#fff" />
              </View>
            </Pressable>
          ))}
          {(photoAngles.extras ?? []).length < MAX_EXTRAS && (
            <Pressable style={styles.extraAdd} onPress={handlePickExtra}>
              {uploadingKey === "extras" ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.extraAddText}>+</Text>
              )}
            </Pressable>
          )}
        </HStack>
        <Text style={styles.hintSmall}>
          {t("trading.publishListing.photos.longPressRemove")}
        </Text>
      </ScrollView>

      <Box style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !allComplete && styles.nextButtonDisabled]}
          onPress={handleNext}
          activeOpacity={0.8}
          disabled={!allComplete}
        >
          <Text style={styles.nextButtonText}>
            {t("trading.publishListing.nextToPricing")}
          </Text>
        </TouchableOpacity>
      </Box>

      <PhotoSlotGuide
        visible={!!guideKey}
        angle={guideKey ?? "front"}
        onClose={() => {
          setGuideKey(null);
          setPendingStoreKey(null);
        }}
        onPickPhoto={() => {
          const target = pendingStoreKey;
          setGuideKey(null);
          setPendingStoreKey(null);
          if (target) launchPicker(target);
        }}
      />
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    scroll: { padding: PAGE_PADDING, paddingBottom: 32 },
    section: {
      fontSize: 13,
      color: t.colors.text,
      fontWeight: "600",
      marginBottom: 4,
    },
    sectionHint: {
      fontSize: 12,
      color: t.colors.textSecondary,
      marginBottom: 12,
    },
    angleGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginHorizontal: -GAP / 2,
    },
    angleTile: {
      width: TILE_W,
      marginHorizontal: GAP / 2,
      marginBottom: GAP + 4,
    },
    angleThumb: {
      width: "100%",
      aspectRatio: 4 / 5,
      borderRadius: t.borderRadius.sm,
      overflow: "hidden",
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    angleImage: { width: "100%", height: "100%" },
    angleEditOverlay: {
      position: "absolute",
      right: 6,
      bottom: 6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    angleEmpty: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 6,
      gap: 4,
    },
    angleEmptyHint: {
      fontSize: 11,
      color: t.colors.textSecondary,
      textAlign: "center",
    },
    angleTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.text,
      marginTop: 6,
      textAlign: "center",
    },
    extraTile: {
      width: 80,
      height: 80,
      borderRadius: t.borderRadius.sm,
      overflow: "hidden",
      position: "relative",
    },
    extraImage: { width: "100%", height: "100%" },
    extraAdd: {
      width: 80,
      height: 80,
      borderRadius: t.borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      justifyContent: "center",
      alignItems: "center",
    },
    extraAddText: { fontSize: 24, color: t.colors.textSecondary },
    hintSmall: { fontSize: 11, color: t.colors.textSecondary, marginTop: 8 },
    footer: {
      padding: 16,
      paddingBottom: Platform.OS === "ios" ? 28 : 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    nextButton: {
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
    },
    nextButtonDisabled: { opacity: 0.4 },
    nextButtonText: {
      color: t.colors.textInverted,
      fontSize: 16,
      fontWeight: "600",
    },
  });

export default PublishListingStep2Screen;
