import { theme } from "../../theme";
import { NotificationType } from "../../services/notificationService";

export type ActivityFilter = "all" | "like_collection" | "comment" | "follow";

export const FILTER_TABS: { id: ActivityFilter; labelKey: string }[] = [
  { id: "all", labelKey: "activity.all" },
  { id: "like_collection", labelKey: "activity.likesAndSaves" },
  { id: "comment", labelKey: "activity.comments" },
  { id: "follow", labelKey: "activity.follows" },
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
