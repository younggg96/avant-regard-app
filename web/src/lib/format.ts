/**
 * Small formatting helpers used across server and client components.
 *
 * IMPORTANT: This module must stay free of top-level imports that touch
 * React context (e.g. `react-i18next`). Server components import
 * `formatCount` from here, and pulling react-i18next into a server bundle
 * triggers `createContext is not a function` errors during page data
 * collection. The fallback `t` below is a key-passthrough used only when
 * no translator is supplied; in practice every caller passes one.
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

type RelativeTimeT = (
  key: string,
  options?: Record<string, string | number>,
) => string;

const passthroughT: RelativeTimeT = (key, options) => {
  if (!options) return key;
  let value = key;
  for (const [k, v] of Object.entries(options)) {
    value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
  }
  return value;
};

/**
 * Relative time for feed timestamps. Prefer passing `t` from `useTranslation()`
 * in React so updates follow hook re-renders; when omitted, falls back to a
 * key-passthrough (no localization) to keep this module server-safe.
 */
export function formatRelativeTime(iso?: string, t?: RelativeTimeT): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  const tr = t ?? passthroughT;
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
 * falls back to a key-passthrough (same as {@link formatRelativeTime}).
 */
export function postTypeLabel(
  postType?: string,
  t?: RelativeTimeT,
): string {
  const tr = t ?? passthroughT;
  const key =
    postType && KNOWN_POST_TYPES.has(postType)
      ? `postTypes.${postType}`
      : "postTypes.default";
  return tr(key);
}
