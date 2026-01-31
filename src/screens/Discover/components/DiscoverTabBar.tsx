import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack } from "../../../components/ui";
import { theme } from "../../../theme";
import { TabType } from "../types";

interface TabItemProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

/**
 * 单个 Tab 项组件
 */
const TabItem: React.FC<TabItemProps> = ({ label, isActive, onPress }) => (
  <Pressable py="$sm" px="$md" position="relative" onPress={onPress}>
    <Text
      color={isActive ? "$black" : "$gray400"}
      fontWeight={isActive ? "$semibold" : "$normal"}
      fontSize="$md"
    >
      {label}
    </Text>
    {isActive && (
      <Box
        position="absolute"
        bottom={-4}
        left={0}
        right={0}
        height={3}
        bg="#000"
        borderRadius="$sm"
      />
    )}
  </Pressable>
);

interface DiscoverTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onSearchPress: () => void;
}

/**
 * 发现页 Tab 栏组件
 */
export const DiscoverTabBar: React.FC<DiscoverTabBarProps> = ({
  activeTab,
  onTabChange,
  onSearchPress,
}) => {
  return (
    <Box borderBottomWidth={1} borderBottomColor="$gray100">
      <HStack
        justifyContent="space-between"
        alignItems="center"
        py="$sm"
        px="$md"
      >
        <HStack justifyContent="center" alignItems="center" gap="$sm">
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

        {/* 右侧搜索按钮 */}
        <Pressable
          onPress={onSearchPress}
          p="$xs"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="search-outline" size={24} color={theme.colors.black} />
        </Pressable>
      </HStack>
    </Box>
  );
};

export default DiscoverTabBar;
