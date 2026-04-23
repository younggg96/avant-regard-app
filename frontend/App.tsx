import React, { useEffect, useCallback, useState, useRef } from "react";
import { View } from "react-native";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import { config } from "./gluestack.config";

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
import StoreDetailScreen from "./src/screens/StoreDetailScreen";
import StoreReviewScreen from "./src/screens/StoreReviewScreen";
// Publish Screens
import PublishTypeScreen from "./src/screens/PublishTypeScreen";
import PublishLookbookScreen from "./src/screens/PublishLookbookScreen";
import PublishOutfitScreen from "./src/screens/PublishOutfitScreen";
import PublishReviewScreen from "./src/screens/PublishReviewScreen";
import PublishForumPostScreen from "./src/screens/PublishForumPostScreen";
import AllCommentsScreen from "./src/screens/AllCommentsScreen";

import CommunityDetailScreen from "./src/screens/CommunityDetailScreen";
import AllCommunitiesScreen from "./src/screens/AllCommunitiesScreen";
// Merchant Screens
import MyMerchantStoresScreen from "./src/screens/MyMerchantStoresScreen";
import MerchantManageScreen from "./src/screens/MerchantManageScreen";
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

// Stores & Services
import { useChatStore } from "./src/store/chatStore";
import { useNotificationStore } from "./src/store/notificationStore";

// Components
import TabBarIcon from "./src/components/TabBarIcon";
import PublishTabButton from "./src/components/PublishTabButton";
import UploadProgressBanner from "./src/components/UploadProgressBanner";
import OnboardingGuideModal from "./src/components/OnboardingGuideModal";
import FpsMonitor from "./src/components/FpsMonitor";

// Theme
import { theme } from "./src/theme";

// Store
import { useAuthStore } from "./src/store/authStore";

// Providers
import { ToastProvider } from "./src/components/ToastProvider";
import ProfileReminderModal from "./src/components/ProfileReminderModal";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  const { totalUnread } = useChatStore();
  // 统一从 notificationStore 读未读数。当页面内调用 markRead / markAllRead 时，
  // tab 角标会立刻更新，不用等 30 秒 polling。polling 仍保留作为兜底，覆盖
  // 后台推送在 App 处于前台但还没被任何页面消费的场景。
  const notifUnread = useNotificationStore((s) => s.unreadCount);
  const loadNotifications = useNotificationStore((s) => s.loadNotifications);
  const refreshUnreadCount = useNotificationStore((s) => s.refreshUnreadCount);

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(refreshUnreadCount, 30_000);
    return () => clearInterval(timer);
  }, [loadNotifications, refreshUnreadCount]);

  const interactionBadge = totalUnread + notifUnread;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.white,
          borderTopWidth: 1,
          borderTopColor: theme.colors.gray100,
          height: 76,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.black,
        tabBarInactiveTintColor: theme.colors.gray400,
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
          tabBarLabel: "首页",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Archive"
        component={ArchiveScreen}
        options={{
          tabBarLabel: "Archive档案",
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
          tabBarButton: (props) => <PublishTabButton />,
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
        options={{
          tabBarLabel: "互动",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="interaction" color={color} focused={focused} />
          ),
          tabBarBadge: interactionBadge > 0 ? interactionBadge : undefined,
          tabBarBadgeStyle: {
            backgroundColor: "#FF3B30",
            fontSize: 10,
            fontWeight: "700",
            minWidth: 18,
            height: 18,
            lineHeight: 17,
            borderRadius: 9,
            textAlign: "center",
            paddingHorizontal: 2,
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "我",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="profile" color={color} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { isAuthenticated, user, shouldShowProfileReminder, updateLastProfileReminderTime } = useAuthStore();
  const [showProfileReminder, setShowProfileReminder] = useState(false);
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);
  const [guideChecked, setGuideChecked] = useState(false);

  // Push notifications
  usePushNotifications();

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

    // 首次检查（延迟3秒，等待应用完全加载）
    const initialCheck = setTimeout(() => {
      if (shouldShowProfileReminder()) {
        setShowProfileReminder(true);
        updateLastProfileReminderTime();
      }
    }, 3000);

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
            backgroundColor: theme.colors.white,
          },
          headerTintColor: theme.colors.black,
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
          name="StoreDetail"
          component={StoreDetailScreen}
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

      {/* 后台上传进度条 */}
      <UploadProgressBanner />
    </>
  );
}

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [appIsReady, setAppIsReady] = useState(false);
  const [showSplashVideo, setShowSplashVideo] = useState(true);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  useEffect(() => {
    async function prepare() {
      try {
        // 加载字体
        await Font.loadAsync({
          "PlayfairDisplay-Regular": require("./assets/fonts/PlayfairDisplay-Regular.ttf"),
          "PlayfairDisplay-Medium": require("./assets/fonts/PlayfairDisplay-Medium.ttf"),
          "PlayfairDisplay-Bold": require("./assets/fonts/PlayfairDisplay-Bold.ttf"),
        });
        setFontsLoaded(true);
      } catch (error) {
        console.log("Font loading failed, using system fonts:", error);
        setFontsLoaded(true);
      } finally {
        // 隐藏原生 splash screen，显示我们的视频
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

  // 维护模式轮询：App 就绪后启动单例轮询，卸载时停止，避免重复定时器泄漏
  useEffect(() => {
    if (!appIsReady) return;
    startMaintenancePolling();
    return () => stopMaintenancePolling();
  }, [appIsReady]);

  const handleSplashVideoFinish = useCallback(() => {
    setShowSplashVideo(false);
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <GluestackUIProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ToastProvider>
            <View style={{ flex: 1 }}>
              <NavigationContainer
                ref={navigationRef}
                linking={LINKING_CONFIG}
              >
                <AppNavigator />
                <StatusBar style="dark" />
              </NavigationContainer>
              {showSplashVideo && (
                <SplashVideo onFinish={handleSplashVideoFinish} />
              )}
              <MaintenanceOverlay />
              {/* <FpsMonitor /> */}
            </View>
          </ToastProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GluestackUIProvider>
  );
}
