/**
 * Feature flags store
 * ------------------------------------------------------------------
 * 全站功能开关 (admin 控制) 的客户端缓存与轮询入口.
 *
 * 当前唯一受控开关:
 * - `lotteryEnabled`: 是否暴露月度抽奖入口与相关内容. 关闭时所有入口/卡片/历史
 *   全部从 UI 上消失, 后端的 `/api/lottery/*` 也会同步返回 `enabled: false`,
 *   双层兜底.
 *
 * 设计与 `maintenanceStore` 完全对齐:
 * - 提供 `startFeatureFlagsPolling()`, App 根节点 (App.tsx) 调用一次, 启动后
 *   定期拉取 `/api/feature-flags`. 后端 5s TTL 缓存 + 客户端 30s 轮询足够及时.
 * - `useFeatureFlagsStore.getState().refresh()` 可在管理员保存设置后立刻刷一次,
 *   避免要等下一次轮询.
 */

import { create } from "zustand";

import { config as envConfig } from "../config/env";

export interface FeatureFlags {
  /**
   * 默认 false, 与后端 `feature_flags_service._default_config` 对齐.
   * "未拉到/拉取失败" 时按关闭处理, 不让未确认的抽奖入口闪一下.
   */
  lotteryEnabled: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  lotteryEnabled: false,
};

interface FeatureFlagsState {
  flags: FeatureFlags;
  loaded: boolean;
  setFlags: (flags: Partial<FeatureFlags>) => void;
  refresh: () => Promise<void>;
}

export const useFeatureFlagsStore = create<FeatureFlagsState>((set) => ({
  flags: DEFAULT_FLAGS,
  loaded: false,
  setFlags: (next) =>
    set((prev) => ({
      flags: { ...prev.flags, ...next },
      loaded: true,
    })),
  refresh: async () => {
    await fetchFeatureFlags();
  },
}));

interface FeatureFlagsResponse {
  code: number;
  data?: Partial<FeatureFlags>;
}

const FLAGS_ENDPOINT = `${envConfig.EXPO_PUBLIC_API_BASE_URL}/api/feature-flags`;

let pollingTimer: ReturnType<typeof setInterval> | null = null;

async function fetchFeatureFlags(): Promise<void> {
  try {
    const response = await fetch(FLAGS_ENDPOINT, { method: "GET" });
    if (!response.ok) return;
    const body = (await response.json()) as FeatureFlagsResponse;
    if (body.code !== 0 || !body.data) return;
    useFeatureFlagsStore.getState().setFlags({
      lotteryEnabled: body.data.lotteryEnabled ?? false,
    });
  } catch {
    // 静默失败: 默认值 (关闭) 不暴露入口, 后续轮询会重试
  }
}

/**
 * 启动功能开关轮询, App 根节点调用一次. 默认 30s 一次, 与维护轮询错峰.
 * 多次调用幂等.
 */
export function startFeatureFlagsPolling(intervalMs: number = 30_000): void {
  if (pollingTimer) return;
  fetchFeatureFlags();
  pollingTimer = setInterval(fetchFeatureFlags, intervalMs);
}

/** 停止轮询. 主要给登出/测试用. */
export function stopFeatureFlagsPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

/** 管理员改完设置后立刻刷一次, 当前设备不必等下一轮轮询. */
export const refreshFeatureFlags = fetchFeatureFlags;
