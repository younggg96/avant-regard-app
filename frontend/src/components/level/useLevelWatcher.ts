/**
 * 等级状态监听 Hook · 挂在 App 根组件
 *
 * 职责:
 *   - 登录后立即拉一次 /levels/me, 让 store 持有 currentLevel + benefits.
 *   - AppState 从后台回前台时再次拉 (命中每月 1 号 / 权益核销后的变化).
 *   - 用户切换 / 登出时 reset.
 *   - 不做定时轮询: 关键升级节点走后端站内信+通知; 拉取交给路由事件.
 */

import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuthStore } from "../../store/authStore";
import { useLevelStore } from "../../store/levelStore";

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

  // 回到前台时 re-sync
  useEffect(() => {
    if (!isAuthenticated) return;
    const listener = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          refresh();
        }
      }
    );
    return () => listener.remove();
  }, [isAuthenticated, refresh]);
}
