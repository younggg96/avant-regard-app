import { theme } from "../../theme";
import type { TradingCategory } from "../../services/notificationService";

export { CS_USER_ID } from "../../constants/customerService";

export type SubTab = "messages" | "trading" | "map";

export const SUB_TAB_KEYS: Record<SubTab, string> = {
  messages: "interaction.messages",
  trading: "interaction.trading",
  map: "map.title",
};

export const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "messages", label: "消息" },
  { id: "trading", label: "交易" },
  { id: "map", label: "地图" },
];

export const TAB_INDEX: Record<SubTab, number> = {
  messages: 0,
  trading: 1,
  map: 2,
};
export const INDEX_TAB: SubTab[] = ["messages", "trading", "map"];

/**
 * 「交易」tab 三个分类的展示元数据（图标 / 主题色 / i18n key）。
 * 顺序即页面展示顺序：物流 → 售后 → 心动。
 */
export const TRADING_CATEGORY_META: {
  id: TradingCategory;
  labelKey: string;
  emptyKey: string;
  icon: string;
  color: string;
}[] = [
  {
    id: "logistics",
    labelKey: "interaction.tradingLogistics",
    emptyKey: "interaction.tradingLogisticsEmpty",
    icon: "cube-outline",
    color: "#3498DB",
  },
  {
    id: "after_sales",
    labelKey: "interaction.tradingAfterSales",
    emptyKey: "interaction.tradingAfterSalesEmpty",
    icon: "shield-checkmark-outline",
    color: "#27AE60",
  },
  {
    id: "wishlist",
    labelKey: "interaction.tradingWishlist",
    emptyKey: "interaction.tradingWishlistEmpty",
    icon: "heart-outline",
    color: "#E74C3C",
  },
];

export const NOTIF_ICON_MAP: Record<string, { name: string; color: string }> = {
  like: { name: "heart", color: "#E74C3C" },
  comment: { name: "chatbubble", color: "#3498DB" },
  follow: { name: "person-add", color: "#27AE60" },
  mention: { name: "at", color: "#9B59B6" },
  collection: { name: "briefcase-outline", color: theme.colors.accent },
  system: { name: "notifications", color: "#F39C12" },
};
