import { useEffect, useState } from "react";
import { Image } from "react-native";
import { isVideoUrl } from "../services/postService";

/**
 * In-memory aspect ratio cache keyed by URI.
 *
 * We share the map across all hook instances so each asset is measured at
 * most once per app session — important for the discover feed where the same
 * media URI may appear in several cards (e.g. cover + detail prefetch).
 */
const aspectRatioCache = new Map<string, number>();

/**
 * Publish a measured aspect ratio for `uri`. Any component that already knows
 * the real dimensions of a video (e.g. `VideoThumbnailView` after generating
 * a thumbnail) should call this so other consumers don't re-decode the same
 * asset. Subscribed hook instances pick up the update on their next render
 * via the cache, plus a light-weight pub/sub so mounted cards refresh live.
 */
const subscribers = new Map<string, Set<(r: number) => void>>();

export function rememberMediaAspectRatio(
  uri: string | null | undefined,
  width?: number,
  height?: number
): void {
  if (!uri || !width || !height) return;
  const ratio = width / height;
  if (!Number.isFinite(ratio) || ratio <= 0) return;
  aspectRatioCache.set(uri, ratio);
  subscribers.get(uri)?.forEach((fn) => fn(ratio));
}

/**
 * Synchronous read of the shared cache. Returns `undefined` if the URI has
 * not been measured yet. Useful for parents that need to arrange items into
 * a masonry layout based on their natural heights without subscribing to
 * per-item updates (column height balancing, placeholder sizing, etc.).
 */
export function peekMediaAspectRatio(
  uri: string | null | undefined
): number | undefined {
  if (!uri) return undefined;
  return aspectRatioCache.get(uri);
}

/**
 * Resolve `{ width, height }` of a cover image for the publish flow. Used
 * by `PublishXXXScreen` to populate `coverWidth` / `coverHeight` on the
 * create-post payload so the feed masonry has the aspect ratio up-front.
 *
 * Resolution order:
 *   1. `localDims` — the picker-level record the screen already keeps
 *      (keyed by local URI, populated from `asset.width/height` or
 *      `getVideoThumbnail`). Hits in-memory, zero cost.
 *   2. Shared aspect-ratio cache (`peekMediaAspectRatio`). If another screen
 *      already measured this URI we reuse it. We only know the ratio here,
 *      so `width` defaults to the ratio and `height` to 1 — the backend
 *      stores two integers but the frontend only ever uses `w/h` anyway.
 *   3. Asynchronous `Image.getSize` fallback. Returns `null` on failure;
 *      the caller should submit the post without the dims (server accepts
 *      NULL, feed falls back to 3/4).
 *
 * Returning `null` (rather than throwing) keeps the publish flow resilient:
 * we never block post creation just because a single cover failed to decode.
 */
export async function resolveCoverDimensions(
  uri: string | null | undefined,
  localDims?: Record<string, { width: number; height: number }>
): Promise<{ width: number; height: number } | null> {
  if (!uri) return null;

  const tracked = localDims?.[uri];
  if (tracked?.width && tracked?.height) {
    rememberMediaAspectRatio(uri, tracked.width, tracked.height);
    return { width: tracked.width, height: tracked.height };
  }

  const cachedRatio = aspectRatioCache.get(uri);
  if (cachedRatio && Number.isFinite(cachedRatio) && cachedRatio > 0) {
    // Reconstruct integer-ish dims from the ratio. The backend only uses
    // them as a ratio on the read path, so any {w, h} preserving the ratio
    // works; we pick h=1000 so both sides round to non-trivial integers.
    const height = 1000;
    const width = Math.round(cachedRatio * height);
    return { width, height };
  }

  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => {
        if (width > 0 && height > 0) {
          rememberMediaAspectRatio(uri, width, height);
          resolve({ width, height });
        } else {
          resolve(null);
        }
      },
      () => resolve(null)
    );
  });
}

