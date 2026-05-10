/**
 * V2 发布流程 · Step 1：图片 / 视频多选
 * ------------------------------------------------------------------
 * 使用场景：用户在 Discover 推荐 / 关注 / 买手店等非论坛 Tab 点中央「+」。
 *
 * 行为：
 *   - 进入即弹出系统相册多选；用户可继续添加图片或视频；
 *   - 已选媒体以网格形式展示，支持删除；
 *   - 「下一步」跳转 `PublishV2TypeSelect`，把媒体 URI 数组带过去。
 *
 * 媒体最大数量与现有发帖屏一致 = 9。视频和图片混选都计入同一上限。
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";

import { Box, Text, ScrollView, HStack, OptimizedImage } from "../../components/ui";
import { theme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import ImagePickerModal from "../../components/ImagePickerModal";
import ImageCropper from "../../components/ImageCropper";
import BatchImageCropper from "../../components/BatchImageCropper";
import { VideoThumbnailView } from "../../components/VideoThumbnailView";
import { Alert } from "../../utils/Alert";
import { isVideoUrl } from "../../services/postService";
import { ImageSize } from "../../utils/imageUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 8;
const GRID_COLUMNS = 3;
const TILE_SIZE = (SCREEN_WIDTH - 32 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
const MAX_MEDIA = 9;

const PublishV2ImageSelectScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [media, setMedia] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  // 单图裁切：拍照 / 单选画廊命中时走 ImageCropper。
  const [singleCropperUri, setSingleCropperUri] = useState<string | null>(null);
  // 批量裁切：多选画廊命中时走 BatchImageCropper（顺序逐张裁）。
  const [batchCropperUris, setBatchCropperUris] = useState<string[]>([]);
  const autoOpenedRef = useRef(false);

  // 进入屏后自动弹出选择来源面板，保留再次点 + 时的手动入口。
  useEffect(() => {
    if (autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    const t = setTimeout(() => setPickerVisible(true), 250);
    return () => clearTimeout(t);
  }, []);

  const remainingSlots = Math.max(0, MAX_MEDIA - media.length);

  const requireGalleryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.show(t("publish.galleryPermissionRequired"));
      return false;
    }
    return true;
  };

  const requireCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.show(t("publish.cameraPermissionRequired"));
      return false;
    }
    return true;
  };

  const handleSelectGalleryMulti = async () => {
    setPickerVisible(false);
    if (remainingSlots <= 0) {
      Alert.show(t("publish.maxMediaReached", { count: MAX_MEDIA }));
      return;
    }
    if (!(await requireGalleryPermission())) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 1.0,
      });
      if (result.canceled || !result.assets?.length) return;
      const newUris = result.assets.map((a) => a.uri).slice(0, remainingSlots);
      // 多张：进入批量裁切，逐张让用户决定是否裁切，最终把结果一次性追加到 media。
      setBatchCropperUris(newUris);
    } catch (err) {
      console.warn("V2 gallery select failed", err);
      Alert.show(t("publish.imageSelectionFailed"));
    }
  };

  const handleSelectGallerySingle = async () => {
    setPickerVisible(false);
    if (remainingSlots <= 0) {
      Alert.show(t("publish.maxMediaReached", { count: MAX_MEDIA }));
      return;
    }
    if (!(await requireGalleryPermission())) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1.0,
      });
      if (result.canceled || !result.assets?.length) return;
      // 单张：进入单图裁切。
      setSingleCropperUri(result.assets[0].uri);
    } catch (err) {
      console.warn("V2 single image select failed", err);
      Alert.show(t("publish.imageSelectionFailed"));
    }
  };

  const handleSelectCamera = async () => {
    setPickerVisible(false);
    if (remainingSlots <= 0) {
      Alert.show(t("publish.maxMediaReached", { count: MAX_MEDIA }));
      return;
    }
    if (!(await requireCameraPermission())) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1.0,
      });
      if (result.canceled || !result.assets?.length) return;
      // 拍照后同样走单图裁切，与现有 PublishLookbook 行为一致。
      setSingleCropperUri(result.assets[0].uri);
    } catch (err) {
      console.warn("V2 camera failed", err);
      Alert.show(t("publish.imageSelectionFailed"));
    }
  };

  const handleSelectVideo = async () => {
    setPickerVisible(false);
    if (remainingSlots <= 0) {
      Alert.show(t("publish.maxMediaReached", { count: MAX_MEDIA }));
      return;
    }
    if (!(await requireGalleryPermission())) {
      Alert.show(t("publish.videoPermissionRequired"));
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1.0,
      });
      if (result.canceled || !result.assets?.length) return;
      const uri = result.assets[0].uri;
      setMedia((prev) => [...prev, uri]);
      Alert.show(t("publish.videoAdded"), "", 1000);
    } catch (err) {
      console.warn("V2 video select failed", err);
      Alert.show(t("publish.videoSelectionFailed"));
    }
  };

  const handleRemove = (index: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  };

  // 裁切完成：把裁切结果追加到 media。批量模式 BatchImageCropper 已经处理
  // 「跳过裁切」的项 → 透传原 URI，所以这里直接 append 即可。
  const handleSingleCropDone = (uri: string) => {
    setSingleCropperUri(null);
    setMedia((prev) => [...prev, uri]);
    Alert.show(t("publish.imageAdded"), "", 1000);
  };

  const handleSingleCropCancel = () => {
    setSingleCropperUri(null);
  };

  const handleBatchCropDone = (uris: string[]) => {
    setBatchCropperUris([]);
    if (uris.length === 0) return;
    const truncated = uris.slice(0, remainingSlots);
    setMedia((prev) => [...prev, ...truncated]);
    Alert.show(t("publish.imagesAdded", { count: truncated.length }), "", 1200);
  };

  const handleBatchCropCancel = () => {
    setBatchCropperUris([]);
  };

  const handleNext = () => {
    if (media.length === 0) {
      Alert.show(t("publishV2.imageSelect.needAtLeastOne"));
      return;
    }
    navigation.navigate("PublishV2TypeSelect", { prefilledMedia: media });
  };

  const renderMediaTile = (uri: string, index: number) => {
    const isVideo = isVideoUrl(uri);
    return (
      <View
        key={`${uri}-${index}`}
        style={[
          styles.tile,
          {
            width: TILE_SIZE,
            height: TILE_SIZE,
            marginRight: (index + 1) % GRID_COLUMNS === 0 ? 0 : GRID_GAP,
            marginBottom: GRID_GAP,
          },
        ]}
      >
        {isVideo ? (
          <VideoThumbnailView uri={uri} style={StyleSheet.absoluteFill} />
        ) : (
          <OptimizedImage
            uri={uri}
            size={ImageSize.MEDIUM}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            lazy={false}
          />
        )}
        {isVideo ? (
          <View style={styles.videoBadge}>
            <Ionicons name="play" size={16} color={theme.colors.white} />
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => handleRemove(index)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="close" size={14} color={theme.colors.white} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderAddTile = () => {
    if (media.length >= MAX_MEDIA) return null;
    const index = media.length;
    return (
      <TouchableOpacity
        key="add-tile"
        style={[
          styles.tile,
          styles.addTile,
          {
            width: TILE_SIZE,
            height: TILE_SIZE,
            marginRight: (index + 1) % GRID_COLUMNS === 0 ? 0 : GRID_GAP,
            marginBottom: GRID_GAP,
          },
        ]}
        onPress={() => setPickerVisible(true)}
      >
        <Ionicons name="add" size={32} color={theme.colors.gray400} />
        <Text fontSize="$xs" color="$gray400" mt="$xs" textAlign="center">
          {t("publishV2.imageSelect.addMedia")}
        </Text>
      </TouchableOpacity>
    );
  };

  const canGoNext = media.length > 0;

  // 批量裁切优先级最高：用户多选完图片立刻进入逐张裁切。
  if (batchCropperUris.length > 0) {
    return (
      <BatchImageCropper
        sourceUris={batchCropperUris}
        aspect="free"
        onCancel={handleBatchCropCancel}
        onDone={handleBatchCropDone}
      />
    );
  }

  // 单图裁切（拍照 / 单选画廊）。
  if (singleCropperUri) {
    return (
      <ImageCropper
        sourceUri={singleCropperUri}
        aspect="free"
        onCancel={handleSingleCropCancel}
        onDone={handleSingleCropDone}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("publishV2.imageSelect.title")}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Text fontSize="$sm" color="$gray500" mb="$md">
          {media.length > 0
            ? t("publishV2.imageSelect.selectedCount", {
                count: media.length,
                max: MAX_MEDIA,
              })
            : t("publishV2.imageSelect.subtitle")}
        </Text>

        <HStack flexWrap="wrap">
          {media.map((uri, idx) => renderMediaTile(uri, idx))}
          {renderAddTile()}
        </HStack>
      </ScrollView>

      <Box
        px="$lg"
        pt="$md"
        pb="$md"
        borderTopWidth={1}
        borderTopColor="$gray100"
        bg="$white"
      >
        <TouchableOpacity
          style={[styles.nextBtn, !canGoNext && styles.nextBtnDisabled]}
          onPress={handleNext}
          activeOpacity={0.8}
          disabled={!canGoNext}
        >
          <Text color="$white" fontSize="$md" fontWeight="$medium">
            {t("publishV2.imageSelect.next")}
          </Text>
        </TouchableOpacity>
      </Box>

      <ImagePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelectCamera={handleSelectCamera}
        onSelectGallery={handleSelectGallerySingle}
        onSelectMultipleGallery={handleSelectGalleryMulti}
        onSelectVideo={handleSelectVideo}
        title={t("publishV2.imageSelect.pickerTitle")}
        showVideoOption
        showMultiSelectOption
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  tile: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: theme.colors.gray100,
    position: "relative",
  },
  addTile: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtn: {
    height: 48,
    borderRadius: 8,
    backgroundColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnDisabled: {
    opacity: 0.4,
  },
});

export default PublishV2ImageSelectScreen;
