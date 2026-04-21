import * as VideoThumbnails from "expo-video-thumbnails";

/**
 * Thumbnail result: the extracted still frame plus its pixel size.
 * Width / height come straight from expo-video-thumbnails and reflect the
 * source video's natural dimensions, so callers can use them to drive
 * aspect-ratio-aware layouts without re-decoding the image.
 */
export interface VideoThumbnail {
  uri: string;
  width: number;
  height: number;
}

/**
 * iOS VideoToolbox only has a small pool of hardware decoders; when a feed
 * mounts a dozen video covers at once every concurrent `generateCGImages`
 * beyond that pool gets cancelled by AVFoundation with
 *   `[VideoToolbox] (Fig) signalled err=-12900` / `Error: 操作已停止`.
 * Those failures then leave the feed stuck on the 3/4 placeholder ratio
 * and, under heavy load, make the UI appear frozen while native callbacks
 * drain.
 *
 * We serialise thumbnail work through a tiny semaphore (2 concurrent is a
 * sweet spot on real devices — enough to hide per-frame latency, not so
 * many that we saturate the decoder pool) and dedupe by URI so multiple
 * callers (e.g. `PostCard` + `VideoThumbnailView` for the same cover) share
 * a single AVAsset pass.
 */
const MAX_CONCURRENT_THUMBNAILS = 2;
let activeThumbnailCount = 0;
const pendingThumbnailQueue: Array<() => void> = [];

const inflightThumbnails = new Map<string, Promise<VideoThumbnail | null>>();
// URIs that have already failed this session. Retrying them only adds to
// the VideoToolbox storm — callers fall back to the placeholder instead.
const failedThumbnailUris = new Set<string>();

function acquireThumbnailSlot(): Promise<void> {
  if (activeThumbnailCount < MAX_CONCURRENT_THUMBNAILS) {
    activeThumbnailCount += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    pendingThumbnailQueue.push(() => {
      activeThumbnailCount += 1;
      resolve();
    });
  });
}

function releaseThumbnailSlot(): void {
  activeThumbnailCount -= 1;
  const next = pendingThumbnailQueue.shift();
  if (next) next();
}

function thumbnailCacheKey(videoUri: string, timeMs: number): string {
  return `${videoUri}@${timeMs}`;
}

/**
 * Extract the first frame of a video as a thumbnail image.
 * Returns the local URI and natural pixel size, or null on failure.
 *
 * Concurrent callers for the same `(videoUri, timeMs)` share one decode
 * pass, and URIs that already failed this session short-circuit to `null`
 * without re-hitting VideoToolbox.
 */
export async function getVideoThumbnail(
  videoUri: string,
  timeMs: number = 0
): Promise<VideoThumbnail | null> {
  const key = thumbnailCacheKey(videoUri, timeMs);

  if (failedThumbnailUris.has(key)) return null;

  const existing = inflightThumbnails.get(key);
  if (existing) return existing;

  const task = (async () => {
    await acquireThumbnailSlot();
    try {
      const { uri, width, height } = await VideoThumbnails.getThumbnailAsync(
        videoUri,
        {
          time: timeMs,
          quality: 0.8,
        }
      );
      return { uri, width, height };
    } catch (error) {
      failedThumbnailUris.add(key);
      console.log("Failed to generate video thumbnail:", error);
      return null;
    } finally {
      inflightThumbnails.delete(key);
      releaseThumbnailSlot();
    }
  })();

  inflightThumbnails.set(key, task);
  return task;
}
