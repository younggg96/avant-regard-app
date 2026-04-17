import * as VideoThumbnails from "expo-video-thumbnails";

/**
 * Extract the first frame of a video as a thumbnail image.
 * Returns the local URI of the generated thumbnail, or null on failure.
 */
export async function getVideoThumbnail(
  videoUri: string,
  timeMs: number = 0
): Promise<string | null> {
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: timeMs,
      quality: 0.8,
    });
    return uri;
  } catch (error) {
    console.log("Failed to generate video thumbnail:", error);
    return null;
  }
}
