import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Dimensions,
  ScrollView as RNScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { useMainBottomTabStore } from "../../store/mainBottomTabStore";
import { useTranslation } from "react-i18next";
import { CenteredTabBar } from "../../components/CenteredTabBar";
import { useChatStore } from "../../store/chatStore";
import { useNotificationStore } from "../../store/notificationStore";
import { SubTab, SUB_TAB_KEYS, INDEX_TAB } from "./constants";
import { useTradingEnabled } from "../../store/featureFlagsStore";
import { MessagesContent } from "./components/MessagesContent";
import { TradingContent } from "./components/TradingContent";
import { isChatNotification } from "./utils";
import { isTradeConversation } from "../../services/chatService";
import { useInteractionStyles } from "./styles";

const { width: screenWidth } = Dimensions.get("window");

/**
 * 底部「消息」Tab：私信 + 交易相关消息。
 * 买手店地图已迁到首页「买手店」Tab，不再挂在本页。
 */
const InteractionScreen = () => {
  const styles = useInteractionStyles();
  const { t } = useTranslation();
  const route = useRoute<any>();
  const tradingEnabled = useTradingEnabled();
  const visibleTabs: SubTab[] = useMemo(
    () => (tradingEnabled ? INDEX_TAB : INDEX_TAB.filter((tab) => tab !== "trading")),
    [tradingEnabled]
  );
  const routeSubTab = route.params?.subTab as SubTab | undefined;
  const initialTab: SubTab =
    routeSubTab && visibleTabs.includes(routeSubTab) ? routeSubTab : "messages";
  const [activeTab, setActiveTab] = useState<SubTab>(initialTab);
  const { refreshUnreadCount } = useChatStore();
  const messagesJumpNonce = useMainBottomTabStore((s) => s.messagesJumpNonce);
  const tradingNotifUnread = useNotificationStore((s) =>
    s.notifications.filter((n) => n.category != null && !n.isRead).length
  );
  const tradingConvUnread = useChatStore((s) =>
    s.conversations
      .filter((c) => c.tradeContext?.isTrade)
      .reduce((sum, c) => sum + (c.unreadCount > 0 ? c.unreadCount : 0), 0)
  );
  const tradingUnread = tradingNotifUnread + tradingConvUnread;

  const messagesConvUnread = useChatStore((s) =>
    s.conversations
      .filter((c) => !isTradeConversation(c))
      .reduce((sum, c) => sum + (c.unreadCount > 0 ? c.unreadCount : 0), 0)
  );
  const messagesNotifUnread = useNotificationStore((s) =>
    s.notifications.filter(
      (n) => !n.isRead && n.category == null && !isChatNotification(n)
    ).length
  );
  const messagesUnread = messagesConvUnread + messagesNotifUnread;
  const horizontalScrollRef = useRef<RNScrollView>(null);
  const hasAlignedAfterLayoutRef = useRef(false);
  const lastHandledRouteSubTabRef = useRef<SubTab | undefined>(routeSubTab);

  const alignToTab = useCallback((tab: SubTab, animated: boolean) => {
    const idx = visibleTabs.indexOf(tab);
    if (idx < 0) return;
    horizontalScrollRef.current?.scrollTo({
      x: idx * screenWidth,
      animated,
    });
  }, [visibleTabs]);

  const prevTradingEnabledRef = useRef(tradingEnabled);
  useEffect(() => {
    if (prevTradingEnabledRef.current === tradingEnabled) return;
    prevTradingEnabledRef.current = tradingEnabled;
    const target: SubTab = !tradingEnabled && activeTab === "trading" ? "messages" : activeTab;
    if (target !== activeTab) {
      setActiveTab(target);
      lastHandledRouteSubTabRef.current = target;
    }
    requestAnimationFrame(() => alignToTab(target, false));
  }, [tradingEnabled, activeTab, alignToTab]);

  useEffect(() => {
    if (!routeSubTab || !visibleTabs.includes(routeSubTab)) return;
    if (routeSubTab === lastHandledRouteSubTabRef.current) return;
    lastHandledRouteSubTabRef.current = routeSubTab;
    setActiveTab(routeSubTab);
    alignToTab(routeSubTab, false);
  }, [alignToTab, routeSubTab, visibleTabs]);

  useFocusEffect(
    useCallback(() => {
      useMainBottomTabStore.getState().setActiveMainTab("Interaction");
      refreshUnreadCount();
    }, [refreshUnreadCount])
  );

  const handleTabChange = useCallback(
    (tab: SubTab) => {
      setActiveTab(tab);
      lastHandledRouteSubTabRef.current = tab;
      alignToTab(tab, true);
    },
    [alignToTab]
  );

  const lastMessagesJumpNonceRef = useRef(messagesJumpNonce);
  useEffect(() => {
    if (messagesJumpNonce === lastMessagesJumpNonceRef.current) return;
    lastMessagesJumpNonceRef.current = messagesJumpNonce;
    handleTabChange("messages");
  }, [messagesJumpNonce, handleTabChange]);

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const pageIndex = Math.round(offsetX / screenWidth);
      const newTab = visibleTabs[pageIndex];
      if (newTab && newTab !== activeTab) {
        setActiveTab(newTab);
        lastHandledRouteSubTabRef.current = newTab;
      }
    },
    [activeTab, visibleTabs]
  );

  const tabItems = visibleTabs.map((id) => ({
    id,
    label: t(SUB_TAB_KEYS[id]),
    badge: id === "trading" ? tradingUnread : id === "messages" ? messagesUnread : 0,
  }));

  const showSubTabs = visibleTabs.length > 1;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {showSubTabs ? (
        <CenteredTabBar
          tabs={tabItems}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      ) : null}

      <RNScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={showSubTabs}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        onLayout={() => {
          if (hasAlignedAfterLayoutRef.current) return;
          hasAlignedAfterLayoutRef.current = true;
          requestAnimationFrame(() => {
            alignToTab(activeTab, false);
          });
        }}
        style={styles.swipeContainer}
      >
        <View style={{ width: screenWidth }}>
          <MessagesContent />
        </View>
        {tradingEnabled ? (
          <View style={{ width: screenWidth }}>
            <TradingContent />
          </View>
        ) : null}
      </RNScrollView>
    </SafeAreaView>
  );
};

export default InteractionScreen;
