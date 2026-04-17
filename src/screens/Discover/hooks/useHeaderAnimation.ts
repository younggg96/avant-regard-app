import { useCallback, useRef } from "react";
import { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import {
  HEADER_ANIMATION_DURATION,
  SCROLL_THRESHOLD,
  BOTTOM_THRESHOLD,
  HEADER_HEIGHT,
} from "../constants";

interface UseHeaderAnimationReturn {
  /**
   * Reanimated style driving both `height` and `opacity` of the Header
   * container. Applied directly on `Animated.View` (from `react-native-reanimated`).
   * The animation runs on the UI thread, so it does not fight with the JS
   * scroll handler and image decoding on the first downward scroll.
   */
  headerAnimatedStyle: ReturnType<typeof useAnimatedStyle>;
  handleVerticalScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

/**
 * Header show/hide animation for the Discover screen.
 *
 * Why reanimated instead of `Animated` (RN core):
 *   • The collapsed state has to animate `height` (layout prop) to remove the
 *     reserved space. Core `Animated` cannot run layout props on the native
 *     driver, so the old implementation was forced into `useNativeDriver: false`.
 *     That means every frame of the 150ms transition was relayout-on-JS-thread,
 *     which stuttered during the first scroll-down (while images were decoding
 *     and the feed was still fetching). See PROGRESS_LOG 2026-04-16 for context.
 *   • Reanimated drives the animation on the UI thread, height included, so
 *     the JS thread stays free for scroll + data work.
 *
 * Scroll direction detection still happens on the JS thread (we need to read
 * `contentOffset.y` and compare with `lastScrollY`), but the handler is O(1)
 * and only *triggers* an animation when the direction flips — it doesn't
 * block every frame.
 */
export const useHeaderAnimation = (): UseHeaderAnimationReturn => {
  // 1 == header fully visible, 0 == fully collapsed.
  const progress = useSharedValue(1);
  const isHeaderVisible = useRef(true);
  const lastScrollY = useRef(0);

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    height: progress.value * HEADER_HEIGHT,
    opacity: progress.value,
  }));

  const handleVerticalScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;
      const contentHeight = event.nativeEvent.contentSize.height;
      const layoutHeight = event.nativeEvent.layoutMeasurement.height;
      const isNearBottom =
        currentScrollY + layoutHeight >= contentHeight - BOTTOM_THRESHOLD;

      const scrollingDown =
        currentScrollY > SCROLL_THRESHOLD &&
        currentScrollY > lastScrollY.current;
      const scrollingUp =
        currentScrollY < lastScrollY.current || currentScrollY <= 10;

      if (scrollingDown && isHeaderVisible.current) {
        isHeaderVisible.current = false;
        progress.value = withTiming(0, {
          duration: HEADER_ANIMATION_DURATION,
          easing: Easing.out(Easing.quad),
        });
      } else if (scrollingUp && !isHeaderVisible.current && !isNearBottom) {
        isHeaderVisible.current = true;
        progress.value = withTiming(1, {
          duration: HEADER_ANIMATION_DURATION,
          easing: Easing.out(Easing.quad),
        });
      }

      lastScrollY.current = currentScrollY;
    },
    [progress]
  );

  return {
    headerAnimatedStyle,
    handleVerticalScroll,
  };
};

export default useHeaderAnimation;
