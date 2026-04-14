import { useState, useCallback, useEffect, useRef } from "react";
import { useAuthStore } from "../store/authStore";
import {
  getUserFavoriteStores,
  favoriteStore,
  unfavoriteStore,
} from "../services/buyerStoreService";

export function useStoreFavorites() {
  const { user } = useAuthStore();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const loadingRef = useRef(false);

  const loadFavorites = useCallback(async () => {
    if (!user?.userId || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const result = await getUserFavoriteStores(user.userId, 1, 500);
      setFavoriteIds(new Set(result.storeIds));
    } catch (err) {
      console.error("Failed to load store favorites:", err);
    } finally {
      loadingRef.current = false;
      setLoaded(true);
    }
  }, [user?.userId]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const isFavorited = useCallback(
    (storeId: string) => favoriteIds.has(storeId),
    [favoriteIds]
  );

  const toggleFavorite = useCallback(
    async (storeId: string) => {
      if (!user?.userId) return;
      const wasFavorited = favoriteIds.has(storeId);

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) {
          next.delete(storeId);
        } else {
          next.add(storeId);
        }
        return next;
      });

      try {
        if (wasFavorited) {
          await unfavoriteStore(storeId, user.userId);
        } else {
          await favoriteStore(storeId, user.userId);
        }
      } catch (err) {
        setFavoriteIds((prev) => {
          const rollback = new Set(prev);
          if (wasFavorited) {
            rollback.add(storeId);
          } else {
            rollback.delete(storeId);
          }
          return rollback;
        });
        console.error("Failed to toggle store favorite:", err);
      }
    },
    [user?.userId, favoriteIds]
  );

  return { isFavorited, toggleFavorite, loaded, reload: loadFavorites };
}
