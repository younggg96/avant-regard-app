import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Dimensions,
  ScrollView as RNScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { useMainBottomTabStore } from "../../store/mainBottomTabStore";
import { useTranslation } from "react-i18next";
import { CenteredTabBar } from "../../components/CenteredTabBar";
import { useChatStore } from "../../store/chatStore";
import BuyerMapScreen from "../BuyerMapScreen";
import { useAppTheme } from "../../theme";
import { SubTab, SUB_TAB_KEYS, TAB_INDEX, INDEX_TAB } from "./constants";
import { MessagesContent } from "./components/MessagesContent";
import { useInteractionStyles } from "./styles";

const { width: screenWidth } = Dimensions.get("window");

/**
 * 买手店子 Tab 懒挂载的占位骨架。
 *
 * 为什么需要：InteractionScreen 把"消息"和"地图"放在同一个 pagingEnabled 横向
 * ScrollView 里。如果两个子页同时挂载，进入"消息" Tab 就会顺带触发 BuyerMapScreen
 * 的 `loadStores` / `loadCountries` / `initUserLocation`——这些都是不必要的 IO，
 * 而且一次 Supabase 瞬时 502 会直接以 "Error loading stores" 冒到用户眼前。
 *
 * 解决方式：用户第一次切到"地图" Tab 时才把 BuyerMapScreen 挂载上；在此之前渲染
 * 这个占位骨架。视觉上与 BuyerMapScreen 初始的加载 GIF 保持一致，用户真的切过来
 * 时不会有"空白 → 忽然出现地图 loading"的跳变。
 */
const MapTabPlaceholder: React.FC = () => {
  const t = useAppTheme();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: t.colors.background,
      }}
    >
      <ActivityIndicator size="small" color={t.colors.gray300} />
    </View>
  );
};

const InteractionScreen = () => {
  const styles = useInteractionStyles();
  const { t } = useTranslation();
  const route = useRoute<any>();
  const initialTab = route.params?.subTab as SubTab | undefined;
  const [activeTab, setActiveTab] = useState<SubTab>(initialTab || "messages");
  // 懒挂载标记：一旦用户访问过"地图"子 Tab，就保持挂载（避免来回切时反复重载地图）。
  // 初始化时若用户是从其它页通过 `subTab=map` 参数直达，则直接标记为已挂载。
  const [hasMountedMap, setHasMountedMap] = useState(initialTab === "map");
  const { refreshUnreadCount } = useChatStore();
  const horizontalScrollRef = useRef<RNScrollView>(null);
  const hasAlignedAfterLayoutRef = useRef(false);

  const alignToTab = useCallback((tab: SubTab) => {
    horizontalScrollRef.current?.scrollTo({
      x: TAB_INDEX[tab] * screenWidth,
      animated: false,
    });
  }, []);

  useEffect(() => {
    if (initialTab && INDEX_TAB.includes(initialTab)) {
      setActiveTab(initialTab);
      if (initialTab === "map") setHasMountedMap(true);
      alignToTab(initialTab);
    }
  }, [alignToTab, initialTab]);

  useEffect(() => {
    // Reset layout-alignment guard when tab is driven by route params.
    hasAlignedAfterLayoutRef.current = false;
  }, [initialTab]);

  useFocusEffect(
    useCallback(() => {
      useMainBottomTabStore.getState().setActiveMainTab("Interaction");
      refreshUnreadCount();

      // Ensure page position always matches activeTab when the screen regains focus.
      // This avoids a mismatch where tab highlight is updated from route params
      // but the underlying horizontal ScrollView remains on the old page.
      requestAnimationFrame(() => {
        alignToTab(activeTab);
      });
    }, [activeTab, alignToTab, refreshUnreadCount])
  );

  const handleTabChange = useCallback((tab: SubTab) => {
    setActiveTab(tab);
    if (tab === "map") setHasMountedMap(true);
    horizontalScrollRef.current?.scrollTo({
      x: TAB_INDEX[tab] * screenWidth,
      animated: true,
    });
  }, []);

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const pageIndex = Math.round(offsetX / screenWidth);
      const newTab = INDEX_TAB[pageIndex];
      if (newTab && newTab !== activeTab) {
        setActiveTab(newTab);
        if (newTab === "map") setHasMountedMap(true);
      }
    },
    [activeTab]
  );

  const tabItems = (Object.keys(SUB_TAB_KEYS) as SubTab[]).map((id) => ({
    id,
    label: t(SUB_TAB_KEYS[id]),
    badge: 0,
  }));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <CenteredTabBar
        tabs={tabItems}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      <RNScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        onLayout={() => {
          if (hasAlignedAfterLayoutRef.current) return;
          hasAlignedAfterLayoutRef.current = true;

          // One more alignment after first layout to avoid occasional
          // "tab selected but page not moved" race on some devices.
          const targetTab =
            initialTab && INDEX_TAB.includes(initialTab) ? initialTab : activeTab;
          requestAnimationFrame(() => {
            alignToTab(targetTab);
          });
        }}
        style={styles.swipeContainer}
      >
        <View style={{ width: screenWidth }}>
          <MessagesContent />
        </View>
        <View style={{ width: screenWidth }}>
          {hasMountedMap ? <BuyerMapScreen embedded /> : <MapTabPlaceholder />}
        </View>
      </RNScrollView>
    </SafeAreaView>
  );
};

export default InteractionScreen;
