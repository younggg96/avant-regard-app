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

interface LevelStoreActions {
  /** 拉取最新状态; 若发现 currentLevel 高于 lastSeenLevel, 触发庆祝动画. */
  refresh: () => Promise<UserLevelStatus | null>;
  /** 组件播完动画后调用, 清空 celebrateLevel 并持久化 lastSeenLevel. */
  acknowledgeCelebration: () => Promise<void>;
  /** 登出或切号时调用. */
  reset: () => void;
  /** 内部: 从持久化读取; 返回是否找到已有基线值 */
  hydrate: (userId: number) => Promise<boolean>;
}

type LevelStore = LevelStoreState & LevelStoreActions;

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

  refresh: async () => {
    const authUserId = useAuthStore.getState().user?.userId;
    if (!authUserId) return null;

    // 首次调用时先从 AsyncStorage 读 lastSeenLevel
    if (!get().hasBaselined && get().status == null) {
      await get().hydrate(authUserId);
    }

    set({ loading: true });
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
      return status;
    } catch (e) {
      set({ loading: false });
      console.warn("[levelStore] refresh failed:", e);
      return null;
    }
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
    set({
      status: null,
      loading: false,
      celebrateLevel: null,
      lastSeenLevel: 0,
      hasBaselined: false,
    });
  },
}));
