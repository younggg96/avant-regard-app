"use client";

/**
 * Web 端店铺收藏 hook — 对齐 frontend/src/hooks/useStoreFavorites.ts。
 *
 * 行为：
 *   - 登录后首次访问自动拉 `/api/buyer-stores/favorites/user` 的 id 列表
 *   - 乐观更新 toggle，失败回滚（与 iOS zustand store 一致）
 *   - 本地维护每个店铺的 favoriteCount，避免频繁请求 detail
 *
 * 不走 zustand（web 当前按需使用 hooks），直接用 React state + 模块级缓存
 * 保证同一 tab 不同页面共享收藏状态。
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuthStore } from "../auth/store";
import {
  favoriteStore as apiFavorite,
  unfavoriteStore as apiUnfavorite,
  getUserFavoriteStoreIds,
} from "../services/buyer-store";

interface FavoritesState {
  ids: Set<string>;
  counts: Map<string, number>;
  loaded: boolean;
  loading: boolean;
  loadedForUserId: number | null;
}

const state: FavoritesState = {
  ids: new Set(),
  counts: new Map(),
  loaded: false,
  loading: false,
  loadedForUserId: null,
};

const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return state;
}

async function loadFavorites(userId: number) {
  if (state.loading || state.loadedForUserId === userId) return;
  state.loading = true;
  notify();
  try {
    const result = await getUserFavoriteStoreIds(userId, 1, 500);
    state.ids = new Set(result.storeIds);
    state.loaded = true;
    state.loadedForUserId = userId;
  } catch (err) {
    console.error("Failed to load store favorites:", err);
  } finally {
    state.loading = false;
    notify();
  }
}

function resetFavoritesForLogout() {
  state.ids = new Set();
  state.counts = new Map();
  state.loaded = false;
  state.loadedForUserId = null;
  notify();
}

export function useStoreFavorites() {
  // Subscribe to the module-level state so all consumers re-render together.
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const user = useAuthStore((s) => s.user);
  const userId = user?.userId ?? null;

  useEffect(() => {
    if (userId == null) {
      resetFavoritesForLogout();
      return;
    }
    if (state.loadedForUserId !== userId) {
      void loadFavorites(userId);
    }
  }, [userId]);

  const isFavorited = useCallback(
    (storeId: string) => state.ids.has(storeId),
    [],
  );

  const getFavoriteCount = useCallback(
    (storeId: string) => state.counts.get(storeId) ?? 0,
    [],
  );

  const setFavoriteCountForStore = useCallback(
    (storeId: string, count: number) => {
      const next = new Map(state.counts);
      next.set(storeId, count);
      state.counts = next;
      notify();
    },
    [],
  );

  const syncCountsFromStores = useCallback(
    (stores: Array<{ id: string; favoriteCount?: number }>) => {
      const next = new Map(state.counts);
      let changed = false;
      for (const s of stores) {
        if (s.favoriteCount != null && next.get(s.id) !== s.favoriteCount) {
          next.set(s.id, s.favoriteCount);
          changed = true;
        }
      }
      if (changed) {
        state.counts = next;
        notify();
      }
    },
    [],
  );

  const toggleFavorite = useCallback(
    async (storeId: string) => {
      if (userId == null) return { ok: false, reason: "NOT_LOGGED_IN" as const };
      const wasFavorited = state.ids.has(storeId);
      const currentCount = state.counts.get(storeId) ?? 0;

      // Optimistic update.
      const nextIds = new Set(state.ids);
      const nextCounts = new Map(state.counts);
      if (wasFavorited) {
        nextIds.delete(storeId);
        nextCounts.set(storeId, Math.max(0, currentCount - 1));
      } else {
        nextIds.add(storeId);
        nextCounts.set(storeId, currentCount + 1);
      }
      state.ids = nextIds;
      state.counts = nextCounts;
      notify();

      try {
        if (wasFavorited) {
          await apiUnfavorite(storeId, userId);
        } else {
          await apiFavorite(storeId, userId);
        }
        return { ok: true as const };
      } catch (err) {
        // Rollback on failure.
        const rollbackIds = new Set(state.ids);
        const rollbackCounts = new Map(state.counts);
        if (wasFavorited) {
          rollbackIds.add(storeId);
        } else {
          rollbackIds.delete(storeId);
        }
        rollbackCounts.set(storeId, currentCount);
        state.ids = rollbackIds;
        state.counts = rollbackCounts;
        notify();
        console.error("Failed to toggle store favorite:", err);
        return { ok: false as const, reason: "API_ERROR" as const };
      }
    },
    [userId],
  );

  return {
    isLoggedIn: userId != null,
    isFavorited,
    toggleFavorite,
    getFavoriteCount,
    setFavoriteCountForStore,
    syncCountsFromStores,
    loaded: state.loaded,
  };
}
