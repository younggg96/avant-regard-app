import React, { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { View, AppState, AppStateStatus, useColorScheme } from "react-native";
import {
  NavigationContainer,
  NavigationContainerRef,
  NavigationState,
  PartialState,
  DefaultTheme as NavigationDefaultTheme,
  DarkTheme as NavigationDarkTheme,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import { config } from "./gluestack.config";

// i18n
import { initI18n } from "./src/i18n";
import { useTranslation } from "react-i18next";

// Push Notifications
import { usePushNotifications } from "./src/hooks/usePushNotifications";

// Deep Linking
import { LINKING_CONFIG, setNavigationRef, initDeepLinking } from "./src/utils/deepLinking";

// Splash Video
import SplashVideo from "./src/components/SplashVideo";

// Maintenance
import {
  startMaintenancePolling,
  stopMaintenancePolling,
} from "./src/store/maintenanceStore";
import MaintenanceOverlay from "./src/components/MaintenanceOverlay";

// Feature flags (admin 控制的全站开关, 例如月度抽奖入口)
import {
  startFeatureFlagsPolling,
  stopFeatureFlagsPolling,
} from "./src/store/featureFlagsStore";

// Share SDK
import { initWechat } from "./src/services/shareService";

// Screens
import DiscoverScreen from "./src/screens/DiscoverScreen";
import ArchiveScreen from "./src/screens/Archive/ArchiveScreen";
import InteractionScreen from "./src/screens/InteractionScreen";
import StoreListScreen from "./src/screens/StoreListScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import CollectionDetailScreen from "./src/screens/CollectionDetailScreen";
import PostDetailScreen from "./src/screens/PostDetailScreen";
import BrandDetailScreen from "./src/screens/BrandDetailScreen";

// Auth Screens
import AuthScreen from "./src/screens/AuthScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import EditProfileScreen from "./src/screens/EditProfileScreen";
import UserProfileScreen from "./src/screens/UserProfileScreen";
import FavoritesScreen from "./src/screens/FavoritesScreen";
import FollowingUsersScreen from "./src/screens/FollowingUsersScreen";
import FollowersScreen from "./src/screens/FollowersScreen";
import BrandFollowersScreen from "./src/screens/BrandFollowersScreen";
import AdminScreen from "./src/screens/admin/AdminScreen";
import SubmitStoreScreen from "./src/screens/SubmitStoreScreen";
import SubmitBrandScreen from "./src/screens/Archive/SubmitBrandScreen";
import StoreDetailScreen from "./src/screens/StoreDetailScreen";
import AllBuyerStoresScreen from "./src/screens/AllBuyerStoresScreen";
import StoreReviewScreen from "./src/screens/StoreReviewScreen";
import StoreProductListScreen from "./src/screens/StoreProductListScreen";
import StoreProductDetailScreen from "./src/screens/StoreProductDetailScreen";
// Publish Screens
import PublishTypeScreen from "./src/screens/PublishTypeScreen";
import PublishLookbookScreen from "./src/screens/PublishLookbookScreen";
import PublishOutfitScreen from "./src/screens/PublishOutfitScreen";
import PublishReviewScreen from "./src/screens/PublishReviewScreen";
import PublishForumPostScreen from "./src/screens/PublishForumPostScreen";
// V2 Publish Flow Screens
// Composer 是当前底部「+」按钮的图片优先入口（单屏完成媒体 + 类型 + 字段）。
// ImageSelectScreen / TypeSelectScreen 文件保留但不再注册路由，作为 V2 早期分步流程的历史回退。
import PublishV2ComposerScreen from "./src/screens/PublishV2/PublishV2ComposerScreen";
import PublishV2ForumModeScreen from "./src/screens/PublishV2/PublishV2ForumModeScreen";
import PublishV2ForumSelectScreen from "./src/screens/PublishV2/PublishV2ForumSelectScreen";
// AI Post Assistant Screens
import AIPostEntryScreen from "./src/screens/AIPost/AIPostEntryScreen";
import AIPostQAStepScreen from "./src/screens/AIPost/AIPostQAStepScreen";
import AIPostPreviewScreen from "./src/screens/AIPost/AIPostPreviewScreen";
import AIPostImageBriefScreen from "@/screens/AIPost/AIPostImageBriefScreen";
import AllCommentsScreen from "./src/screens/AllCommentsScreen";

import CommunityDetailScreen from "./src/screens/CommunityDetailScreen";
import AllCommunitiesScreen from "./src/screens/AllCommunitiesScreen";
// Merchant Screens
import MyMerchantStoresScreen from "./src/screens/MyMerchantStoresScreen";
import MerchantManageScreen from "./src/screens/MerchantManageScreen";
import MerchantProductsScreen from "./src/screens/MerchantProductsScreen";
import MerchantReviewScreen from "./src/screens/MerchantReviewScreen";
// Search Screens
import SearchScreen from "./src/screens/SearchScreen";
import StoreSearchScreen from "./src/screens/StoreSearchScreen";
// User Management Screens
import MyCommentsScreen from "./src/screens/MyCommentsScreen";
import MyLikesScreen from "./src/screens/MyLikesScreen";
import MyReportsScreen from "./src/screens/MyReportsScreen";
import BlockedUsersScreen from "./src/screens/BlockedUsersScreen";
import MyTitlesScreen from "./src/screens/MyTitlesScreen";
import ChangePasswordScreen from "./src/screens/ChangePasswordScreen";

// Chat Screens
import ChatScreen from "./src/screens/ChatScreen";
import ActivityScreen from "./src/screens/ActivityScreen";
import StrangerMessagesScreen from "./src/screens/StrangerMessagesScreen";

// Level Screens / Watcher
import MyLevelScreen from "./src/screens/MyLevelScreen";
import { LevelUpgradeModal, useLevelWatcher } from "./src/components/level";

// Stores & Services
import { useChatStore } from "./src/store/chatStore";
import { useNotificationStore } from "./src/store/notificationStore";

// Components
import TabBarIcon from "./src/components/TabBarIcon";
// V1 PublishTabButton 文件保留作为历史回退入口；当前 Tab 中央「+」走 V2 流程。
import PublishTabButtonV2 from "./src/components/PublishTabButtonV2";
import UploadProgressBanner from "./src/components/UploadProgressBanner";
import OnboardingGuideModal from "./src/components/OnboardingGuideModal";
import CustomAlert from "./src/components/CustomAlert";

// Theme
import {
  getThemeByMode,
  resolveThemeMode,
  ThemeProvider,
  useAppTheme,
  type ThemePreference,
} from "./src/theme";

// Store
import { useAuthStore } from "./src/store/authStore";

// Providers
import { ToastProvider } from "./src/components/ToastProvider";
import ProfileReminderModal from "./src/components/ProfileReminderModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { userInfoService } from "./src/services/userInfoService";

// 防止原生 splash screen 自动隐藏
SplashScreen.preventAutoHideAsync().catch(() => { });

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

type EngagementNudgeStage = "aiPost" | "forumFollow" | "done";

interface EngagementNudgeState {
  stage: EngagementNudgeStage;
  accumulatedMs: number;
  behaviorCount: number;
  // 累计已主动弹出过的次数。一旦达到 ENGAGEMENT_NUDGE_MAX_PROMPTS，
  // stage 永久置为 "done"，不再打扰用户（不论后续添加多少 stage）。
  shownCount: number;
}

const ENGAGEMENT_NUDGE_USAGE_THRESHOLD_MS = 3 * 60 * 1000;
const ENGAGEMENT_NUDGE_BEHAVIOR_THRESHOLD = 3;
// 全局硬上限：整个用户生命周期内最多主动弹 2 次（AI 发帖 + 论坛关注），
// 超过即冻结到 "done"，避免对老用户反复打扰。
const ENGAGEMENT_NUDGE_MAX_PROMPTS = 2;
const ENGAGEMENT_NUDGE_STORAGE_PREFIX = "engagement_nudge_state";
const ENGAGEMENT_NUDGE_BEHAVIOR_ROUTES = new Set([
  "PostDetail",
  "PublishType",
  "PublishForumPost",
  "Search",
  "CommunityDetail",
]);

const DEFAULT_ENGAGEMENT_NUDGE_STATE: EngagementNudgeState = {
  stage: "aiPost",
  accumulatedMs: 0,
  behaviorCount: 0,
  shownCount: 0,
};

const getEngagementNudgeStorageKey = (userId: string | number) =>
  `${ENGAGEMENT_NUDGE_STORAGE_PREFIX}_${userId}`;

// 老版本持久化里没有 shownCount。按 stage 推断已弹出的次数，
// 让升级后的客户端立刻遵守 2 次上限，不会因为缺字段又开始弹一次。
const inferShownCountFromStage = (
  stage: EngagementNudgeStage,
  raw: unknown
): number => {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(Math.max(0, Math.floor(raw)), ENGAGEMENT_NUDGE_MAX_PROMPTS);
  }
  if (stage === "done") return ENGAGEMENT_NUDGE_MAX_PROMPTS;
  if (stage === "forumFollow") return 1;
  return 0;
};

const getActiveRouteName = (
  state?: NavigationState | PartialState<NavigationState>
): string | undefined => {
  if (!state || state.routes.length === 0) return undefined;
  const route = state.routes[state.index ?? 0];
  const nestedState = route.state as NavigationState | PartialState<NavigationState> | undefined;
  if (nestedState) {
    return getActiveRouteName(nestedState);
  }
  return route.name;
};

function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Auth" component={AuthScreen} />
    </Stack.Navigator>
  );
}

