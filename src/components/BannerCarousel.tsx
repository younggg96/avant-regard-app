/**
 * BannerCarousel 组件 - 首页轮播图
 */
import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text, Box, HStack } from "./ui";
import { theme } from "../theme";
import { Banner } from "../services/bannerService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_HEIGHT = 180;
const AUTO_SCROLL_INTERVAL = 4000; // 4秒自动切换

interface BannerCarouselProps {
  banners: Banner[];
  onBannerPress?: (banner: Banner) => void;
}

const BannerCarousel: React.FC<BannerCarouselProps> = ({
  banners,
  onBannerPress,
}) => {
  const scrollViewRef = useRef<Animated.FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const autoScrollTimer = useRef<NodeJS.Timeout | null>(null);
  const isUserScrolling = useRef(false);

  // 自动轮播
  const startAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
    }

    if (banners.length <= 1) return;

    autoScrollTimer.current = setInterval(() => {
      if (!isUserScrolling.current) {
        const nextIndex = (currentIndex + 1) % banners.length;
        scrollViewRef.current?.scrollToOffset({
          offset: nextIndex * SCREEN_WIDTH,
          animated: true,
        });
        setCurrentIndex(nextIndex);
      }
    }, AUTO_SCROLL_INTERVAL);
  }, [banners.length, currentIndex]);

  useEffect(() => {
    startAutoScroll();
    return () => {
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
      }
    };
  }, [startAutoScroll]);

  // 处理滚动结束
  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      setCurrentIndex(index);
      isUserScrolling.current = false;
      startAutoScroll();
    },
    [startAutoScroll]
  );

  // 处理用户开始滚动
  const handleScrollBegin = useCallback(() => {
    isUserScrolling.current = true;
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
    }
  }, []);

  // 处理 Banner 点击
  const handleBannerPress = useCallback(
    (banner: Banner) => {
      if (onBannerPress) {
        onBannerPress(banner);
      }
    },
    [onBannerPress]
  );

  // 渲染单个 Banner
  const renderBannerItem = useCallback(
    ({ item }: { item: Banner }) => (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => handleBannerPress(item)}
        style={styles.bannerItem}
      >
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.bannerImage}
          resizeMode="cover"
        />
        {/* 渐变遮罩 */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.6)"]}
          style={styles.gradient}
        />
        {/* 文字内容 */}
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.subtitle && (
            <Text style={styles.bannerSubtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    ),
    [handleBannerPress]
  );

  if (banners.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={scrollViewRef}
        data={banners}
        renderItem={renderBannerItem}
        keyExtractor={(item) => String(item.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollBeginDrag={handleScrollBegin}
        scrollEventThrottle={16}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />
      
      {/* 指示器 */}
      {banners.length > 1 && (
        <HStack style={styles.indicatorContainer}>
          {banners.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentIndex && styles.indicatorActive,
              ]}
            />
          ))}
        </HStack>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: BANNER_HEIGHT,
    backgroundColor: theme.colors.gray100,
  },
  bannerItem: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: BANNER_HEIGHT * 0.6,
  },
  bannerContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.white,
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 4,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  indicatorContainer: {
    position: "absolute",
    bottom: theme.spacing.sm,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  indicatorActive: {
    width: 18,
    backgroundColor: theme.colors.white,
  },
});

export default BannerCarousel;
