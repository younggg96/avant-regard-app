import React, { useEffect, useRef } from "react";
import {
  Dimensions,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, Pressable, NotificationBadge } from "./ui";
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
  /** 更紧凑的垂直内边距，给首页 Logo / Tab 叠放用 */
  compact?: boolean;
  /** 默认 true；首页 Tab 下方紧贴内容时关掉，避免多出一条分割线 */
  showBottomBorder?: boolean;
  /** 默认居中；首页可用 left / right */
  align?: "center" | "left" | "right";
  /** 选中项只加粗，字号不变 */
  emphasizeActive?: boolean;
}

function TabButton<T extends string>({
  tab,
  isActive,
  onPress,
  onLayout,
  compact,
  emphasizeActive,
  compactPad,
}: {
  tab: TabItem<T>;
  isActive: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
  compact?: boolean;
  emphasizeActive?: boolean;
  compactPad?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={[
        styles.tabItem,
        compact && styles.tabItemCompact,
        compactPad && styles.tabItemTight,
      ]}
      onPress={onPress}
      onLayout={onLayout}
    >
      <Text
        style={[
          styles.tabText,
          isActive ? styles.tabTextActive : styles.tabTextInactive,
          emphasizeActive && (isActive ? styles.tabTextActiveBold : styles.tabTextInactive),
        ]}
        numberOfLines={1}
      >
        {tab.label}
      </Text>
      {isActive && <View style={styles.tabIndicator} />}
      {!!tab.badge && tab.badge > 0 && (
        <NotificationBadge count={tab.badge} size="sm" style={styles.badge} />
      )}
    </Pressable>
  );
}

export function CenteredTabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  compact = false,
  showBottomBorder = true,
  align = "center",
  emphasizeActive = false,
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

  /** 居中时把激活 tab 滚到可视区中央；左右对齐时不抢滚动，避免跳动 */
  useEffect(() => {
    if (align !== "center") return;
    const layout = tabLayoutsRef.current[activeTab];
    if (!layout || !scrollRef.current) return;
    const targetX = Math.max(
      0,
      layout.x - SCREEN_WIDTH / 2 + layout.width / 2
    );
    scrollRef.current.scrollTo({ x: targetX, animated: true });
  }, [activeTab, align]);

  return (
    <View
      style={{
        borderBottomWidth: showBottomBorder ? 1 : 0,
        borderBottomColor: theme.colors.gray100,
        backgroundColor: theme.colors.background,
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          align === "left" && styles.scrollContentLeft,
          align === "right" && styles.scrollContentRight,
        ]}
      >
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            compact={compact}
            emphasizeActive={emphasizeActive}
            compactPad={align !== "center"}
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
    scrollContentLeft: {
      justifyContent: "flex-start",
      paddingLeft: 8,
      paddingRight: 4,
    },
    scrollContentRight: {
      justifyContent: "flex-end",
      paddingLeft: 4,
      paddingRight: 8,
    },
    tabItem: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      position: "relative",
      alignItems: "center",
    },
    tabItemCompact: {
      paddingVertical: 6,
    },
    tabItemTight: {
      paddingHorizontal: 8,
    },
    tabText: {
      fontSize: 14,
      fontWeight: "500",
      textAlign: "center",
    },
    tabTextActive: {
      color: t.colors.text,
      fontWeight: "600",
    },
    tabTextActiveBold: {
      color: t.colors.text,
      fontWeight: "700",
    },
    tabTextInactive: {
      color: t.colors.gray300,
      fontWeight: "500",
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
      top: 2,
      right: 2,
    },
  });
