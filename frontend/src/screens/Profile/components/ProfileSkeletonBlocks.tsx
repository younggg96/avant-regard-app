import React from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useAppTheme, useThemedStyles, type AppTheme } from "../../../theme";
import { useSkeletonAnimation } from "../../Discover/components/SkeletonPostCard";

export interface SkeletonBlockProps {
  width: number | string;
  height: number;
  style?: object;
  opacity: Animated.AnimatedInterpolation<number>;
  color: string;
  radius?: number;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
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

export const useProfileSkeleton = () => {
  const theme = useAppTheme();
  const { skeletonOpacity } = useSkeletonAnimation();
  return { skeletonOpacity, blockColor: theme.colors.skeleton };
};

interface ChipRowSkeletonProps {
  widths?: number[];
}

export const ChipRowSkeleton: React.FC<ChipRowSkeletonProps> = ({
  widths = [72, 80, 68, 76, 64],
}) => {
  const styles = useThemedStyles(makeChipStyles);
  const { skeletonOpacity, blockColor } = useProfileSkeleton();

  return (
    <View style={styles.row}>
      {widths.map((width, index) => (
        <SkeletonBlock
          key={index}
          width={width}
          height={32}
          radius={14}
          opacity={skeletonOpacity}
          color={blockColor}
        />
      ))}
    </View>
  );
};

const makeChipStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: t.spacing.sm,
      paddingVertical: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
    },
  });
