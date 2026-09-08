/**
 * Discover 二级切换 —— chip 筛选，而不是再做一条下划线 Tab。
 *
 * 一级（CenteredTabBar）是页面导航：左对齐、选中字号加大。
 * 二级只是当前页内的筛选（推荐/关注、我的/世界、地图/详情），
 * 用实心 chip 压低视觉权重，避免两排 Tab 叠在一起。
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { AnimatedChip } from "../../../components/ui";
import { useAppTheme } from "../../../theme";

export interface DiscoverSubTabItem<T extends string = string> {
  id: T;
  label: string;
}

interface DiscoverSubTabBarProps<T extends string> {
  tabs: DiscoverSubTabItem<T>[];
  activeTab: T;
  onTabPress: (id: T) => void;
}

export function DiscoverSubTabBar<T extends string>({
  tabs,
  activeTab,
  onTabPress,
}: DiscoverSubTabBarProps<T>) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: theme.colors.background },
      ]}
    >
      {tabs.map((tab) => (
        <AnimatedChip
          key={tab.id}
          label={tab.label}
          isActive={activeTab === tab.id}
          onPress={() => onTabPress(tab.id)}
          size="sm"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
    gap: 6,
  },
});

export default DiscoverSubTabBar;
