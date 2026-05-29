/**
 * PRD 单品发布 · Step 2 / 4：规范化 7 视角图 + 最多 7 张额外图。
 *
 * 7 个必填卡槽 (与后端 `PhotoAngles.REQUIRED_SLOTS` 对齐)：
 *   - 正面 / 背面 (front / back)
 *   - 细节 (flaw —— 旧 schema 字段名, UI 已改成"细节")
 *   - 领标正面 / 背面 (brand_label / brand_label_back)
 *   - 洗标正面 / 背面 (wash_label / wash_label_back)
 *
 * 设计要点:
 *   1. 多选上传: 顶部 "批量上传" 按钮使用 `allowsMultipleSelection`, 一次最多
 *      `remaining` 张, 自动按顺序填到空槽 (前→后→细节→领标×2→洗标×2). 单击
 *      具体卡槽仍走 PhotoSlotGuide → 单选拍照, 保证每张都对应明确说明.
 *   2. 上传稳定性: 调用 `uploadImageFromUri` 时传入 AbortSignal, 用户点 spinner
 *      可以取消; 单文件超时 90s + 1 次自动重试; 即使卡死也能恢复无需杀进程。
 *   3. 已上传的图可重新点击替换; 长按移除. extras 上限 7 张 (总数最多 14).
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import {
  uploadImageFromUri,
  UploadCancelledError,
} from "../admin/adminUtils";
import {
  usePublishListingStore,
  TOTAL_PUBLISH_STEPS,
} from "../../store/publishListingStore";
import type { PhotoAngles } from "../../services/storeProductService";
import {
  makePublishListingFormStyles,
  PublishListingFeeNotice,
  PUBLISH_LISTING_FORM_PADDING,
} from "./publishListingFormShared";

// 数据层 key 与 UI 层 key 的桥接:
//   - UI 里"细节"对应 DB 里的 `flaw` 字段 (兼容老数据, 不动 schema 名).
//   - 领标 / 洗标 正反面各占一个 store key, 共 7 个强制槽.
type StoreAngleKey = keyof Pick<
  PhotoAngles,
  | "front"
  | "back"
  | "wash_label"
  | "wash_label_back"
  | "brand_label"
  | "brand_label_back"
  | "flaw"
>;

const SLOT_ORDER: Array<{
  storeKey: StoreAngleKey;
  guideKey: GuideAngle;
  titleKey: string;
}> = [
  { storeKey: "front",             guideKey: "front",             titleKey: "front" },
  { storeKey: "back",              guideKey: "back",              titleKey: "back" },
  { storeKey: "flaw",              guideKey: "detail",            titleKey: "detail" },
  { storeKey: "brand_label",       guideKey: "brand_label",       titleKey: "brandLabel" },
  { storeKey: "brand_label_back",  guideKey: "brand_label_back",  titleKey: "brandLabelBack" },
  { storeKey: "wash_label",        guideKey: "wash_label",        titleKey: "washLabel" },
  { storeKey: "wash_label_back",   guideKey: "wash_label_back",   titleKey: "washLabelBack" },
];

const REQUIRED_COUNT = SLOT_ORDER.length; // 7
const MAX_EXTRAS = 7;

const { width: SCREEN_W } = Dimensions.get("window");
const GAP = 12;
// 4 列网格 (7 张分两行: 4+3) —— 比原来的 3 列更紧凑, 不至于因 7 张图把页面撑得太长.
const COLS = 4;
const TILE_W =
  (SCREEN_W - PUBLISH_LISTING_FORM_PADDING * 2 - GAP * (COLS - 1)) / COLS;

const PublishListingStep2Screen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(makeStyles);
  const theme = useAppTheme();

  const photoAngles = usePublishListingStore((s) => s.photoAngles);
  const patch = usePublishListingStore((s) => s.patch);

  // uploadingKey 是粗粒度的"哪一个槽 / extras 正在上传"标识, 同时也用来禁用
  // 重复点击. batchUploading 用来给"批量上传"按钮独立显示 spinner。
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [batchUploading, setBatchUploading] = useState(false);
  const [guideKey, setGuideKey] = useState<GuideAngle | null>(null);
  const [pendingStoreKey, setPendingStoreKey] = useState<StoreAngleKey | null>(
    null,
  );

  // AbortController 池: key (槽名 / "extras" / "batch") → controller.
  // 用 ref 是因为我们需要在 setState 之外通过 controller.abort() 触发取消,
  // 不需要把它放进 React state 重渲染。
  const uploadControllersRef = useRef<Map<string, AbortController>>(new Map());

  const stepLabels = useMemo(
    () => [
      t("trading.publishListing.steps.basics"),
      t("trading.publishListing.steps.photos"),
      t("trading.publishListing.steps.pricing"),
      t("trading.publishListing.steps.logistics"),
    ],
    [t],
  );

  const allComplete = useMemo(
    () => SLOT_ORDER.every(({ storeKey }) => !!photoAngles[storeKey]),
    [photoAngles],
  );

  // 已使用某个 key 时不重复发起请求, 取消旧的再发新的。
  const startUpload = (key: string): AbortController => {
    const prev = uploadControllersRef.current.get(key);
    if (prev) prev.abort();
    const ctl = new AbortController();
    uploadControllersRef.current.set(key, ctl);
    return ctl;
  };

  const finishUpload = (key: string) => {
    uploadControllersRef.current.delete(key);
  };

  const cancelUpload = (key: string) => {
    const ctl = uploadControllersRef.current.get(key);
    if (ctl) ctl.abort();
  };

  /**
   * 单个槽位的上传 (从相册选一张). 失败 / 取消都会重置 uploadingKey.
   */
  const launchPicker = useCallback(
    async (storeKey: StoreAngleKey) => {
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

      const ctl = startUpload(storeKey);
      setUploadingKey(storeKey);
      try {
        const url = await uploadImageFromUri(result.assets[0].uri, {
          signal: ctl.signal,
        });
        // 注意: 这里读 store 的最新值, 避免上传期间用户改了别的槽导致覆盖.
        const latest = usePublishListingStore.getState().photoAngles;
        patch({ photoAngles: { ...latest, [storeKey]: url } });
      } catch (e) {
        if (e instanceof UploadCancelledError) return;
        Alert.show(e instanceof Error ? e.message : t("common.uploadFailed"));
      } finally {
        finishUpload(storeKey);
        setUploadingKey((cur) => (cur === storeKey ? null : cur));
      }
    },
    [patch, t],
  );

  /**
   * 多选批量上传 —— 一次性把剩余空槽全填满, 不在意构图引导.
   *
   * 用户先点这里时, 我们按 SLOT_ORDER 顺序把每张图分配到下一个空槽; 全填完
   * 后剩余的图自动塞到 extras (不超 MAX_EXTRAS). 上传是串行的, 避免同时几个
   * fetch 撞到带宽瓶颈反而都超时。
   */
  const handleBatchUpload = useCallback(async () => {
    if (batchUploading) return;
    const latest = usePublishListingStore.getState().photoAngles;
    const emptySlots = SLOT_ORDER.filter(({ storeKey }) => !latest[storeKey]);
    const remainingExtras = MAX_EXTRAS - (latest.extras?.length ?? 0);
    const limit = emptySlots.length + Math.max(0, remainingExtras);
    if (limit <= 0) {
      Alert.show(t("trading.publishListing.photos.batchAllFilled"));
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.show(t("common.photoPermissionRequired"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: limit,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;

    setBatchUploading(true);
    const ctl = startUpload("batch");

    try {
      let slotPtr = 0;
      for (const asset of result.assets) {
        if (ctl.signal.aborted) break;
        try {
          const url = await uploadImageFromUri(asset.uri, { signal: ctl.signal });
          const cur = usePublishListingStore.getState().photoAngles;
          if (slotPtr < emptySlots.length) {
            const slot = emptySlots[slotPtr].storeKey;
            patch({ photoAngles: { ...cur, [slot]: url } });
            slotPtr += 1;
          } else {
            const extras = cur.extras ?? [];
            if (extras.length >= MAX_EXTRAS) break;
            patch({
              photoAngles: { ...cur, extras: [...extras, url] },
            });
          }
        } catch (e) {
          if (e instanceof UploadCancelledError) break;
          // 单张失败不阻断整个批次, 显示一次提示就继续下一张.
          Alert.show(e instanceof Error ? e.message : t("common.uploadFailed"));
        }
      }
    } finally {
      finishUpload("batch");
      setBatchUploading(false);
    }
  }, [batchUploading, patch, t]);

  const handleSlotPress = (storeKey: StoreAngleKey, guideAngle: GuideAngle) => {
    if (uploadingKey === storeKey) {
      // 正在上传 → 第二次点击视为取消请求
      cancelUpload(storeKey);
      return;
    }
    if (!photoAngles[storeKey]) {
      setPendingStoreKey(storeKey);
      setGuideKey(guideAngle);
      return;
    }
    launchPicker(storeKey);
  };

  const handleRemoveSlot = (storeKey: StoreAngleKey) => {
    if (uploadingKey === storeKey) cancelUpload(storeKey);
    patch({ photoAngles: { ...photoAngles, [storeKey]: null } });
  };

  /**
   * 追加图 (extras) 多选上传 —— 与批量上传不同, 这里完全不动必填槽, 只补 extras.
   */
  const handlePickExtra = async () => {
    const extras = photoAngles.extras ?? [];
    const remaining = MAX_EXTRAS - extras.length;
    if (remaining <= 0) {
      Alert.show(t("trading.publishListing.photos.extraLimit", { max: MAX_EXTRAS }));
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.show(t("common.photoPermissionRequired"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;

    const ctl = startUpload("extras");
    setUploadingKey("extras");
    try {
      for (const asset of result.assets) {
        if (ctl.signal.aborted) break;
        try {
          const url = await uploadImageFromUri(asset.uri, { signal: ctl.signal });
          const cur = usePublishListingStore.getState().photoAngles;
          const curExtras = cur.extras ?? [];
          if (curExtras.length >= MAX_EXTRAS) break;
          patch({
            photoAngles: { ...cur, extras: [...curExtras, url] },
          });
        } catch (e) {
          if (e instanceof UploadCancelledError) break;
          Alert.show(e instanceof Error ? e.message : t("common.uploadFailed"));
        }
      }
    } finally {
      finishUpload("extras");
      setUploadingKey((cur) => (cur === "extras" ? null : cur));
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
      Alert.show(
        t("trading.publishListing.photos.allRequired", { count: REQUIRED_COUNT }),
      );
      return;
    }
    navigation.navigate("PublishListingStep3");
  };

  const filledCount = SLOT_ORDER.filter(
    ({ storeKey }) => !!photoAngles[storeKey],
  ).length;

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
      <PublishListingFeeNotice />
      <ScrollView contentContainerStyle={styles.scroll}>
        <HStack alignItems="center" justifyContent="space-between" style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>
              {t("trading.publishListing.photos.requiredHeader", {
                count: REQUIRED_COUNT,
              })}
            </Text>
            <Text style={styles.sectionHint}>
              {t("trading.publishListing.photos.requiredHint")}
            </Text>
          </View>
          <Text style={styles.progressBadge}>
            {filledCount}/{REQUIRED_COUNT}
          </Text>
        </HStack>

        {/* 批量上传按钮: 一次选多张图按顺序填空槽 → extras */}
        <Pressable
          style={styles.batchButton}
          onPress={handleBatchUpload}
          disabled={batchUploading}
        >
          {batchUploading ? (
            <HStack alignItems="center" space="sm">
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text style={styles.batchButtonText}>
                {t("trading.publishListing.photos.batchUploading")}
              </Text>
              <Text
                style={styles.batchCancelText}
                onPress={() => cancelUpload("batch")}
              >
                {t("common.cancel")}
              </Text>
            </HStack>
          ) : (
            <HStack alignItems="center" space="sm">
              <Ionicons
                name="cloud-upload-outline"
                size={18}
                color={theme.colors.accent}
              />
              <Text style={styles.batchButtonText}>
                {t("trading.publishListing.photos.batchUpload")}
              </Text>
            </HStack>
          )}
        </Pressable>

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
              >
                <Box style={styles.angleThumb}>
                  {url ? (
                    <>
                      <OptimizedImage uri={url} style={styles.angleImage} />
                      <View style={styles.angleEditOverlay}>
                        <Ionicons name="camera-outline" size={12} color="#fff" />
                      </View>
                    </>
                  ) : (
                    <Box style={styles.angleEmpty}>
                      {isUploading ? (
                        <>
                          <ActivityIndicator />
                          <Text style={styles.angleCancelHint}>
                            {t("trading.publishListing.photos.tapToCancel")}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Ionicons
                            name="add"
                            size={22}
                            color={theme.colors.textSecondary}
                          />
                          <Text style={styles.angleEmptyHint} numberOfLines={2}>
                            {t(`trading.publishListing.photoGuide.${titleKey}`)}
                          </Text>
                        </>
                      )}
                    </Box>
                  )}
                </Box>
                <Text style={styles.angleTitle} numberOfLines={2}>
                  {t(`trading.publishListing.photoGuide.${titleKey}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
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
            <Pressable
              style={styles.extraAdd}
              onPress={() =>
                uploadingKey === "extras"
                  ? cancelUpload("extras")
                  : handlePickExtra()
              }
            >
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

const makeStyles = (t: AppTheme) => {
  const shared = makePublishListingFormStyles(t);
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    scroll: shared.scroll,
    sectionTitle: shared.sectionTitle,
    sectionHint: shared.sectionHint,
    hintSmall: shared.hintSmall,
    footer: shared.footer,
    nextButton: shared.nextButton,
    nextButtonDisabled: shared.nextButtonDisabled,
    nextButtonText: shared.nextButtonText,
    headerRow: {
      marginBottom: 8,
    },
    progressBadge: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.gray500,
    },
    batchButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: t.borderRadius.sm,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      backgroundColor: t.colors.card,
      marginBottom: 16,
    },
    batchButtonText: {
      fontSize: 13,
      fontWeight: "500",
      color: t.colors.text,
    },
    batchCancelText: {
      fontSize: 12,
      color: t.colors.error,
      marginLeft: 6,
      paddingHorizontal: 6,
    },
    angleGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: GAP,
    },
    angleTile: {
      width: TILE_W,
      marginBottom: 4,
    },
    angleThumb: {
      width: "100%",
      aspectRatio: 4 / 5,
      borderRadius: t.borderRadius.sm,
      overflow: "hidden",
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: t.colors.gray200,
    },
    angleImage: { width: "100%", height: "100%" },
    angleEditOverlay: {
      position: "absolute",
      right: 6,
      bottom: 6,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    angleEmpty: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
      gap: 4,
    },
    angleEmptyHint: {
      fontSize: 10,
      color: t.colors.gray400,
      textAlign: "center",
      lineHeight: 13,
    },
    angleCancelHint: {
      fontSize: 9,
      color: t.colors.gray400,
      textAlign: "center",
      marginTop: 4,
    },
    angleTitle: {
      fontSize: 11,
      fontWeight: "500",
      color: t.colors.gray600,
      marginTop: 6,
      textAlign: "center",
      lineHeight: 14,
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
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: t.colors.gray200,
      backgroundColor: t.colors.card,
      justifyContent: "center",
      alignItems: "center",
    },
    extraAddText: { fontSize: 24, color: t.colors.gray400 },
  });
};

export default PublishListingStep2Screen;
