import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  authService,
  AuthRequestError,
  LoginResponse,
} from "../services/authService";
import {
  saveRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
} from "./secureTokenStorage";

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
  preferredTheme?: "system" | "light" | "dark";
}

interface AuthTokens {
  accessToken: string;
  // refreshToken 可能缺失：持久化到 AsyncStorage 的 blob 里不含它（存在
  // SecureStore），冷启动 rehydrate 后由 onRehydrateStorage 异步合并回来。
  refreshToken?: string;
  expiresAt?: number; // Token 过期时间戳（秒）
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isRefreshing: boolean; // 是否正在刷新 token
  lastLoginAt: number | null; // 上次登录/成功刷新的时间戳（毫秒），用于诊断日志
  lastProfileReminderTime: number | null; // 上次提醒填写资料的时间戳
  /** 本地主题偏好写入世代；用于丢弃「发起请求之后才改过主题」的过时 getUserInfo 响应。不参与持久化。 */
  themePreferenceRevision: number;
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

// 当前正在进行的 refresh promise（去重并发刷新）
let inflightRefresh: Promise<boolean> | null = null;

// Token 刷新提前量（提前 5 分钟刷新）
const REFRESH_THRESHOLD_SECONDS = 5 * 60;

// 把（登录 / 轮换后的）refresh token 落到安全存储，写失败时打错误日志。
// 采用 fire-and-forget：不阻塞同步的 set()，但失败会被记录以便定位「很久没
// 用要重新登录」这类问题。
function persistRefreshToken(token: string): void {
  saveRefreshToken(token)
    .then((ok) => {
      if (!ok) {
        console.error(
          "[auth] refresh token 持久化失败：下次冷启动可能无法刷新，会被强制登出"
        );
      }
    })
    .catch((error) => {
      console.error("[auth] refresh token 持久化异常:", error);
    });
}

// 距离上次登录/刷新成功过去了多少天（用于诊断日志）。
function daysSince(timestampMs: number | null): string {
  if (!timestampMs) return "unknown";
  const days = (Date.now() - timestampMs) / (1000 * 60 * 60 * 24);
  return days.toFixed(1);
}

/**
 * Robust base64 (URL-safe) → utf-8 decode, works under both Hermes (`atob`
 * available) and older RN runtimes. Returns null on any failure.
 */
function decodeBase64Url(input: string): string | null {
  try {
    const base64 =
      input.replace(/-/g, "+").replace(/_/g, "/") +
      "===".slice((input.length + 3) % 4);
    if (typeof globalThis.atob === "function") {
      return globalThis.atob(base64);
    }
    // Fallback path (older RN without atob): manual base64 decode.
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let str = "";
    let buffer = 0;
    let bits = 0;
    for (const ch of base64) {
      if (ch === "=") break;
      const v = chars.indexOf(ch);
      if (v < 0) continue;
      buffer = (buffer << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        str += String.fromCharCode((buffer >> bits) & 0xff);
      }
    }
    return str;
  } catch {
    return null;
  }
}

// 解析 JWT token 获取过期时间（单位：秒）
function getTokenExpiry(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const decoded = decodeBase64Url(parts[1]);
    if (!decoded) return null;
    const payload = JSON.parse(decoded);
    return typeof payload.exp === "number" ? payload.exp : null;
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
      lastLoginAt: null,
      lastProfileReminderTime: null,
      themePreferenceRevision: 0,

      // Actions
      loginWithResponse: (response: LoginResponse) => {
        const currentUser = get().user;
        const sameUser =
          currentUser?.userId === response.userId;
        const user: AuthUser = {
          id: String(response.userId),
          userId: response.userId,
          phone: response.phone,
          username: response.username,
          is_admin: response.is_admin,
          userType: response.userType,
          avatar: currentUser?.avatar || undefined,
          // 如果是同一用户重新登录，保留之前的 profileCompleted / 主题等本地状态
          profileCompleted: sameUser ? currentUser?.profileCompleted : undefined,
          preferredTheme: sameUser ? currentUser?.preferredTheme : undefined,
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
          lastLoginAt: Date.now(),
        });

        // refresh token 写入安全存储（Keychain / Keystore），而不是明文
        // AsyncStorage（partialize 已把它从 persist blob 里剔除）。
        persistRefreshToken(response.refreshToken);

        // 登录后启动自动刷新
        get().startAutoRefresh();
      },

