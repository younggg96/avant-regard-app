import React from "react";
import { StyleSheet, View } from "react-native";

import { useThemedStyles, type AppTheme } from "../../../theme";
import { SkeletonBlock, useProfileSkeleton } from "./ProfileSkeletonBlocks";

const CardSkeleton: React.FC<{ flex: number; tall?: boolean }> = ({
  flex,
  tall = false,
}) => {
  const styles = useThemedStyles(makeCardStyles);
  const { skeletonOpacity, blockColor } = useProfileSkeleton();

  return (
    <View style={[styles.card, { flex }]}>
      <SkeletonBlock
        width="60%"
        height={14}
        opacity={skeletonOpacity}
        color={blockColor}
      />
      {tall ? (
        <>
          <SkeletonBlock
            width="80%"
            height={12}
            style={styles.gapSm}
            opacity={skeletonOpacity}
            color={blockColor}
          />
          <SkeletonBlock
            width="100%"
            height={6}
            radius={3}
            style={styles.gapMd}
            opacity={skeletonOpacity}
            color={blockColor}
          />
          <SkeletonBlock
            width="90%"
            height={10}
            style={styles.gapSm}
            opacity={skeletonOpacity}
            color={blockColor}
          />
          <SkeletonBlock
            width="75%"
            height={10}
            style={styles.gapXs}
            opacity={skeletonOpacity}
            color={blockColor}
          />
        </>
      ) : (
        <SkeletonBlock
          width={36}
          height={36}
          radius={6}
          style={styles.gapMd}
          opacity={skeletonOpacity}
          color={blockColor}
        />
      )}
    </View>
  );
};

export const ProfileSecondaryRowSkeleton: React.FC = () => {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.row}>
      <CardSkeleton flex={2} />
      <CardSkeleton flex={3} tall />
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs,
    },
  });

const makeCardStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      minWidth: 0,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.sm,
      borderRadius: t.borderRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    gapSm: {
      marginTop: t.spacing.sm,
    },
    gapMd: {
      marginTop: t.spacing.md,
    },
    gapXs: {
      marginTop: t.spacing.xs,
    },
  });

export default ProfileSecondaryRowSkeleton;
