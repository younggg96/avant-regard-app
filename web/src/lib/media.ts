/**
 * Media type helpers shared across web components.
 *
 * The backend stores images and videos together in `Post.imageUrls` (a single
 * string[] field) and distinguishes them purely by file extension. This mirror
 * of the app-side helper (`frontend/src/services/postService.ts#isVideoUrl`)
 * MUST keep the extension set in sync — if you add a new video format on one
 * side, add it on the other.
 */

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "avi"]);

export function isVideoUrl(uri: string | undefined | null): boolean {
  if (!uri) return false;
  const clean = uri.split("?")[0].split("#")[0];
  const ext = clean.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXTENSIONS.has(ext);
}

/**
 * Append a `#t=0.1` media fragment so browsers render the first frame as a
 * still when `preload="metadata"` is respected (Chrome, Safari, Firefox).
 * Idempotent: if the URL already has `#t=`, it is returned unchanged.
 */
export function withPosterFragment(url: string): string {
  return url.includes("#t=") ? url : `${url}#t=0.1`;
}
