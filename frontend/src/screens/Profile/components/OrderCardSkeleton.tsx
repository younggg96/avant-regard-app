import React from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useAppTheme, useThemedStyles, type AppTheme } from "../../../theme";
import { useSkeletonAnimation } from "../../Discover/components/SkeletonPostCard";

const COVER_SIZE = 96;

interface SkeletonBlockProps {
  width: number | string;
  height: number;
  style?: object;
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

/** 与 OrderCard 三列布局一致的骨架卡片。 */
export const OrderCardSkeleton: React.FC = () => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { skeletonOpacity } = useSkeletonAnimation();
  const blockColor = theme.colors.skeleton;

  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <Animated.View style={[styles.cover, { opacity: skeletonOpacity }]} />
        <View style={styles.detailsCol}>
          <SkeletonBlock
            width="55%"
            height={14}
            opacity={skeletonOpacity}
            color={blockColor}
          />
          <SkeletonBlock
            width="92%"
            height={12}
            style={styles.gapSm}
            opacity={skeletonOpacity}
            color={blockColor}
          />
          <SkeletonBlock
            width="72%"
            height={12}
            style={styles.gapSm}
            opacity={skeletonOpacity}
            color={blockColor}
          />
          <SkeletonBlock
            width="38%"
            height={14}
            style={styles.gapMd}
            opacity={skeletonOpacity}
            color={blockColor}
          />
        </View>
        <View style={styles.statusCol}>
          <SkeletonBlock
            width={52}
            height={22}
            radius={6}
            opacity={skeletonOpacity}
            color={blockColor}
          />
          <SkeletonBlock
            width={36}
            height={10}
            style={styles.gapSm}
            opacity={skeletonOpacity}
            color={blockColor}
          />
        </View>
      </View>
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.borderRadius.md,
      padding: t.spacing.sm,
      marginBottom: t.spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    body: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: t.spacing.md,
    },
    cover: {
      width: COVER_SIZE,
      height: COVER_SIZE,
      borderRadius: t.borderRadius.md,
      backgroundColor: t.colors.skeleton,
    },
    detailsCol: {
      flex: 1,
      minWidth: 0,
      alignItems: "flex-start",
      justifyContent: "center",
    },
    statusCol: {
      width: 72,
      minHeight: COVER_SIZE,
      alignItems: "flex-end",
    },
    gapSm: {
      marginTop: t.spacing.xs,
    },
    gapMd: {
      marginTop: t.spacing.sm,
    },
  });

export default OrderCardSkeleton;
