import i18n from "@/i18n";
import { formatLastMessage as formatChatPreview } from "../../utils/chatMessagePreview";

export function formatTime(isoString: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return i18n.t("time.justNow");
  if (diffMin < 60) return i18n.t("time.minutesAgo", { count: diffMin });
  if (diffHours < 24) return i18n.t("time.hoursAgo", { count: diffHours });
  if (diffDays < 7) return i18n.t("time.daysAgo", { count: diffDays });
  return date.toLocaleDateString(i18n.language === "zh" ? "zh-CN" : "en-US");
}

export function formatLastMessage(text: string | null): string {
  return formatChatPreview(text, "chat.noMessages");
}
