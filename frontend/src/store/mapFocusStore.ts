import { create } from "zustand";
import type { BuyerStore } from "../services/buyerStoreService";

/**
 * 跨屏「请求把买手地图聚焦到某家店」的信号通道。
 *
 * 用法：
 *   - StoreSearchScreen 选中搜索结果时调用 `requestFocus(store)` 再 navigate 回
 *     地图所在的 InteractionScreen。
 *   - BuyerMapScreen 订阅这个 store；`pending` 一变成非空就消费掉，把地图
 *     animateToRegion 到该店并打开 callout。
 *
 * 为什么不直接用 react-navigation 的 `route.params`：
 * BuyerMapScreen 是 InteractionScreen 内部的嵌入子页（同一个 Stack.Screen 里
 * pagingEnabled 横向 ScrollView 里挂着），不是独立路由，自身不会随
 * `navigate("Interaction", { focusStoreId })` 收到 focusEffect / 新 params。
 * 让 Interaction 转发也能做，但耦合更大、还得处理"同一家店两次"的去重；
 * 用一个 pub-sub store 把信号脱钩出来最简单，并且天然支持"未挂载先压入、
 * 挂载后 consume"。
 *
 * 消费语义：`consume()` 在读取后把 `pending` 置空，下一次 `requestFocus()`
 * 即使传入同一家店也会再次触发订阅者，保证"再次点同一条搜索结果也会重新聚焦"
 * 的预期行为。
 */
interface MapFocusState {
  pending: BuyerStore | null;
  requestFocus: (store: BuyerStore) => void;
  consume: () => BuyerStore | null;
}

export const useMapFocusStore = create<MapFocusState>((set, get) => ({
  pending: null,
  requestFocus: (store) => set({ pending: store }),
  consume: () => {
    const p = get().pending;
    if (p !== null) set({ pending: null });
    return p;
  },
}));
