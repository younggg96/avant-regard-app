import React from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useAppTheme, useThemedStyles, type AppTheme } from "../../../theme";
import { AVATAR_BORDER, AVATAR_SIZE } from "../constants";
import { SkeletonBlock, useProfileSkeleton } from "./ProfileSkeletonBlocks";

export const ProfileInfoSkeleton: React.FC = () => {
  const appTheme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { skeletonOpacity, blockColor } = useProfileSkeleton();

  return (
    <View style={[styles.wrap, { backgroundColor: appTheme.colors.card }]}>
      <View style={styles.headerRow}>
        <Animated.View
          style={[
            styles.avatar,
            {
              opacity: skeletonOpacity,
              backgroundColor: blockColor,
            },
          ]}
        />
        <View style={styles.headerTextCol}>
          <SkeletonBlock
            width="55%"
            height={22}
            opacity={skeletonOpacity}
            color={blockColor}
          />
          <SkeletonBlock
            width="72%"
            height={14}
            style={styles.gapSm}
            opacity={skeletonOpacity}
            color={blockColor}
          />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statsHalf}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.statItem}>
              <SkeletonBlock
                width={24}
                height={16}
                opacity={skeletonOpacity}
                color={blockColor}
              />
              <SkeletonBlock
                width={36}
                height={10}
                style={styles.gapXs}
                opacity={skeletonOpacity}
                color={blockColor}
              />
            </View>
          ))}
        </View>
        <View style={styles.tagsHalf}>
          <SkeletonBlock
            width={56}
            height={24}
            radius={12}
            opacity={skeletonOpacity}
            color={blockColor}
          />
          <SkeletonBlock
            width={44}
            height={24}
            radius={12}
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
    wrap: {
      paddingBottom: 10,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginTop: -(AVATAR_SIZE / 2),
      paddingHorizontal: 16,
      gap: 16,
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: (AVATAR_SIZE + AVATAR_BORDER * 2) / 2,
      borderWidth: AVATAR_BORDER,
      borderColor: t.colors.card,
    },
    headerTextCol: {
      flex: 1,
      paddingBottom: t.spacing.xs,
      minWidth: 0,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: t.spacing.md,
      marginTop: t.spacing.sm,
      paddingBottom: t.spacing.xs,
      gap: t.spacing.md,
    },
    statsHalf: {
      flex: 1,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: t.spacing.lg,
    },
    statItem: {
      alignItems: "center",
    },
    tagsHalf: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: 6,
    },
    gapSm: {
      marginTop: t.spacing.sm,
    },
    gapXs: {
      marginTop: t.spacing.xs,
    },
  });

export default ProfileInfoSkeleton;
