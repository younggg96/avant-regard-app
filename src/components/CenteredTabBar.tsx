import React from "react";
import { StyleSheet, View } from "react-native";
import { Box, Text, Pressable, HStack } from "./ui";
import { theme } from "../theme";

interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface CenteredTabBarProps<T extends string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}

function TabButton<T extends string>({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
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
}

export function CenteredTabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: CenteredTabBarProps<T>) {
  return (
    <Box borderBottomWidth={1} borderBottomColor="$gray100" bg="$white">
      <HStack justifyContent="center" alignItems="center" py="$xs">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            label={tab.label}
            isActive={activeTab === tab.id}
            onPress={() => onTabChange(tab.id)}
          />
        ))}
      </HStack>
    </Box>
  );
}

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
