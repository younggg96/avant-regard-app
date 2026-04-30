/**
 * Small formatting helpers used across server and client components.
 */

import i18n from "./i18n";

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

type RelativeTimeT = (
  key: string,
  options?: Record<string, string | number>,
) => string;

/**
 * Relative time for feed timestamps. Prefer passing `t` from `useTranslation()`
 * in React so updates follow hook re-renders; when omitted, uses the shared
 * i18n instance (current language from localStorage / detector).
 */
export function formatRelativeTime(iso?: string, t?: RelativeTimeT): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  const tr =
    t ??
    ((key: string, options?: Record<string, string | number>) =>
      String(i18n.t(key, options)));
  if (minutes < 1) return tr("timeRelative.justNow");
  if (minutes < 60) return tr("timeRelative.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tr("timeRelative.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return tr("timeRelative.daysAgo", { count: days });
  const months = Math.floor(days / 30);
  if (months < 12) return tr("timeRelative.monthsAgo", { count: months });
  const years = Math.floor(months / 12);
  return tr("timeRelative.yearsAgo", { count: years });
}

const KNOWN_POST_TYPES = new Set([
  "OUTFIT",
  "DAILY_SHARE",
  "ITEM_REVIEW",
  "ARTICLES",
]);

/**
 * Localized post type label. Prefer `t` from `useTranslation()`; when omitted,
 * uses the shared i18n instance (same as {@link formatRelativeTime}).
 */
export function postTypeLabel(
  postType?: string,
  t?: RelativeTimeT,
): string {
  const tr =
    t ??
    ((key: string, options?: Record<string, string | number>) =>
      String(i18n.t(key, options)));
  const key =
    postType && KNOWN_POST_TYPES.has(postType)
      ? `postTypes.${postType}`
      : "postTypes.default";
  return tr(key);
}
