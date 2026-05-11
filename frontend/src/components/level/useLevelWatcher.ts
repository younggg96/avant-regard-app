/**
 * 等级状态监听 Hook · 挂在 App 根组件
 *
 * 职责:
 *   - 登录后立即拉一次 /levels/me, 让 store 持有 currentLevel + benefits.
 *   - AppState 从后台回前台时再次拉 (命中每月 1 号 / 权益核销后的变化).
 *   - 前台时按 LEVEL_FOREGROUND_POLL_MS 周期再拉一次, 用于"用户一直在 App 内
 *     连续操作 / 后端异步线程池静默升级"这条路径的兜底自动弹窗.
 *   - 用户切换 / 登出时 reset.
 *
 * 为什么需要前台轮询:
 *   后端 level_service.record_action 走的是 ThreadPoolExecutor 后台任务,
 *   升级事件本身没有暴露给前端的实时 push 通道 (站内信只在启动时
 *   loadNotifications 一次拉取). 早期实现只在登录 / 回前台 时 refresh,
 *   导致用户在 App 内连续操作触达升级阈值后, 必须手动打开"我的等级"才会
 *   弹全屏动画 —— 与 PRD"任意页面都能看到升级庆祝"的预期不符.
 *
 *   选择周期: 30s 与 notificationStore.refreshUnreadCount 同一节奏,
 *   /levels/me 是只读查询, 单次 IO 极轻; 升级是低频事件, 30s 对体感"立刻就弹"
 *   已经足够. 仅在 AppState === 'active' 时跑定时器, 切后台立即停, 不浪费请求.
 */

import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuthStore } from "../../store/authStore";
import { useLevelStore } from "../../store/levelStore";

const LEVEL_FOREGROUND_POLL_MS = 30_000;

export function useLevelWatcher() {
  const userId = useAuthStore((s) => s.user?.userId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const refresh = useLevelStore((s) => s.refresh);
  const reset = useLevelStore((s) => s.reset);
  const hydrate = useLevelStore((s) => s.hydrate);

  const lastUserIdRef = useRef<number | null>(null);

  // 登录/切号时初始化
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      if (lastUserIdRef.current != null) {
        reset();
        lastUserIdRef.current = null;
      }
      return;
    }

    if (lastUserIdRef.current !== userId) {
      lastUserIdRef.current = userId;
      (async () => {
        await hydrate(userId);
        await refresh();
      })();
    }
  }, [isAuthenticated, userId, reset, hydrate, refresh]);

  // 前台轮询 + 回前台立即拉取: 双保险, 保证任何页面都能自动弹出升级动画.
  useEffect(() => {
    if (!isAuthenticated) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (timer != null) return;
      timer = setInterval(() => {
        refresh();
      }, LEVEL_FOREGROUND_POLL_MS);
    };

    const stopPolling = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };

    // 挂载时若已经在前台, 直接开始轮询;
    // 登录初始化那一发 refresh 已经在上一个 effect 里处理, 这里不再重复立即拉.
    if (AppState.currentState === "active") {
      startPolling();
    }

    const listener = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          // 回前台时立即同步一次, 然后重新开启轮询.
          refresh();
          startPolling();
        } else {
          stopPolling();
        }
      }
    );

    return () => {
      stopPolling();
      listener.remove();
    };
  }, [isAuthenticated, refresh]);
}
