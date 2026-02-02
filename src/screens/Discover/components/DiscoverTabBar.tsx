import React from "react";
import { StyleSheet, View } from "react-native";
import { Box, Text, Pressable, HStack } from "../../../components/ui";
import { theme } from "../../../theme";
import { TabType } from "../types";

interface TabItemProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

/**
 * 单个 Tab 项组件 - 居中、小字体样式
 */
const TabItem: React.FC<TabItemProps> = ({ label, isActive, onPress }) => (
  <Pressable style={styles.tabItem} onPress={onPress}>
    <Text
      style={[
        styles.tabText,
        isActive ? styles.tabTextActive : styles.tabTextInactive,
      ]}
    >
      {label}
    </Text>
    {isActive && <View style={styles.tabIndicator} />}
  </Pressable>
);

interface DiscoverTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

/**
 * 发现页 Tab 栏组件 - B站风格
 * 论坛、推荐、关注 居中排列，小字体
 */
export const DiscoverTabBar: React.FC<DiscoverTabBarProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <Box borderBottomWidth={1} borderBottomColor="$gray100" bg="$white">
      <HStack justifyContent="center" alignItems="center" py="$xs">
        <TabItem
          label="论坛"
          isActive={activeTab === "forum"}
          onPress={() => onTabChange("forum")}
        />
        <TabItem
          label="推荐"
          isActive={activeTab === "recommend"}
          onPress={() => onTabChange("recommend")}
        />
        <TabItem
          label="关注"
          isActive={activeTab === "following"}
          onPress={() => onTabChange("following")}
        />
      </HStack>
    </Box>
  );
};

const styles = StyleSheet.create({
  tabItem: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    position: "relative",
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
  },
  tabTextActive: {
    color: theme.colors.black,
    fontWeight: "600",
  },
  tabTextInactive: {
    color: theme.colors.gray300,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    width: 24,
    height: 2,
    backgroundColor: theme.colors.black,
    borderRadius: 1,
  },
});

export default DiscoverTabBar;
