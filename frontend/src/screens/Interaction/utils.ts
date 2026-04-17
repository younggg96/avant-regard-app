import { Notification } from "../../services/notificationService";
import { Conversation } from "../../services/chatService";
import { CS_USER_ID } from "./constants";

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

export function formatLastMessage(text: string | null): string {
  if (!text) return "暂无消息";
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.postId === "string") return "[帖子分享]";
        if (typeof parsed.storeId === "string") return "[店铺分享]";
        if (typeof parsed.brandId === "number") return "[品牌分享]";
        if (typeof parsed.showId === "string") return "[秀场分享]";
        if (typeof parsed.userId === "number" && typeof parsed.username === "string") {
          return "[名片分享]";
        }
      }
    } catch {
      // Not valid JSON; fall through to raw text.
    }
  }
  return text;
}

export const isChatNotification = (n: Notification) =>
  n.actionData?.navigateTo === "Chat";

/**
 * A conversation is "stranger" when the current user has never sent a message
 * (myMessageCount === 0) and it's not the customer-service conversation.
 */
export const isStrangerConversation = (c: Conversation): boolean =>
  c.myMessageCount === 0 && c.otherUser?.userId !== CS_USER_ID;
