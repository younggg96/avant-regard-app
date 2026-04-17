import { useEffect, useState } from "react";
import { Image } from "react-native";
import { isVideoUrl } from "../services/postService";
import { getVideoThumbnail } from "./videoThumbnail";

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
 * Resolve and return the natural aspect ratio (width / height) of an image
 * or video URI. While the real size is being measured, the `fallback` ratio
 * is returned so containers render at a sensible size immediately.
 *
 * - For images, `Image.getSize` is used directly.
 * - For videos, a first-frame thumbnail is extracted via
 *   `getVideoThumbnail`, which also surfaces the natural pixel size from
 *   expo-video-thumbnails (no extra image decode required).
 *
 * Safe to call with null/undefined/empty URIs — it just returns the fallback.
 */
export function useMediaAspectRatio(
  uri: string | null | undefined,
  fallback: number = 3 / 4
): number {
  const [ratio, setRatio] = useState<number>(() => {
    if (uri && aspectRatioCache.has(uri)) return aspectRatioCache.get(uri)!;
    return fallback;
  });

  useEffect(() => {
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
      (async () => {
        const thumb = await getVideoThumbnail(uri);
        apply(thumb?.width, thumb?.height);
      })();
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
  }, [uri, fallback]);

  return ratio;
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
