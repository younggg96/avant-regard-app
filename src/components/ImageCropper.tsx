import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  StatusBar,
} from "react-native";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import {
  PanGestureHandler,
  GestureHandlerRootView,
  PanGestureHandlerGestureEvent,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Aspect ratio types and utilities
export type AspectRatio = "free" | "1:1" | "4:3" | "16:9" | "9:16";

interface AspectConfig {
  label: string;
  ratio?: number;
}

const ASPECT_CONFIGS: Record<AspectRatio, AspectConfig> = {
  free: { label: "自由裁剪" },
  "1:1": { label: "1:1", ratio: 1 },
  "4:3": { label: "4:3", ratio: 4 / 3 },
  "16:9": { label: "16:9", ratio: 16 / 9 },
  "9:16": { label: "9:16", ratio: 9 / 16 },
};

// Component props
export interface ImageCropperProps {
  sourceUri: string;
  aspect?: AspectRatio;
  onCancel: () => void;
  onDone: (resultUri: string) => void;
  minBoxSize?: number;
}

// Image display dimensions
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
  minBoxSize = 80,
}) => {
  // State
  const [selectedAspect, setSelectedAspect] = useState<AspectRatio>(aspect);
  const [imageDimensions, setImageDimensions] =
    useState<ImageDimensions | null>(null);
  const [originalImageSize, setOriginalImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Animated values for crop box
  const cropX = useSharedValue(50);
  const cropY = useSharedValue(100);
  const cropWidth = useSharedValue(200);
  const cropHeight = useSharedValue(200);

  // Shared values for image bounds (for use in worklets)
  const imageBoundsX = useSharedValue(0);
  const imageBoundsY = useSharedValue(0);
  const imageBoundsWidth = useSharedValue(SCREEN_WIDTH);
  const imageBoundsHeight = useSharedValue(SCREEN_HEIGHT);

  // Context for gesture handlers
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startWidth = useSharedValue(0);
  const startHeight = useSharedValue(0);

  // Update shared values when image dimensions change
  React.useEffect(() => {
    if (imageDimensions) {
      imageBoundsX.value = imageDimensions.x;
      imageBoundsY.value = imageDimensions.y;
      imageBoundsWidth.value = imageDimensions.width;
      imageBoundsHeight.value = imageDimensions.height;
    }
  }, [imageDimensions]);

  // Handle image load
  const handleImageLoad = useCallback(
    (event: any) => {
      const { width: imgWidth, height: imgHeight } = event.source;
      setOriginalImageSize({ width: imgWidth, height: imgHeight });

      // Calculate display dimensions (fit-contain)
      const containerWidth = SCREEN_WIDTH;
      const containerHeight = SCREEN_HEIGHT - 200; // Account for UI elements
      const imageAspectRatio = imgWidth / imgHeight;
      const containerAspectRatio = containerWidth / containerHeight;

      let displayWidth, displayHeight, displayX, displayY;

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

      // Update shared values immediately
      imageBoundsX.value = displayX;
      imageBoundsY.value = displayY;
      imageBoundsWidth.value = displayWidth;
      imageBoundsHeight.value = displayHeight;

      // Initialize crop box
      const initialSize = Math.min(displayWidth, displayHeight) * 0.8;
      const centerX = displayX + (displayWidth - initialSize) / 2;
      const centerY = displayY + (displayHeight - initialSize) / 2;

      cropX.value = centerX;
      cropY.value = centerY;
      cropWidth.value = initialSize;
      cropHeight.value = initialSize;
    },
    [
      imageBoundsX,
      imageBoundsY,
      imageBoundsWidth,
      imageBoundsHeight,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
    ]
  );

  // Pan gesture handler for moving crop box
  const panGestureHandler =
    useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
      onStart: () => {
        startX.value = cropX.value;
        startY.value = cropY.value;
      },
      onActive: (event) => {
        "worklet";

        let newX = startX.value + event.translationX;
        let newY = startY.value + event.translationY;

        // Constrain within image bounds using shared values
        const minX = imageBoundsX.value;
        const maxX =
          imageBoundsX.value + imageBoundsWidth.value - cropWidth.value;
        const minY = imageBoundsY.value;
        const maxY =
          imageBoundsY.value + imageBoundsHeight.value - cropHeight.value;

        // Clamp to bounds
        newX = Math.max(minX, Math.min(maxX, newX));
        newY = Math.max(minY, Math.min(maxY, newY));

        cropX.value = newX;
        cropY.value = newY;
      },
    });

  // Resize handlers
  const resizeHandlerNW =
    useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
      onStart: () => {
        startX.value = cropX.value;
        startY.value = cropY.value;
        startWidth.value = cropWidth.value;
        startHeight.value = cropHeight.value;
      },
      onActive: (event) => {
        "worklet";

        const config = ASPECT_CONFIGS[selectedAspect];

        // Fixed anchor point (bottom-right corner)
        const anchorX = startX.value + startWidth.value;
        const anchorY = startY.value + startHeight.value;

        // Calculate new dimensions based on drag
        let newWidth = startWidth.value - event.translationX;
        let newHeight = startHeight.value - event.translationY;

        // Apply minimum size
        newWidth = Math.max(minBoxSize, newWidth);
        newHeight = Math.max(minBoxSize, newHeight);

        // Apply aspect ratio
        if (config.ratio) {
          // When dragging NW corner, prioritize width
          newHeight = newWidth / config.ratio;
        }

        // Calculate new position (top-left moves, bottom-right stays fixed)
        let newX = anchorX - newWidth;
        let newY = anchorY - newHeight;

        // Constrain to image boundaries using shared values
        // Ensure we don't go beyond left edge
        if (newX < imageBoundsX.value) {
          newX = imageBoundsX.value;
          newWidth = anchorX - newX;
          if (config.ratio) {
            newHeight = newWidth / config.ratio;
            newY = anchorY - newHeight;
          }
        }

        // Ensure we don't go beyond top edge
        if (newY < imageBoundsY.value) {
          newY = imageBoundsY.value;
          newHeight = anchorY - newY;
          if (config.ratio) {
            newWidth = newHeight * config.ratio;
            newX = anchorX - newWidth;
            // Re-check left boundary
            if (newX < imageBoundsX.value) {
              newX = imageBoundsX.value;
              newWidth = anchorX - newX;
              newHeight = newWidth / config.ratio;
              newY = anchorY - newHeight;
            }
          }
        }

        // Ensure anchor doesn't exceed image bounds
        if (anchorX > imageBoundsX.value + imageBoundsWidth.value) {
          newWidth = imageBoundsX.value + imageBoundsWidth.value - newX;
          if (config.ratio) {
            newHeight = newWidth / config.ratio;
          }
        }

        if (anchorY > imageBoundsY.value + imageBoundsHeight.value) {
          newHeight = imageBoundsY.value + imageBoundsHeight.value - newY;
          if (config.ratio) {
            newWidth = newHeight * config.ratio;
            newX = anchorX - newWidth;
          }
        }

        // Final boundary check - ensure crop box is completely within image
        newX = Math.max(imageBoundsX.value, newX);
        newY = Math.max(imageBoundsY.value, newY);

        // Ensure right and bottom don't exceed
        const finalMaxWidth =
          imageBoundsX.value + imageBoundsWidth.value - newX;
        const finalMaxHeight =
          imageBoundsY.value + imageBoundsHeight.value - newY;

        newWidth = Math.min(newWidth, finalMaxWidth);
        newHeight = Math.min(newHeight, finalMaxHeight);

        cropX.value = newX;
        cropY.value = newY;
        cropWidth.value = Math.max(minBoxSize, newWidth);
        cropHeight.value = Math.max(minBoxSize, newHeight);
      },
    });

  const resizeHandlerNE =
    useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
      onStart: () => {
        startX.value = cropX.value;
        startY.value = cropY.value;
        startWidth.value = cropWidth.value;
        startHeight.value = cropHeight.value;
      },
      onActive: (event) => {
        "worklet";

        const config = ASPECT_CONFIGS[selectedAspect];

        // Fixed anchor point (bottom-left corner)
        const anchorX = startX.value;
        const anchorY = startY.value + startHeight.value;

        let newWidth = startWidth.value + event.translationX;
        let newHeight = startHeight.value - event.translationY;

        newWidth = Math.max(minBoxSize, newWidth);
        newHeight = Math.max(minBoxSize, newHeight);

        if (config.ratio) {
          newHeight = newWidth / config.ratio;
        }

        let newY = anchorY - newHeight;

        // Right boundary
        const maxWidth = imageBoundsX.value + imageBoundsWidth.value - anchorX;
        if (newWidth > maxWidth) {
          newWidth = maxWidth;
          if (config.ratio) {
            newHeight = newWidth / config.ratio;
            newY = anchorY - newHeight;
          }
        }

        // Top boundary
        if (newY < imageBoundsY.value) {
          newY = imageBoundsY.value;
          newHeight = anchorY - newY;
          if (config.ratio) {
            newWidth = newHeight * config.ratio;
            // Re-check right boundary
            if (
              anchorX + newWidth >
              imageBoundsX.value + imageBoundsWidth.value
            ) {
              newWidth = imageBoundsX.value + imageBoundsWidth.value - anchorX;
              newHeight = newWidth / config.ratio;
              newY = anchorY - newHeight;
            }
          }
        }

        // Bottom boundary (anchor shouldn't exceed)
        if (anchorY > imageBoundsY.value + imageBoundsHeight.value) {
          newHeight = imageBoundsY.value + imageBoundsHeight.value - newY;
          if (config.ratio) {
            newWidth = newHeight * config.ratio;
          }
        }

        // Final boundary check - ensure crop box is completely within image
        newY = Math.max(imageBoundsY.value, newY);

        // Ensure right edge doesn't exceed
        const finalMaxWidth =
          imageBoundsX.value + imageBoundsWidth.value - anchorX;
        newWidth = Math.min(newWidth, finalMaxWidth);

        // Ensure bottom edge doesn't exceed
        const finalMaxHeight =
          imageBoundsY.value + imageBoundsHeight.value - newY;
        newHeight = Math.min(newHeight, finalMaxHeight);

        cropY.value = newY;
        cropWidth.value = Math.max(minBoxSize, newWidth);
        cropHeight.value = Math.max(minBoxSize, newHeight);
      },
    });

  const resizeHandlerSW =
    useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
      onStart: () => {
        startX.value = cropX.value;
        startY.value = cropY.value;
        startWidth.value = cropWidth.value;
        startHeight.value = cropHeight.value;
      },
      onActive: (event) => {
        "worklet";

        const config = ASPECT_CONFIGS[selectedAspect];

        // Fixed anchor point (top-right corner)
        const anchorX = startX.value + startWidth.value;
        const anchorY = startY.value;

        let newWidth = startWidth.value - event.translationX;
        let newHeight = startHeight.value + event.translationY;

        newWidth = Math.max(minBoxSize, newWidth);
        newHeight = Math.max(minBoxSize, newHeight);

        if (config.ratio) {
          newHeight = newWidth / config.ratio;
        }

        let newX = anchorX - newWidth;

        // Left boundary
        if (newX < imageBoundsX.value) {
          newX = imageBoundsX.value;
          newWidth = anchorX - newX;
          if (config.ratio) {
            newHeight = newWidth / config.ratio;
          }
        }

        // Right boundary (anchor shouldn't exceed)
        if (anchorX > imageBoundsX.value + imageBoundsWidth.value) {
          newWidth = imageBoundsX.value + imageBoundsWidth.value - newX;
          if (config.ratio) {
            newHeight = newWidth / config.ratio;
          }
        }

        // Bottom boundary
        const maxHeight =
          imageBoundsY.value + imageBoundsHeight.value - anchorY;
        if (newHeight > maxHeight) {
          newHeight = maxHeight;
          if (config.ratio) {
            newWidth = newHeight * config.ratio;
            newX = anchorX - newWidth;
            // Re-check left boundary
            if (newX < imageBoundsX.value) {
              newX = imageBoundsX.value;
              newWidth = anchorX - newX;
              newHeight = newWidth / config.ratio;
            }
          }
        }

        // Final boundary check - ensure crop box is completely within image
        newX = Math.max(imageBoundsX.value, newX);

        // Ensure right edge doesn't exceed
        const finalMaxWidth =
          imageBoundsX.value + imageBoundsWidth.value - newX;
        newWidth = Math.min(newWidth, finalMaxWidth);

        // Ensure bottom edge doesn't exceed (anchor is at top)
        const finalMaxHeight =
          imageBoundsY.value + imageBoundsHeight.value - anchorY;
        newHeight = Math.min(newHeight, finalMaxHeight);

        cropX.value = newX;
        cropWidth.value = Math.max(minBoxSize, newWidth);
        cropHeight.value = Math.max(minBoxSize, newHeight);
      },
    });

  const resizeHandlerSE =
    useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
      onStart: () => {
        startX.value = cropX.value;
        startY.value = cropY.value;
        startWidth.value = cropWidth.value;
        startHeight.value = cropHeight.value;
      },
      onActive: (event) => {
        "worklet";

        const config = ASPECT_CONFIGS[selectedAspect];

        // Top-left corner is fixed
        let newWidth = startWidth.value + event.translationX;
        let newHeight = startHeight.value + event.translationY;

        newWidth = Math.max(minBoxSize, newWidth);
        newHeight = Math.max(minBoxSize, newHeight);

        if (config.ratio) {
          // Prioritize width when dragging SE
          newHeight = newWidth / config.ratio;
        }

        // Calculate maximum available space
        const maxWidth =
          imageBoundsX.value + imageBoundsWidth.value - startX.value;
        const maxHeight =
          imageBoundsY.value + imageBoundsHeight.value - startY.value;

        // Constrain to image bounds
        if (newWidth > maxWidth) {
          newWidth = maxWidth;
          if (config.ratio) {
            newHeight = newWidth / config.ratio;
            // If height exceeds, recalculate from height
            if (newHeight > maxHeight) {
              newHeight = maxHeight;
              newWidth = newHeight * config.ratio;
              // Final check
              if (newWidth > maxWidth) {
                newWidth = maxWidth;
                newHeight = newWidth / config.ratio;
              }
            }
          }
        }

        if (newHeight > maxHeight) {
          newHeight = maxHeight;
          if (config.ratio) {
            newWidth = newHeight * config.ratio;
            // Re-check width
            if (newWidth > maxWidth) {
              newWidth = maxWidth;
              newHeight = newWidth / config.ratio;
            }
          }
        }

        // Final boundary check - absolutely ensure we're within bounds
        newWidth = Math.min(newWidth, maxWidth);
        newHeight = Math.min(newHeight, maxHeight);

        cropWidth.value = Math.max(minBoxSize, newWidth);
        cropHeight.value = Math.max(minBoxSize, newHeight);
      },
    });

  // Animated styles
  const cropBoxStyle = useAnimatedStyle(() => {
    "worklet";

    // Final safety clamp - ensure crop box never exceeds image bounds
    const safeX = Math.max(
      imageBoundsX.value,
      Math.min(
        imageBoundsX.value + imageBoundsWidth.value - cropWidth.value,
        cropX.value
      )
    );

    const safeY = Math.max(
      imageBoundsY.value,
      Math.min(
        imageBoundsY.value + imageBoundsHeight.value - cropHeight.value,
        cropY.value
      )
    );

    const safeWidth = Math.min(
      cropWidth.value,
      imageBoundsX.value + imageBoundsWidth.value - safeX
    );

    const safeHeight = Math.min(
      cropHeight.value,
      imageBoundsY.value + imageBoundsHeight.value - safeY
    );

    return {
      position: "absolute",
      left: safeX,
      top: safeY,
      width: safeWidth,
      height: safeHeight,
      borderWidth: 2,
      borderColor: "white",
      backgroundColor: "transparent",
    };
  });

  const maskStyle = useAnimatedStyle(() => ({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  }));

  // Handle aspect ratio change
  const handleAspectChange = (newAspect: AspectRatio) => {
    if (!imageDimensions) return;

    setSelectedAspect(newAspect);
    const config = ASPECT_CONFIGS[newAspect];

    let newWidth = cropWidth.value;
    let newHeight = cropHeight.value;

    if (config.ratio) {
      const currentCenterX = cropX.value + cropWidth.value / 2;
      const currentCenterY = cropY.value + cropHeight.value / 2;

      // Calculate new dimensions based on ratio
      if (config.ratio > 1) {
        // Wider than tall (e.g., 16:9, 4:3)
        newHeight = Math.min(
          imageDimensions.height * 0.9,
          newWidth / config.ratio
        );
        newWidth = newHeight * config.ratio;
      } else {
        // Taller than wide (e.g., 9:16)
        newWidth = Math.min(
          imageDimensions.width * 0.9,
          newHeight * config.ratio
        );
        newHeight = newWidth / config.ratio;
      }

      // Ensure dimensions fit within image bounds
      const maxPossibleWidth = imageDimensions.width;
      const maxPossibleHeight = imageDimensions.height;

      if (newWidth > maxPossibleWidth) {
        newWidth = maxPossibleWidth;
        newHeight = newWidth / config.ratio;
      }

      if (newHeight > maxPossibleHeight) {
        newHeight = maxPossibleHeight;
        newWidth = newHeight * config.ratio;
      }

      // Calculate new position centered on current position
      let newX = Math.max(
        imageDimensions.x,
        Math.min(
          imageDimensions.x + imageDimensions.width - newWidth,
          currentCenterX - newWidth / 2
        )
      );
      let newY = Math.max(
        imageDimensions.y,
        Math.min(
          imageDimensions.y + imageDimensions.height - newHeight,
          currentCenterY - newHeight / 2
        )
      );

      // Final safety check - ensure crop box is completely within image
      if (newX + newWidth > imageDimensions.x + imageDimensions.width) {
        newX = imageDimensions.x + imageDimensions.width - newWidth;
      }
      if (newY + newHeight > imageDimensions.y + imageDimensions.height) {
        newY = imageDimensions.y + imageDimensions.height - newHeight;
      }

      cropX.value = withSpring(newX);
      cropY.value = withSpring(newY);
    }

    cropWidth.value = withSpring(newWidth);
    cropHeight.value = withSpring(newHeight);
  };

  // Handle crop and save
  const handleDone = async () => {
    if (!imageDimensions || !originalImageSize) return;

    try {
      const scaleX = originalImageSize.width / imageDimensions.width;
      const scaleY = originalImageSize.height / imageDimensions.height;

      const cropConfig = {
        originX: Math.max(0, (cropX.value - imageDimensions.x) * scaleX),
        originY: Math.max(0, (cropY.value - imageDimensions.y) * scaleY),
        width: Math.min(cropWidth.value * scaleX, originalImageSize.width),
        height: Math.min(cropHeight.value * scaleY, originalImageSize.height),
      };

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
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <GestureHandlerRootView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>裁剪图片</Text>
          <View style={styles.headerButton} />
        </View>

        {/* Image and crop area */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: sourceUri }}
            style={styles.image}
            contentFit="contain"
            onLoad={handleImageLoad}
          />

          {/* Mask overlay */}
          <Animated.View style={maskStyle} pointerEvents="none" />

          {/* Crop box */}
          {imageDimensions && (
            <PanGestureHandler onGestureEvent={panGestureHandler}>
              <Animated.View style={cropBoxStyle}>
                {/* Grid lines */}
                <View style={styles.gridContainer}>
                  <View style={[styles.gridLine, { top: "33.33%" }]} />
                  <View style={[styles.gridLine, { top: "66.66%" }]} />
                  <View style={[styles.gridLineVertical, { left: "33.33%" }]} />
                  <View style={[styles.gridLineVertical, { left: "66.66%" }]} />
                </View>

                {/* Corner handles */}
                <PanGestureHandler onGestureEvent={resizeHandlerNW}>
                  <Animated.View style={[styles.handle, styles.handleNW]} />
                </PanGestureHandler>
                <PanGestureHandler onGestureEvent={resizeHandlerNE}>
                  <Animated.View style={[styles.handle, styles.handleNE]} />
                </PanGestureHandler>
                <PanGestureHandler onGestureEvent={resizeHandlerSW}>
                  <Animated.View style={[styles.handle, styles.handleSW]} />
                </PanGestureHandler>
                <PanGestureHandler onGestureEvent={resizeHandlerSE}>
                  <Animated.View style={[styles.handle, styles.handleSE]} />
                </PanGestureHandler>
              </Animated.View>
            </PanGestureHandler>
          )}
        </View>

        {/* Bottom controls */}
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
                  {ASPECT_CONFIGS[aspectKey].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actionContainer}>
            <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
              <Text style={styles.doneButtonText}>完成裁剪</Text>
            </TouchableOpacity>
          </View>
        </View>
      </GestureHandlerRootView>
    </SafeAreaView>
  );
};

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
  imageContainer: {
    flex: 1,
    position: "relative",
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
    width: 20,
    height: 20,
    backgroundColor: "white",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "black",
  },
  handleNW: {
    top: -10,
    left: -10,
  },
  handleNE: {
    top: -10,
    right: -10,
  },
  handleSW: {
    bottom: -10,
    left: -10,
  },
  handleSE: {
    bottom: -10,
    right: -10,
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
    borderRadius: 20,
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
    borderRadius: 8,
    alignItems: "center",
  },
  doneButtonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ImageCropper;
