import { Notification, NotificationType } from "../../services/notificationService";
import {
  ACTIVITY_ICON_COLOR,
  ActivityFilter,
  EXCLUDED_TYPES,
  NOTIF_ICON_MAP,
  ORDER_EVENT_ICON_RULES,
} from "./constants";
import i18n from "@/i18n";

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
  NOTIF_ICON_MAP[type] || { name: "ellipse", color: ACTIVITY_ICON_COLOR.neutral };

/**
 * 列表行图标选择:交易 / 订单类通知(system 类型)按标题关键词细分图标,
 * 命中具体事件(付款/发货/签收/完成/结算…)时返回对应图标,否则回落到
 * 按类型映射的默认图标(铃铛等)。
 */
export const getActivityIcon = (
  item: Pick<Notification, "type" | "title" | "category">
) => {
  const title = item.title || "";
  const lower = title.toLowerCase();
  for (const rule of ORDER_EVENT_ICON_RULES) {
    if (rule.kws.some((k) => lower.includes(k.toLowerCase()))) {
      return rule.icon;
    }
  }
  // 未命中具体事件时,给售后 / 心动两类一个区别于物流的基础图标。
  if (item.category === "after_sales")
    return { name: "shield-checkmark", color: ACTIVITY_ICON_COLOR.neutral };
  if (item.category === "wishlist")
    return { name: "pricetag", color: ACTIVITY_ICON_COLOR.alert };
  return getNotifIcon(item.type);
};

export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const min = Math.floor(ms / 60000);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);
  if (min < 1) return i18n.t("time.justNow");
  if (min < 60) return i18n.t("time.minutesAgo", { count: min });
  if (hrs < 24) return i18n.t("time.hoursAgo", { count: hrs });
  if (days < 7) return i18n.t("time.daysAgo", { count: days });
  return d.toLocaleDateString(i18n.language === "zh" ? "zh-CN" : "en-US");
}
