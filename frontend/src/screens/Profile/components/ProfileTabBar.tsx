/**
 * ProfileTabBar —— 「笔记」一级 tab 下的 9 个 sub-tab (chip 样式 + 动效)。
 */
import React, { useEffect, useRef } from "react";
import {
  Dimensions,
  LayoutChangeEvent,
  ScrollView as RNScrollView,
  View,
} from "react-native";
import { useAppTheme } from "../../../theme";
import { TabType } from "../types";
import { AnimatedChip, chipRowStyle } from "../../../components/ui";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Tab {
  id: TabType;
  label: string;
  count?: number;
}

interface ProfileTabBarProps {
  tabs: Tab[];
  activeTab: TabType;
  onTabPress: (tab: TabType) => void;
  scrollViewRef?: React.RefObject<RNScrollView>;
}

export const ProfileTabBar = ({
  tabs,
  activeTab,
  onTabPress,
  scrollViewRef,
}: ProfileTabBarProps) => {
  const theme = useAppTheme();
  const innerRef = useRef<RNScrollView>(null);
  const scrollRef = scrollViewRef ?? innerRef;
  const tabLayoutsRef = useRef<
    Partial<Record<TabType, { x: number; width: number }>>
  >({});

  useEffect(() => {
    const layout = tabLayoutsRef.current[activeTab];
    if (!layout || !scrollRef.current) return;
    const targetX = Math.max(
      0,
      layout.x - SCREEN_WIDTH / 2 + layout.width / 2,
    );
    scrollRef.current.scrollTo({ x: targetX, animated: true });
  }, [activeTab, scrollRef]);

  return (
    <RNScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.md,
        paddingVertical: 10,
        alignItems: "flex-start",
      }}
    >
      <View style={chipRowStyle}>
      {tabs.map((tab) => (
        <AnimatedChip
          key={tab.id}
          label={tab.label}
          count={tab.count}
          isActive={activeTab === tab.id}
          onPress={() => onTabPress(tab.id)}
          onLayout={(e: LayoutChangeEvent) => {
            tabLayoutsRef.current[tab.id] = {
              x: e.nativeEvent.layout.x,
              width: e.nativeEvent.layout.width,
            };
          }}
        />
      ))}
      </View>
    </RNScrollView>
  );
};
