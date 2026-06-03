import { create } from "zustand";

/**
 * orderAddressPromptStore —— offer 成交后「填写收货地址」的全局提示状态。
 *
 * 流程:
 *   1. 买家在 MyOffers 接受卖家还价(或下单成交)后, 调用 `showPrompt`,
 *      由挂在 App 顶层的 `OrderAddressPromptBanner` 从顶部滑入 + 成功动画。
 *   2. 点击横幅 → 进入与卖家的私聊 (Chat), 并通过路由参数让 Chat 自动弹出
 *      收货地址表单 (ShippingAddressModal)。
 *
 * 横幅与 Chat 解耦: 横幅只负责「展示 + 导航」, 地址表单由目标 Chat 屏渲染,
 * 这样能复用 AddressPickerSheet / ShippingAddressFields 现成组件的导航上下文。
 */
export interface OrderAddressPrompt {
  orderId: number;
  sellerUserId?: number | null;
  sellerName?: string | null;
  sellerAvatar?: string | null;
  productTitle?: string | null;
  coverImage?: string | null;
}

interface OrderAddressPromptStore {
  prompt: OrderAddressPrompt | null;
  showPrompt: (prompt: OrderAddressPrompt) => void;
  dismissPrompt: () => void;
}

export const useOrderAddressPromptStore = create<OrderAddressPromptStore>(
  (set) => ({
    prompt: null,
    showPrompt: (prompt) => set({ prompt }),
    dismissPrompt: () => set({ prompt: null }),
  }),
);
