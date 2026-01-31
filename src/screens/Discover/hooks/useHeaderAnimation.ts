import { useRef, useCallback } from "react";
import { Animated, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  HEADER_ANIMATION_DURATION,
  SCROLL_THRESHOLD,
  BOTTOM_THRESHOLD,
  HEADER_HEIGHT,
} from "../constants";

interface UseHeaderAnimationReturn {
  headerHeight: Animated.Value;
  headerOpacity: Animated.Value;
  handleVerticalScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  interpolatedHeaderHeight: Animated.AnimatedInterpolation<number>;
}

/**
 * Header 动画 Hook
 * 管理 Header 的显示/隐藏动画
 */
export const useHeaderAnimation = (): UseHeaderAnimationReturn => {
  // Header 动画值
  const headerHeight = useRef(new Animated.Value(1)).current; // 1 = 显示, 0 = 隐藏
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const isHeaderVisible = useRef(true);
  const lastScrollY = useRef(0);

  /**
   * 处理垂直滚动（控制 header 显示/隐藏）
   */
  const handleVerticalScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;
      const contentHeight = event.nativeEvent.contentSize.height;
      const layoutHeight = event.nativeEvent.layoutMeasurement.height;

      // 检测是否接近底部
      const isNearBottom =
        currentScrollY + layoutHeight >= contentHeight - BOTTOM_THRESHOLD;

      // 向下滚动且超过阈值 - 隐藏 header
      if (
        currentScrollY > SCROLL_THRESHOLD &&
        currentScrollY > lastScrollY.current &&
        isHeaderVisible.current
      ) {
        isHeaderVisible.current = false;
        Animated.parallel([
          Animated.timing(headerHeight, {
            toValue: 0,
            duration: HEADER_ANIMATION_DURATION,
            useNativeDriver: false,
          }),
          Animated.timing(headerOpacity, {
            toValue: 0,
            duration: HEADER_ANIMATION_DURATION,
            useNativeDriver: false,
          }),
        ]).start();
      }
      // 向上滚动或接近顶部 - 显示 header（但如果在底部附近则不显示）
      else if (
        (currentScrollY < lastScrollY.current || currentScrollY <= 10) &&
        !isHeaderVisible.current &&
        !isNearBottom
      ) {
        isHeaderVisible.current = true;
        Animated.parallel([
          Animated.timing(headerHeight, {
            toValue: 1,
            duration: HEADER_ANIMATION_DURATION,
            useNativeDriver: false,
          }),
          Animated.timing(headerOpacity, {
            toValue: 1,
            duration: HEADER_ANIMATION_DURATION,
            useNativeDriver: false,
          }),
        ]).start();
      }

      lastScrollY.current = currentScrollY;
    },
    [headerHeight, headerOpacity]
  );

  // 插值动画：将 0-1 转换为实际高度
  const interpolatedHeaderHeight = headerHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, HEADER_HEIGHT],
  });

  return {
    headerHeight,
    headerOpacity,
    handleVerticalScroll,
    interpolatedHeaderHeight,
  };
};

export default useHeaderAnimation;
