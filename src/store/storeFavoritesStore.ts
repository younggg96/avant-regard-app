import { create } from "zustand";
import {
  getUserFavoriteStores,
  favoriteStore,
  unfavoriteStore,
} from "../services/buyerStoreService";

interface StoreFavoritesState {
  favoriteIds: Set<string>;
  favoriteCounts: Map<string, number>;
  loaded: boolean;
  _loading: boolean;

  loadFavorites: (userId: number) => Promise<void>;
  isFavorited: (storeId: string) => boolean;
  getFavoriteCount: (storeId: string) => number;
  setFavoriteCountForStore: (storeId: string, count: number) => void;
  syncCountsFromStores: (
    stores: Array<{ id: string; favoriteCount?: number }>
  ) => void;
  syncFromDetail: (
    storeId: string,
    isFavorited: boolean,
    count: number
  ) => void;
  toggleFavorite: (storeId: string, userId: number) => Promise<void>;
  reset: () => void;
}

export const useStoreFavoritesStore = create<StoreFavoritesState>(
  (set, get) => ({
    favoriteIds: new Set(),
    favoriteCounts: new Map(),
    loaded: false,
    _loading: false,

    loadFavorites: async (userId: number) => {
      if (get()._loading) return;
      set({ _loading: true });
      try {
        const result = await getUserFavoriteStores(userId, 1, 500);
        set({ favoriteIds: new Set(result.storeIds), loaded: true });
      } catch (err) {
        console.error("Failed to load store favorites:", err);
      } finally {
        set({ _loading: false });
      }
    },

    isFavorited: (storeId: string) => get().favoriteIds.has(storeId),

    getFavoriteCount: (storeId: string) =>
      get().favoriteCounts.get(storeId) ?? 0,

    setFavoriteCountForStore: (storeId: string, count: number) => {
      const next = new Map(get().favoriteCounts);
      next.set(storeId, count);
      set({ favoriteCounts: next });
    },

    syncCountsFromStores: (
      stores: Array<{ id: string; favoriteCount?: number }>
    ) => {
      const next = new Map(get().favoriteCounts);
      for (const s of stores) {
        if (s.favoriteCount != null) {
          next.set(s.id, s.favoriteCount);
        }
      }
      set({ favoriteCounts: next });
    },

    syncFromDetail: (
      storeId: string,
      isFavorited: boolean,
      count: number
    ) => {
      const nextIds = new Set(get().favoriteIds);
      if (isFavorited) {
        nextIds.add(storeId);
      } else {
        nextIds.delete(storeId);
      }
      const nextCounts = new Map(get().favoriteCounts);
      nextCounts.set(storeId, count);
      set({ favoriteIds: nextIds, favoriteCounts: nextCounts });
    },

    toggleFavorite: async (storeId: string, userId: number) => {
      const { favoriteIds, favoriteCounts } = get();
      const wasFavorited = favoriteIds.has(storeId);
      const currentCount = favoriteCounts.get(storeId) ?? 0;

      const nextIds = new Set(favoriteIds);
      const nextCounts = new Map(favoriteCounts);
      if (wasFavorited) {
        nextIds.delete(storeId);
        nextCounts.set(storeId, Math.max(0, currentCount - 1));
      } else {
        nextIds.add(storeId);
        nextCounts.set(storeId, currentCount + 1);
      }
      set({ favoriteIds: nextIds, favoriteCounts: nextCounts });

      try {
        if (wasFavorited) {
          await unfavoriteStore(storeId, userId);
        } else {
          await favoriteStore(storeId, userId);
        }
      } catch (err) {
        const rollbackIds = new Set(get().favoriteIds);
        const rollbackCounts = new Map(get().favoriteCounts);
        if (wasFavorited) {
          rollbackIds.add(storeId);
          rollbackCounts.set(storeId, currentCount);
        } else {
          rollbackIds.delete(storeId);
          rollbackCounts.set(storeId, currentCount);
        }
        set({ favoriteIds: rollbackIds, favoriteCounts: rollbackCounts });
        console.error("Failed to toggle store favorite:", err);
      }
    },

    reset: () =>
      set({
        favoriteIds: new Set(),
        favoriteCounts: new Map(),
        loaded: false,
        _loading: false,
      }),
  })
);
