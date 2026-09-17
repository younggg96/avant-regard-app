/**
 * 「Archive」顶部 Tab —— 全站公开档案。
 *
 * 这里只展示所有人的档案，不再分「我的 / 世界」：个人档案已经挪到「我」页面
 * 的 Archive tab 里，那才是找自己东西的地方。发现页保持单一语义 —— 逛别人的。
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { ScrollView } from "../../../components/ui";
import WorldArchiveSection from "../../Events/WorldArchiveSection";
import { useAppTheme } from "../../../theme";
import { SCREEN_WIDTH } from "../constants";

interface MyArchivePageProps {
  isActive: boolean;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const MyArchivePageImpl: React.FC<MyArchivePageProps> = ({
  isActive,
  onScroll,
}) => {
  const theme = useAppTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [worldSignal, setWorldSignal] = useState(0);
  const [hasActivated, setHasActivated] = useState(false);

  useEffect(() => {
    if (isActive) setHasActivated(true);
  }, [isActive]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setWorldSignal((n) => n + 1);
  }, []);

  const handleLoaded = useCallback(() => setRefreshing(false), []);

  return (
    <View style={styles.root}>
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
          <WorldArchiveSection
            refreshSignal={worldSignal}
            onLoaded={handleLoaded}
          />
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { width: SCREEN_WIDTH, flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
});

export const MyArchivePage = React.memo(MyArchivePageImpl);

export default MyArchivePage;
