import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import { theme } from "../../../theme";
import { styles } from "../styles";

interface SkeletonBoxProps {
  width: number | string;
  height: number;
  style?: any;
  opacity: Animated.AnimatedInterpolation<number>;
}

/**
 * 骨架屏基础盒子组件
 */
const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width,
  height,
  style,
  opacity,
}) => (
  <Animated.View
    style={[
      {
        width,
        height,
        backgroundColor: theme.colors.gray200,
        borderRadius: 4,
        opacity,
      },
      style,
    ]}
  />
);

interface SkeletonPostCardProps {
  opacity: Animated.AnimatedInterpolation<number>;
}

/**
 * 骨架屏帖子卡片组件
 * 匹配 PostCard 样式：图片 + 标题 + 用户信息/点赞
 */
export const SkeletonPostCard: React.FC<SkeletonPostCardProps> = ({
  opacity,
}) => {
  return (
    <View style={styles.skeletonCard}>
      {/* 图片区域：3:4 比例 */}
      <Animated.View style={[styles.skeletonImage, { opacity }]} />
      {/* 标题 */}
      <View style={styles.skeletonTitleArea}>
        <SkeletonBox
          width="90%"
          height={14}
          style={{ marginBottom: 4 }}
          opacity={opacity}
        />
        <SkeletonBox width="60%" height={14} opacity={opacity} />
      </View>
      {/* 底部：用户信息 + 点赞 */}
      <View style={styles.skeletonFooter}>
        <View style={styles.skeletonUserInfo}>
          <Animated.View style={[styles.skeletonAvatar, { opacity }]} />
          <SkeletonBox width={50} height={10} opacity={opacity} />
        </View>
        <SkeletonBox width={30} height={14} opacity={opacity} />
      </View>
    </View>
  );
};

/**
 * 使用骨架屏动画的 Hook
 */
export const useSkeletonAnimation = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerAnimation.start();
    return () => shimmerAnimation.stop();
  }, [shimmerAnim]);

  const skeletonOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return { skeletonOpacity };
};

export default SkeletonPostCard;
