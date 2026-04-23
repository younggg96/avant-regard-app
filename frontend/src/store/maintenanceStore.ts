import { create } from "zustand";

import { config as envConfig } from "../config/env";

/**
 * Maintenance store
 * ------------------------------------------------------------------
 * 维护模式状态与副作用集中在一个模块里，避免散落在多个组件：
 *
 * 1. 轻量全站轮询：`startMaintenancePolling()` 只应被 App 根节点调用一次，
 *    启动后按固定周期拉取 `/api/maintenance/status`，是否展示遮罩完全由
 *    后端配置决定。
 * 2. 网络短路识别：`fetch` 被一次性 patch —— 任何接口返回 502/503 都会立刻
 *    切换到维护态；恢复则交给轮询完成，避免靠计时器 “自解封”。
 * 3. 文案可覆写：后端下发的 message 会覆盖默认文案，UI 直接消费 store。
 */

export const DEFAULT_MAINTENANCE_MESSAGE =
  "服务暂时不可用，正在恢复中\n请稍后再试";

interface MaintenanceState {
  isDown: boolean;
  message: string;
  setStatus: (isDown: boolean, message?: string) => void;
}

export const useMaintenanceStore = create<MaintenanceState>((set) => ({
  isDown: false,
  message: DEFAULT_MAINTENANCE_MESSAGE,
  setStatus: (isDown, message) =>
    set((prev) => ({
      isDown,
      message:
        message && message.trim().length > 0
          ? message
          : isDown
            ? prev.message
            : DEFAULT_MAINTENANCE_MESSAGE,
    })),
}));

// ---------------------------------------------------------------
// 被动触发：任何 HTTP 502/503 立即进入维护态
// ---------------------------------------------------------------

const originalFetch = global.fetch;

global.fetch = async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await originalFetch(input, init);

  if (response.status === 502 || response.status === 503) {
    // 尽量读出后端下发的维护文案，读取失败也不阻塞原请求的返回
    let message: string | undefined;
    try {
      const cloned = response.clone();
      const body = await cloned.json();
      if (body && typeof body.message === "string") {
        message = body.message;
      }
    } catch {
      // 非 JSON 或读取失败均忽略，沿用已有文案
    }
    useMaintenanceStore.getState().setStatus(true, message);
  }

  return response;
};

// ---------------------------------------------------------------
// 主动轮询：以后端配置为准，保证维护恢复后能自动关闭遮罩
// ---------------------------------------------------------------

interface MaintenanceStatusResponse {
  code: number;
  data?: { enabled?: boolean; message?: string };
}

const STATUS_ENDPOINT = `${envConfig.EXPO_PUBLIC_API_BASE_URL}/api/maintenance/status`;

let pollingTimer: ReturnType<typeof setInterval> | null = null;

async function fetchMaintenanceStatus(): Promise<void> {
  try {
    const response = await originalFetch(STATUS_ENDPOINT, { method: "GET" });
    if (!response.ok) return;
    const body = (await response.json()) as MaintenanceStatusResponse;
    if (body.code !== 0 || !body.data) return;
    useMaintenanceStore
      .getState()
      .setStatus(Boolean(body.data.enabled), body.data.message);
  } catch {
    // 轮询失败由 fetch patch 处理 502/503；此处静默避免日志刷屏
  }
}

/**
 * 启动维护模式轮询。默认 20s 一次——足够快地感知开关变化，又不会给后端造成压力。
 * 多次调用是幂等的（已有定时器会被复用）。
 */
export function startMaintenancePolling(intervalMs: number = 20_000): void {
  if (pollingTimer) return;
  // 启动立刻拉一次，避免首屏还停留在默认关闭态
  fetchMaintenanceStatus();
  pollingTimer = setInterval(fetchMaintenanceStatus, intervalMs);
}

/** 停止轮询；主要给测试或登出清理使用。 */
export function stopMaintenancePolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

/** 管理员改动配置后可以调用它立刻刷新其他端的状态（本端 UI 通常会直接使用返回值）。 */
export const refreshMaintenanceStatus = fetchMaintenanceStatus;