      login: (user: AuthUser, tokens?: AuthTokens) => {
        set({
          isAuthenticated: true,
          user,
          tokens: tokens || null,
          isLoading: false,
          lastLoginAt: Date.now(),
        });

        // 登录后启动自动刷新
        if (tokens) {
          if (tokens.refreshToken) {
            persistRefreshToken(tokens.refreshToken);
          }
          get().startAutoRefresh();
        }
      },

      logout: () => {
        // 停止自动刷新
        get().stopAutoRefresh();

        // 清除安全存储里的 refresh token（fire-and-forget）。
        deleteRefreshToken().catch((error) => {
          console.error("[auth] 登出时删除 refresh token 失败:", error);
        });

        set({
          isAuthenticated: false,
          user: null,
          tokens: null,
          isLoading: false,
          isRefreshing: false,
          lastLoginAt: null,
          themePreferenceRevision: 0,
        });
      },

      updateUser: (userData: Partial<AuthUser>) => {
        const currentUser = get().user;
        if (!currentUser) return;
        const nextPreferred = userData.preferredTheme;
        const themeTouched =
          nextPreferred !== undefined &&
          nextPreferred !== currentUser.preferredTheme;
        const prevRev = get().themePreferenceRevision;
        set({
          user: { ...currentUser, ...userData },
          themePreferenceRevision: themeTouched ? prevRev + 1 : prevRev,
        });
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
        // 无法判断过期时间时，**按需要刷新处理**——保守一点比"假设有效"安全：
        // 假设有效会让 proactive refresh 被跳过，最终触发 401 + 失败 logout。
        if (!expiresAt) return true;

        const now = Math.floor(Date.now() / 1000);
        return expiresAt - now < REFRESH_THRESHOLD_SECONDS;
      },

      refreshTokens: async () => {
        const currentTokens = get().tokens;
        if (!currentTokens?.refreshToken) {
          return false;
        }
        const currentRefreshToken = currentTokens.refreshToken;

        // 并发去重：如果已经有一个 refresh 在飞，所有调用方都 await 同一个 promise。
        // 否则原代码会让第二个调用直接拿到 false → 触发 logout，连环爆。
        if (inflightRefresh) {
          return inflightRefresh;
        }

        set({ isRefreshing: true });

        inflightRefresh = (async (): Promise<boolean> => {
          try {
            console.log("Refreshing token...");
            const response = await authService.refreshToken({
              refreshToken: currentRefreshToken,
            });

            const currentUser = get().user;
            if (!currentUser) {
              set({ isRefreshing: false });
              return false;
            }
            const user: AuthUser = {
              ...currentUser,
              id: String(response.userId),
              userId: response.userId,
              phone: response.phone,
              username: response.username,
              is_admin: response.is_admin,
              userType: response.userType,
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
              lastLoginAt: Date.now(),
            });

            // Supabase 默认开启 refresh token 轮换：每次刷新都会发一个新的
            // refresh token，旧的立即作废。必须把新 token 落盘，否则下次冷启动
            // 用旧 token 会被 401 → 强制登出。写失败会打错误日志。
            persistRefreshToken(response.refreshToken);

            console.log("Token refreshed successfully");

            // 刷新成功后重新设置定时器
            get().startAutoRefresh();

            return true;
          } catch (error) {
            // 结构化诊断日志：定位「很久没用要重新登录」的关键信息——
            // HTTP 状态码、服务端消息、距上次登录/刷新成功过去了几天。
            const status =
              error instanceof AuthRequestError ? error.status : "n/a";
            const message =
              error instanceof Error ? error.message : String(error);
            console.error(
              `[auth] refresh 失败 status=${status} daysSinceLogin=${daysSince(
                get().lastLoginAt
              )} message=${message}`
            );
            set({ isRefreshing: false });

            // 关键修复：只有在 refresh token 真的被服务端拒绝时才登出用户。
            // 网络层错误 (status=0)、网关 5xx、超时 都是瞬时故障——用户隔几
            // 天打开 app 时，无线唤醒慢、后端冷启动、临时 502 都很常见，原先
            // 一刀切地 logout() 是用户被反复要求重新登录的主因。
            //
            // 真正的"refresh 失效"信号：
            //   - 401 Unauthorized (Supabase 拒绝 refresh token)
            //   - 403 Forbidden
            //   - 400 + 后端的 "invalid grant" / "刷新令牌无效或已过期" 类
            //     消息（FastAPI 路由对失败也会返回 401，所以 400 这里更多是
            //     兜底）
            let shouldLogout = false;
            if (error instanceof AuthRequestError) {
              if (error.status === 401 || error.status === 403) {
                shouldLogout = true;
              } else if (
                error.status === 400 &&
                /invalid|expired|refresh|令牌|过期|无效/i.test(error.message)
              ) {
                shouldLogout = true;
              }
            }

            if (shouldLogout) {
              console.warn(
                "Refresh token rejected by server, logging out:",
                error instanceof Error ? error.message : error
              );
              get().logout();
            } else {
              console.warn(
                "Refresh failed transiently, keeping session; will retry later.",
                error instanceof Error ? error.message : error
              );
              // 保留 tokens 不动；下次 API 请求 / AppState active / 定时器到
              // 期时都会再试。再加一个短时重试兜底，避免完全依赖外部触发。
              if (refreshTimer) clearTimeout(refreshTimer);
              refreshTimer = setTimeout(() => {
                get().refreshTokens();
              }, 60 * 1000);
            }

            return false;
          } finally {
            inflightRefresh = null;
          }
        })();

