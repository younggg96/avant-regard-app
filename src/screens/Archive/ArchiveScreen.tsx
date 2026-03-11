import React, { useState, useCallback, useRef } from "react";
import { StyleSheet, Animated, Dimensions, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Box, Text } from "../../components/ui";
import { theme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import { BrandListTab, MyContributionTab, LeaderboardTab } from "./components";
import { ArchiveTab, MAIN_TABS } from "./types";

const { width: screenWidth } = Dimensions.get("window");
const TAB_COUNT = MAIN_TABS.length;
const TAB_BAR_H_PADDING = 16;
const TAB_WIDTH = (screenWidth - TAB_BAR_H_PADDING * 2) / TAB_COUNT;
const INDICATOR_W = 30;

const ArchiveScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ArchiveTab>("all");

  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const headerHeight = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const isHeaderVisible = useRef(true);

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
      const idx = MAIN_TABS.findIndex((t) => t.id === tab);
      Animated.spring(tabIndicatorAnim, {
        toValue: idx,
        useNativeDriver: true,
        tension: 300,
        friction: 30,
      }).start();
      if (tab !== "all") showHeader();
    },
    [tabIndicatorAnim, showHeader]
  );

  const renderContent = () => {
    switch (activeTab) {
      case "all":
        return (
          <BrandListTab onScrollUp={showHeader} onScrollDown={hideHeader} />
        );
      case "myContribution":
        return <MyContributionTab />;
      case "leaderboard":
        return <LeaderboardTab />;
    }
  };

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
      <Box style={styles.tabBar}>
        {MAIN_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabItem}
            onPress={() => handleTabChange(tab.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}

        <Animated.View
          style={[
            styles.tabIndicator,
            {
              width: INDICATOR_W,
              left: 0,
              transform: [
                {
                  translateX: tabIndicatorAnim.interpolate({
                    inputRange: MAIN_TABS.map((_, i) => i),
                    outputRange: MAIN_TABS.map(
                      (_, i) =>
                        TAB_BAR_H_PADDING +
                        TAB_WIDTH * (i + 0.5) -
                        INDICATOR_W / 2
                    ),
                  }),
                },
              ],
            },
          ]}
        />
      </Box>

      {/* Active tab content */}
      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: TAB_BAR_H_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
    position: "relative",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.gray400,
    textAlign: "center",
  },
  tabTextActive: {
    color: theme.colors.black,
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    backgroundColor: theme.colors.black,
    borderRadius: 1,
  },
});

export default ArchiveScreen;
