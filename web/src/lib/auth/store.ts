"use client";

/**
 * Web-side auth store.
 *
 * 1:1 behavioural mirror of [frontend/src/store/authStore.ts](../../../frontend/src/store/authStore.ts):
 *  - Same shape (AuthUser / AuthTokens / AuthState / AuthActions).
 *  - Same JWT expiry parsing and REFRESH_THRESHOLD_SECONDS = 5 minutes.
 *  - Same `loginWithResponse` / `refreshTokens` / `startAutoRefresh` algorithm.
 *
 * Only deviation: persistence goes through `localStorage` instead of
 * `@react-native-async-storage/async-storage`, because web doesn't have it.
 * The persist key is kept identical (`avant-regard-auth`) so that if we ever
 * unify stores behind a shared package, migration is free.
 *
 * Rehydration logic runs only in the browser (`typeof window !== "undefined"`)
 * to keep server components safe.
 */

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import { refreshToken as refreshTokenApi, type LoginResponse } from "./service";

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
  is_admin: boolean;
  userType: string;
  profileCompleted?: boolean;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isRefreshing: boolean;
  hydrated: boolean;
}

interface AuthActions {
  loginWithResponse: (response: LoginResponse) => void;
  logout: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
  setLoading: (loading: boolean) => void;
  refreshTokens: () => Promise<boolean>;
  getAccessToken: () => string | null;
  checkAndRefreshToken: () => Promise<string | null>;
  isTokenExpiringSoon: () => boolean;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  setHydrated: (v: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const REFRESH_THRESHOLD_SECONDS = 5 * 60;

function decodeJwtExpiry(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      typeof atob === "function"
        ? atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
        : Buffer.from(parts[1], "base64").toString("utf8"),
    );
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * SSR-safe storage: returns a no-op store on the server so `persist` doesn't
 * touch `localStorage` during hydration.
 */
const browserStorage: StateStorage = {
  getItem: (key) => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* quota / privacy mode — ignore */
    }
  },
  removeItem: (key) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      tokens: null,
      isLoading: false,
      isRefreshing: false,
      hydrated: false,

      loginWithResponse: (response: LoginResponse) => {
        const currentUser = get().user;
        const user: AuthUser = {
          id: String(response.userId),
          userId: response.userId,
          phone: response.phone,
          username: response.username,
          is_admin: response.is_admin,
          userType: response.userType,
          avatar: currentUser?.avatar,
          profileCompleted:
            currentUser?.userId === response.userId
              ? currentUser.profileCompleted
              : undefined,
        };

        const expiresAt =
          decodeJwtExpiry(response.accessToken) || response.expiresAt;

        const tokens: AuthTokens = {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          expiresAt,
        };

        set({
          isAuthenticated: true,
          user,
          tokens,
          isLoading: false,
        });

        get().startAutoRefresh();
      },

      logout: () => {
        get().stopAutoRefresh();
        set({
          isAuthenticated: false,
          user: null,
          tokens: null,
          isLoading: false,
          isRefreshing: false,
        });
      },

      updateUser: (userData) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },

      setLoading: (loading) => set({ isLoading: loading }),

      isTokenExpiringSoon: () => {
        const tokens = get().tokens;
        if (!tokens?.accessToken) return true;

        const expiresAt =
          tokens.expiresAt || decodeJwtExpiry(tokens.accessToken);
        if (!expiresAt) return false;

        const now = Math.floor(Date.now() / 1000);
        return expiresAt - now < REFRESH_THRESHOLD_SECONDS;
      },

      refreshTokens: async () => {
        const currentTokens = get().tokens;
        if (!currentTokens?.refreshToken) return false;
        if (get().isRefreshing) return false;

        set({ isRefreshing: true });

        try {
          const response = await refreshTokenApi({
            refreshToken: currentTokens.refreshToken,
          });

          const currentUser = get().user;
          const user: AuthUser = {
            id: String(response.userId),
            userId: response.userId,
            phone: response.phone,
            username: response.username,
            is_admin: response.is_admin,
            userType: response.userType,
            avatar: currentUser?.avatar,
            profileCompleted: currentUser?.profileCompleted,
          };

          const expiresAt =
            decodeJwtExpiry(response.accessToken) || response.expiresAt;

          set({
            user,
            tokens: {
              accessToken: response.accessToken,
              refreshToken: response.refreshToken,
              expiresAt,
            },
            isRefreshing: false,
          });

          get().startAutoRefresh();
          return true;
        } catch (error) {
          console.error("Token refresh failed:", error);
          set({ isRefreshing: false });
          get().logout();
          return false;
        }
      },

      checkAndRefreshToken: async () => {
        const tokens = get().tokens;
        if (!tokens?.accessToken) return null;

        if (get().isTokenExpiringSoon()) {
          const ok = await get().refreshTokens();
          if (!ok) return null;
        }
        return get().tokens?.accessToken || null;
      },

      getAccessToken: () => get().tokens?.accessToken || null,

      startAutoRefresh: () => {
        if (typeof window === "undefined") return;
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }

        const tokens = get().tokens;
        if (!tokens?.accessToken) return;

        const expiresAt =
          tokens.expiresAt || decodeJwtExpiry(tokens.accessToken);
        if (!expiresAt) {
          refreshTimer = setTimeout(
            () => get().refreshTokens(),
            30 * 60 * 1000,
          );
          return;
        }

        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt - now;
        const refreshIn = Math.max(
          timeUntilExpiry - REFRESH_THRESHOLD_SECONDS,
          60,
        );

        refreshTimer = setTimeout(
          () => get().refreshTokens(),
          refreshIn * 1000,
        );
      },

      stopAutoRefresh: () => {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }
      },

      setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: "avant-regard-auth",
      storage: createJSONStorage(() => browserStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        tokens: state.tokens,
      }),
      onRehydrateStorage: () => (state) => {
        if (typeof window === "undefined") return;
        state?.setHydrated(true);
        if (state?.isAuthenticated && state?.tokens) {
          setTimeout(() => {
            const store = useAuthStore.getState();
            if (store.isTokenExpiringSoon()) {
              store.refreshTokens();
            } else {
              store.startAutoRefresh();
            }
          }, 500);
        }
      },
    },
  ),
);
