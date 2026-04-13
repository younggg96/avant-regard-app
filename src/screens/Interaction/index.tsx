import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Dimensions,
  ScrollView as RNScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { CenteredTabBar } from "../../components/CenteredTabBar";
import { useChatStore } from "../../store/chatStore";
import BuyerMapScreen from "../BuyerMapScreen";
import { SubTab, SUB_TABS, TAB_INDEX, INDEX_TAB } from "./constants";
import { MessagesContent } from "./components/MessagesContent";
import { styles } from "./styles";

const { width: screenWidth } = Dimensions.get("window");

const InteractionScreen = () => {
  const route = useRoute<any>();
  const initialTab = route.params?.subTab as SubTab | undefined;
  const [activeTab, setActiveTab] = useState<SubTab>(initialTab || "messages");
  const { refreshUnreadCount } = useChatStore();
  const horizontalScrollRef = useRef<RNScrollView>(null);

  useEffect(() => {
    if (initialTab && INDEX_TAB.includes(initialTab)) {
      setActiveTab(initialTab);
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
      }
    },
    [activeTab]
  );

  const tabItems = SUB_TABS.map((t) => ({ ...t, badge: 0 }));

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
          <BuyerMapScreen embedded />
        </View>
      </RNScrollView>
    </SafeAreaView>
  );
};

export default InteractionScreen;
