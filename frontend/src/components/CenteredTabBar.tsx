import React, { useEffect, useRef } from "react";
import {
  Dimensions,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, Pressable } from "./ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TabItem<T extends string> {
  id: T;
  label: string;
  badge?: number;
}

interface CenteredTabBarProps<T extends string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}

function TabButton<T extends string>({
  tab,
  isActive,
  onPress,
  onLayout,
}: {
  tab: TabItem<T>;
  isActive: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable style={styles.tabItem} onPress={onPress} onLayout={onLayout}>
      <Text
        style={[
          styles.tabText,
          isActive ? styles.tabTextActive : styles.tabTextInactive,
        ]}
        numberOfLines={1}
      >
        {tab.label}
      </Text>
      {isActive && <View style={styles.tabIndicator} />}
      {!!tab.badge && tab.badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {tab.badge > 99 ? "99+" : tab.badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function CenteredTabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: CenteredTabBarProps<T>) {
  // Bypass Gluestack color tokens here: Gluestack resolves `$white` via a
  // global mutable colorMode + internal style cache that can race with our
  // ThemeProvider on switch (rendering dark `$white` inside an otherwise
  // light page). Reading colors from useAppTheme keeps this strictly tied
  // to the current React ThemeProvider value.
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const scrollRef = useRef<ScrollView>(null);
  const tabLayoutsRef = useRef<
    Partial<Record<string, { x: number; width: number }>>
  >({});

  /** 激活 tab 变化时滚到可视区中央 */
  useEffect(() => {
    const layout = tabLayoutsRef.current[activeTab];
    if (!layout || !scrollRef.current) return;
    const targetX = Math.max(
      0,
      layout.x - SCREEN_WIDTH / 2 + layout.width / 2
    );
    scrollRef.current.scrollTo({ x: targetX, animated: true });
  }, [activeTab]);

  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.gray100,
        backgroundColor: theme.colors.background,
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            onPress={() => onTabChange(tab.id)}
            onLayout={(e) => {
              tabLayoutsRef.current[tab.id] = {
                x: e.nativeEvent.layout.x,
                width: e.nativeEvent.layout.width,
              };
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    tabItem: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      position: "relative",
      alignItems: "center",
    },
    tabText: {
      fontSize: 14,
      fontWeight: "500",
    },
    tabTextActive: {
      color: t.colors.text,
      fontWeight: "600",
    },
    tabTextInactive: {
      color: t.colors.gray300,
    },
    tabIndicator: {
      position: "absolute",
      bottom: 0,
      width: 24,
      height: 2,
      backgroundColor: t.colors.text,
      borderRadius: 1,
    },
    badge: {
      position: "absolute",
      top: 2,
      right: 2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: t.colors.error,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 3,
    },
    badgeText: {
      color: t.colors.textInverted,
      fontSize: 10,
      fontWeight: "700",
    },
  });
