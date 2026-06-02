/**
 * Upload-time image compression.
 *
 * Users routinely pick photos straight from the camera roll — iPhone HEIC
 * shots commonly weigh in at 3–10 MB and Android JPEGs at 2–6 MB. Storing
 * and serving those originals turns feed scrolls into minutes-long blank
 * screens (see PROGRESS_LOG: image-loading optimisation).
 *
 * This module resizes + recompresses on the device before the upload leaves
 * the phone, so both storage cost and download latency shrink by ~10×. The
 * settings are intentionally conservative: the long edge is clamped to
 * 1600 px (above that extra pixels are imperceptible on mobile) and JPEG
 * quality is 0.8 (visually lossless for photography workloads).
 *
 * Why a dedicated module (instead of inlining in `postService.uploadImage`)?
 *  - `ImageCropper` / `BatchImageCropper` already pay a manipulator pass
 *    when the user crops, so future work can skip the second pass for
 *    already-cropped inputs by calling `shouldCompress(uri)` first.
 *  - Keeps the publish screens agnostic to file-format quirks: HEIC inputs
 *    silently become JPEG here so the backend / Storage never has to deal
 *    with a format that browsers and `expo-image` struggle to decode.
 */

import * as ImageManipulator from "expo-image-manipulator";

/**
 * Target long-edge, in pixels. Anything larger is scaled down keeping the
 * original aspect ratio. 1600 px covers:
 *  - 1x full-screen portrait on every shipping iPhone / Android flagship
 *    (max physical width ~480 dp × 3x DPR = 1440 px)
 *  - full-screen "LARGE" preset consumers (see `imageUtils.ts`, 1440 px)
 *  - the `PostDetail` fullscreen viewer which up-scales to device width
 */
const MAX_LONG_EDGE = 1600;

/**
 * JPEG quality used for the re-encode. 0.8 is the inflection point on the
 * quality-vs-size curve for libjpeg: going higher barely improves perceived
 * quality but can double file size; going lower starts to show blocking in
 * smooth gradients (skin, sky, fabric).
 */
const JPEG_QUALITY = 0.8;

/**
 * File extensions that the Storage bucket / `expo-image` decoder both
 * accept directly. HEIC is deliberately excluded — see `compressImage`.
 */
const NATIVELY_SUPPORTED = new Set(["jpg", "jpeg", "png", "webp"]);

function extractExtension(uri: string): string {
  const path = uri.split("?")[0].split("#")[0];
  const filename = path.split("/").pop() || "";
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Returns the extension portion we'd like to emit. We always re-encode to
 * JPEG because:
 *  - It is universally supported (HEIC is not in React Native Image / older
 *    browsers, PNG is 3–5× larger for photography, WebP would gate us on
 *    platform-specific encoders in `expo-image-manipulator`).
 *  - Storage's on-the-fly `render/image` endpoint will still emit WebP to
 *    modern clients regardless of the source format, so JPEG-on-disk does
 *    not give up WebP-on-wire.
 */
function targetExtension(_sourceExt: string): "jpg" {
  return "jpg";
}

/**
 * The heavy lifting: run one manipulator pass that both resizes and
 * re-encodes. `expo-image-manipulator` composes actions into a single
 * native call, so splitting resize / compress into two awaits would only
 * double I/O for no benefit.
 *
 * If the source is already small enough (<= MAX_LONG_EDGE on both axes)
 * AND natively supported, we still run a compress-only pass because
 * re-encoding a 5 MB over-sharpened JPEG with quality 0.8 still buys a
 * 30–50% size reduction — much cheaper than downloading the original on
 * every feed mount.
 */
export async function compressImage(uri: string): Promise<{
  uri: string;
  width: number;
  height: number;
}> {
  // Probe dimensions via a no-op manipulation — this is cheap (no
  // re-encode) and lets us skip the resize action when the source is
  // already within bounds, saving a full decode pass on small inputs.
  const probe = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 1,
    base64: false,
  });

  const actions: ImageManipulator.Action[] = [];
  const longEdge = Math.max(probe.width, probe.height);
  if (longEdge > MAX_LONG_EDGE) {
    const scale = MAX_LONG_EDGE / longEdge;
    actions.push({
      resize: {
        width: Math.round(probe.width * scale),
        height: Math.round(probe.height * scale),
      },
    });
  }

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return { uri: result.uri, width: result.width, height: result.height };
}

/**
 * Bake the EXIF orientation flag into the actual pixels.
 *
 * iOS / many Android cameras store a photo's "which way is up" as an EXIF
 * `Orientation` tag instead of physically rotating the pixel buffer. When a
 * user straightens a sideways/upside-down shot in the system Photos app, the
 * edit often only flips that tag too. Our upload path streams the raw file
 * bytes straight to Storage, and several of our consumers (and some web
 * browsers) ignore the orientation tag — so the buyer ends up seeing the
 * pre-rotation, upside-down frame even though the seller "fixed" it.
 *
 * Running a single `expo-image-manipulator` pass re-encodes the image with the
 * orientation already applied to the pixels (output orientation = normal), so
 * every downstream viewer renders it the same way the seller saw it. This is
 * intentionally a no-resize, max-quality pass: detail shots (brand / care
 * labels) must stay crisp, and the listing upload does not otherwise compress.
 *
 * Failures are swallowed (returns the original uri) — a manipulator hiccup must
 * never block the seller from uploading.
 */
export async function normalizeImageOrientation(uri: string): Promise<string> {
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  try {
    const result = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return result.uri;
  } catch (error) {
    console.warn(
      "[imageCompression] orientation normalize failed, using original:",
      error,
    );
    return uri;
  }
}

/**
 * High-level entry point used by `postService.uploadImage`. Wraps
 * `compressImage` with:
 *  - a remote-URL short-circuit (the caller may pass an already-uploaded
 *    URL, e.g. when re-publishing a draft whose images are already on
 *    Storage — nothing to compress, return as-is).
 *  - conservative error handling: a compression failure must never block
 *    publishing; we fall back to the original URI and let the upload
 *    proceed.
 */
export async function compressBeforeUpload(uri: string): Promise<{
  uri: string;
  filename: string;
  mimeType: "image/jpeg";
}> {
  const ext = extractExtension(uri);

  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    return {
      uri,
      filename: uri.split("/").pop() || "image.jpg",
      mimeType: "image/jpeg",
    };
  }

  const baseName =
    (uri.split("/").pop() || "image").replace(/\.[^.]+$/, "") || "image";
  const outExt = targetExtension(ext);
  const outFilename = `${baseName}.${outExt}`;

  try {
    const compressed = await compressImage(uri);
    return {
      uri: compressed.uri,
      filename: outFilename,
      mimeType: "image/jpeg",
    };
  } catch (error) {
    // We deliberately do NOT rethrow — a manipulator failure (HEIC edge
    // cases, out-of-memory on ancient devices, permission quirks) should
    // still let the user publish with the original bytes. The network-
    // level slowdown is recoverable; a hard publish failure is not.
    console.warn(
      "[imageCompression] compress failed, uploading original:",
      error,
    );
    const originalName =
      uri.split("/").pop() || `image.${NATIVELY_SUPPORTED.has(ext) ? ext : "jpg"}`;
    return {
      uri,
      filename: originalName,
      mimeType: "image/jpeg",
    };
  }
}
