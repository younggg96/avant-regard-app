/**
 * 「My Archive」顶部 Tab —— 内部二级切换：我的 / 世界。
 *
 *   - 我的：当前用户的档案（reuse ForumMyArchiveSection，含上传入口）
 *   - 世界：其他用户的公开档案（WorldArchiveSection）
 *
 * 二级 Tab 栏固定在顶部，下方为可下拉刷新的滚动区。滚动事件汇聚到
 * DiscoverHeader 折叠动画，与其它 Tab 一致。
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { ScrollView } from "../../../components/ui";
import ForumMyArchiveSection from "../../Events/ForumMyArchiveSection";
import WorldArchiveSection from "../../Events/WorldArchiveSection";
import { DiscoverSubTabBar } from "./DiscoverSubTabBar";
import { useAppTheme } from "../../../theme";
import { SCREEN_WIDTH } from "../constants";
import type { ArchiveSubTab } from "../types";

interface MyArchivePageProps {
  isActive: boolean;
  subTab: ArchiveSubTab;
  onSubTabChange: (tab: ArchiveSubTab) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const MyArchivePageImpl: React.FC<MyArchivePageProps> = ({
  isActive,
  subTab,
  onSubTabChange,
  onScroll,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [mineSignal, setMineSignal] = useState(0);
  const [worldSignal, setWorldSignal] = useState(0);
  const [hasActivated, setHasActivated] = useState(false);

  useEffect(() => {
    if (isActive) setHasActivated(true);
  }, [isActive]);

  const subTabs = React.useMemo<{ id: ArchiveSubTab; label: string }[]>(
    () => [
      { id: "mine", label: t("discover.archiveMine") },
      { id: "world", label: t("discover.archiveWorld") },
    ],
    [t]
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (subTab === "mine") {
      setMineSignal((n) => n + 1);
    } else {
      setWorldSignal((n) => n + 1);
    }
  }, [subTab]);

  const handleLoaded = useCallback(() => setRefreshing(false), []);

  return (
    <View style={styles.root}>
      <DiscoverSubTabBar<ArchiveSubTab>
        tabs={subTabs}
        activeTab={subTab}
        onTabPress={onSubTabChange}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.accent]}
            tintColor={theme.colors.accent}
          />
        }
      >
        {hasActivated ? (
          subTab === "mine" ? (
            <ForumMyArchiveSection refreshSignal={mineSignal} onLoaded={handleLoaded} />
          ) : (
            <WorldArchiveSection refreshSignal={worldSignal} onLoaded={handleLoaded} />
          )
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { width: SCREEN_WIDTH, flex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: 56 },
});

export const MyArchivePage = React.memo(MyArchivePageImpl);

export default MyArchivePage;
