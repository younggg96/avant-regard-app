import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AuthUser {
  id: string;
  phone: string;
  nickname: string;
  name?: string;
  bio?: string;
  website?: string;
  location?: string;
  avatar?: string;
  token?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthActions {
  login: (user: AuthUser) => void;
  logout: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
  updateProfile: (profileData: Partial<AuthUser>) => void;
  setLoading: (loading: boolean) => void;
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
      token: null,
      isLoading: false,

      // Actions
      login: (user: AuthUser) => {
        set({
          isAuthenticated: true,
          user,
          token: user.token,
          isLoading: false,
        });
      },

      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
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
    }),
    {
      name: "avant-regard-auth",
      storage: createJSONStorage(() => safeAsyncStorage),
      // Only persist essential auth data
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
      }),
      // Add error handling for storage failures
      onRehydrateStorage: () => (state) => {
        console.log("Auth store rehydrated:", state ? "success" : "failed");
      },
    }
  )
);
