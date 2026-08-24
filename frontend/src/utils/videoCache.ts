import * as FileSystem from "expo-file-system";

const VIDEO_EXTS = new Set(["mp4", "mov", "m4v", "webm", "avi"]);

/**
 * Supabase/MemFire public URLs sometimes end with a trailing `?`.
 */
export function cleanVideoUri(uri: string): string {
  return uri.endsWith("?") ? uri.slice(0, -1) : uri;
}

/**
 * Preserve the real container extension (.mov / .mp4 / …).
 * AVPlayer on device uses the file extension to pick a demuxer, so forcing
 * `.mp4` for QuickTime uploads breaks TestFlight / App Store playback.
 */
export function getVideoExtension(uri: string): string {
  const path = uri.split("?")[0].split("#")[0];
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return VIDEO_EXTS.has(ext) ? ext : "mp4";
}

function cacheKey(uri: string): string {
  return uri.replace(/[^a-zA-Z0-9]/g, "_").slice(-80);
}

export function getCachedVideoPath(uri: string): string {
  const clean = cleanVideoUri(uri);
  const ext = getVideoExtension(clean);
  return `${FileSystem.cacheDirectory}video_cache/${cacheKey(clean)}.${ext}`;
}

/**
 * Download a remote video into the local cache, keeping its original
 * extension. Returns the local file URI, or null on failure.
 */
export async function ensureCachedVideo(uri: string): Promise<string | null> {
  const clean = cleanVideoUri(uri);
  const cacheDir = `${FileSystem.cacheDirectory}video_cache/`;
  const dirInfo = await FileSystem.getInfoAsync(cacheDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
  }

  const dest = getCachedVideoPath(clean);
  const fileInfo = await FileSystem.getInfoAsync(dest);
  if (fileInfo.exists) return dest;

  const result = await FileSystem.downloadAsync(clean, dest);
  if (result.status === 200) return result.uri;
  return null;
}
