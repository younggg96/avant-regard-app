import React from "react";
import { CenteredTabBar } from "../../../components/CenteredTabBar";
import { TabType } from "../types";

const DISCOVER_TABS: { id: TabType; label: string }[] = [
  { id: "forum", label: "论坛" },
  { id: "recommend", label: "推荐" },
  { id: "following", label: "关注" },
];

interface DiscoverTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const DiscoverTabBar: React.FC<DiscoverTabBarProps> = ({
  activeTab,
  onTabChange,
}) => (
  <CenteredTabBar
    tabs={DISCOVER_TABS}
    activeTab={activeTab}
    onTabChange={onTabChange}
  />
);

export default DiscoverTabBar;
