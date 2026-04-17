import { theme } from "../../theme";

/** Backend user ID for the customer-service / admin account */
export const CS_USER_ID = 1;
export const CS_DISPLAY_NAME = "Avant Regard 客服";

export type SubTab = "messages" | "map";

export const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "messages", label: "消息" },
  { id: "map", label: "地图" },
];

export const TAB_INDEX: Record<SubTab, number> = { messages: 0, map: 1 };
export const INDEX_TAB: SubTab[] = ["messages", "map"];

export const NOTIF_ICON_MAP: Record<string, { name: string; color: string }> = {
  like: { name: "heart", color: "#E74C3C" },
  comment: { name: "chatbubble", color: "#3498DB" },
  follow: { name: "person-add", color: "#27AE60" },
  mention: { name: "at", color: "#9B59B6" },
  collection: { name: "briefcase-outline", color: theme.colors.accent },
  system: { name: "notifications", color: "#F39C12" },
};
