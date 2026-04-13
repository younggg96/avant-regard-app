import { Message } from "../../services/chatService";

export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  if (isToday) return `${h}:${m}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${h}:${m}`;

  return `${d.getMonth() + 1}/${d.getDate()} ${h}:${m}`;
}

export function shouldShowTimestamp(
  current: Message,
  previous: Message | undefined
): boolean {
  if (!previous) return true;
  const diff =
    new Date(current.createdAt).getTime() -
    new Date(previous.createdAt).getTime();
  return diff > 5 * 60 * 1000;
}
