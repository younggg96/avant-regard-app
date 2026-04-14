import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { useStoreFavoritesStore } from "../store/storeFavoritesStore";

export function useStoreFavorites() {
  const { user } = useAuthStore();
  const store = useStoreFavoritesStore();

  useEffect(() => {
    if (user?.userId && !store.loaded) {
      store.loadFavorites(user.userId);
    }
  }, [user?.userId, store.loaded]);

  const isFavorited = (storeId: string) => store.isFavorited(storeId);

  const toggleFavorite = async (storeId: string) => {
    if (!user?.userId) return;
    await store.toggleFavorite(storeId, user.userId);
  };

  const getFavoriteCount = (storeId: string) => store.getFavoriteCount(storeId);

  return {
    isFavorited,
    toggleFavorite,
    getFavoriteCount,
    setFavoriteCountForStore: store.setFavoriteCountForStore,
    syncCountsFromStores: store.syncCountsFromStores,
    loaded: store.loaded,
    reload: () => user?.userId ? store.loadFavorites(user.userId) : undefined,
  };
}
