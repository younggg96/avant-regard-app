import { NotificationType } from "../../services/notificationService";
import { ActivityFilter, EXCLUDED_TYPES, NOTIF_ICON_MAP } from "./constants";
import { theme } from "../../theme";

export function matchesFilter(type: NotificationType, filter: ActivityFilter): boolean {
  if (EXCLUDED_TYPES.includes(type)) return false;
  if (filter === "all") return true;
  switch (filter) {
    case "like_collection":
      return type === "like" || type === "collection";
    case "comment":
      return type === "comment";
    case "follow":
      return type === "follow";
    default:
      return true;
  }
}

export const getNotifIcon = (type: string) =>
  NOTIF_ICON_MAP[type] || { name: "ellipse", color: theme.colors.gray400 };

export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const min = Math.floor(ms / 60000);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  if (hrs < 24) return `${hrs}小时前`;
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString("zh-CN");
}
