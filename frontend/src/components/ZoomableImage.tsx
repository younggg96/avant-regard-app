/**
 * ZoomableImage
 *
 * Reusable pinch-to-zoom / pan / double-tap image viewer tile built on
 * `react-native-gesture-handler` + `react-native-reanimated`.
 *
 * Designed to be embedded inside fullscreen image viewers (post carousel,
 * avatar preview, generic image preview modal). All gesture state lives
 * on the UI thread via shared values, so it stays 60fps even when the
 * parent is a horizontal `FlatList` pager.
 *
 * Interaction rules (aligned with iOS Photos.app):
 *   - Pinch with two fingers to zoom (clamped to [1x, 4x], rubber-banded
 *     beyond 1x so the release animates back).
 *   - Pan with one finger while zoomed moves within the image. Pan is
 *     clamped to the wrapper bounds so the zoomed image cannot leave the
 *     visible rect. While NOT zoomed, the pan gesture is disabled so a
 *     parent `FlatList` pager can still receive horizontal swipes.
 *   - Double tap toggles between 1x and 2.5x.
 *   - Single tap forwards to `onTap` (used for tap-to-close/dismiss).
 *
 * The component also reports `onZoomChange(isZoomed)` so a parent pager
 * can disable horizontal paging while the image is zoomed.
 *
 * IMPORTANT: Because React Native's `Modal` creates a new view hierarchy,
 * callers MUST wrap this component in a `GestureHandlerRootView`. The
 * fullscreen image modals in this codebase do so at their root.
 */
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { OptimizedImage } from "./ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";

export interface ZoomableImageProps {
  uri: string;
  width: number;
  height: number;
  /**
   * Called when the zoom level crosses in/out of the "zoomed" state
   * (currently 1x vs > 1x). Parents use this to toggle pager scroll.
   */
  onZoomChange?: (isZoomed: boolean) => void;
  /**
   * Single-tap handler. Runs only when the tap is not part of a pinch /
   * pan / double-tap sequence, so callers can safely wire this to
   * dismiss the overlay.
   */
  onTap?: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

const ZoomableImageInner: React.FC<ZoomableImageProps> = ({
  uri,
  width,
  height,
  onZoomChange,
  onTap,
}) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Mirror the zoom state on the JS thread so we can reactively
  // `.enabled()` the pan gesture. Without this guard, `Gesture.Pan` would
  // intercept horizontal swipes at 1x and prevent the carousel from
  // paging to the next image.
  const [isZoomed, setIsZoomed] = useState(false);

  const handleZoomChange = useCallback(
    (zoomed: boolean) => {
      setIsZoomed(zoomed);
      onZoomChange?.(zoomed);
    },
    [onZoomChange]
  );

  const emitTap = useCallback(() => {
    onTap?.();
  }, [onTap]);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((e) => {
          "worklet";
          const next = savedScale.value * e.scale;
          scale.value = Math.max(MIN_SCALE * 0.8, Math.min(MAX_SCALE, next));
        })
        .onEnd(() => {
          "worklet";
          const wasZoomed = savedScale.value > 1.01;
          if (scale.value < MIN_SCALE) {
            scale.value = withTiming(MIN_SCALE);
            savedScale.value = MIN_SCALE;
            translateX.value = withTiming(0);
            translateY.value = withTiming(0);
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
            if (wasZoomed) runOnJS(handleZoomChange)(false);
            return;
          }
          if (scale.value > MAX_SCALE) {
            scale.value = withTiming(MAX_SCALE);
            savedScale.value = MAX_SCALE;
          } else {
            savedScale.value = scale.value;
          }
          const maxX = Math.max(0, (width * savedScale.value - width) / 2);
          const maxY = Math.max(0, (height * savedScale.value - height) / 2);
          const clampedX = Math.min(maxX, Math.max(-maxX, translateX.value));
          const clampedY = Math.min(maxY, Math.max(-maxY, translateY.value));
          translateX.value = withTiming(clampedX);
          translateY.value = withTiming(clampedY);
          savedTranslateX.value = clampedX;
          savedTranslateY.value = clampedY;
          const nowZoomed = savedScale.value > 1.01;
          if (nowZoomed !== wasZoomed) runOnJS(handleZoomChange)(nowZoomed);
        }),
    [width, height, scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY, handleZoomChange]
  );

  // Pan is only enabled while zoomed so horizontal swipes at 1x fall
  // through to the carousel ScrollView / FlatList. Recomputing the
  // gesture on `isZoomed` toggles rewires the `.enabled()` flag.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isZoomed)
        .maxPointers(2)
        .onUpdate((e) => {
          "worklet";
          translateX.value = savedTranslateX.value + e.translationX;
          translateY.value = savedTranslateY.value + e.translationY;
        })
        .onEnd(() => {
          "worklet";
          const maxX = Math.max(0, (width * savedScale.value - width) / 2);
          const maxY = Math.max(0, (height * savedScale.value - height) / 2);
          const clampedX = Math.min(maxX, Math.max(-maxX, translateX.value));
          const clampedY = Math.min(maxY, Math.max(-maxY, translateY.value));
          translateX.value = withTiming(clampedX);
          translateY.value = withTiming(clampedY);
          savedTranslateX.value = clampedX;
          savedTranslateY.value = clampedY;
        }),
    [isZoomed, width, height, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]
  );

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(250)
        .onEnd((_e, success) => {
          "worklet";
          if (!success) return;
          const wasZoomed = savedScale.value > 1.01;
          if (wasZoomed) {
            scale.value = withTiming(1);
            savedScale.value = 1;
            translateX.value = withTiming(0);
            translateY.value = withTiming(0);
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
            runOnJS(handleZoomChange)(false);
          } else {
            scale.value = withTiming(DOUBLE_TAP_SCALE);
            savedScale.value = DOUBLE_TAP_SCALE;
            runOnJS(handleZoomChange)(true);
          }
        }),
    [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY, handleZoomChange]
  );

  // Single-tap is only wired up when a handler is provided; this lets
  // callers that don't care about taps (e.g. the post carousel) avoid
  // the ~250ms delay double-tap would otherwise impose.
  const singleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(1)
        .maxDelay(250)
        .onEnd((_e, success) => {
          "worklet";
          if (!success) return;
          runOnJS(emitTap)();
        }),
    [emitTap]
  );

  const composed = useMemo(() => {
    const tapComposite = onTap
      ? Gesture.Exclusive(doubleTap, singleTap)
      : doubleTap;
    return Gesture.Simultaneous(pinch, pan, tapComposite);
  }, [pinch, pan, doubleTap, singleTap, onTap]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[styles.wrapper, { width, height }, animatedStyle]}
      >
        <OptimizedImage
          uri={uri}
          size={ImageSize.ORIGINAL}
          style={styles.image}
          contentFit="contain"
          priority="high"
          lazy={false}
        />
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

export const ZoomableImage = React.memo(ZoomableImageInner);
ZoomableImage.displayName = "ZoomableImage";

export default ZoomableImage;