        return inflightRefresh;
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
      // 条件：已登录 + 明确未完善资料 (profileCompleted === false) + (从未提醒过 或 距离上次提醒超过1小时)
      shouldShowProfileReminder: () => {
        const { isAuthenticated, user, lastProfileReminderTime } = get();
        
        // 未登录，不需要提醒
        if (!isAuthenticated || !user) {
          return false;
        }

        // 只有当 profileCompleted 明确为 false 时才可能显示提醒
        // 如果是 true 或 undefined（状态未知/未检查），不显示
        if (user.profileCompleted !== false) {
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
      // 注意：refreshToken 不再写进 AsyncStorage（明文）——它单独存进
      // SecureStore（见 secureTokenStorage.ts）。这里把它从持久化的 tokens 里
      // 剔除，只保留短期有效的 accessToken 和过期时间。
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        tokens: state.tokens
          ? {
              accessToken: state.tokens.accessToken,
              expiresAt: state.tokens.expiresAt,
            }
          : null,
        lastLoginAt: state.lastLoginAt,
        lastProfileReminderTime: state.lastProfileReminderTime,
      }),
      // Add error handling for storage failures
      onRehydrateStorage: () => (state) => {
        console.log("Auth store rehydrated:", state ? "success" : "failed");

        if (!state?.isAuthenticated || !state?.tokens) return;

        // refresh token 不在 persist blob 里，需要从 SecureStore 异步取回并
        // 合并进内存状态，之后才能刷新。
        (async () => {
          try {
            let refreshToken = await getRefreshToken();

            // 迁移：老版本把 refresh token 明文存在 AsyncStorage 的 persist
            // blob 里。首次升级后 SecureStore 为空，但 state.tokens 里可能还带
            // 着旧的 refresh token —— 把它搬进 SecureStore，随后 partialize 会
            // 自动把明文那份从 blob 里清掉。
            const legacyRefreshToken = state.tokens?.refreshToken;
            if (!refreshToken && legacyRefreshToken) {
              console.log("[auth] 迁移 refresh token 到 SecureStore");
              await saveRefreshToken(legacyRefreshToken);
              refreshToken = legacyRefreshToken;
            }

            const store = useAuthStore.getState();

            if (refreshToken && store.tokens) {
              // 把 refresh token 合并回内存 tokens（这次 set 会触发一次
              // persist，partialize 会顺手把明文 refresh token 从 blob 清掉）。
              useAuthStore.setState({
                tokens: { ...store.tokens, refreshToken },
              });
            } else if (!refreshToken) {
              console.warn(
                "[auth] rehydrate 后没有找到 refresh token，无法自动刷新"
              );
            }

            // 给网络栈一点时间完成 DNS / TLS 握手，避免冷启动第一个 refresh
            // 请求在网络就绪前失败。
            setTimeout(() => {
              const s = useAuthStore.getState();
              // 无论是否"即将过期"，都先把定时器拉起来。
              s.startAutoRefresh();

              // 隔了几天再开 app，access token 几乎必然已过期；主动刷一次。
              // 即使刷失败也不会立刻 logout（见 refreshTokens），只会稍后重试
              // / 等 AppState active / 等下一次 API 401 触发。
              if (s.tokens?.refreshToken && s.isTokenExpiringSoon()) {
                console.log("Token expiring soon, refreshing...");
                s.refreshTokens();
              }
            }, 1000);
          } catch (error) {
            console.error("[auth] rehydrate 处理 refresh token 失败:", error);
          }
        })();
      },
    }
  )
);
