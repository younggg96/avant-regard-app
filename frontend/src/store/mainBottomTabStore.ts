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
  /**
   * 「私信」跳转信号。底部「消息」Tab 对应 Interaction 页，页内还有
   * 消息 / 交易 / 地图 三个子 Tab。用户点底部消息图标时，无论当前停在哪个
   * 子 Tab，都应直接跳到私信。靠 initialParams 只在首次挂载生效，无法满足
   * 「每次点都回到私信」；这里用一个自增 nonce 作为信号，InteractionScreen 订阅它，
   * 每次变化就切到 messages 子 Tab。
   */
  messagesJumpNonce: number;
  requestMessagesJump: () => void;
}

export const useMainBottomTabStore = create<MainBottomTabState>((set) => ({
  activeMainTab: "Home",
  setActiveMainTab: (tab) => set({ activeMainTab: tab }),
  messagesJumpNonce: 0,
  requestMessagesJump: () =>
    set((s) => ({ messagesJumpNonce: s.messagesJumpNonce + 1 })),
}));
