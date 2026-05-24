/**
 * TopTabBar —— 左对齐一级 tab + 滑动下划线 + 文字过渡动效。
 *
 * 泛型 `T` 让各 screen 自定义 tab id, 不绑定 Profile 业务类型。
 */
import React, { useEffect, useRef } from "react";
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Pressable } from "./pressable";
import {
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../theme";

export interface TopTabItem<T extends string = string> {
  id: T;
  label: string;
}

export interface TopTabBarProps<T extends string = string> {
  tabs: TopTabItem<T>[];
  activeTab: T;
  onTabPress: (id: T) => void;
  style?: ViewStyle;
  /** 默认 `theme.colors.card` */
  backgroundColor?: string;
}

interface TabLayout {
  x: number;
  width: number;
}

const TopTabLabel: React.FC<{
  label: string;
  isActive: boolean;
  inactiveColor: string;
  activeColor: string;
  styles: ReturnType<typeof makeStyles>;
}> = ({ label, isActive, inactiveColor, activeColor, styles }) => {
  const progress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, { duration: 200 });
  }, [isActive, progress]);

  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveColor, activeColor],
    ),
    fontWeight: progress.value > 0.5 ? "600" : "500",
  }));

  return (
    <Animated.Text style={[styles.tabText, textStyle]}>{label}</Animated.Text>
  );
};

export function TopTabBar<T extends string>({
  tabs,
  activeTab,
  onTabPress,
  style,
  backgroundColor,
}: TopTabBarProps<T>) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const layoutsRef = useRef<Partial<Record<T, TabLayout>>>({});

  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const indicatorReady = useSharedValue(0);

  const moveIndicator = (tabId: T) => {
    const layout = layoutsRef.current[tabId];
    if (!layout) return;
    const inset = layout.width * 0.2;
    indicatorX.value = withSpring(layout.x + inset, {
      damping: 20,
      stiffness: 280,
    });
    indicatorWidth.value = withSpring(layout.width - inset * 2, {
      damping: 20,
      stiffness: 280,
    });
    indicatorReady.value = withTiming(1, { duration: 150 });
  };

  useEffect(() => {
    moveIndicator(activeTab);
  }, [activeTab]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorReady.value,
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: backgroundColor ?? theme.colors.card },
        style,
      ]}
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          style={styles.tabBtn}
          onPress={() => onTabPress(tab.id)}
          onLayout={(e: LayoutChangeEvent) => {
            layoutsRef.current[tab.id] = {
              x: e.nativeEvent.layout.x,
              width: e.nativeEvent.layout.width,
            };
            if (tab.id === activeTab) {
              moveIndicator(tab.id);
            }
          }}
        >
          <TopTabLabel
            label={tab.label}
            isActive={activeTab === tab.id}
            inactiveColor={theme.colors.gray400}
            activeColor={theme.colors.text}
            styles={styles}
          />
        </Pressable>
      ))}

      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: theme.colors.text },
          indicatorStyle,
        ]}
      />
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      paddingLeft: t.spacing.md,
      position: "relative",
    },
    tabBtn: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      marginRight: 20,
    },
    tabText: {
      fontSize: 15,
    },
    indicator: {
      position: "absolute",
      bottom: 0,
      left: 0,
      height: 2,
      borderRadius: 1,
    },
  });

export default TopTabBar;
