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
  TOP_EXPAND_THRESHOLD,
  HEADER_HEIGHT,
} from "../constants";

// After a refresh ends, suppress header collapse for this window to let
// the RefreshControl bounce-back animation settle. Without this, the
// transient scroll-Y spikes from the bounce can trigger an immediate
// collapse → expand cycle (visible as a one-frame flicker).
const REFRESH_COOLDOWN_MS = 400;

interface UseHeaderAnimationReturn {
  /**
   * Reanimated style driving both `height` and `opacity` of the Header
   * container. Applied directly on `Animated.View` (from `react-native-reanimated`).
   * The animation runs on the UI thread, so it does not fight with the JS
   * scroll handler and image decoding on the first downward scroll.
   */
  headerAnimatedStyle: ReturnType<typeof useAnimatedStyle>;
  handleVerticalScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /**
   * Sync the parent's `refreshing` state so the animation can suppress
   * scroll-driven collapse/expand during pull-to-refresh and avoid
   * header jitter + post-refresh blank space.
   */
  notifyRefreshing: (refreshing: boolean) => void;
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
 * Collapse/expand policy (2026-04-26 update):
 *   • Collapse  : user scrolls down past `SCROLL_THRESHOLD` while the Y
 *                 coordinate is still increasing. This matches the
 *                 "content-first" feed idiom — the header gets out of the way
 *                 as soon as the user shows intent to read.
 *   • Expand    : ONLY when the user has scrolled all the way back within
 *                 `TOP_EXPAND_THRESHOLD` of the top. Intentionally we do NOT
 *                 expand on direction flip in the middle of the list — a
 *                 half-swipe up while reading used to pop the header back
 *                 down over content, which felt noisy. With this rule the
 *                 header only reappears when the user is clearly "back at
 *                 home".
 *
 * Refresh-awareness (2026-04-26 fix):
 *   During pull-to-refresh the RefreshControl bounce-back produces rapid
 *   `contentOffset.y` fluctuations that whip past SCROLL_THRESHOLD and
 *   back to 0 within a few frames — triggering a collapse → expand cycle
 *   visible as header jitter. Additionally, if the header stays collapsed
 *   when the refresh finishes and the scroll offset settles above
 *   `TOP_EXPAND_THRESHOLD`, the user sees blank space that never
 *   collapses.
 *
 *   Fix: `notifyRefreshing(true)` suppresses all scroll-driven
 *   collapse/expand and forces the header visible. After
 *   `notifyRefreshing(false)`, a `REFRESH_COOLDOWN_MS` window suppresses
 *   collapse only, so the header cannot flicker during the last bounce
 *   frames while still expanding promptly.
 *
 * Scroll direction tracking (`lastScrollY`) is kept only for the collapse
 * side; the expand side is position-based so a user lingering at the top
 * after a pull-to-refresh still gets the header back.
 */
export const useHeaderAnimation = (): UseHeaderAnimationReturn => {
  // 1 == header fully visible, 0 == fully collapsed.
  const progress = useSharedValue(1);
  const isHeaderVisible = useRef(true);
  const lastScrollY = useRef(0);
  const isRefreshingRef = useRef(false);
  const refreshEndTimeRef = useRef(0);

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    height: progress.value * HEADER_HEIGHT,
    opacity: progress.value,
  }));

  const notifyRefreshing = useCallback(
    (refreshing: boolean) => {
      const wasRefreshing = isRefreshingRef.current;
      isRefreshingRef.current = refreshing;

      if (refreshing && !isHeaderVisible.current) {
        isHeaderVisible.current = true;
        progress.value = withTiming(1, {
          duration: HEADER_ANIMATION_DURATION,
          easing: Easing.out(Easing.quad),
        });
      }

      if (wasRefreshing && !refreshing) {
        lastScrollY.current = 0;
        refreshEndTimeRef.current = Date.now();
      }
    },
    [progress]
  );

  const handleVerticalScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;

      if (isRefreshingRef.current) {
        lastScrollY.current = currentScrollY;
        return;
      }

      const inCooldown =
        Date.now() - refreshEndTimeRef.current < REFRESH_COOLDOWN_MS;

      const shouldCollapse =
        !inCooldown &&
        currentScrollY > SCROLL_THRESHOLD &&
        currentScrollY > lastScrollY.current;
      const shouldExpand = currentScrollY <= TOP_EXPAND_THRESHOLD;

      if (shouldCollapse && isHeaderVisible.current) {
        isHeaderVisible.current = false;
        progress.value = withTiming(0, {
          duration: HEADER_ANIMATION_DURATION,
          easing: Easing.out(Easing.quad),
        });
      } else if (shouldExpand && !isHeaderVisible.current) {
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
    notifyRefreshing,
  };
};

export default useHeaderAnimation;
