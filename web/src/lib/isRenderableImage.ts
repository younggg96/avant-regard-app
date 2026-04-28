/**
 * `next/image` throws `Invalid src prop` (and tears down the whole render tree
 * in SSR) whenever it receives a src that is not an absolute http(s) URL, a
 * configured `loader` src, or a `/`-rooted public asset.
 *
 * We ingest image URLs from several untrusted sources — user-edited avatar /
 * cover URLs, mobile `ImagePicker` temp URIs (`file:///var/mobile/...`) that
 * slipped past client-side upload, scraped brand covers, etc. Any of these can
 * poison a list and crash the entire page.
 *
 * This helper is the single chokepoint: feed every user-controlled src through
 * it before passing to `<Image>` / `<FadeImage>`. It acts as a TypeScript type
 * guard so callers can keep using the narrowed string afterwards.
 *
 * Accepted:
 *   - `http://...`, `https://...`  (remote CDN / uploads)
 *   - `/foo.jpg`                   (public assets, excluding `//host` URLs)
 *
 * Rejected (anything next/image would refuse):
 *   - empty / undefined
 *   - `file://`, `data:`, `blob:`, `content://`, `ph://`, etc.
 *   - protocol-relative `//example.com/...`
 */
export function isRenderableImage(src?: string | null): src is string {
  if (!src) return false;
  const trimmed = src.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  return false;
}
