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
 * Extract the first frame of a video as a thumbnail image.
 * Returns the local URI and natural pixel size, or null on failure.
 */
export async function getVideoThumbnail(
  videoUri: string,
  timeMs: number = 0
): Promise<VideoThumbnail | null> {
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
    console.log("Failed to generate video thumbnail:", error);
    return null;
  }
}
