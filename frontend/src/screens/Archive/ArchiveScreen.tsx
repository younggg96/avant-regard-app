import React, { useState, useCallback, useRef, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  StyleSheet,
  View,
  Animated,
  Dimensions,
  ScrollView as RNScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import { CenteredTabBar } from "../../components/CenteredTabBar";
import { BrandListTab, MyContributionTab, LeaderboardTab } from "./components";
import { ArchiveTab, MAIN_TAB_IDS, MAIN_TAB_KEYS } from "./types";
import { useMainBottomTabStore } from "../../store/mainBottomTabStore";

const { width: screenWidth } = Dimensions.get("window");

const ArchiveScreen: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ArchiveTab>("all");

  const tabs = useMemo(
    () => MAIN_TAB_IDS.map((id) => ({ id, label: t(MAIN_TAB_KEYS[id]) })),
    [t]
  );

  useFocusEffect(
    useCallback(() => {
      useMainBottomTabStore.getState().setActiveMainTab("Archive");
    }, [])
  );

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
      const tabIndex = MAIN_TAB_IDS.indexOf(tab);
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
      const newTab = MAIN_TAB_IDS[pageIndex];
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
          subtitle={t("archive.subtitle")}
          boldTitle
          borderless
        />
      </Animated.View>

      {/* Tab bar */}
      <CenteredTabBar
        tabs={tabs}
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
