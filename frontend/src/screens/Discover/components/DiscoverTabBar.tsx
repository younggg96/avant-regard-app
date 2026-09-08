import React, { useMemo, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import Reanimated from "react-native-reanimated";
import { CenteredTabBar } from "../../../components/CenteredTabBar";
import { useAppTheme } from "../../../theme";
import { TopTab } from "../types";
import { SEARCH_ICON_SLOT } from "../constants";
import { DiscoverSearchBar } from "./DiscoverHeader";

interface DiscoverTabBarProps {
  activeTab: TopTab;
  onTabChange: (tab: TopTab) => void;
  onSearchPress: () => void;
  searchBarAnimatedStyle: object;
  searchIconAnimatedStyle: object;
  /** 搜索条显隐会改变高度；PagerView 需在布局后再对齐当前页 */
  onChromeLayout?: () => void;
}

/**
 * 顶部一级 Tab 栏 + 搜索。
 * 展开：Tab 下方整行搜索条；下滑收起：搜索条消失，图标出现在 Tab 右侧。
 * 买手店页自带搜索，首页搜索条收起不占位。
 */
export const DiscoverTabBar: React.FC<DiscoverTabBarProps> = ({
  activeTab,
  onTabChange,
  onSearchPress,
  searchBarAnimatedStyle,
  searchIconAnimatedStyle,
  onChromeLayout,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();

  const tabs = useMemo<{ id: TopTab; label: string }[]>(
    () => [
      { id: "forum", label: t("discover.forum") },
      { id: "posts", label: t("discover.postsTab") },
      { id: "myArchive", label: t("discover.myArchiveTab") },
      { id: "buyer", label: t("discover.buyer") },
    ],
    [t]
  );

  const hideChromeSearch = activeTab === "buyer";
  const lastChromeHeightRef = useRef<number | null>(null);

  return (
    <View
      style={[
        styles.chrome,
        {
          backgroundColor: theme.colors.background,
          borderBottomColor: theme.colors.gray100,
        },
      ]}
      onLayout={(e) => {
        const height = e.nativeEvent.layout.height;
        if (lastChromeHeightRef.current === height) return;
        lastChromeHeightRef.current = height;
        onChromeLayout?.();
      }}
    >
      <View style={styles.tabRow}>
        <View style={styles.tabs}>
          <CenteredTabBar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
            compact
            showBottomBorder={false}
            align="left"
            emphasizeActive
          />
        </View>
        <View
          style={hideChromeSearch ? styles.searchCollapsed : undefined}
          pointerEvents={hideChromeSearch ? "none" : "auto"}
        >
          <Reanimated.View style={searchIconAnimatedStyle}>
            <View style={styles.iconInner}>
              <Pressable
                onPress={onSearchPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel={t("discover.searchPlaceholder")}
              >
                <Ionicons name="search" size={20} color={theme.colors.text} />
              </Pressable>
            </View>
          </Reanimated.View>
        </View>
      </View>
      <View
        style={hideChromeSearch ? styles.searchCollapsed : undefined}
        pointerEvents={hideChromeSearch ? "none" : "auto"}
      >
        <Reanimated.View style={searchBarAnimatedStyle}>
          <DiscoverSearchBar onSearchPress={onSearchPress} />
        </Reanimated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chrome: {
    borderBottomWidth: 1,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tabs: {
    flex: 1,
    minWidth: 0,
  },
  iconInner: {
    width: SEARCH_ICON_SLOT,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  searchCollapsed: {
    height: 0,
    overflow: "hidden",
    opacity: 0,
  },
});

export default DiscoverTabBar;
