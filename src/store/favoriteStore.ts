import { create } from "zustand";

interface FavoriteItem {
  id: string;
  type: "look" | "item" | "lookbook" | "designer";
  name: string;
  data: any;
}

interface FavoriteStore {
  favorites: FavoriteItem[];
  addFavorite: (item: FavoriteItem) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  clearFavorites: () => void;
}

export const useFavoriteStore = create<FavoriteStore>((set, get) => ({
  favorites: [],

  addFavorite: (item) => {
    set((state) => ({
      favorites: [...state.favorites, item],
    }));
  },

  removeFavorite: (id) => {
    set((state) => ({
      favorites: state.favorites.filter((item) => item.id !== id),
    }));
  },

  isFavorite: (id) => {
    return get().favorites.some((item) => item.id === id);
  },

  clearFavorites: () => {
    set({ favorites: [] });
  },
}));
