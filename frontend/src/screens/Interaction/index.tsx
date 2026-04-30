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
import { useTranslation } from "react-i18next";
import { CenteredTabBar } from "../../components/CenteredTabBar";
import { useChatStore } from "../../store/chatStore";
import BuyerMapScreen from "../BuyerMapScreen";
import { SubTab, SUB_TAB_KEYS, TAB_INDEX, INDEX_TAB } from "./constants";
import { MessagesContent } from "./components/MessagesContent";
import { styles } from "./styles";

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
const MapTabPlaceholder: React.FC = () => (
  <View style={mapPlaceholderStyles.container}>
    <ActivityIndicator size="small" color="#888" />
  </View>
);

const mapPlaceholderStyles = {
  container: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: "#ffffff",
  },
};

const InteractionScreen = () => {
  const { t } = useTranslation();
  const route = useRoute<any>();
  const initialTab = route.params?.subTab as SubTab | undefined;
  const [activeTab, setActiveTab] = useState<SubTab>(initialTab || "messages");
  // 懒挂载标记：一旦用户访问过"地图"子 Tab，就保持挂载（避免来回切时反复重载地图）。
  // 初始化时若用户是从其它页通过 `subTab=map` 参数直达，则直接标记为已挂载。
  const [hasMountedMap, setHasMountedMap] = useState(initialTab === "map");
  const { refreshUnreadCount } = useChatStore();
  const horizontalScrollRef = useRef<RNScrollView>(null);

  useEffect(() => {
    if (initialTab && INDEX_TAB.includes(initialTab)) {
      setActiveTab(initialTab);
      if (initialTab === "map") setHasMountedMap(true);
      horizontalScrollRef.current?.scrollTo({
        x: TAB_INDEX[initialTab] * screenWidth,
        animated: false,
      });
    }
  }, [initialTab]);

  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount();
    }, [])
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
