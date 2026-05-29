import React from "react";
import { StyleSheet, View } from "react-native";

import { useAppTheme, useThemedStyles, type AppTheme } from "../../../theme";
import { ChipRowSkeleton } from "./ProfileSkeletonBlocks";
import { OrderCardSkeleton } from "./OrderCardSkeleton";

/** 「购买 / 在售」tab 加载态：chip 条 + 订单卡片骨架。 */
export const TradingContentSkeleton: React.FC = () => {
  const styles = useThemedStyles(makeStyles);

  return (
    <View>
      <ChipRowSkeleton />
      <View style={styles.listWrap}>
        <OrderCardSkeleton />
        <OrderCardSkeleton />
        <OrderCardSkeleton />
      </View>
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    listWrap: {
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.xs,
    },
  });

export default TradingContentSkeleton;
