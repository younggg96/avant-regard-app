import { theme } from "../../theme";

export { CS_USER_ID } from "../../constants/customerService";

export type SubTab = "messages" | "map";

export const SUB_TAB_KEYS: Record<SubTab, string> = {
  messages: "interaction.messages",
  map: "map.title",
};

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
