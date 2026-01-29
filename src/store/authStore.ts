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
  is_admin: boolean;
  userType: string;
  profileCompleted?: boolean; // 是否已完善资料
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number; // Token 过期时间戳（秒）
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isRefreshing: boolean; // 是否正在刷新 token
  lastProfileReminderTime: number | null; // 上次提醒填写资料的时间戳
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
  checkAndRefreshToken: () => Promise<string | null>; // 检查并刷新 token
  isTokenExpiringSoon: () => boolean; // 检查 token 是否即将过期
  startAutoRefresh: () => void; // 启动自动刷新
  stopAutoRefresh: () => void; // 停止自动刷新
  // 资料填写提醒相关
  setProfileCompleted: (completed: boolean) => void;
  updateLastProfileReminderTime: () => void;
  shouldShowProfileReminder: () => boolean; // 是否应该显示提醒
}

// 自动刷新定时器
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

// Token 刷新提前量（提前 5 分钟刷新）
const REFRESH_THRESHOLD_SECONDS = 5 * 60;

// 解析 JWT token 获取过期时间
function getTokenExpiry(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.exp || null;
  } catch {
    return null;
  }
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
      isRefreshing: false,
      lastProfileReminderTime: null,

      // Actions
      loginWithResponse: (response: LoginResponse) => {
        const user: AuthUser = {
          id: String(response.userId),
          userId: response.userId,
          phone: response.phone,
          username: response.username,
          is_admin: response.is_admin,
          userType: response.userType,
          avatar: "https://via.placeholder.com/100x100",
        };

        // 从 token 中解析过期时间
        const expiresAt =
          getTokenExpiry(response.accessToken) || response.expiresAt;

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

        // 登录后启动自动刷新
        get().startAutoRefresh();
      },

      login: (user: AuthUser, tokens?: AuthTokens) => {
        set({
          isAuthenticated: true,
          user,
          tokens: tokens || null,
          isLoading: false,
        });

        // 登录后启动自动刷新
        if (tokens) {
          get().startAutoRefresh();
        }
      },

      logout: () => {
        // 停止自动刷新
        get().stopAutoRefresh();

        set({
          isAuthenticated: false,
          user: null,
          tokens: null,
          isLoading: false,
          isRefreshing: false,
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

      // 检查 token 是否即将过期
      isTokenExpiringSoon: () => {
        const tokens = get().tokens;
        if (!tokens?.accessToken) return true;

        const expiresAt =
          tokens.expiresAt || getTokenExpiry(tokens.accessToken);
        if (!expiresAt) return false; // 无法判断过期时间，假设有效

        const now = Math.floor(Date.now() / 1000);
        return expiresAt - now < REFRESH_THRESHOLD_SECONDS;
      },

      refreshTokens: async () => {
        const currentTokens = get().tokens;
        if (!currentTokens?.refreshToken) {
          return false;
        }

        // 防止重复刷新
        if (get().isRefreshing) {
          return false;
        }

        set({ isRefreshing: true });

        try {
          console.log("Refreshing token...");
          const response = await authService.refreshToken({
            refreshToken: currentTokens.refreshToken,
          });

          const user: AuthUser = {
            id: String(response.userId),
            userId: response.userId,
            phone: response.phone,
            username: response.username,
            is_admin: response.is_admin,
            userType: response.userType,
            avatar: get().user?.avatar || "https://via.placeholder.com/100x100",
          };

          const expiresAt =
            getTokenExpiry(response.accessToken) || response.expiresAt;

          const tokens: AuthTokens = {
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresAt,
          };

          set({
            user,
            tokens,
            isRefreshing: false,
          });

          console.log("Token refreshed successfully");

          // 刷新成功后重新设置定时器
          get().startAutoRefresh();

          return true;
        } catch (error) {
          console.error("Token refresh failed:", error);
          set({ isRefreshing: false });
          // Token 刷新失败，清除登录状态
          get().logout();
          return false;
        }
      },

      // 检查并刷新 token，返回有效的 access token
      checkAndRefreshToken: async () => {
        const tokens = get().tokens;
        if (!tokens?.accessToken) return null;

        // 如果 token 即将过期，先刷新
        if (get().isTokenExpiringSoon()) {
          const success = await get().refreshTokens();
          if (!success) return null;
        }

        return get().tokens?.accessToken || null;
      },

      getAccessToken: () => {
        return get().tokens?.accessToken || null;
      },

      // 启动自动刷新
      startAutoRefresh: () => {
        // 先清除现有定时器
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }

        const tokens = get().tokens;
        if (!tokens?.accessToken) return;

        const expiresAt =
          tokens.expiresAt || getTokenExpiry(tokens.accessToken);
        if (!expiresAt) {
          // 无法获取过期时间，每 30 分钟刷新一次
          refreshTimer = setTimeout(() => {
            get().refreshTokens();
          }, 30 * 60 * 1000);
          return;
        }

        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt - now;

        // 提前 5 分钟刷新
        const refreshIn = Math.max(
          timeUntilExpiry - REFRESH_THRESHOLD_SECONDS,
          60
        );

        console.log(
          `Token expires in ${timeUntilExpiry}s, will refresh in ${refreshIn}s`
        );

        refreshTimer = setTimeout(() => {
          get().refreshTokens();
        }, refreshIn * 1000);
      },

      // 停止自动刷新
      stopAutoRefresh: () => {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }
      },

      // 设置资料是否已完善
      setProfileCompleted: (completed: boolean) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, profileCompleted: completed },
          });
        }
      },

      // 更新上次提醒时间
      updateLastProfileReminderTime: () => {
        set({ lastProfileReminderTime: Date.now() });
      },

      // 检查是否应该显示资料填写提醒
      // 条件：已登录 + 未完善资料 + (从未提醒过 或 距离上次提醒超过1小时)
      shouldShowProfileReminder: () => {
        const { isAuthenticated, user, lastProfileReminderTime } = get();
        
        // 未登录或已完善资料，不需要提醒
        if (!isAuthenticated || !user || user.profileCompleted) {
          return false;
        }

        // 从未提醒过
        if (!lastProfileReminderTime) {
          return true;
        }

        // 检查是否距离上次提醒超过1小时（3600000毫秒）
        const oneHour = 60 * 60 * 1000;
        const timeSinceLastReminder = Date.now() - lastProfileReminderTime;
        return timeSinceLastReminder >= oneHour;
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
        lastProfileReminderTime: state.lastProfileReminderTime,
      }),
      // Add error handling for storage failures
      onRehydrateStorage: () => (state) => {
        console.log("Auth store rehydrated:", state ? "success" : "failed");

        // 恢复登录状态后，启动自动刷新并检查 token
        if (state?.isAuthenticated && state?.tokens) {
          // 延迟执行以确保 store 完全初始化
          setTimeout(() => {
            const store = useAuthStore.getState();

            // 如果 token 即将过期，立即刷新
            if (store.isTokenExpiringSoon()) {
              console.log("Token expiring soon, refreshing...");
              store.refreshTokens();
            } else {
              // 启动自动刷新定时器
              store.startAutoRefresh();
            }
          }, 1000);
        }
      },
    }
  )
);
