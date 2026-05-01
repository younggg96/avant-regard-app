import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  StatusBar,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  cancelAnimation,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const HANDLE_HIT_SLOP = 20;
const HANDLE_VISUAL_SIZE = 20;
const IMAGE_AREA_PADDING = 24;

export type AspectRatio = "free" | "1:1" | "4:3" | "16:9" | "9:16";

interface AspectConfig {
  label: string;
  ratio?: number;
}

const ASPECT_CONFIGS: Record<AspectRatio, AspectConfig & { i18nKey?: string }> = {
  free: { label: "自由裁剪", i18nKey: "imageCropper.freeCrop" },
  "1:1": { label: "1:1", ratio: 1 },
  "4:3": { label: "4:3", ratio: 4 / 3 },
  "16:9": { label: "16:9", ratio: 16 / 9 },
  "9:16": { label: "9:16", ratio: 9 / 16 },
};

export interface ImageCropperProps {
  sourceUri: string;
  aspect?: AspectRatio;
  onCancel: () => void;
  onDone: (resultUri: string) => void;
  minBoxSize?: number;
}

interface ImageDimensions {
  width: number;
  height: number;
  x: number;
  y: number;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
  sourceUri,
  aspect = "free",
  onCancel,
  onDone,
  minBoxSize = 60,
}) => {
  const { t } = useTranslation();
  const [selectedAspect, setSelectedAspect] = useState<AspectRatio>(aspect);
  const [imageDimensions, setImageDimensions] =
    useState<ImageDimensions | null>(null);
  const [originalImageSize, setOriginalImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const cropX = useSharedValue(0);
  const cropY = useSharedValue(0);
  const cropWidth = useSharedValue(200);
  const cropHeight = useSharedValue(200);

  const imageBoundsX = useSharedValue(0);
  const imageBoundsY = useSharedValue(0);
  const imageBoundsWidth = useSharedValue(SCREEN_WIDTH);
  const imageBoundsHeight = useSharedValue(SCREEN_HEIGHT);

  // Shared value for aspect ratio so worklets always read latest
  const aspectRatio = useSharedValue<number>(0); // 0 = free

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startWidth = useSharedValue(0);
  const startHeight = useSharedValue(0);

  React.useEffect(() => {
    if (imageDimensions) {
      imageBoundsX.value = imageDimensions.x;
      imageBoundsY.value = imageDimensions.y;
      imageBoundsWidth.value = imageDimensions.width;
      imageBoundsHeight.value = imageDimensions.height;
    }
  }, [imageDimensions]);

  React.useEffect(() => {
    const config = ASPECT_CONFIGS[selectedAspect];
    aspectRatio.value = config.ratio ?? 0;
  }, [selectedAspect]);

  const handleContainerLayout = useCallback((event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  const handleImageLoad = useCallback(
    (event: any) => {
      if (!containerSize) return;

      const { width: imgWidth, height: imgHeight } = event.source;
      setOriginalImageSize({ width: imgWidth, height: imgHeight });

      const containerWidth = containerSize.width;
      const containerHeight = containerSize.height;
      const imageAspectRatio = imgWidth / imgHeight;
      const containerAspectRatio = containerWidth / containerHeight;

      let displayWidth: number, displayHeight: number, displayX: number, displayY: number;

      if (imageAspectRatio > containerAspectRatio) {
        displayWidth = containerWidth;
        displayHeight = containerWidth / imageAspectRatio;
        displayX = 0;
        displayY = (containerHeight - displayHeight) / 2;
      } else {
        displayHeight = containerHeight;
        displayWidth = containerHeight * imageAspectRatio;
        displayX = (containerWidth - displayWidth) / 2;
        displayY = 0;
      }

      const imgDims: ImageDimensions = {
        width: displayWidth,
        height: displayHeight,
        x: displayX,
        y: displayY,
      };

      setImageDimensions(imgDims);

      imageBoundsX.value = displayX;
      imageBoundsY.value = displayY;
      imageBoundsWidth.value = displayWidth;
      imageBoundsHeight.value = displayHeight;

      const initialConfig = ASPECT_CONFIGS[aspect];
      if (initialConfig.ratio) {
        const ratio = initialConfig.ratio;
        let boxW: number, boxH: number;
        if (displayWidth / displayHeight > ratio) {
          boxH = displayHeight;
          boxW = boxH * ratio;
        } else {
          boxW = displayWidth;
          boxH = boxW / ratio;
        }
        cropX.value = displayX + (displayWidth - boxW) / 2;
        cropY.value = displayY + (displayHeight - boxH) / 2;
        cropWidth.value = boxW;
        cropHeight.value = boxH;
      } else {
        cropX.value = displayX;
        cropY.value = displayY;
        cropWidth.value = displayWidth;
        cropHeight.value = displayHeight;
      }
    },
    [containerSize]
  );

  // Helper: clamp resize for a given anchor and direction
  const clampResize = (
    anchorX: number,
    anchorY: number,
    rawW: number,
    rawH: number,
    fromLeft: boolean,
    fromTop: boolean
  ) => {
    "worklet";
    const ratio = aspectRatio.value;
    const bx = imageBoundsX.value;
    const by = imageBoundsY.value;
    const bw = imageBoundsWidth.value;
    const bh = imageBoundsHeight.value;

    // Pre-compute max available space from anchor in each direction
    const maxW = fromLeft ? anchorX - bx : bx + bw - anchorX;
    const maxH = fromTop ? anchorY - by : by + bh - anchorY;

    let w: number, h: number;

    if (ratio > 0) {
      // With fixed ratio, both dimensions must fit within bounds simultaneously
      const maxWFromH = maxH * ratio;
      const effectiveMaxW = Math.min(maxW, maxWFromH);

      w = Math.max(minBoxSize, Math.min(rawW, effectiveMaxW));
      h = w / ratio;

      if (h < minBoxSize) {
        h = minBoxSize;
        w = h * ratio;
      }
    } else {
      w = Math.max(minBoxSize, Math.min(rawW, maxW));
      h = Math.max(minBoxSize, Math.min(rawH, maxH));
    }

    const x = fromLeft ? anchorX - w : anchorX;
    const y = fromTop ? anchorY - h : anchorY;

    return { x, y, w, h };
  };

  // NW: anchor = bottom-right, drag top-left
  const resizeGestureNW = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onStart(() => {
      startX.value = cropX.value;
      startY.value = cropY.value;
      startWidth.value = cropWidth.value;
      startHeight.value = cropHeight.value;
    })
    .onUpdate((e) => {
      const anchorX = startX.value + startWidth.value;
      const anchorY = startY.value + startHeight.value;
      const rawW = startWidth.value - e.translationX;
      const rawH = startHeight.value - e.translationY;
      const r = clampResize(anchorX, anchorY, rawW, rawH, true, true);
      cropX.value = r.x;
      cropY.value = r.y;
      cropWidth.value = r.w;
      cropHeight.value = r.h;
    });

  // NE: anchor = bottom-left, drag top-right
  const resizeGestureNE = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onStart(() => {
      startX.value = cropX.value;
      startY.value = cropY.value;
      startWidth.value = cropWidth.value;
      startHeight.value = cropHeight.value;
    })
    .onUpdate((e) => {
      const anchorX = startX.value;
      const anchorY = startY.value + startHeight.value;
      const rawW = startWidth.value + e.translationX;
      const rawH = startHeight.value - e.translationY;
      const r = clampResize(anchorX, anchorY, rawW, rawH, false, true);
      cropX.value = r.x;
      cropY.value = r.y;
      cropWidth.value = r.w;
      cropHeight.value = r.h;
    });

  // SW: anchor = top-right, drag bottom-left
  const resizeGestureSW = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onStart(() => {
      startX.value = cropX.value;
      startY.value = cropY.value;
      startWidth.value = cropWidth.value;
      startHeight.value = cropHeight.value;
    })
    .onUpdate((e) => {
      const anchorX = startX.value + startWidth.value;
      const anchorY = startY.value;
      const rawW = startWidth.value - e.translationX;
      const rawH = startHeight.value + e.translationY;
      const r = clampResize(anchorX, anchorY, rawW, rawH, true, false);
      cropX.value = r.x;
      cropY.value = r.y;
      cropWidth.value = r.w;
      cropHeight.value = r.h;
    });

  // SE: anchor = top-left, drag bottom-right
  const resizeGestureSE = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onStart(() => {
      startX.value = cropX.value;
      startY.value = cropY.value;
      startWidth.value = cropWidth.value;
      startHeight.value = cropHeight.value;
    })
    .onUpdate((e) => {
      const anchorX = startX.value;
      const anchorY = startY.value;
      const rawW = startWidth.value + e.translationX;
      const rawH = startHeight.value + e.translationY;
      const r = clampResize(anchorX, anchorY, rawW, rawH, false, false);
      cropX.value = r.x;
      cropY.value = r.y;
      cropWidth.value = r.w;
      cropHeight.value = r.h;
    });

  // Edge resize gestures for mid-edge handles
  const resizeGestureN = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onStart(() => {
      startY.value = cropY.value;
      startHeight.value = cropHeight.value;
    })
    .onUpdate((e) => {
      const anchorBottom = startY.value + startHeight.value;
      let newH = startHeight.value - e.translationY;
      let newY = anchorBottom - newH;
      if (newY < imageBoundsY.value) {
        newY = imageBoundsY.value;
        newH = anchorBottom - newY;
      }
      newH = Math.max(minBoxSize, newH);
      newY = anchorBottom - newH;

      if (aspectRatio.value > 0) {
        let newW = newH * aspectRatio.value;
        const maxW = imageBoundsWidth.value;
        if (newW > maxW) { newW = maxW; newH = newW / aspectRatio.value; newY = anchorBottom - newH; }
        const cx = cropX.value + cropWidth.value / 2;
        let newX = cx - newW / 2;
        newX = Math.max(imageBoundsX.value, Math.min(imageBoundsX.value + imageBoundsWidth.value - newW, newX));
        cropX.value = newX;
        cropWidth.value = newW;
      }
      cropY.value = newY;
      cropHeight.value = newH;
    });

  const resizeGestureS = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onStart(() => {
      startY.value = cropY.value;
      startHeight.value = cropHeight.value;
    })
    .onUpdate((e) => {
      let newH = startHeight.value + e.translationY;
      const maxH = imageBoundsY.value + imageBoundsHeight.value - startY.value;
      newH = Math.max(minBoxSize, Math.min(maxH, newH));

      if (aspectRatio.value > 0) {
        let newW = newH * aspectRatio.value;
        const maxW = imageBoundsWidth.value;
        if (newW > maxW) { newW = maxW; newH = newW / aspectRatio.value; }
        const cx = cropX.value + cropWidth.value / 2;
        let newX = cx - newW / 2;
        newX = Math.max(imageBoundsX.value, Math.min(imageBoundsX.value + imageBoundsWidth.value - newW, newX));
        cropX.value = newX;
        cropWidth.value = newW;
      }
      cropHeight.value = newH;
    });

  const resizeGestureW = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onStart(() => {
      startX.value = cropX.value;
      startWidth.value = cropWidth.value;
    })
    .onUpdate((e) => {
      const anchorRight = startX.value + startWidth.value;
      let newW = startWidth.value - e.translationX;
      let newX = anchorRight - newW;
      if (newX < imageBoundsX.value) {
        newX = imageBoundsX.value;
        newW = anchorRight - newX;
      }
      newW = Math.max(minBoxSize, newW);
      newX = anchorRight - newW;

      if (aspectRatio.value > 0) {
        let newH = newW / aspectRatio.value;
        const maxH = imageBoundsHeight.value;
        if (newH > maxH) { newH = maxH; newW = newH * aspectRatio.value; newX = anchorRight - newW; }
        const cy = cropY.value + cropHeight.value / 2;
        let newY = cy - newH / 2;
        newY = Math.max(imageBoundsY.value, Math.min(imageBoundsY.value + imageBoundsHeight.value - newH, newY));
        cropY.value = newY;
        cropHeight.value = newH;
      }
      cropX.value = newX;
      cropWidth.value = newW;
    });

  const resizeGestureE = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onStart(() => {
      startX.value = cropX.value;
      startWidth.value = cropWidth.value;
    })
    .onUpdate((e) => {
      let newW = startWidth.value + e.translationX;
      const maxW = imageBoundsX.value + imageBoundsWidth.value - startX.value;
      newW = Math.max(minBoxSize, Math.min(maxW, newW));

      if (aspectRatio.value > 0) {
        let newH = newW / aspectRatio.value;
        const maxH = imageBoundsHeight.value;
        if (newH > maxH) { newH = maxH; newW = newH * aspectRatio.value; }
        const cy = cropY.value + cropHeight.value / 2;
        let newY = cy - newH / 2;
        newY = Math.max(imageBoundsY.value, Math.min(imageBoundsY.value + imageBoundsHeight.value - newH, newY));
        cropY.value = newY;
        cropHeight.value = newH;
      }
      cropWidth.value = newW;
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = cropX.value;
      startY.value = cropY.value;
    })
    .onUpdate((e) => {
      let newX = startX.value + e.translationX;
      let newY = startY.value + e.translationY;

      newX = Math.max(
        imageBoundsX.value,
        Math.min(imageBoundsX.value + imageBoundsWidth.value - cropWidth.value, newX)
      );
      newY = Math.max(
        imageBoundsY.value,
        Math.min(imageBoundsY.value + imageBoundsHeight.value - cropHeight.value, newY)
      );

      cropX.value = newX;
      cropY.value = newY;
    });

  const cropBoxStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: cropX.value,
    top: cropY.value,
    width: cropWidth.value,
    height: cropHeight.value,
    borderWidth: 2,
    borderColor: "white",
    backgroundColor: "transparent",
    overflow: "visible" as const,
  }));

  const maskStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  }));

  const handleAspectChange = (newAspect: AspectRatio) => {
    if (!imageDimensions) return;

    setSelectedAspect(newAspect);
    const config = ASPECT_CONFIGS[newAspect];
    const imgX = imageDimensions.x;
    const imgY = imageDimensions.y;
    const imgW = imageDimensions.width;
    const imgH = imageDimensions.height;

    if (!config.ratio) {
      // Free: expand to full image
      cropX.value = withSpring(imgX);
      cropY.value = withSpring(imgY);
      cropWidth.value = withSpring(imgW);
      cropHeight.value = withSpring(imgH);
      return;
    }

    const ratio = config.ratio;

    // Fit the largest possible box with this ratio inside the image
    let newWidth: number, newHeight: number;
    if (imgW / imgH > ratio) {
      newHeight = imgH;
      newWidth = newHeight * ratio;
    } else {
      newWidth = imgW;
      newHeight = newWidth / ratio;
    }

    // Center within image
    const newX = imgX + (imgW - newWidth) / 2;
    const newY = imgY + (imgH - newHeight) / 2;

    cropX.value = withSpring(newX);
    cropY.value = withSpring(newY);
    cropWidth.value = withSpring(newWidth);
    cropHeight.value = withSpring(newHeight);
  };

  const handleDone = async () => {
    if (!imageDimensions || !originalImageSize) return;

    // Cancel any running spring animations to read final target values
    cancelAnimation(cropX);
    cancelAnimation(cropY);
    cancelAnimation(cropWidth);
    cancelAnimation(cropHeight);

    try {
      const scaleX = originalImageSize.width / imageDimensions.width;
      const scaleY = originalImageSize.height / imageDimensions.height;

      const originX = Math.max(0, (cropX.value - imageDimensions.x) * scaleX);
      const originY = Math.max(0, (cropY.value - imageDimensions.y) * scaleY);
      const width = Math.min(
        cropWidth.value * scaleX,
        originalImageSize.width - originX
      );
      const height = Math.min(
        cropHeight.value * scaleY,
        originalImageSize.height - originY
      );

      // Ensure valid crop dimensions
      if (width <= 0 || height <= 0) return;

      const cropConfig = { originX, originY, width, height };

      const result = await ImageManipulator.manipulateAsync(
        sourceUri,
        [{ crop: cropConfig }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      onDone(result.uri);
    } catch (error) {
      console.error("Crop failed:", error);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor="black" />
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>{t("common.cancel")}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("imageCropper.title")}</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.imageOuterContainer}>
          <View style={styles.imageContainer} onLayout={handleContainerLayout}>
            <Image
              source={{ uri: sourceUri }}
              style={styles.image}
              contentFit="contain"
              onLoad={handleImageLoad}
            />

            <Animated.View style={maskStyle} pointerEvents="none" />

          {imageDimensions && (
            <>
              {/* Crop box - pan to move */}
              <GestureDetector gesture={panGesture}>
                <Animated.View style={cropBoxStyle}>
                  <View style={styles.gridContainer}>
                    <View style={[styles.gridLine, { top: "33.33%" }]} />
                    <View style={[styles.gridLine, { top: "66.66%" }]} />
                    <View style={[styles.gridLineVertical, { left: "33.33%" }]} />
                    <View style={[styles.gridLineVertical, { left: "66.66%" }]} />
                  </View>

                  {/* Corner handles */}
                  <GestureDetector gesture={resizeGestureNW}>
                    <Animated.View style={[styles.handle, styles.handleNW]} />
                  </GestureDetector>
                  <GestureDetector gesture={resizeGestureNE}>
                    <Animated.View style={[styles.handle, styles.handleNE]} />
                  </GestureDetector>
                  <GestureDetector gesture={resizeGestureSW}>
                    <Animated.View style={[styles.handle, styles.handleSW]} />
                  </GestureDetector>
                  <GestureDetector gesture={resizeGestureSE}>
                    <Animated.View style={[styles.handle, styles.handleSE]} />
                  </GestureDetector>

                  {/* Edge handles */}
                  <GestureDetector gesture={resizeGestureN}>
                    <Animated.View style={[styles.edgeHandle, styles.edgeN]} />
                  </GestureDetector>
                  <GestureDetector gesture={resizeGestureS}>
                    <Animated.View style={[styles.edgeHandle, styles.edgeS]} />
                  </GestureDetector>
                  <GestureDetector gesture={resizeGestureW}>
                    <Animated.View style={[styles.edgeHandle, styles.edgeW]} />
                  </GestureDetector>
                  <GestureDetector gesture={resizeGestureE}>
                    <Animated.View style={[styles.edgeHandle, styles.edgeE]} />
                  </GestureDetector>
                </Animated.View>
              </GestureDetector>
            </>
          )}
          </View>
        </View>

        <View style={styles.bottomContainer}>
          <View style={styles.aspectContainer}>
            {(Object.keys(ASPECT_CONFIGS) as AspectRatio[]).map((aspectKey) => (
              <TouchableOpacity
                key={aspectKey}
                style={[
                  styles.aspectButton,
                  selectedAspect === aspectKey && styles.aspectButtonActive,
                ]}
                onPress={() => handleAspectChange(aspectKey)}
              >
                <Text
                  style={[
                    styles.aspectButtonText,
                    selectedAspect === aspectKey &&
                    styles.aspectButtonTextActive,
                  ]}
                >
                  {ASPECT_CONFIGS[aspectKey].i18nKey ? t(ASPECT_CONFIGS[aspectKey].i18nKey!) : ASPECT_CONFIGS[aspectKey].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actionContainer}>
            <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
              <Text style={styles.doneButtonText}>{t("imageCropper.done")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const EDGE_THICKNESS = 30;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    minWidth: 60,
  },
  headerButtonText: {
    color: "white",
    fontSize: 16,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  imageOuterContainer: {
    flex: 1,
    paddingHorizontal: IMAGE_AREA_PADDING,
    paddingVertical: IMAGE_AREA_PADDING / 2,
  },
  imageContainer: {
    flex: 1,
    position: "relative",
    overflow: "visible",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  gridContainer: {
    flex: 1,
    position: "relative",
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  gridLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  handle: {
    position: "absolute",
    width: HANDLE_VISUAL_SIZE,
    height: HANDLE_VISUAL_SIZE,
    backgroundColor: "white",
    borderRadius: HANDLE_VISUAL_SIZE / 2,
    borderWidth: 1,
    borderColor: "black",
    zIndex: 10,
  },
  handleNW: {
    top: -HANDLE_VISUAL_SIZE / 2,
    left: -HANDLE_VISUAL_SIZE / 2,
  },
  handleNE: {
    top: -HANDLE_VISUAL_SIZE / 2,
    right: -HANDLE_VISUAL_SIZE / 2,
  },
  handleSW: {
    bottom: -HANDLE_VISUAL_SIZE / 2,
    left: -HANDLE_VISUAL_SIZE / 2,
  },
  handleSE: {
    bottom: -HANDLE_VISUAL_SIZE / 2,
    right: -HANDLE_VISUAL_SIZE / 2,
  },
  edgeHandle: {
    position: "absolute",
    backgroundColor: "transparent",
    zIndex: 5,
  },
  edgeN: {
    top: -EDGE_THICKNESS / 2,
    left: HANDLE_VISUAL_SIZE,
    right: HANDLE_VISUAL_SIZE,
    height: EDGE_THICKNESS,
  },
  edgeS: {
    bottom: -EDGE_THICKNESS / 2,
    left: HANDLE_VISUAL_SIZE,
    right: HANDLE_VISUAL_SIZE,
    height: EDGE_THICKNESS,
  },
  edgeW: {
    left: -EDGE_THICKNESS / 2,
    top: HANDLE_VISUAL_SIZE,
    bottom: HANDLE_VISUAL_SIZE,
    width: EDGE_THICKNESS,
  },
  edgeE: {
    right: -EDGE_THICKNESS / 2,
    top: HANDLE_VISUAL_SIZE,
    bottom: HANDLE_VISUAL_SIZE,
    width: EDGE_THICKNESS,
  },
  bottomContainer: {
    paddingHorizontal: 36,
    paddingBottom: 0,
  },
  aspectContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  aspectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  aspectButtonActive: {
    backgroundColor: "white",
  },
  aspectButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  aspectButtonTextActive: {
    color: "black",
  },
  actionContainer: {
    width: "100%",
  },
  doneButton: {
    width: "100%",
    backgroundColor: "white",
    paddingVertical: 16,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
  },
  doneButtonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ImageCropper;
