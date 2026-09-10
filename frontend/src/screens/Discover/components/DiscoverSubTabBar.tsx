/**
 * Discover 二级切换：无衬线小字 + 颜色/字重选中态。
 *
 * 一级 Tab 是 Playfair + 下划线导航；二级只是页内筛选，字号更小、
 * 不用下划线，避免两排 Tab 看起来像同一套控件。
 */
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Pressable } from "../../../components/ui";
import { useAppTheme } from "../../../theme";

const SUB_FONT = Platform.OS === "ios" ? "PingFang SC" : "sans-serif";

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
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onTabPress(tab.id)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={styles.item}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? theme.colors.text : theme.colors.gray300,
                  fontWeight: isActive ? "600" : "400",
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
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
    paddingBottom: 8,
    gap: 16,
  },
  item: {
    paddingVertical: 4,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: SUB_FONT,
  },
});

export default DiscoverSubTabBar;
