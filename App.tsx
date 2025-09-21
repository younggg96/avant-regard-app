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
import DesignersScreen from "./src/screens/DesignersScreen";
import FavoritesScreen from "./src/screens/FavoritesScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import DesignerDetailScreen from "./src/screens/DesignerDetailScreen";
import BranchDetailScreen from "./src/screens/BranchDetailScreen";
import LookbookDetailScreen from "./src/screens/LookbookDetailScreen";
import LookDetailScreen from "./src/screens/LookDetailScreen";
import ItemDetailScreen from "./src/screens/ItemDetailScreen";

// Auth Screens
import WelcomeScreen from "./src/screens/WelcomeScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./src/screens/ResetPasswordScreen";
import EmailVerificationScreen from "./src/screens/EmailVerificationScreen";
import ChangePasswordScreen from "./src/screens/ChangePasswordScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

// Components
import TabBarIcon from "./src/components/TabBarIcon";

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
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
      />
    </Stack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.black,
          borderTopWidth: 0,
          height: 76,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.white,
        tabBarInactiveTintColor: theme.colors.gray400,
        tabBarLabelStyle: {
          fontFamily: __DEV__ ? "System" : "Inter-Regular",
          fontSize: 11,
        },
      }}
    >
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          tabBarLabel: "Discover",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="explore" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Designers"
        component={DesignersScreen}
        options={{
          tabBarLabel: "Designers",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="collections" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          tabBarLabel: "Favorites",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="bookmark" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Me",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="person" color={color} focused={focused} />
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
        options={{ title: "Designer" }}
      />
      <Stack.Screen
        name="BranchDetail"
        component={BranchDetailScreen}
        options={{ title: "Collection" }}
      />
      <Stack.Screen
        name="LookbookDetail"
        component={LookbookDetailScreen}
        options={{ title: "Lookbook" }}
      />
      <Stack.Screen
        name="LookDetail"
        component={LookDetailScreen}
        options={{ title: "Look" }}
      />
      <Stack.Screen
        name="ItemDetail"
        component={ItemDetailScreen}
        options={{ title: "Item" }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: "Change Password" }}
      />
      <Stack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
        options={{ title: "Verify Email" }}
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
