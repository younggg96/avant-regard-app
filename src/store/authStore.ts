import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService, LoginResponse } from "../services/authService";

export interface AuthUser {
  id: string;
  userId: number;
  phone: string;
  username: string;
  name?: string;
  bio?: string;
  website?: string;
  location?: string;
  avatar?: string;
  admin: boolean;
  userType: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
}

interface AuthActions {
  loginWithResponse: (response: LoginResponse) => void;
  login: (user: AuthUser, tokens?: AuthTokens) => void;
  logout: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
  updateProfile: (profileData: Partial<AuthUser>) => void;
  setLoading: (loading: boolean) => void;
  refreshTokens: () => Promise<boolean>;
  getAccessToken: () => string | null;
}

type AuthStore = AuthState & AuthActions;

// Create safe AsyncStorage wrapper to handle potential undefined cases
const safeAsyncStorage = {
  getItem: async (key: string) => {
    try {
      return (await AsyncStorage?.getItem(key)) || null;
    } catch (error) {
      console.warn("AsyncStorage getItem error:", error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage?.setItem(key, value);
    } catch (error) {
      console.warn("AsyncStorage setItem error:", error);
    }
  },
  removeItem: async (key: string) => {
    try {
      await AsyncStorage?.removeItem(key);
    } catch (error) {
      console.warn("AsyncStorage removeItem error:", error);
    }
  },
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      tokens: null,
      isLoading: false,

      // Actions
      loginWithResponse: (response: LoginResponse) => {
        const user: AuthUser = {
          id: String(response.userId),
          userId: response.userId,
          phone: response.phone,
          username: response.username,
          admin: response.admin,
          userType: response.userType,
          avatar: "https://via.placeholder.com/100x100",
        };

        const tokens: AuthTokens = {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        };

        set({
          isAuthenticated: true,
          user,
          tokens,
          isLoading: false,
        });
      },

      login: (user: AuthUser, tokens?: AuthTokens) => {
        set({
          isAuthenticated: true,
          user,
          tokens: tokens || null,
          isLoading: false,
        });
      },

      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          tokens: null,
          isLoading: false,
        });
      },

      updateUser: (userData: Partial<AuthUser>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, ...userData },
          });
        }
      },

      updateProfile: (profileData: Partial<AuthUser>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, ...profileData },
          });
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      refreshTokens: async () => {
        const currentTokens = get().tokens;
        if (!currentTokens?.refreshToken) {
          return false;
        }

        try {
          const response = await authService.refreshToken({
            refreshToken: currentTokens.refreshToken,
          });

          const user: AuthUser = {
            id: String(response.userId),
            userId: response.userId,
            phone: response.phone,
            username: response.username,
            admin: response.admin,
            userType: response.userType,
            avatar: get().user?.avatar || "https://via.placeholder.com/100x100",
          };

          const tokens: AuthTokens = {
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          };

          set({
            user,
            tokens,
          });

          return true;
        } catch (error) {
          console.error("Token refresh failed:", error);
          // Token 刷新失败，清除登录状态
          get().logout();
          return false;
        }
      },

      getAccessToken: () => {
        return get().tokens?.accessToken || null;
      },
    }),
    {
      name: "avant-regard-auth",
      storage: createJSONStorage(() => safeAsyncStorage),
      // Only persist essential auth data
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        tokens: state.tokens,
      }),
      // Add error handling for storage failures
      onRehydrateStorage: () => (state) => {
        console.log("Auth store rehydrated:", state ? "success" : "failed");
      },
    }
  )
);
