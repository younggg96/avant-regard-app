/**
 * 关注品牌 + 等级进度并排行（左 / 右）。
 */
import React from "react";
import { StyleSheet, View } from "react-native";

import { FollowingBrand } from "../../../services/followService";
import { useThemedStyles, type AppTheme } from "../../../theme";
import { FollowedBrands } from "./FollowedBrands";
import { LevelProgressCard } from "./LevelProgressCard";

interface Props {
  brands: FollowingBrand[];
  userId?: number;
}

export const ProfileSecondaryRow: React.FC<Props> = ({ brands, userId }) => {
  const styles = useThemedStyles(makeStyles);
  const hasBrands = brands.length > 0;

  if (!hasBrands) {
    return <LevelProgressCard />;
  }

  return (
    <View style={styles.row}>
      <FollowedBrands brands={brands} userId={userId} embedded />
      <LevelProgressCard embedded />
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

export default ProfileSecondaryRow;
