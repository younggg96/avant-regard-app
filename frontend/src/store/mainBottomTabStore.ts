import { create } from "zustand";

/**
 * 主 Tab（首页 / Archive / 互动 / 个人）当前焦点。
 * 底部中央「+」需区分 Archive 与其它 Tab：`PublishTab` 被 preventDefault，
 * 不会抢走焦点，因此仍以用户上一次选中的主 Tab 为准。
 */

export type MainBottomTabId = "Home" | "Archive" | "Interaction" | "Profile";

interface MainBottomTabState {
  activeMainTab: MainBottomTabId;
  setActiveMainTab: (tab: MainBottomTabId) => void;
}

export const useMainBottomTabStore = create<MainBottomTabState>((set) => ({
  activeMainTab: "Home",
  setActiveMainTab: (tab) => set({ activeMainTab: tab }),
}));
