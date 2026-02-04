/**
 * BannerCarousel 组件 - 首页轮播图（卡片式，可显示多张）
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
import { Text, HStack } from "./ui";
import { theme } from "../theme";
import { Banner } from "../services/bannerService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_HEIGHT = 180;
const AUTO_SCROLL_INTERVAL = 4000; // 4秒自动切换

// 卡片式轮播配置
const CARD_MARGIN = 6; // 卡片左右间距
const SIDE_PEEK = 40; // 两侧露出的宽度
const CARD_WIDTH = SCREEN_WIDTH - (SIDE_PEEK * 2); // 卡片宽度
const SNAP_INTERVAL = CARD_WIDTH; // 滑动对齐间隔

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
  const scrollX = useRef(new Animated.Value(0)).current;

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
          offset: nextIndex * SNAP_INTERVAL,
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
      const index = Math.round(offsetX / SNAP_INTERVAL);
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
    ({ item, index }: { item: Banner; index: number }) => {
      // 计算卡片的缩放和透明度
      const inputRange = [
        (index - 1) * SNAP_INTERVAL,
        index * SNAP_INTERVAL,
        (index + 1) * SNAP_INTERVAL,
      ];

      const scale = scrollX.interpolate({
        inputRange,
        outputRange: [0.92, 1, 0.92],
        extrapolate: "clamp",
      });

      const opacity = scrollX.interpolate({
        inputRange,
        outputRange: [0.7, 1, 0.7],
        extrapolate: "clamp",
      });

      return (
        <Animated.View
          style={[
            styles.bannerItem,
            {
              transform: [{ scale }],
              opacity,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => handleBannerPress(item)}
            style={styles.bannerTouchable}
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
        </Animated.View>
      );
    },
    [handleBannerPress, scrollX]
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
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollBeginDrag={handleScrollBegin}
        scrollEventThrottle={16}
        bounces={false}
        decelerationRate="fast"
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        contentContainerStyle={styles.listContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        getItemLayout={(_, index) => ({
          length: CARD_WIDTH,
          offset: CARD_WIDTH * index,
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
    height: BANNER_HEIGHT + 16, // 额外的空间给阴影
    backgroundColor: theme.colors.white,
    paddingVertical: 8,
  },
  listContent: {
    paddingHorizontal: SIDE_PEEK, // 左右留白，显示相邻卡片
  },
  bannerItem: {
    width: CARD_WIDTH,
    height: BANNER_HEIGHT,
    paddingHorizontal: CARD_MARGIN,
  },
  bannerTouchable: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: theme.colors.gray100,
    // 阴影效果
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
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
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  bannerContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.white,
    letterSpacing: 0.5,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 3,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  indicatorContainer: {
    position: "absolute",
    bottom: 16,
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
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  indicatorActive: {
    width: 18,
    backgroundColor: theme.colors.white,
  },
});

export default BannerCarousel;
