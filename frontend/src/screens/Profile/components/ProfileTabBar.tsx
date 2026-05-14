import React from "react";
import { View, Text as RNText, ScrollView as RNScrollView } from "react-native";
import Animated from "react-native-reanimated";
import { Pressable } from "../../../components/ui";
import { TabType } from "../types";
import { useProfileStyles } from "../styles";
import { useAppTheme } from "../../../theme";

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

export const ProfileTabBar = ({ tabs, activeTab, onTabPress, scrollViewRef }: ProfileTabBarProps) => {
  const styles = useProfileStyles();
  return (
    <RNScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabScrollContent}
    >
      {tabs.map((tab) => (
        <Pressable key={tab.id} style={styles.tabItem} onPress={() => onTabPress(tab.id)}>
          <RNText style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
            {tab.label}
          </RNText>
          {activeTab === tab.id && <View style={styles.tabIndicator} />}
        </Pressable>
      ))}
    </RNScrollView>
  );
};

interface StickyTabBarProps extends ProfileTabBarProps {
  headerTotalHeight: number;
  animatedStyle: any;
}

export const StickyTabBar = ({ tabs, activeTab, onTabPress, headerTotalHeight, animatedStyle }: StickyTabBarProps) => {
  const styles = useProfileStyles();
  const theme = useAppTheme();
  return (
    <Animated.View
      style={[styles.stickyTabBar, { top: headerTotalHeight }, animatedStyle]}
      pointerEvents="box-none"
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card }}>
        <ProfileTabBar tabs={tabs} activeTab={activeTab} onTabPress={onTabPress} />
      </View>
    </Animated.View>
  );
};
