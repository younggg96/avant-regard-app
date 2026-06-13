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
import { useNotificationStore } from "../../store/notificationStore";
import BuyerMapScreen from "../BuyerMapScreen";
import { useAppTheme } from "../../theme";
import { SubTab, SUB_TAB_KEYS, TAB_INDEX, INDEX_TAB } from "./constants";
import { MessagesContent } from "./components/MessagesContent";
import { TradingContent } from "./components/TradingContent";
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
  const routeSubTab = route.params?.subTab as SubTab | undefined;
  const initialTab: SubTab =
    routeSubTab && INDEX_TAB.includes(routeSubTab) ? routeSubTab : "messages";
  const [activeTab, setActiveTab] = useState<SubTab>(initialTab);
  // 懒挂载标记：一旦用户访问过"地图"子 Tab，就保持挂载（避免来回切时反复重载地图）。
  // 初始化时若用户是从其它页通过 `subTab=map` 参数直达，则直接标记为已挂载。
  const [hasMountedMap, setHasMountedMap] = useState(initialTab === "map");
  const { refreshUnreadCount } = useChatStore();
  // 底部消息图标点击信号：每次 nonce 变化都把子 Tab 切回「私信」。
  const messagesJumpNonce = useMainBottomTabStore((s) => s.messagesJumpNonce);
  // 「交易」tab 角标：未读交易类通知（已带 category）+ 未读交易会话的合计数量。
  const tradingNotifUnread = useNotificationStore((s) =>
    s.notifications.filter((n) => n.category != null && !n.isRead).length
  );
  const tradingConvUnread = useChatStore((s) =>
    s.conversations
      .filter((c) => c.tradeContext?.isTrade)
      .reduce((sum, c) => sum + (c.unreadCount > 0 ? c.unreadCount : 0), 0)
  );
  const tradingUnread = tradingNotifUnread + tradingConvUnread;
  const horizontalScrollRef = useRef<RNScrollView>(null);
  const hasAlignedAfterLayoutRef = useRef(false);
  // route.params.subTab 仅当与上次响应过的值不同时才驱动子 Tab 切换；
  // 否则会和本地 setActiveTab 形成循环（pager 切到私信后被 useEffect 弹回 map）。
  const lastHandledRouteSubTabRef = useRef<SubTab | undefined>(routeSubTab);

  const alignToTab = useCallback((tab: SubTab, animated: boolean) => {
    horizontalScrollRef.current?.scrollTo({
      x: TAB_INDEX[tab] * screenWidth,
      animated,
    });
  }, []);

  // 只响应"外部 navigate 主动带来的新 subTab"。比如用户在 Profile 点私信
  // 进入互动页时 routeSubTab='messages'，会切到私信。但用户在屏内自己点了
  // 「买手店地图」之后，route.params 里残留的 'map' 不应再次被消费 —
  // 不然回到「私信」时这个 effect 会立刻把页面拉回 'map'。
  useEffect(() => {
    if (!routeSubTab || !INDEX_TAB.includes(routeSubTab)) return;
    if (routeSubTab === lastHandledRouteSubTabRef.current) return;
    lastHandledRouteSubTabRef.current = routeSubTab;
    setActiveTab(routeSubTab);
    if (routeSubTab === "map") setHasMountedMap(true);
    alignToTab(routeSubTab, false);
  }, [alignToTab, routeSubTab]);

  useFocusEffect(
    useCallback(() => {
      useMainBottomTabStore.getState().setActiveMainTab("Interaction");
      refreshUnreadCount();
    }, [refreshUnreadCount])
  );

  const handleTabChange = useCallback(
    (tab: SubTab) => {
      setActiveTab(tab);
      if (tab === "map") setHasMountedMap(true);
      // 标记本地切换的目标，避免随后被 routeSubTab effect 当成"外部命令"再次响应。
      lastHandledRouteSubTabRef.current = tab;
      alignToTab(tab, true);
    },
    [alignToTab]
  );

  // 响应底部消息图标的点击：跳到「私信」子 Tab。用 ref 跳过首次挂载，
  // 只在 nonce 真正自增（= 用户点了底部消息 Tab）时切换。
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
      const newTab = INDEX_TAB[pageIndex];
      if (newTab && newTab !== activeTab) {
        setActiveTab(newTab);
        if (newTab === "map") setHasMountedMap(true);
        lastHandledRouteSubTabRef.current = newTab;
      }
    },
    [activeTab]
  );

  const tabItems = (Object.keys(SUB_TAB_KEYS) as SubTab[]).map((id) => ({
    id,
    label: t(SUB_TAB_KEYS[id]),
    badge: id === "trading" ? tradingUnread : 0,
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
          requestAnimationFrame(() => {
            alignToTab(activeTab, false);
          });
        }}
        style={styles.swipeContainer}
      >
        <View style={{ width: screenWidth }}>
          <MessagesContent />
        </View>
        <View style={{ width: screenWidth }}>
          <TradingContent />
        </View>
        <View style={{ width: screenWidth }}>
          {hasMountedMap ? <BuyerMapScreen embedded /> : <MapTabPlaceholder />}
        </View>
      </RNScrollView>
    </SafeAreaView>
  );
};

export default InteractionScreen;
