/**
 * Small formatting helpers used across server and client components.
 */

export function formatCount(n: number | undefined | null): string {
  const value = n ?? 0;
  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)}w`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }
  return String(value);
}

export function formatRelativeTime(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  const years = Math.floor(months / 12);
  return `${years} 年前`;
}

const POST_TYPE_LABEL: Record<string, string> = {
  OUTFIT: "穿搭",
  DAILY_SHARE: "日常",
  ITEM_REVIEW: "单品测评",
  ARTICLES: "文章",
};

export function postTypeLabel(postType?: string): string {
  if (!postType) return "帖子";
  return POST_TYPE_LABEL[postType] ?? "帖子";
}