/**
 * Resolve and return the natural aspect ratio (width / height) of an image
 * or video URI. While the real size is being measured, the `fallback` ratio
 * is returned so containers render at a sensible size immediately.
 *
 * - For images, `Image.getSize` is used directly.
 * - For videos, we DO NOT spawn an extra `getVideoThumbnail` pass from
 *   this hook. Every screen that renders a video cover already mounts a
 *   sibling `VideoThumbnailView` / `VideoPlayer`, and those components
 *   publish `{width, height}` into the shared aspect-ratio cache as soon
 *   as their decode finishes. Spawning a second decode here just doubled
 *   the load on iOS VideoToolbox and caused `err=-12900 / 操作已停止`
 *   cancel-storms under feed refresh.
 *
 *   Consumers still subscribe to the cache so the ratio updates in place
 *   the moment the sibling finishes — no visible regression for
 *   displayable videos, and legacy posts without `coverAspectRatio` now
 *   simply stay at the 3/4 fallback until a thumbnail is actually
 *   rendered, which is strictly better than thrashing the decoder pool.
 *
 * Safe to call with null/undefined/empty URIs — it just returns the fallback.
 *
 * @param knownRatio When provided and valid (finite, > 0), short-circuits the
 *   async measurement pipeline and returns this ratio directly. The hook
 *   still publishes it to the shared cache so other consumers reuse the
 *   same value. Used by feed cards where the backend already supplies
 *   `coverWidth` / `coverHeight`, avoiding per-scroll `Image.getSize` calls.
 */
export function useMediaAspectRatio(
  uri: string | null | undefined,
  fallback: number = 3 / 4,
  knownRatio?: number
): number {
  const hasKnownRatio =
    typeof knownRatio === "number" &&
    Number.isFinite(knownRatio) &&
    knownRatio > 0;

  // When the caller already knows the ratio up-front (feed covers since
  // 037), we skip `useState` entirely on the render path and return the
  // known value directly below. Keeping `ratio` state around is still
  // required for the async-measure / pub-sub branch, but in the hot feed
  // path we no longer pay a `setRatio` + re-render per cell recycle.
  const [ratio, setRatio] = useState<number>(() => {
    if (hasKnownRatio) return knownRatio as number;
    if (uri && aspectRatioCache.has(uri)) return aspectRatioCache.get(uri)!;
    return fallback;
  });

  useEffect(() => {
    if (hasKnownRatio) {
      // Seed the shared cache so any sibling card rendering the same URI
      // (e.g. detail screen prefetch) inherits the ratio without a decode.
      // Intentionally NO setState here — the render path returns
      // `knownRatio` directly so updating state would only trigger an
      // extra reconciliation per FlashList cell recycle.
      if (uri) aspectRatioCache.set(uri, knownRatio as number);
      return;
    }

    if (!uri) {
      setRatio(fallback);
      return;
    }

    const cached = aspectRatioCache.get(uri);
    if (cached) {
      setRatio(cached);
      return;
    }

    let cancelled = false;

    // Subscribe so if another component resolves this URI first (e.g.
    // `VideoThumbnailView` finishing its Android download-then-thumbnail
    // fallback), this hook instance picks up the ratio without re-decoding.
    const onResolved = (r: number) => {
      if (!cancelled) setRatio(r);
    };
    const set = subscribers.get(uri) ?? new Set();
    set.add(onResolved);
    subscribers.set(uri, set);

    const apply = (w?: number, h?: number) => {
      if (cancelled) return;
      rememberMediaAspectRatio(uri, w, h);
    };

    if (isVideoUrl(uri)) {
      // No direct decode here — the sibling video component will call
      // `rememberMediaAspectRatio` and our subscription above will pick
      // up the real ratio. Keeps the fallback until then.
    } else {
      Image.getSize(uri, apply, () => {
        /* ignore — keep fallback */
      });
    }

    return () => {
      cancelled = true;
      const s = subscribers.get(uri);
      if (!s) return;
      s.delete(onResolved);
      if (s.size === 0) subscribers.delete(uri);
    };
  }, [uri, fallback, hasKnownRatio, knownRatio]);

  // Feed-hot path: return the known ratio verbatim so recycled cells don't
  // transiently render with a stale value. The `ratio` state is only read
  // when the caller didn't provide `knownRatio`.
  return hasKnownRatio ? (knownRatio as number) : ratio;
}

/**
 * Clamp an aspect ratio into sensible display bounds so a single extreme
 * asset (ultra-wide screenshot, very tall poster) doesn't blow out the
 * surrounding layout. Defaults mirror the most common photo ratios —
 * 3:4 portrait up to 16:9 landscape — matching feed/detail design guidance.
 */
export function clampAspectRatio(
  ratio: number,
  min: number = 3 / 4,
  max: number = 16 / 9
): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return min;
  return Math.max(min, Math.min(max, ratio));
}
