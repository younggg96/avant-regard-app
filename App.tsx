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

// Screens
import DiscoverScreen from "./src/screens/DiscoverScreen";
import ArchiveScreen from "./src/screens/ArchiveScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import BuyerMapScreen from "./src/screens/BuyerMapScreen";
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
import TermsScreen from "./src/screens/TermsScreen";
import PrivacyScreen from "./src/screens/PrivacyScreen";
import FavoritesScreen from "./src/screens/FavoritesScreen";
import FollowingUsersScreen from "./src/screens/FollowingUsersScreen";
import FollowersScreen from "./src/screens/FollowersScreen";
import AdminScreen from "./src/screens/AdminScreen";
import SubmitStoreScreen from "./src/screens/SubmitStoreScreen";
import StoreDetailScreen from "./src/screens/StoreDetailScreen";
import StoreReviewScreen from "./src/screens/StoreReviewScreen";
// Publish Screens
import PublishTypeScreen from "./src/screens/PublishTypeScreen";
import PublishLookbookScreen from "./src/screens/PublishLookbookScreen";
import PublishOutfitScreen from "./src/screens/PublishOutfitScreen";
import PublishReviewScreen from "./src/screens/PublishReviewScreen";
import PublishArticleScreen from "./src/screens/PublishArticleScreen";
import PublishForumPostScreen from "./src/screens/PublishForumPostScreen";
import AllCommentsScreen from "./src/screens/AllCommentsScreen";
// Forum Screens
import ForumScreen from "./src/screens/ForumScreen";
import CommunityDetailScreen from "./src/screens/CommunityDetailScreen";
// Merchant Screens
import MyMerchantStoresScreen from "./src/screens/MyMerchantStoresScreen";
import MerchantManageScreen from "./src/screens/MerchantManageScreen";
import MerchantReviewScreen from "./src/screens/MerchantReviewScreen";
// Search Screen
import SearchScreen from "./src/screens/SearchScreen";
// User Management Screens
import MyCommentsScreen from "./src/screens/MyCommentsScreen";
import MyLikesScreen from "./src/screens/MyLikesScreen";

// Components
import TabBarIcon from "./src/components/TabBarIcon";
import PublishTabButton from "./src/components/PublishTabButton";

// Theme
import { theme } from "./src/theme";

// Store
import { useAuthStore } from "./src/store/authStore";

// Providers
import { ToastProvider } from "./src/components/ToastProvider";
import ProfileReminderModal from "./src/components/ProfileReminderModal";

// 防止原生 splash screen 自动隐藏
SplashScreen.preventAutoHideAsync();

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
          fontFamily: __DEV__ ? "System" : "Inter-Regular",
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
        name="Map"
        component={BuyerMapScreen}
        options={{
          tabBarLabel: "地图",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="map" color={color} focused={focused} />
          ),
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
  const { isAuthenticated, shouldShowProfileReminder, updateLastProfileReminderTime } = useAuthStore();
  const [showProfileReminder, setShowProfileReminder] = useState(false);

  // 初始化推送通知
  usePushNotifications();

  // 检查是否需要显示资料填写提醒
  useEffect(() => {
    if (!isAuthenticated) return;

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
  }, [isAuthenticated, shouldShowProfileReminder, updateLastProfileReminderTime]);

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
          name="Terms"
          component={TermsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Privacy"
          component={PrivacyScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Favorites"
          component={FavoritesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
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
          name="PublishArticle"
          component={PublishArticleScreen}
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
          name="Forum"
          component={ForumScreen}
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
      </Stack.Navigator>

      {/* 资料填写提醒 Modal */}
      <ProfileReminderModal
        visible={showProfileReminder}
        onClose={() => setShowProfileReminder(false)}
      />
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
          "PlayfairDisplay-Bold": require("./assets/fonts/PlayfairDisplay-Bold.ttf"),
          "Inter-Regular": require("./assets/fonts/Inter-Regular.ttf"),
          "Inter-Medium": require("./assets/fonts/Inter-Medium.ttf"),
          "Inter-Bold": require("./assets/fonts/Inter-Bold.ttf"),
        });
        setFontsLoaded(true);
      } catch (error) {
        console.log("Font loading failed, using system fonts:", error);
        setFontsLoaded(true);
      } finally {
        // 隐藏原生 splash screen，显示我们的视频
        await SplashScreen.hideAsync();
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
            </View>
          </ToastProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GluestackUIProvider>
  );
}
