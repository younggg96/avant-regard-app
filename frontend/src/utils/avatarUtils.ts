/** Known generated / stock placeholder avatar URLs we should not render. */
const PLACEHOLDER_AVATAR_MARKERS = [
  "dicebear.com",
  "avataaars",
  "via.placeholder.com",
  "images.unsplash.com/photo-1502685104226",
] as const;

export function isPlaceholderAvatarUrl(url?: string | null): boolean {
  if (!url?.trim()) return true;
  const lower = url.toLowerCase();
  return PLACEHOLDER_AVATAR_MARKERS.some((marker) => lower.includes(marker));
}

/** First real avatar URL from sources, or `undefined` when none. */
export function resolveAvatarUrl(
  ...sources: Array<string | null | undefined>
): string | undefined {
  for (const src of sources) {
    if (src && !isPlaceholderAvatarUrl(src)) {
      return src.trim();
    }
  }
  return undefined;
}

/** String form for models that store avatar as `string` (empty = no avatar). */
export function resolveAvatarUrlOrEmpty(
  ...sources: Array<string | null | undefined>
): string {
  return resolveAvatarUrl(...sources) ?? "";
}