function TabNavigator() {
  const appTheme = useAppTheme();
  const { t } = useTranslation();
  // 统一从 notificationStore 读未读数。当页面内调用 markRead / markAllRead 时，
  // tab 角标会立刻更新，不用等 30 秒 polling。polling 仍保留作为兜底，覆盖
  // 后台推送在 App 处于前台但还没被任何页面消费的场景。
  const loadNotifications = useNotificationStore((s) => s.loadNotifications);
  const refreshUnreadCount = useNotificationStore((s) => s.refreshUnreadCount);

  // Delay the initial `loadNotifications` call by 2s so its HTTP round-trip
  // + `setState` for unread badges doesn't land inside the Discover tab's
  // first-paint window (recommend feed fetch + 26-card masonry mount + 52
  // image decodes). The 30s polling timer still schedules immediately — it's
  // the next tick that's delayed, not the cadence.
  useEffect(() => {
    const kickoff = setTimeout(() => {
      loadNotifications();
    }, 2000);
    const timer = setInterval(refreshUnreadCount, 30_000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(timer);
    };
  }, [loadNotifications, refreshUnreadCount]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: appTheme.colors.card,
          borderTopWidth: 1,
          borderTopColor: appTheme.colors.border,
          height: 76,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: appTheme.colors.text,
        tabBarInactiveTintColor: appTheme.colors.gray300,
        tabBarLabelStyle: {
          fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Regular",
          fontSize: 11,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DiscoverScreen}
        options={{
          tabBarLabel: t("tabs.home"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Archive"
        component={ArchiveScreen}
        options={{
          tabBarLabel: t("tabs.archive"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="archive" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="PublishTab"
        component={DiscoverScreen} // Placeholder, won't be used
        options={{
          tabBarLabel: "",
          tabBarIcon: () => null,
          tabBarButton: (props) => <PublishTabButtonV2 />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault(); // Prevent default tab behavior
          },
        })}
      />
      <Tab.Screen
        name="Interaction"
        component={InteractionScreen}
        initialParams={{ subTab: "map" }}
        options={{
          tabBarLabel: t("tabs.interaction"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="interaction" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t("tabs.profile"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="profile" color={color} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator({
  engagementBehaviorSignal,
  onNavigateToAIPost,
  onNavigateToForum,
}: {
  engagementBehaviorSignal: number;
  onNavigateToAIPost: () => void;
  onNavigateToForum: () => void;
}) {
  const appTheme = useAppTheme();
  const { t } = useTranslation();
  const { isAuthenticated, user, shouldShowProfileReminder, updateLastProfileReminderTime } = useAuthStore();
  const [showProfileReminder, setShowProfileReminder] = useState(false);
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);
  const [guideChecked, setGuideChecked] = useState(false);
  const [engagementNudgeState, setEngagementNudgeState] = useState<EngagementNudgeState | null>(null);
  const [activeEngagementNudge, setActiveEngagementNudge] = useState<EngagementNudgeStage | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastBehaviorSignalRef = useRef(engagementBehaviorSignal);
  // 避免定时器/订阅每次状态对象引用变化都重建，靠 ref 读最新值。
  const activeEngagementNudgeRef = useRef(activeEngagementNudge);
  activeEngagementNudgeRef.current = activeEngagementNudge;
  const showOnboardingGuideRef = useRef(showOnboardingGuide);
  showOnboardingGuideRef.current = showOnboardingGuide;
  const showProfileReminderRef = useRef(showProfileReminder);
  showProfileReminderRef.current = showProfileReminder;

  // Push notifications
  usePushNotifications();

  // 等级状态监听 (登录后 / 回到前台 触发一次 /levels/me, 用于徽章 & 全屏升级动画)
  useLevelWatcher();

  // Connect chat WebSocket when authenticated
  const { connectWebSocket, disconnectWebSocket, reset: resetChat } = useChatStore();
  const resetNotifications = useNotificationStore((s) => s.reset);
  useEffect(() => {
    if (isAuthenticated) {
      connectWebSocket();
    } else {
      resetChat();
      resetNotifications();
    }
    return () => disconnectWebSocket();
  }, [isAuthenticated]);

  // Check if onboarding guide needs to be shown
  useEffect(() => {
    if (!isAuthenticated || !user?.userId) {
      setGuideChecked(true);
      return;
    }

    const checkGuide = async () => {
      try {
        const key = `onboarding_guide_completed_${user.userId}`;
        const completed = await AsyncStorage.getItem(key);
        if (!completed) {
          setShowOnboardingGuide(true);
        }
      } catch (error) {
        console.log("Failed to check onboarding guide status:", error);
      } finally {
        setGuideChecked(true);
      }
    };

    checkGuide();
  }, [isAuthenticated, user?.userId]);

  const persistEngagementNudgeState = useCallback(
    async (nextState: EngagementNudgeState) => {
      if (!user?.userId) return;
      try {
        await AsyncStorage.setItem(
          getEngagementNudgeStorageKey(user.userId),
          JSON.stringify(nextState)
        );
      } catch (error) {
        console.log("Failed to persist engagement nudge state:", error);
      }
    },
    [user?.userId]
  );

  const patchEngagementNudgeState = useCallback(
    (patcher: (prev: EngagementNudgeState) => EngagementNudgeState) => {
      setEngagementNudgeState((prev) => {
        if (!prev) return prev;
        const next = patcher(prev);
        void persistEngagementNudgeState(next);
        return next;
      });
    },
    [persistEngagementNudgeState]
  );

  // 弹窗"打开"时立即推进一次，而不是关闭时推进。
  // 这样可以避免 CustomAlert.handleButtonPress 同时调用 button.onPress
  // 和 onClose（两者都指向 closeEngagementNudge）导致 stage 被推进 2 级、
  // 用户实际只能看到 1 次弹窗的旧 bug。
  const advanceEngagementNudgeStage = useCallback(() => {
    patchEngagementNudgeState((prev) => {
      const nextShownCount = Math.min(
        prev.shownCount + 1,
        ENGAGEMENT_NUDGE_MAX_PROMPTS
      );
      // 命中全局上限直接进入终态，后续永不再弹。
      const reachedCap = nextShownCount >= ENGAGEMENT_NUDGE_MAX_PROMPTS;
      const nextStage: EngagementNudgeStage = reachedCap
        ? "done"
        : prev.stage === "aiPost"
          ? "forumFollow"
          : "done";
      return {
        stage: nextStage,
        accumulatedMs: 0,
        behaviorCount: 0,
        shownCount: nextShownCount,
      };
    });
  }, [patchEngagementNudgeState]);

  const closeEngagementNudge = useCallback(() => {
    setActiveEngagementNudge(null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.userId) {
      setEngagementNudgeState(null);
      setActiveEngagementNudge(null);
      lastBehaviorSignalRef.current = engagementBehaviorSignal;
      return;
    }

    let cancelled = false;
    const loadNudgeState = async () => {
      try {
        const raw = await AsyncStorage.getItem(getEngagementNudgeStorageKey(user.userId));
        if (cancelled) return;
        if (!raw) {
          setEngagementNudgeState(DEFAULT_ENGAGEMENT_NUDGE_STATE);
          return;
        }
        const parsed = JSON.parse(raw) as Partial<EngagementNudgeState>;
        if (
          parsed.stage !== "aiPost" &&
          parsed.stage !== "forumFollow" &&
          parsed.stage !== "done"
        ) {
          setEngagementNudgeState(DEFAULT_ENGAGEMENT_NUDGE_STATE);
          return;
        }
        const shownCount = inferShownCountFromStage(parsed.stage, parsed.shownCount);
        // 老数据若已经"事实上"达到上限（比如旧 bug 让 stage 已经走到 forumFollow
        // 或 done），直接钉死在 done，不再给一次额外的机会。
        const stage: EngagementNudgeStage =
          shownCount >= ENGAGEMENT_NUDGE_MAX_PROMPTS ? "done" : parsed.stage;
        setEngagementNudgeState({
          stage,
          accumulatedMs: Number(parsed.accumulatedMs) || 0,
          behaviorCount: Number(parsed.behaviorCount) || 0,
          shownCount,
        });
      } catch (error) {
        console.log("Failed to load engagement nudge state:", error);
        if (!cancelled) {
          setEngagementNudgeState(DEFAULT_ENGAGEMENT_NUDGE_STATE);
        }
      }
    };

    loadNudgeState();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.userId]);

  useEffect(() => {
    if (!isAuthenticated || !guideChecked || showOnboardingGuide) return;
    if (activeEngagementNudge || !engagementNudgeState) return;
    if (showProfileReminder || engagementNudgeState.stage === "done") return;
    // 兜底：即使 stage 没及时收敛到 done，也要严格遵守 2 次硬上限。
    if (engagementNudgeState.shownCount >= ENGAGEMENT_NUDGE_MAX_PROMPTS) return;

    const shouldOpen =
      engagementNudgeState.accumulatedMs >= ENGAGEMENT_NUDGE_USAGE_THRESHOLD_MS ||
      engagementNudgeState.behaviorCount >= ENGAGEMENT_NUDGE_BEHAVIOR_THRESHOLD;
    if (shouldOpen) {
      setActiveEngagementNudge(engagementNudgeState.stage);
      // 在"打开"时立即记账并推进 stage，确保 shownCount + 1 与本次弹窗一一对应，
      // 不依赖关闭路径（用户点按钮 / 系统返回 / 切后台）的回调到位。
      advanceEngagementNudgeStage();
    }
  }, [
    isAuthenticated,
    guideChecked,
    showOnboardingGuide,
    showProfileReminder,
    activeEngagementNudge,
    engagementNudgeState,
    advanceEngagementNudgeStage,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !user?.userId) return;
    if (!engagementNudgeState || engagementNudgeState.stage === "done") return;

    const usageTimer = setInterval(() => {
      if (appStateRef.current !== "active") return;
      if (activeEngagementNudgeRef.current) return;
      if (showOnboardingGuideRef.current || showProfileReminderRef.current) return;
      patchEngagementNudgeState((prev) => ({
        ...prev,
        accumulatedMs: prev.accumulatedMs + 15_000,
      }));
    }, 15_000);

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
    });

    return () => {
      clearInterval(usageTimer);
      appStateSubscription.remove();
    };
  }, [
    isAuthenticated,
    user?.userId,
    engagementNudgeState?.stage,
    patchEngagementNudgeState,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !engagementNudgeState) return;
    if (engagementNudgeState.stage === "done") return;
    if (activeEngagementNudge) return;
    if (engagementBehaviorSignal === lastBehaviorSignalRef.current) return;

    lastBehaviorSignalRef.current = engagementBehaviorSignal;
    patchEngagementNudgeState((prev) => ({
      ...prev,
      behaviorCount: prev.behaviorCount + 1,
    }));
  }, [
    isAuthenticated,
    engagementBehaviorSignal,
    engagementNudgeState,
    activeEngagementNudge,
    patchEngagementNudgeState,
  ]);

  const handleGuideComplete = useCallback(async () => {
    if (user?.userId) {
      try {
        const key = `onboarding_guide_completed_${user.userId}`;
        await AsyncStorage.setItem(key, "true");
      } catch (error) {
        console.log("Failed to save onboarding guide status:", error);
      }
    }
    setShowOnboardingGuide(false);
  }, [user?.userId]);

  // 检查是否需要显示资料填写提醒（仅在引导完成后）
  useEffect(() => {
    if (!isAuthenticated || !guideChecked || showOnboardingGuide) return;

    // 首次检查：原先 3s 正好落在用户滑动推荐列表的关键帧窗口里，命中时弹
    // Modal 会触发一次大的 React subtree mount + 毛玻璃背板合成，直接把
    // 掉帧叠加到冷启动的图片解码风暴上。推到 8s：此时首屏图片已经解码完、
    // backfill 已经落地、网络请求回来，JS 线程和 GPU 都腾空了，弹 Modal
    // 对滚动体感基本无感。
    const initialCheck = setTimeout(() => {
      if (shouldShowProfileReminder()) {
        setShowProfileReminder(true);
        updateLastProfileReminderTime();
      }
    }, 8000);

    // 每隔1小时检查一次
    const interval = setInterval(() => {
      if (shouldShowProfileReminder()) {
        setShowProfileReminder(true);
        updateLastProfileReminderTime();
      }
    }, 60 * 60 * 1000); // 1小时

    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
    };
  }, [isAuthenticated, guideChecked, showOnboardingGuide, shouldShowProfileReminder, updateLastProfileReminderTime]);

  if (!isAuthenticated) {
    // Show only auth flow for unauthenticated users
    return <AuthNavigator />;
  }

  // Show main app for authenticated users
  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: appTheme.colors.card,
          },
          headerTintColor: appTheme.colors.text,
          headerTitleStyle: {
            fontFamily: "PlayfairDisplay-Bold",
            fontSize: 20,
          },
          headerBackTitle: "",
        }}
      >
        <Stack.Screen
          name="Main"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CollectionDetail"
          component={CollectionDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BrandDetail"
          component={BrandDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AllComments"
          component={AllCommentsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PostDetail"
          component={PostDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="UserProfile"
          component={UserProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Favorites"
          component={FavoritesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FollowingUsers"
          component={FollowingUsersScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Followers"
          component={FollowersScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BrandFollowers"
          component={BrandFollowersScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Admin"
          component={AdminScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="StoreList"
          component={StoreListScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SubmitStore"
          component={SubmitStoreScreen}
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
          }}
        />
        <Stack.Screen
          name="SubmitBrand"
          component={SubmitBrandScreen}
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
          }}
        />
        <Stack.Screen
          name="StoreDetail"
          component={StoreDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AllBuyerStores"
          component={AllBuyerStoresScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="StoreProductList"
          component={StoreProductListScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="StoreProductDetail"
          component={StoreProductDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="StoreSearch"
          component={StoreSearchScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="StoreReview"
          component={StoreReviewScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PublishType"
          component={PublishTypeScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="PublishLookbook"
          component={PublishLookbookScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="PublishOutfit"
          component={PublishOutfitScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="PublishReview"
          component={PublishReviewScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="PublishForumPost"
          component={PublishForumPostScreen}
          options={{
            headerShown: false,
          }}
        />
        {/* V2 发布流程：底部「+」按钮根据 Discover 子 Tab 走不同入口 */}
        <Stack.Screen
          name="PublishV2Composer"
          component={PublishV2ComposerScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PublishV2ForumMode"
          component={PublishV2ForumModeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PublishV2ForumSelect"
          component={PublishV2ForumSelectScreen}
          options={{ headerShown: false }}
        />
        {/* AI 发帖助手 (V3 #25) */}
        <Stack.Screen
          name="AIPostEntry"
          component={AIPostEntryScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AIPostQAStep"
          component={AIPostQAStepScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AIPostImageBrief"
          component={AIPostImageBriefScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AIPostPreview"
          component={AIPostPreviewScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CommunityDetail"
          component={CommunityDetailScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="AllCommunities"
          component={AllCommunitiesScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="MyMerchantStores"
          component={MyMerchantStoresScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MerchantManage"
          component={MerchantManageScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MerchantProducts"
          component={MerchantProductsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MerchantReview"
          component={MerchantReviewScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyComments"
          component={MyCommentsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyLikes"
          component={MyLikesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyReports"
          component={MyReportsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BlockedUsers"
          component={BlockedUsersScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyTitles"
          component={MyTitlesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyLevel"
          component={MyLevelScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ChangePassword"
          component={ChangePasswordScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Activity"
          component={ActivityScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="StrangerMessages"
          component={StrangerMessagesScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>

      {/* 新用户引导 Modal */}
      <OnboardingGuideModal
        visible={showOnboardingGuide}
        onComplete={handleGuideComplete}
      />

      {/* 资料填写提醒 Modal */}
      <ProfileReminderModal
        visible={showProfileReminder}
        onClose={() => setShowProfileReminder(false)}
      />

      <CustomAlert
        visible={activeEngagementNudge !== null}
        title={
          activeEngagementNudge === "aiPost"
            ? t("engagementNudge.aiPost.title")
            : t("engagementNudge.forumFollow.title")
        }
        message={
          activeEngagementNudge === "aiPost"
            ? t("engagementNudge.aiPost.message")
            : t("engagementNudge.forumFollow.message")
        }
        buttons={[
          {
            text:
              activeEngagementNudge === "aiPost"
                ? t("engagementNudge.aiPost.later")
                : t("engagementNudge.forumFollow.later"),
            style: "cancel",
            onPress: closeEngagementNudge,
          },
          {
            text:
              activeEngagementNudge === "aiPost"
                ? t("engagementNudge.aiPost.cta")
                : t("engagementNudge.forumFollow.cta"),
            style: "default",
            onPress: () => {
              const currentStage = activeEngagementNudge;
              closeEngagementNudge();
              if (currentStage === "aiPost") {
                onNavigateToAIPost();
              } else if (currentStage === "forumFollow") {
                onNavigateToForum();
              }
            },
          },
        ]}
        onClose={closeEngagementNudge}
        icon={activeEngagementNudge === "aiPost" ? "sparkles-outline" : "chatbubbles-outline"}
        iconColor={appTheme.colors.text}
      />

      {/* 后台上传进度条 */}
      <UploadProgressBanner />

      {/* 等级升级全屏庆祝 (黑白 2s 动画, 订阅 useLevelStore.celebrateLevel) */}
      <LevelUpgradeModal />
    </>
  );
}

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [appIsReady, setAppIsReady] = useState(false);
  const [showSplashVideo, setShowSplashVideo] = useState(true);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const lastRouteNameRef = useRef<string | undefined>(undefined);
  const [engagementBehaviorSignal, setEngagementBehaviorSignal] = useState(0);
  const systemColorScheme = useColorScheme();
  const userId = useAuthStore((state) => state.user?.userId);
  const updateUser = useAuthStore((state) => state.updateUser);
  const themePreference = useAuthStore(
    (state) => (state.user?.preferredTheme ?? "system") as ThemePreference
  );
  const resolvedThemeMode = resolveThemeMode(themePreference, systemColorScheme);
  const appTheme = getThemeByMode(resolvedThemeMode);
  const navigationTheme = useMemo(
    () =>
      resolvedThemeMode === "dark"
        ? {
            ...NavigationDarkTheme,
            colors: {
              ...NavigationDarkTheme.colors,
              background: appTheme.colors.background,
              card: appTheme.colors.card,
              border: appTheme.colors.border,
              text: appTheme.colors.text,
              primary: appTheme.colors.text,
            },
          }
        : {
            ...NavigationDefaultTheme,
            colors: {
              ...NavigationDefaultTheme.colors,
              background: appTheme.colors.background,
              card: appTheme.colors.card,
              border: appTheme.colors.border,
              text: appTheme.colors.text,
              primary: appTheme.colors.text,
            },
          },
    [appTheme, resolvedThemeMode]
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    userInfoService
      .getUserInfo(userId)
      .then((info) => {
        if (cancelled) return;
        if (
          info.preferredTheme === "system" ||
          info.preferredTheme === "light" ||
          info.preferredTheme === "dark"
        ) {
          updateUser({ preferredTheme: info.preferredTheme });
        }
      })
      .catch((error) => {
        console.log("Failed to sync theme preference:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [updateUser, userId]);

  useEffect(() => {
    async function prepare() {
      try {
        await Promise.all([
          Font.loadAsync({
            "PlayfairDisplay-Regular": require("./assets/fonts/PlayfairDisplay-Regular.ttf"),
            "PlayfairDisplay-Medium": require("./assets/fonts/PlayfairDisplay-Medium.ttf"),
            "PlayfairDisplay-Bold": require("./assets/fonts/PlayfairDisplay-Bold.ttf"),
          }),
          initI18n(),
        ]);
        setFontsLoaded(true);
      } catch (error) {
        console.log("Font loading failed, using system fonts:", error);
        setFontsLoaded(true);
      } finally {
        await SplashScreen.hideAsync().catch(() => { });
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  // 初始化深度链接处理
  useEffect(() => {
    if (appIsReady && navigationRef.current) {
      setNavigationRef(navigationRef.current);
      const unsubscribe = initDeepLinking();
      return () => {
        unsubscribe.then((unsub) => unsub?.());
      };
    }
  }, [appIsReady]);

  // 维护模式轮询：App 就绪后启动单例轮询，卸载时停止，避免重复定时器泄漏。
  //
  // Cold-start budget: the first few seconds after mount are already burning
  // JS cycles on font loading, React tree hydration, feed fetch + 26-card
  // masonry mount, and first-screen image decoding. Delaying the initial
  // maintenance check by ~3s lets the recommend tab paint cleanly before
  // this polling's first HTTP call + `setState` lands.
  useEffect(() => {
    if (!appIsReady) return;
    const kickoff = setTimeout(() => {
      startMaintenancePolling();
    }, 3000);
    return () => {
      clearTimeout(kickoff);
      stopMaintenancePolling();
    };
  }, [appIsReady]);

  // 功能开关轮询 (admin 控制月度抽奖等入口的可见性).
  // 与维护模式一样错开 3s, 让首屏 paint 优先, 但不阻塞用户进入抽奖入口.
  useEffect(() => {
    if (!appIsReady) return;
    const kickoff = setTimeout(() => {
      startFeatureFlagsPolling();
    }, 3500);
    return () => {
      clearTimeout(kickoff);
      stopFeatureFlagsPolling();
    };
  }, [appIsReady]);

  // 初始化微信 SDK（失败不阻塞，只是退化为系统分享）。
  //
  // `initWechat` calls into the native WeChat SDK on iOS which does a
  // synchronous native-module register + app-id validation + bridge call.
  // Nothing in the first-screen UX depends on it — the share sheet is only
  // reachable after the user has tapped into a post. Push it 5s out so the
  // native side doesn't contend with the first-screen image pipeline.
  useEffect(() => {
    if (!appIsReady) return;
    const kickoff = setTimeout(() => {
      initWechat().catch((error) => {
        console.warn("[App] initWechat failed:", error);
      });
    }, 5000);
    return () => clearTimeout(kickoff);
  }, [appIsReady]);

  const handleSplashVideoFinish = useCallback(() => {
    setShowSplashVideo(false);
  }, []);

  const handleNavigationStateChange = useCallback(
    (state?: NavigationState) => {
      const routeName = getActiveRouteName(state);
      if (!routeName) return;
      if (routeName === lastRouteNameRef.current) return;

      if (ENGAGEMENT_NUDGE_BEHAVIOR_ROUTES.has(routeName)) {
        setEngagementBehaviorSignal((prev) => prev + 1);
      }
      lastRouteNameRef.current = routeName;
    },
    []
  );

  const handleNavigateToAIPost = useCallback(() => {
    (navigationRef.current as any)?.navigate("AIPostEntry");
  }, []);

  const handleNavigateToForum = useCallback(() => {
    (navigationRef.current as any)?.navigate("Main", {
        screen: "Home",
        params: {
          targetDiscoverTab: "forum",
        },
      });
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <GluestackUIProvider
      // Force remount on mode switch so gluestack tokens ($white/$black etc.)
      // never get stuck on the previous colorMode.
      key={resolvedThemeMode}
      config={config}
      colorMode={resolvedThemeMode}
    >
      <ThemeProvider value={appTheme}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <ToastProvider>
              <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
                <NavigationContainer
                  ref={navigationRef}
                  linking={LINKING_CONFIG}
                  theme={navigationTheme}
                  onStateChange={handleNavigationStateChange}
                >
                  <AppNavigator
                    engagementBehaviorSignal={engagementBehaviorSignal}
                    onNavigateToAIPost={handleNavigateToAIPost}
                    onNavigateToForum={handleNavigateToForum}
                  />
                  <StatusBar style={resolvedThemeMode === "dark" ? "light" : "dark"} />
                </NavigationContainer>
                {showSplashVideo && (
                  <SplashVideo onFinish={handleSplashVideoFinish} />
                )}
                <MaintenanceOverlay />
              </View>
            </ToastProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
