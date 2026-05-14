import React from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../../theme";
import { useSkeletonAnimation } from "./SkeletonPostCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const BANNER_HEIGHT = 180;
const BANNER_SIDE_PEEK = 40;
const BANNER_CARD_WIDTH = SCREEN_WIDTH - BANNER_SIDE_PEEK * 2;

interface SkeletonBlockProps {
  width: number | string;
  height: number;
  style?: any;
  opacity: Animated.AnimatedInterpolation<number>;
  color: string;
  radius?: number;
}

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width,
  height,
  style,
  opacity,
  color,
  radius = 4,
}) => (
  <Animated.View
    style={[
      {
        width,
        height,
        backgroundColor: color,
        borderRadius: radius,
        opacity,
      },
      style,
    ]}
  />
);

/**
 * Banner 轮播骨架屏 —— 与 `BannerCarousel` 视觉占位一致：左右各留出
 * 40px peek（露出邻卡边缘），主卡片圆角 12、阴影由父背景吸收。配上 shimmer
 * 动画，给用户「内容马上到」的反馈。
 */
export const BannerCarouselSkeleton: React.FC = () => {
  const t = useAppTheme();
  const styles = useThemedStyles(makeBannerStyles);
  const { skeletonOpacity } = useSkeletonAnimation();
  const blockColor = t.colors.skeleton;

  return (
    <View style={styles.container}>
      <View style={styles.cardWrapper}>
        <SkeletonBlock
          width={BANNER_CARD_WIDTH - 12}
          height={BANNER_HEIGHT}
          opacity={skeletonOpacity}
          color={blockColor}
          radius={12}
        />
      </View>
    </View>
  );
};

const makeBannerStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      height: BANNER_HEIGHT + 16,
      backgroundColor: t.colors.background,
      paddingVertical: 8,
    },
    cardWrapper: {
      paddingHorizontal: BANNER_SIDE_PEEK + 6,
    },
  });

/**
 * 热门社区骨架屏 —— 标题占位 + 5 个圆形社区头像 + 名称占位行；和
 * `PopularCommunities` 的 56pt 圆形 + 文字两行结构对齐。
 */
export const PopularCommunitiesSkeleton: React.FC = () => {
  const t = useAppTheme();
  const styles = useThemedStyles(makeCommunitiesStyles);
  const { skeletonOpacity } = useSkeletonAnimation();
  const blockColor = t.colors.skeleton;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <SkeletonBlock width={80} height={16} opacity={skeletonOpacity} color={blockColor} />
        <SkeletonBlock width={48} height={12} opacity={skeletonOpacity} color={blockColor} />
      </View>
      <View style={styles.itemsRow}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.item}>
            <Animated.View
              style={[
                styles.avatar,
                { backgroundColor: blockColor, opacity: skeletonOpacity },
              ]}
            />
            <SkeletonBlock
              width={48}
              height={10}
              opacity={skeletonOpacity}
              color={blockColor}
              style={{ marginTop: 6 }}
            />
          </View>
        ))}
      </View>
    </View>
  );
};

const makeCommunitiesStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: t.colors.card,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    itemsRow: {
      flexDirection: "row",
      gap: 16,
    },
    item: {
      alignItems: "center",
      width: 64,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
  });

/**
 * 论坛帖子骨架屏 —— 单条卡片版，与 `ForumPostCard` 横向排版对齐：
 * 顶部头像 + 用户名，下面标题、摘要 2 行，以及一行三张缩略图占位 + 底部
 * 社区/时间/互动 placeholder。视觉上不会出现「闪一下空白」的尺寸跳变。
 */
export const ForumPostCardSkeleton: React.FC = () => {
  const t = useAppTheme();
  const styles = useThemedStyles(makePostStyles);
  const { skeletonOpacity } = useSkeletonAnimation();
  const blockColor = t.colors.skeleton;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Animated.View
          style={[
            styles.avatar,
            { backgroundColor: blockColor, opacity: skeletonOpacity },
          ]}
        />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <SkeletonBlock width={120} height={12} opacity={skeletonOpacity} color={blockColor} />
        </View>
      </View>
      <SkeletonBlock
        width="92%"
        height={16}
        style={{ marginTop: 12 }}
        opacity={skeletonOpacity}
        color={blockColor}
      />
      <SkeletonBlock
        width="60%"
        height={16}
        style={{ marginTop: 6 }}
        opacity={skeletonOpacity}
        color={blockColor}
      />
      <SkeletonBlock
        width="88%"
        height={12}
        style={{ marginTop: 10 }}
        opacity={skeletonOpacity}
        color={blockColor}
      />
      <SkeletonBlock
        width="74%"
        height={12}
        style={{ marginTop: 6 }}
        opacity={skeletonOpacity}
        color={blockColor}
      />
      <View style={styles.imagesRow}>
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.image,
              { backgroundColor: blockColor, opacity: skeletonOpacity },
            ]}
          />
        ))}
      </View>
      <View style={styles.footerRow}>
        <SkeletonBlock width={70} height={12} opacity={skeletonOpacity} color={blockColor} />
        <View style={{ flexDirection: "row", gap: 16 }}>
          <SkeletonBlock width={28} height={12} opacity={skeletonOpacity} color={blockColor} />
          <SkeletonBlock width={28} height={12} opacity={skeletonOpacity} color={blockColor} />
        </View>
      </View>
    </View>
  );
};

const makePostStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: t.colors.background,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    imagesRow: {
      marginTop: 12,
      flexDirection: "row",
      gap: 6,
    },
    image: {
      width: 100,
      height: 100,
      borderRadius: 4,
    },
    footerRow: {
      marginTop: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
  });

/**
 * 整页论坛骨架屏：banner + 社区 + N 条帖子卡片。
 *
 * 用在 forum Tab 网络请求未命中本地缓存的冷启动路径上 —— 取代
 * `home-loading.gif`，让用户先看到布局占位，比起一个全屏品牌动画，
 * 在「网络慢但还在拿数据」的真实场景下感知更顺滑。
 */
export const ForumTabSkeleton: React.FC<{ postCount?: number }> = ({
  postCount = 3,
}) => {
  return (
    <View style={{ flex: 1 }}>
      <BannerCarouselSkeleton />
      <PopularCommunitiesSkeleton />
      {Array.from({ length: postCount }).map((_, i) => (
        <ForumPostCardSkeleton key={i} />
      ))}
    </View>
  );
};
