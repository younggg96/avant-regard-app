import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Font from "expo-font";

// Screens
import DiscoverScreen from "./src/screens/DiscoverScreen";
import ArchiveScreen from "./src/screens/ArchiveScreen";
import PublishScreen from "./src/screens/PublishScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import DesignerDetailScreen from "./src/screens/DesignerDetailScreen";
import CollectionDetailScreen from "./src/screens/CollectionDetailScreen";
import LookDetailScreen from "./src/screens/LookDetailScreen";
// Auth Screens
import AuthScreen from "./src/screens/AuthScreen";
import ChangePasswordScreen from "./src/screens/ChangePasswordScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import EditProfileScreen from "./src/screens/EditProfileScreen";
import PhoneManagementScreen from "./src/screens/PhoneManagementScreen";
import TermsScreen from "./src/screens/TermsScreen";
import PrivacyScreen from "./src/screens/PrivacyScreen";
import FavoritesScreen from "./src/screens/FavoritesScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import DraftsScreen from "./src/screens/DraftsScreen";

// Components
import TabBarIcon from "./src/components/TabBarIcon";
import PublishTabButton from "./src/components/PublishTabButton";

// Theme
import { theme } from "./src/theme";

// Store
import { useAuthStore } from "./src/store/authStore";

// Providers
import { AlertProvider } from "./src/components/AlertProvider";

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
          tabBarLabel: "存档",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="archive" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Publish"
        component={PublishScreen}
        options={{
          tabBarLabel: "",
          tabBarIcon: () => null,
          tabBarButton: (props) => <PublishTabButton onPress={props.onPress} />,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: "通知",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="notifications" color={color} focused={focused} />
          ),
          tabBarBadge: 99, // Show notification badge
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
          fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
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
        name="DesignerDetail"
        component={DesignerDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CollectionDetail"
        component={CollectionDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LookDetail"
        component={LookDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="设置"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PhoneManagement"
        component={PhoneManagementScreen}
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
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded, setFontsLoaded] = React.useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        // In development, we'll skip custom font loading to avoid errors with placeholder files
        if (__DEV__) {
          console.log("Development mode: Skipping custom font loading");
          setFontsLoaded(true);
          return;
        }

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
      }
    }
    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AlertProvider>
          <NavigationContainer>
            <AppNavigator />
            <StatusBar style="dark" />
          </NavigationContainer>
        </AlertProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
