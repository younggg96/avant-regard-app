import i18next from "i18next";
import { Notification } from "../../services/notificationService";
import { Conversation } from "../../services/chatService";
import { CS_USER_ID } from "./constants";
import { formatLastMessage as formatChatPreview } from "../../utils/chatMessagePreview";

export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const min = Math.floor(ms / 60000);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);
  if (min < 1) return i18next.t("time.justNow");
  if (min < 60) return i18next.t("time.minutesAgo", { count: min });
  if (hrs < 24) return i18next.t("time.hoursAgo", { count: hrs });
  if (days < 7) return i18next.t("time.daysAgo", { count: days });
  return d.toLocaleDateString(i18next.language === "zh" ? "zh-CN" : "en-US");
}

export function formatLastMessage(
  text: string | null,
  orderStatusOverride?: string | null,
): string {
  return formatChatPreview(text, "interaction.noMessages", orderStatusOverride);
}

export const isChatNotification = (n: Notification) =>
  n.actionData?.navigateTo === "Chat";

/**
 * A conversation is "stranger" when the current user has never sent a message
 * (myMessageCount === 0) and it's not the customer-service conversation.
 */
export const isStrangerConversation = (c: Conversation): boolean =>
  c.myMessageCount === 0 && c.otherUser?.userId !== CS_USER_ID;
