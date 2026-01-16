import React, { useEffect, useCallback, useState } from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import { config } from "./gluestack.config";

// Splash Video
import SplashVideo from "./src/components/SplashVideo";

// Screens
import DiscoverScreen from "./src/screens/DiscoverScreen";
import ArchiveScreen from "./src/screens/ArchiveScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import BuyerMapScreen from "./src/screens/BuyerMapScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import CollectionDetailScreen from "./src/screens/CollectionDetailScreen";
import LookDetailScreen from "./src/screens/LookDetailScreen";
import PostDetailScreen from "./src/screens/PostDetailScreen";
import SearchScreen from "./src/screens/SearchScreen";
// Auth Screens
import AuthScreen from "./src/screens/AuthScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import EditProfileScreen from "./src/screens/EditProfileScreen";
import UserProfileScreen from "./src/screens/UserProfileScreen";
import TermsScreen from "./src/screens/TermsScreen";
import PrivacyScreen from "./src/screens/PrivacyScreen";
import FavoritesScreen from "./src/screens/FavoritesScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import DraftsScreen from "./src/screens/DraftsScreen";
import FollowingUsersScreen from "./src/screens/FollowingUsersScreen";
import AdminScreen from "./src/screens/AdminScreen";
// Publish Screens
import PublishTypeScreen from "./src/screens/PublishTypeScreen";
import PublishLookbookScreen from "./src/screens/PublishLookbookScreen";
import PublishOutfitScreen from "./src/screens/PublishOutfitScreen";
import PublishReviewScreen from "./src/screens/PublishReviewScreen";
import PublishArticleScreen from "./src/screens/PublishArticleScreen";
import AllCommentsScreen from "./src/screens/AllCommentsScreen";
import DesignerDetailScreen from "./src/screens/DesignerDetailScreen";

// Components
import TabBarIcon from "./src/components/TabBarIcon";
import PublishTabButton from "./src/components/PublishTabButton";

// Theme
import { theme } from "./src/theme";

// Store
import { useAuthStore } from "./src/store/authStore";

// Providers
import { ToastProvider } from "./src/components/ToastProvider";

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
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    // Show only auth flow for unauthenticated users
    return <AuthNavigator />;
  }

  // Show main app for authenticated users
  return (
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
        name="DesignerDetail"
        component={DesignerDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AllComments"
        component={AllCommentsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LookDetail"
        component={LookDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{ headerShown: false }}
      />
      {/* Search 页面暂时隐藏 */}
      {/* <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ headerShown: false }}
      /> */}
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
        name="History"
        component={HistoryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Drafts"
        component={DraftsScreen}
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
        name="Admin"
        component={AdminScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PublishType"
        component={PublishTypeScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="PublishLookbook"
        component={PublishLookbookScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="PublishOutfit"
        component={PublishOutfitScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="PublishReview"
        component={PublishReviewScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="PublishArticle"
        component={PublishArticleScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [appIsReady, setAppIsReady] = useState(false);
  const [showSplashVideo, setShowSplashVideo] = useState(true);

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
              <NavigationContainer>
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
