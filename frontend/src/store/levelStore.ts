/**
 * 用户等级全局状态 + 升级监听器
 *
 * 核心设计:
 *   1) 持久化 lastSeenLevel 在 AsyncStorage.
 *      前端每次从 /levels/me 拉到的最新 currentLevel 与 lastSeenLevel 比较,
 *      严格 `newLevel > lastSeenLevel` 才触发全屏动画, 保证:
 *        - 只升不降 (单调递增)
 *        - 同一次升级不会重复播放动画
 *   2) 动画 pending 用 celebrateLevel 状态驱动;
 *      组件播完 2s 后调用 acknowledgeCelebration() 清零.
 *   3) 所有业务组件 (徽章 / 抽奖入口 / 进度看板) 只订阅此 store, 不重复拉接口.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import {
  levelService,
  UserLevelStatus,
} from "../services/levelService";
import { useAuthStore } from "./authStore";

const LAST_SEEN_KEY_PREFIX = "ar-level-last-seen-v1:";

/**
 * 非强制 refresh 的最小间隔.
 *
 * 调用链路一共有 4 处会触发 refresh:
 *   1) useLevelWatcher 5 分钟前台轮询 + AppState 回前台
 *   2) MyLevelScreen useEffect + useFocusEffect
 *   3) Profile/index.tsx useEffect + useFocusEffect (每次切 Tab 也会触发)
 *   4) EventRegistrationButton 核销后 (强制)
 *
 * 用户在 MyLevel <-> Profile 之间快速跳转 / Profile 内切 Tab 时, 上述
 * useFocusEffect 会在毫秒级内连续 fire. 没有节流的话日志会刷出连续十几
 * 条 /api/levels/me. 这里把"被动刷新"用 15s 窗口去重, pull-to-refresh /
 * 核销后用 `force: true` 旁路, 既不浪费请求也不让用户感到滞后.
 */
const REFRESH_THROTTLE_MS = 15_000;

function keyFor(userId?: number | null) {
  return `${LAST_SEEN_KEY_PREFIX}${userId ?? "anonymous"}`;
}

interface LevelStoreState {
  status: UserLevelStatus | null;
  loading: boolean;
  /**
   * 需要展示庆祝动画的目标等级;
   * null 表示不需要播放.
   */
  celebrateLevel: number | null;
  lastSeenLevel: number;
  /**
   * 是否已经完成本次会话的 baseline 同步.
   * 首次拉取时只把 currentLevel 当成基线, 不触发升级动画, 避免:
   *   - 老用户换新设备首登 (AsyncStorage 没有历史值)
   *   - 清缓存后重登
   * 这两种场景下误放全屏庆祝动画.
   */
  hasBaselined: boolean;
}

interface RefreshOptions {
  /**
   * 跳过节流窗口, 强制立即发请求.
   * 用于 pull-to-refresh / 核销成功后这种"用户明确要求最新数据"的场景.
   */
  force?: boolean;
}

interface LevelStoreActions {
  /** 拉取最新状态; 若发现 currentLevel 高于 lastSeenLevel, 触发庆祝动画. */
  refresh: (options?: RefreshOptions) => Promise<UserLevelStatus | null>;
  /** 组件播完动画后调用, 清空 celebrateLevel 并持久化 lastSeenLevel. */
  acknowledgeCelebration: () => Promise<void>;
  /** 登出或切号时调用. */
  reset: () => void;
  /** 内部: 从持久化读取; 返回是否找到已有基线值 */
  hydrate: (userId: number) => Promise<boolean>;
}

type LevelStore = LevelStoreState & LevelStoreActions;

// 模块级缓存: 跨组件共享 in-flight Promise 与上一次成功时间.
// 没放进 zustand state 是因为这两个值变化不应该触发订阅者重渲染.
let inFlight: Promise<UserLevelStatus | null> | null = null;
let lastRefreshedAt = 0;

export const useLevelStore = create<LevelStore>((set, get) => ({
  status: null,
  loading: false,
  celebrateLevel: null,
  lastSeenLevel: 0,
  hasBaselined: false,

  hydrate: async (userId: number) => {
    try {
      const raw = await AsyncStorage.getItem(keyFor(userId));
      if (raw == null) {
        // 该用户在本设备上还没有基线, 不要把 lastSeenLevel 当成"真实经历过 0 级"
        set({ lastSeenLevel: 0, hasBaselined: false });
        return false;
      }
      const seen = Math.max(0, Number(raw) || 0);
      set({ lastSeenLevel: seen, hasBaselined: true });
      return true;
    } catch {
      set({ lastSeenLevel: 0, hasBaselined: false });
      return false;
    }
  },

  refresh: async (options?: RefreshOptions) => {
    const authUserId = useAuthStore.getState().user?.userId;
    if (!authUserId) return null;

    // 1) In-flight 去重: 多个调用方在同一 tick 内连发时, 复用同一个 Promise.
    //    例如 Profile 进入页面同时触发 useEffect + useFocusEffect 各一次.
    if (inFlight) return inFlight;

    // 2) 节流: 非强制刷新且距离上次成功不到 REFRESH_THROTTLE_MS, 直接返回当前
    //    status, 避免页面跳转 / Tab 切换导致的"毫秒级重复请求".
    //    pull-to-refresh / 核销后传 force: true 跳过该窗口.
    if (!options?.force && Date.now() - lastRefreshedAt < REFRESH_THROTTLE_MS) {
      return get().status;
    }

    // 首次调用时先从 AsyncStorage 读 lastSeenLevel
    if (!get().hasBaselined && get().status == null) {
      await get().hydrate(authUserId);
    }

    set({ loading: true });

    const run = async (): Promise<UserLevelStatus | null> => {
      try {
        const status = await levelService.getMyLevel();

        const next = Math.max(0, Number(status.currentLevel) || 0);
        const prev = get().lastSeenLevel;
        const baselined = get().hasBaselined;

        if (!baselined) {
          // 首次观察: 把当前等级当基线, 不播动画, 避免新设备/清缓存误触发.
          try {
            await AsyncStorage.setItem(keyFor(authUserId), String(next));
          } catch {
            /* 忽略持久化失败, 内存里先推进即可 */
          }
          set({ lastSeenLevel: next, hasBaselined: true });
        } else if (next > prev) {
          // 严格单调: 只有真正从旧基线向上跃迁才庆祝
          // (保护: 即使后端误回较小值也不降级展示)
          set({ celebrateLevel: next });
        }

        set({ status, loading: false });
        lastRefreshedAt = Date.now();
        return status;
      } catch (e) {
        set({ loading: false });
        console.warn("[levelStore] refresh failed:", e);
        return null;
      } finally {
        inFlight = null;
      }
    };

    inFlight = run();
    return inFlight;
  },

  acknowledgeCelebration: async () => {
    const { status } = get();
    const level = status?.currentLevel ?? 0;
    const userId = useAuthStore.getState().user?.userId;
    if (userId) {
      try {
        await AsyncStorage.setItem(keyFor(userId), String(level));
      } catch {
        // 忽略持久化失败, 至少在内存里推进 lastSeenLevel
      }
    }
    set({ celebrateLevel: null, lastSeenLevel: level, hasBaselined: true });
  },

  reset: () => {
    // 切号 / 登出时也要清掉模块级缓存, 否则下一个账号会被上一个账号的
    // lastRefreshedAt 节流命中, 导致登录后第一发 refresh 被静默吞掉.
    inFlight = null;
    lastRefreshedAt = 0;
    set({
      status: null,
      loading: false,
      celebrateLevel: null,
      lastSeenLevel: 0,
      hasBaselined: false,
    });
  },
}));
