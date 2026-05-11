import { create } from "zustand";

/**
 * 从「上传品牌」全屏返回后触发 Archive 品牌列表刷新（与弹窗路径 onSuccess={loadBrands} 对齐）。
 */

interface ArchiveBrandListRefreshState {
  refreshNonce: number;
  bumpRefreshNonce: () => void;
}

export const useArchiveBrandListRefreshStore = create<ArchiveBrandListRefreshState>((set, get) => ({
  refreshNonce: 0,
  bumpRefreshNonce: () => set({ refreshNonce: get().refreshNonce + 1 }),
}));
