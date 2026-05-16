import React from "react";
import { View, StyleSheet, Animated } from "react-native";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../../theme";
import { useSkeletonAnimation } from "../../Discover/components/SkeletonPostCard";

/**
 * Archive · Brand 列表 dark-mode 骨架屏。
 *
 * 设计要点：
 * - `archive-loading.gif` 是浅色品牌动图，dark mode 下整屏白底过于刺眼，
 *   也没有深色版 GIF；用通用 skeleton + shimmer 在暗色背景上显示低对比
 *   占位是最稳妥的过渡。
 * - 单条行的尺寸/间距严格对齐 `BrandListTab` 真实 row（高 ~58px、
 *   `paddingHorizontal: lg`、底部 hairline），切到实数据时不会出现整体
 *   抖动。
 * - 字母分组 header 只画一个圆角小方块 + 一条横线，弱化字母本身（占位
 *   阶段字母对用户没意义）。
 */

const SECTION_COUNT = 3;
const ROWS_PER_SECTION = 5;

interface SkeletonLineProps {
  width: number | `${number}%`;
  height: number;
  marginTop?: number;
  marginRight?: number;
  borderRadius?: number;
  opacity: Animated.AnimatedInterpolation<number>;
  color: string;
}

const SkeletonLine: React.FC<SkeletonLineProps> = ({
  width,
  height,
  marginTop,
  marginRight,
  borderRadius = 4,
  opacity,
  color,
}) => (
  <Animated.View
    style={{
      width,
      height,
      marginTop,
      marginRight,
      borderRadius,
      backgroundColor: color,
      opacity,
    }}
  />
);

const BrandListSkeleton: React.FC = () => {
  const t = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { skeletonOpacity } = useSkeletonAnimation();
  const block = t.colors.skeleton;

  return (
    <View style={styles.container}>
      {Array.from({ length: SECTION_COUNT }).map((_, sIdx) => (
        <View key={`s-${sIdx}`}>
          <View style={styles.sectionHeader}>
            <Animated.View
              style={[styles.letterBadge, { backgroundColor: block, opacity: skeletonOpacity }]}
            />
            <Animated.View
              style={[styles.letterLine, { backgroundColor: block, opacity: skeletonOpacity }]}
            />
          </View>

          {Array.from({ length: ROWS_PER_SECTION }).map((__, rIdx) => (
            <View key={`r-${sIdx}-${rIdx}`} style={styles.row}>
              <View style={styles.rowText}>
                <SkeletonLine
                  width="60%"
                  height={14}
                  opacity={skeletonOpacity}
                  color={block}
                />
                <View style={styles.metaRow}>
                  <SkeletonLine
                    width={56}
                    height={10}
                    marginRight={8}
                    opacity={skeletonOpacity}
                    color={block}
                  />
                  <SkeletonLine
                    width={40}
                    height={10}
                    marginRight={8}
                    opacity={skeletonOpacity}
                    color={block}
                  />
                  <SkeletonLine
                    width={32}
                    height={10}
                    opacity={skeletonOpacity}
                    color={block}
                  />
                </View>
              </View>
              <SkeletonLine
                width={14}
                height={14}
                borderRadius={2}
                opacity={skeletonOpacity}
                color={block}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.md,
      backgroundColor: t.colors.background,
    },
    letterBadge: {
      width: 28,
      height: 28,
      borderRadius: 6,
    },
    letterLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      marginLeft: t.spacing.md,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: t.spacing.lg,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    rowText: {
      flex: 1,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
    },
  });

export default BrandListSkeleton;
