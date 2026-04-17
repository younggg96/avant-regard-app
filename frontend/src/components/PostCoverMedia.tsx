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
  lazy?: boolean;
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
 */
export const PostCoverMedia: React.FC<PostCoverMediaProps> = ({
  uri,
  style,
  size = ImageSize.MEDIUM,
  contentFit = "cover",
  lazy = true,
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
      lazy={lazy}
    />
  );
};

export default PostCoverMedia;
