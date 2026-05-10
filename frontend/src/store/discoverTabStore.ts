import { create } from "zustand";

import type { TabType } from "../screens/Discover/types";

/**
 * Discover Tab store
 * ------------------------------------------------------------------
 * 记录 Discover (推荐 / 论坛 / 买手店 / 关注) 当前所在子 Tab。
 *
 * 唯一消费方是底部 Tab 中央的 `PublishTabButtonV2`：它需要在用户
 * 点击「+」时知道用户当前停在 Discover 的哪个子 Tab，从而决定走
 * 论坛发帖流程还是图片优先发帖流程。
 *
 * 设计要点：
 *   - 默认值与 Discover 启动后落到 `recommend` 一致；
 *   - 仅由 `DiscoverScreen` 在 sub-tab 切换时写入；
 *   - 不持久化，应用冷启动后即重置；
 *   - `lastFocused` 标记当前 Discover 是否仍是焦点屏。当用户从 Discover
 *     跳到其它屏（例如个人主页）后再点中间「+」，按最近一次落在 Discover
 *     的 sub-tab 路由仍合理，但若 V2 入口需要更严格的「仅 Discover 内
 *     才生效」语义，可读取此字段做兜底。
 */

interface DiscoverTabState {
  /** Discover 内当前激活的子 Tab */
  activeTab: TabType;
  /** Discover 是否当前是焦点屏（DiscoverScreen 自己维护） */
  lastFocused: boolean;
  setActiveTab: (tab: TabType) => void;
  setFocused: (focused: boolean) => void;
}

export const useDiscoverTabStore = create<DiscoverTabState>((set) => ({
  activeTab: "recommend",
  lastFocused: false,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setFocused: (focused) => set({ lastFocused: focused }),
}));
