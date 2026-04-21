import React from "react";
import { View, StyleProp, ViewStyle, ImageStyle } from "react-native";

import { OptimizedImage } from "./ui/OptimizedImage";
import { VideoThumbnailView } from "./VideoThumbnailView";
import { isVideoUrl } from "../services/postService";
import { ImageSize } from "../utils/imageUtils";

// Feed callers typically build a layout style object with `width`,
// `aspectRatio`, and `backgroundColor` — all valid in both ViewStyle and
// ImageStyle. Using the intersection keeps the prop permissive for both
// the `<View>` wrapper branch (video) and `<OptimizedImage>` branch.
type PostCoverStyle = StyleProp<ViewStyle & ImageStyle>;

interface PostCoverMediaProps {
  uri: string;
  style?: PostCoverStyle;
  size?: ImageSize;
  contentFit?: "cover" | "contain";
  /**
   * Optional priority override. Leave undefined to keep the default
   * "normal" priority that's correct for feed covers. Set to "high" only
   * for single-cover, full-screen contexts (e.g. post detail hero).
   */
  priority?: "low" | "normal" | "high";
}

/**
 * Unified cover renderer for a post's first media URI.
 *
 * `OptimizedImage` cannot decode `.mp4` URIs, so feeds that rendered video
 * posts with it directly (BrandDetail posts grid, legacy screens, etc.)
 * ended up showing a gray placeholder. This component encapsulates the
 * image-vs-video branch so callers only deal with a single URI + style
 * and every feed shares the same video-thumbnail pipeline (with its
 * aspect-ratio cache).
 *
 * Priority note:
 *   Cover images are the primary visual payload of a feed card, so this
 *   component intentionally does NOT set `lazy={true}` on the underlying
 *   `OptimizedImage`. Earlier versions did, which made expo-image schedule
 *   covers behind avatars and icons — manifesting as a grid of gray
 *   placeholders while a single image loaded at a time. If a caller has
 *   an off-screen / low-priority use case, pass `priority="low"`
 *   explicitly rather than bringing back the `lazy` knob.
 */
export const PostCoverMedia: React.FC<PostCoverMediaProps> = ({
  uri,
  style,
  size = ImageSize.MEDIUM,
  contentFit = "cover",
  priority,
}) => {
  if (isVideoUrl(uri)) {
    return (
      <View style={style as StyleProp<ViewStyle>}>
        <VideoThumbnailView
          uri={uri}
          style={{ width: "100%", height: "100%" }}
        />
      </View>
    );
  }

  return (
    <OptimizedImage
      uri={uri}
      size={size}
      style={style as StyleProp<ImageStyle>}
      contentFit={contentFit}
      priority={priority}
    />
  );
};

export default PostCoverMedia;
