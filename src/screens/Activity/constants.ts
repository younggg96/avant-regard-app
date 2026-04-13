import { theme } from "../../theme";
import { NotificationType } from "../../services/notificationService";

export type ActivityFilter = "all" | "like_collection" | "comment" | "follow";

export const FILTER_TABS: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "like_collection", label: "赞与收藏" },
  { id: "comment", label: "评论" },
  { id: "follow", label: "关注" },
];

export const EXCLUDED_TYPES: NotificationType[] = ["system", "mention"];

export const NOTIF_ICON_MAP: Record<string, { name: string; color: string }> = {
  like: { name: "heart", color: "#E74C3C" },
  comment: { name: "chatbubble", color: "#3498DB" },
  follow: { name: "person-add", color: "#27AE60" },
  mention: { name: "at", color: "#9B59B6" },
  collection: { name: "briefcase-outline", color: theme.colors.accent },
  system: { name: "notifications", color: "#F39C12" },
};
