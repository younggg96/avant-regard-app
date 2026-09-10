import React, { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { SharedValue } from "react-native-reanimated";
import { CenteredTabBar } from "../../../components/CenteredTabBar";
import { useAppTheme } from "../../../theme";
import { TopTab } from "../types";
import { DiscoverSearchBar } from "./DiscoverSearchBar";

interface DiscoverTabBarProps {
  activeTab: TopTab;
  onTabChange: (tab: TopTab) => void;
  searchPlaceholder: string;
  onSearchPress: () => void;
  /** Pager 滑动进度，驱动一级 Tab 下划线跟手 */
  pagerPosition?: SharedValue<number>;
  /** Tab 栏高度变化时对齐 PagerView 当前页 */
  onChromeLayout?: () => void;
}

/** 顶部一级 Tab + 搜索栏（搜索栏在 Tab 与二级筛选之间）。 */
export const DiscoverTabBar: React.FC<DiscoverTabBarProps> = ({
  activeTab,
  onTabChange,
  searchPlaceholder,
  onSearchPress,
  pagerPosition,
  onChromeLayout,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const lastChromeHeightRef = useRef<number | null>(null);

  const tabs = useMemo<{ id: TopTab; label: string }[]>(
    () => [
      { id: "forum", label: t("discover.forum") },
      { id: "posts", label: t("discover.postsTab") },
      { id: "events", label: t("discover.eventsTab") },
      { id: "myArchive", label: t("discover.myArchiveTab") },
      { id: "buyer", label: t("discover.buyer") },
    ],
    [t]
  );

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
      <CenteredTabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        compact
        showBottomBorder={false}
        align="left"
        emphasizeActive
        pagerPosition={pagerPosition}
      />
      <DiscoverSearchBar
        placeholder={searchPlaceholder}
        onPress={onSearchPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  chrome: {
    borderBottomWidth: 1,
  },
});

export default DiscoverTabBar;
