import React from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useThemedStyles, type AppTheme } from "../../../theme";
import { CollectionsSubTab } from "../types";
import { SkeletonBlock, useProfileSkeleton } from "./ProfileSkeletonBlocks";
import { PostMasonrySkeleton } from "./PostMasonrySkeleton";

interface CollectionsTabSkeletonProps {
  variant: CollectionsSubTab;
}

const StoreRowSkeleton: React.FC = () => {
  const styles = useThemedStyles(makeStoreStyles);
  const { skeletonOpacity, blockColor } = useProfileSkeleton();

  return (
    <View style={styles.row}>
      <SkeletonBlock
        width={60}
        height={60}
        radius={6}
        opacity={skeletonOpacity}
        color={blockColor}
      />
      <View style={styles.body}>
        <SkeletonBlock
          width="70%"
          height={14}
          opacity={skeletonOpacity}
          color={blockColor}
        />
        <SkeletonBlock
          width="50%"
          height={10}
          style={styles.gapSm}
          opacity={skeletonOpacity}
          color={blockColor}
        />
        <SkeletonBlock
          width="35%"
          height={10}
          style={styles.gapSm}
          opacity={skeletonOpacity}
          color={blockColor}
        />
      </View>
    </View>
  );
};

const FolderCardSkeleton: React.FC = () => {
  const styles = useThemedStyles(makeFolderStyles);
  const { skeletonOpacity, blockColor } = useProfileSkeleton();

  return (
    <View style={styles.card}>
      <Animated.View
        style={[
          styles.cover,
          {
            backgroundColor: blockColor,
            opacity: skeletonOpacity,
          },
        ]}
      />
      <SkeletonBlock
        width="75%"
        height={14}
        style={styles.gapSm}
        opacity={skeletonOpacity}
        color={blockColor}
      />
      <SkeletonBlock
        width="40%"
        height={10}
        style={styles.gapXs}
        opacity={skeletonOpacity}
        color={blockColor}
      />
    </View>
  );
};

export const CollectionsTabSkeleton: React.FC<CollectionsTabSkeletonProps> = ({
  variant,
}) => {
  const styles = useThemedStyles(makeStyles);
  const { skeletonOpacity, blockColor } = useProfileSkeleton();

  const renderContent = () => {
    if (variant === "posts") {
      return <PostMasonrySkeleton count={4} />;
    }
    if (variant === "stores") {
      return (
        <View>
          <StoreRowSkeleton />
          <StoreRowSkeleton />
          <StoreRowSkeleton />
        </View>
      );
    }
    return (
      <View style={styles.productsWrap}>
        <View style={styles.toolbar}>
          <SkeletonBlock
            width={72}
            height={12}
            opacity={skeletonOpacity}
            color={blockColor}
          />
          <SkeletonBlock
            width={96}
            height={28}
            radius={6}
            opacity={skeletonOpacity}
            color={blockColor}
          />
        </View>
        <View style={styles.folderGrid}>
          <FolderCardSkeleton />
          <FolderCardSkeleton />
        </View>
      </View>
    );
  };

  return (
    <View>
      {renderContent()}
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    productsWrap: {
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 16,
    },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    folderGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
  });

const makeStoreStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      padding: 12,
      gap: 12,
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    body: {
      flex: 1,
    },
    gapSm: {
      marginTop: t.spacing.sm,
    },
  });

const makeFolderStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      width: "48%",
      padding: 8,
      borderRadius: t.borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    cover: {
      aspectRatio: 1,
    },
    gapSm: {
      marginTop: 8,
    },
    gapXs: {
      marginTop: 4,
    },
  });

export default CollectionsTabSkeleton;
