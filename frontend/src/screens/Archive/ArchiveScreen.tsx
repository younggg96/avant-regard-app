import React, { useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Animated,
  Dimensions,
  ScrollView as RNScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import { CenteredTabBar } from "../../components/CenteredTabBar";
import { BrandListTab, MyContributionTab, LeaderboardTab } from "./components";
import { ArchiveTab, MAIN_TABS } from "./types";

const { width: screenWidth } = Dimensions.get("window");

const ArchiveScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ArchiveTab>("all");

  const headerHeight = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const isHeaderVisible = useRef(true);
  const horizontalScrollRef = useRef<RNScrollView>(null);

  const showHeader = useCallback(() => {
    if (isHeaderVisible.current) return;
    isHeaderVisible.current = true;
    Animated.parallel([
      Animated.timing(headerHeight, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  }, [headerHeight, headerOpacity]);

  const hideHeader = useCallback(() => {
    if (!isHeaderVisible.current) return;
    isHeaderVisible.current = false;
    Animated.parallel([
      Animated.timing(headerHeight, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(headerOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  }, [headerHeight, headerOpacity]);

  const handleTabChange = useCallback(
    (tab: ArchiveTab) => {
      setActiveTab(tab);
      const tabIndex = MAIN_TABS.findIndex((t) => t.id === tab);
      horizontalScrollRef.current?.scrollTo({
        x: tabIndex * screenWidth,
        animated: true,
      });
      if (tab !== "all") showHeader();
    },
    [showHeader]
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const pageIndex = Math.round(offsetX / screenWidth);
      const newTab = MAIN_TABS[pageIndex]?.id;
      if (newTab && newTab !== activeTab) {
        setActiveTab(newTab);
        if (newTab !== "all") showHeader();
      }
    },
    [activeTab, showHeader]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Collapsible header */}
      <Animated.View
        style={{
          height: headerHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 80],
          }),
          opacity: headerOpacity,
          overflow: "hidden",
        }}
      >
        <ScreenHeader
          title="Archive"
          subtitle="探索全球时尚品牌"
          boldTitle
          borderless
        />
      </Animated.View>

      {/* Tab bar */}
      <CenteredTabBar
        tabs={MAIN_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Horizontal swipe container */}
      <RNScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.swipeContainer}
      >
        <View style={{ width: screenWidth }}>
          <BrandListTab onScrollUp={showHeader} onScrollDown={hideHeader} />
        </View>
        <View style={{ width: screenWidth }}>
          <MyContributionTab />
        </View>
        <View style={{ width: screenWidth }}>
          <LeaderboardTab />
        </View>
      </RNScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  swipeContainer: {
    flex: 1,
  },
});

export default ArchiveScreen;
