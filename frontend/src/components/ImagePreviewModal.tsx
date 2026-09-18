import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  FlatList,
  Dimensions,
  StatusBar,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable } from "./ui";
import { ZoomableImage } from "./ZoomableImage";
import { theme, useAppTheme } from "../theme";
import { Alert } from "../utils/Alert";
import { saveImageToLibrary } from "../utils/saveImage";
// NOTE: This modal is intentionally always dark (full-screen image preview),
// so static StyleSheet colors below remain hardcoded.

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ImagePreviewModalProps {
  visible: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  initialIndex?: number;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onImagePress?: (index: number) => void;
  /**
   * 显示「保存到相册」。默认关闭 —— 这个 Modal 也用来看别人的帖子图，
   * 不该无条件给下载入口；只在内容属于当前用户时由调用方打开。
   */
  allowSave?: boolean;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  imageUrl,
  imageUrls,
  initialIndex = 0,
  title,
  subtitle,
  onClose,
  onImagePress,
  allowSave = false,
}) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  // Lock horizontal paging while the active image is zoomed so pan
  // gestures stay with the image instead of swiping to the next slide.
  const [isZoomed, setIsZoomed] = useState(false);

  // 确定要显示的图片数组
  const images = imageUrls || (imageUrl ? [imageUrl] : []);
  const hasMultipleImages = images.length > 1;

  // 当 visible 或 initialIndex 改变时，重置当前索引
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setIsZoomed(false);
    }
  }, [visible, initialIndex]);

  const handleIndexChange = useCallback((newIndex: number) => {
    setIsZoomed(false);
    setCurrentIndex(newIndex);
  }, []);

  const handleTap = useCallback(
    (index: number) => {
      onImagePress?.(index);
    },
    [onImagePress]
  );

  const handleSave = useCallback(async () => {
    const url = images[currentIndex];
    if (!url || saving) return;
    setSaving(true);
    try {
      const res = await saveImageToLibrary(url);
      Alert.show(
        res.ok
          ? t("common.saveImageDone")
          : res.reason === "permission"
            ? t("common.saveImageNoPermission")
            : t("common.saveImageFailed"),
      );
    } finally {
      setSaving(false);
    }
  }, [images, currentIndex, saving, t]);

  if (images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      transparent={false}
    >
      <GestureHandlerRootView style={styles.fullscreenContainer}>
        <StatusBar hidden />

        {/* 关闭按钮 */}
        <Pressable style={styles.closeButtonTop} onPress={onClose}>
          <Ionicons name="close" size={30} color="#FFFFFF" />
        </Pressable>

        {/* 保存到相册。与关闭按钮同一行、置于右上，避开底部的图注区域 */}
        {allowSave && (
          <Pressable
            style={styles.saveButtonTop}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t("common.saveImage")}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="download-outline" size={26} color="#FFFFFF" />
            )}
          </Pressable>
        )}

        {/* 图片计数器 */}
        {hasMultipleImages && (
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        )}

        {/* 图片轮播 */}
        <FlatList
          ref={flatListRef}
          data={images}
          horizontal
          pagingEnabled
          scrollEnabled={!isZoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(data, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onMomentumScrollEnd={(event) => {
            const newIndex = Math.round(
              event.nativeEvent.contentOffset.x / SCREEN_WIDTH
            );
            handleIndexChange(newIndex);
          }}
          renderItem={({ item, index }) => (
            <View style={styles.fullscreenImageWrapper}>
              <ZoomableImage
                uri={item}
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                onZoomChange={setIsZoomed}
                onTap={onImagePress ? () => handleTap(index) : undefined}
              />
            </View>
          )}
          keyExtractor={(item, index) => `image-${index}`}
        />

        {/* 底部信息 */}
        {(title || subtitle) && (
          <Box position="absolute" bottom={0} left={0} right={0}>
            <SafeAreaView edges={["bottom"]}>
              <Box
                px="$lg"
                py="$lg"
                bg="rgba(0,0,0,0.8)"
                borderTopWidth={1}
                borderTopColor="rgba(255,255,255,0.1)"
              >
                {title && (
                  <Text
                    style={{ color: theme.colors.white }}
                    fontSize="$lg"
                    fontWeight="$bold"
                    mb="$xs"
                  >
                    {title}
                  </Text>
                )}
                {subtitle && (
                  <Text style={{ color: theme.colors.gray300 }} fontSize="$md">
                    {subtitle}
                  </Text>
                )}
              </Box>
            </SafeAreaView>
          </Box>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  closeButtonTop: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: theme.borderRadius.sm,
    padding: 8,
  },
  // 紧挨关闭按钮左侧：关闭键宽 46（图标 30 + 左右 padding 8），
  // 加 8 的间距正好落在 74。
  saveButtonTop: {
    position: "absolute",
    top: 50,
    right: 74,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: theme.borderRadius.sm,
    padding: 10,
  },
  imageCounter: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  imageCounterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  fullscreenImageWrapper: {
    width: SCREEN_WIDTH,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ImagePreviewModal;
