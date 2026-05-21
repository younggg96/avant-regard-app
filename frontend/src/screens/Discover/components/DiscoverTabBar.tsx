import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CenteredTabBar } from "../../../components/CenteredTabBar";
import { TabType } from "../types";

interface DiscoverTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const DiscoverTabBar: React.FC<DiscoverTabBarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { t } = useTranslation();

  const tabs = useMemo<{ id: TabType; label: string }[]>(
    () => [
      { id: "forum", label: t("discover.forum") },
      { id: "recommend", label: t("discover.recommend") },
      { id: "trading", label: t("discover.trading") },
      { id: "buyer", label: t("discover.buyer") },
      { id: "following", label: t("discover.follow") },
    ],
    [t]
  );

  return (
    <CenteredTabBar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
    />
  );
};

export default DiscoverTabBar;
