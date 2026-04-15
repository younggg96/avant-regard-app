import { useRef, useCallback } from "react";
import { Animated, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  HEADER_ANIMATION_DURATION,
  SCROLL_THRESHOLD,
  BOTTOM_THRESHOLD,
  HEADER_HEIGHT,
} from "../constants";

interface UseHeaderAnimationReturn {
  headerOpacity: Animated.Value;
  handleVerticalScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  interpolatedHeaderHeight: Animated.AnimatedInterpolation<number>;
}

/**
 * Header animation hook.
 * Uses a single Animated.Value driving both height and opacity.
 * useNativeDriver: false is required because `height` is a layout property,
 * but this only fires during show/hide transitions (~150ms), not every scroll frame.
 */
export const useHeaderAnimation = (): UseHeaderAnimationReturn => {
  const animValue = useRef(new Animated.Value(1)).current;
  const isHeaderVisible = useRef(true);
  const lastScrollY = useRef(0);

  const handleVerticalScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;
      const contentHeight = event.nativeEvent.contentSize.height;
      const layoutHeight = event.nativeEvent.layoutMeasurement.height;
      const isNearBottom =
        currentScrollY + layoutHeight >= contentHeight - BOTTOM_THRESHOLD;

      if (
        currentScrollY > SCROLL_THRESHOLD &&
        currentScrollY > lastScrollY.current &&
        isHeaderVisible.current
      ) {
        isHeaderVisible.current = false;
        Animated.timing(animValue, {
          toValue: 0,
          duration: HEADER_ANIMATION_DURATION,
          useNativeDriver: false,
        }).start();
      } else if (
        (currentScrollY < lastScrollY.current || currentScrollY <= 10) &&
        !isHeaderVisible.current &&
        !isNearBottom
      ) {
        isHeaderVisible.current = true;
        Animated.timing(animValue, {
          toValue: 1,
          duration: HEADER_ANIMATION_DURATION,
          useNativeDriver: false,
        }).start();
      }

      lastScrollY.current = currentScrollY;
    },
    [animValue]
  );

  const interpolatedHeaderHeight = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, HEADER_HEIGHT],
  });

  return {
    headerOpacity: animValue,
    handleVerticalScroll,
    interpolatedHeaderHeight,
  };
};

export default useHeaderAnimation;
