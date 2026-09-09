/**
 * 「活动」顶部 Tab —— 时装活动日历 + 近期活动 + 活动回顾。
 * 从论坛页拆出，作为一级 Tab，滚动汇聚到 Header 折叠动画。
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
import ForumCalendarSection from "../../Events/ForumCalendarSection";
import { useAppTheme } from "../../../theme";
import { SCREEN_WIDTH } from "../constants";

interface EventsPageProps {
  isActive: boolean;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const EventsPageImpl: React.FC<EventsPageProps> = ({ isActive, onScroll }) => {
  const theme = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [hasActivated, setHasActivated] = useState(false);

  useEffect(() => {
    if (isActive) setHasActivated(true);
  }, [isActive]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshSignal((n) => n + 1);
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
          <ForumCalendarSection
            refreshSignal={refreshSignal}
            showPostsHeading={false}
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
  content: { flexGrow: 1, paddingBottom: 24 },
});

export const EventsPage = React.memo(EventsPageImpl);

export default EventsPage;
