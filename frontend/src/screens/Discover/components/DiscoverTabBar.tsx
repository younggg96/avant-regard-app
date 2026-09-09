import React, { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CenteredTabBar } from "../../../components/CenteredTabBar";
import { useAppTheme } from "../../../theme";
import { TopTab } from "../types";

interface DiscoverTabBarProps {
  activeTab: TopTab;
  onTabChange: (tab: TopTab) => void;
  /** Tab 栏高度变化时对齐 PagerView 当前页 */
  onChromeLayout?: () => void;
}

/** 顶部一级 Tab：论坛 / 帖子 / 活动 / My Archive / 买手店。搜索在 Header 右侧图标。 */
export const DiscoverTabBar: React.FC<DiscoverTabBarProps> = ({
  activeTab,
  onTabChange,
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
